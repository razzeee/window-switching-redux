# GNOME Shell 50 custom window switcher APIs

Research date: 2026-08-12. Target: GNOME Shell/Mutter 50. The documentation site currently renders API version 51, so exported API signatures below were cross-checked against the `50.0` source tag. GNOME Shell JavaScript links are pinned to `50.0` wherever possible.

## Executive recommendation

For a Shell 50 extension that replaces the behavior reached by the default `<Alt>Tab` and `<Super>Tab` accelerators without changing the user's shortcut settings:

1. Override the built-in `switch-applications` and `switch-applications-backward` handlers with exported Mutter API `Meta.keybindings_set_custom_handler(name, handler)`. Both default forward accelerators belong to `switch-applications`; both Shift variants belong to `switch-applications-backward`.
2. On disable, restore Shell's handler with `Main.wm.setCustomKeybindingHandler(name, Shell.ActionMode.NORMAL, Main.wm._startSwitcher.bind(Main.wm))`, matching Shell 50 initialization. Passing `null` to `Meta.keybindings_set_custom_handler()` does **not** restore Shell's custom switcher; it falls back to Mutter's built-in handler. Restoration through `Main.wm` is therefore Shell-private and is the largest unavoidable risk of replacing a built-in binding.
3. Obtain candidates with `global.display.get_tab_list(Meta.TabList.NORMAL_ALL_MRU, workspaceOrNull)` if strict MRU is required, or `NORMAL_ALL` to match Shell 50's stock popup (unminimized MRU first, minimized MRU last). Use the active workspace when the relevant current-workspace preference is true, otherwise `null`. Neither form filters by monitor, so all monitors are included.
4. Map each `Meta.Window` using `Shell.WindowTracker.get_default().get_window_app(window)`. Keep windows as the primary entries because mapping may return `null`.
5. Build a reactive `St.Widget`, add it to `Main.uiGroup`, and use `Main.pushModal(actor)` / `Main.popModal(grab)` with actor key vfuncs. These modal functions and Shell modules are internal JavaScript API; copying the small modal protocol into an extension is not viable because it coordinates Shell-global focus/action-mode state.
6. Render live previews using `new Clutter.Clone({source: window.get_compositor_private()})`, guarding a `null` actor. Prefer clones over transforming or reparenting the real `Meta.WindowActor`. Listen to `Meta.Window::unmanaged` for candidate removal and optionally the actor's `destroy` signal to invalidate a clone promptly.
7. Destroy an active popup before restoring handlers. Popup destruction must pop its modal grab, disconnect signals, remove sources/transitions, and destroy clones/widgets. Then restore both keybindings and clear references in `disable()`.

## 1. Which bindings cover Alt+Tab and Super+Tab

The GNOME 50 desktop keybinding schema defines:

| Binding name | Default accelerators | Direction |
|---|---|---|
| `switch-applications` | `<Super>Tab`, `<Alt>Tab` | forward |
| `switch-applications-backward` | `<Shift><Super>Tab`, `<Shift><Alt>Tab` | backward |

Thus, replacing those two *binding names* replaces both Alt and Super variants and preserves user-rebound accelerators. Do not add separate hardcoded Alt/Super grabs unless the intended behavior is to ignore the user's GNOME keybinding configuration.

Sources: [GNOME 50 keybinding schema](https://gitlab.gnome.org/GNOME/gsettings-desktop-schemas/-/blob/50.0/schemas/org.gnome.desktop.wm.keybindings.gschema.xml.in), [Shell 50 registration](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/windowManager.js#L690-712).

## 2. Replacing and restoring the built-in handler

### Exact exported API

Mutter exports:

```c
gboolean meta_keybindings_set_custom_handler (
    const gchar        *name,
    MetaKeyHandlerFunc  handler,
    gpointer            user_data,
    GDestroyNotify      free_data);
```

In GJS this is exposed as:

```js
Meta.keybindings_set_custom_handler(name, handler)
```

The callback shape exposed to JavaScript is the same shape Shell 50 uses:

```js
(display, window, event, binding) => {}
```

`binding` is a `Meta.KeyBinding`; relevant methods are:

```js
binding.get_name()
binding.is_reversed()
binding.get_mask()
binding.get_modifiers()
```

`Meta.keybindings_set_custom_handler()` returns `true` if `name` is a known built-in binding. It replaces only the handler, not the configured accelerator. Mutter stores the original built-in callback as `default_func`; setting the custom handler to `null` makes invocation fall back to that Mutter callback.

Sources: [Mutter 50 implementation](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/core/keybindings.c#L2522-2553), [Mutter API declaration](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/meta/keybindings.h#L41-46), [handler callback signature](https://gnome.pages.gitlab.gnome.org/mutter/meta/callback.KeyHandlerFunc.html), [`Meta.KeyBinding`](https://gnome.pages.gitlab.gnome.org/mutter/meta/struct.KeyBinding.html).

### Shell wrapper and action mode

GNOME Shell 50's `WindowManager.setCustomKeybindingHandler()` is:

```js
setCustomKeybindingHandler(name, modes, handler) {
    if (Meta.keybindings_set_custom_handler(name, handler))
        this.allowKeybinding(name, modes);
}
```

Shell registers the application switcher names with `Shell.ActionMode.NORMAL` and `this._startSwitcher.bind(this)`. Using this wrapper is convenient because Shell's compositor filters keybindings through `Main.wm._allowedKeybindings` according to `Main.actionMode`.

Recommended enable operation for Shell 50:

```js
Main.wm.setCustomKeybindingHandler(
    'switch-applications', Shell.ActionMode.NORMAL, handler);
Main.wm.setCustomKeybindingHandler(
    'switch-applications-backward', Shell.ActionMode.NORMAL, handler);
```

Sources: [Shell 50 wrapper](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/windowManager.js#L1073-1089), [Shell 50 registrations](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/windowManager.js#L690-712), [Mutter filter/invocation path](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/core/keybindings.c).

### Restoration semantics

There is no exported "restore the previous custom handler" stack. Each call overwrites the single current handler. In Shell 50, correct restoration of stock GNOME Shell behavior is therefore:

```js
const stockHandler = Main.wm._startSwitcher.bind(Main.wm);
Main.wm.setCustomKeybindingHandler(
    'switch-applications', Shell.ActionMode.NORMAL, stockHandler);
Main.wm.setCustomKeybindingHandler(
    'switch-applications-backward', Shell.ActionMode.NORMAL, stockHandler);
```

Important consequences:

- `Meta.keybindings_set_custom_handler(name, null)` restores Mutter's lower-level `handle_switch`, not GNOME Shell's `AltTab.AppSwitcherPopup`, because Shell itself had replaced Mutter's built-in callback during startup.
- `global.display.remove_keybinding()` is not the restoration API here. Mutter documents it for bindings previously added with `Meta.Display.add_keybinding()`, while these are built-in schema bindings.
- The official `InjectionManager` cannot help: it restores JavaScript methods, whereas this mutation changes a callback retained inside Mutter.
- Extensions overriding the same names are last-writer-wins. Disabling this extension can overwrite another extension's later handler with stock Shell behavior because no getter exposes the previous callback. This conflict cannot be solved robustly with current public APIs.

Sources: [Mutter handler storage/fallback](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/core/keybindings.c#L2535-2552), [`Meta.Display.remove_keybinding()` contract](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.Display.html), [official `InjectionManager` docs](https://gjs.guide/extensions/topics/extension.html#injectionmanager).

### Alternative: add extension-owned bindings

`Main.wm.addKeybinding(name, settings, flags, modes, handler)` wraps `global.display.add_keybinding()`, and cleanup is `Main.wm.removeKeybinding(name)`. This is the documented runtime-binding pair, but it cannot claim `<Alt>Tab`/`<Super>Tab` while the built-in binding already owns those combinations, and disabling/rebinding the user's GNOME settings would be invasive. It is suitable only if the extension uses its own non-conflicting configurable shortcuts.

Sources: [Shell 50 wrapper](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/windowManager.js#L1078-1089), [`Meta.Display.add_keybinding()`](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.Display.html).

## 3. MRU windows, workspaces, and monitors

### Exact API

```js
global.display.get_tab_list(type, workspace)
```

This is introspected `Meta.Display.get_tab_list(Meta.TabList type, Meta.Workspace? workspace) -> Meta.Window[]`. Mutter states that the result is in MRU order. Passing a workspace limits the list to windows on that workspace, plus windows on other workspaces that demand attention; passing `null` includes all workspaces.

For strict window MRU:

```js
const settings = new Gio.Settings({
    schema_id: 'org.gnome.shell.window-switcher',
});
const workspace = settings.get_boolean('current-workspace-only')
    ? global.workspace_manager.get_active_workspace()
    : null;
const windows = global.display.get_tab_list(
    Meta.TabList.NORMAL_ALL_MRU, workspace);
```

For exact stock Shell 50 candidate behavior, use `Meta.TabList.NORMAL_ALL`, then map attached dialogs to their parent and remove `skip_taskbar` windows and duplicates. Shell's helper is module-private (`getWindows()` is not exported), so an extension must reproduce that small policy deliberately rather than import it:

```js
const windows = global.display
    .get_tab_list(Meta.TabList.NORMAL_ALL, workspace)
    .map(w => w.is_attached_dialog() ? w.get_transient_for() : w)
    .filter((w, i, all) => !w.skip_taskbar && all.indexOf(w) === i);
```

Sources: [Mutter 50 tab-list implementation](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/core/display.c#L1844-1922), [Mutter 50 enum declaration](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/meta/display.h#L27-42), [Shell 50 `getWindows()` and `_getWindowList()`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/altTab.js), [Shell 50 switcher schemas](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/data/org.gnome.shell.gschema.xml.in).

### `NORMAL_ALL` versus `NORMAL_ALL_MRU`

In Mutter 50:

- `NORMAL_ALL_MRU` accepts all non-dock/non-desktop window types in pure MRU order. It does **not** apply the `skip_taskbar` exclusion in `in_tab_chain()`.
- `NORMAL_ALL` accepts the same broad type set but places all unminimized windows first and minimized windows last, preserving MRU within each partition.
- Shell 50 uses `NORMAL_ALL`, then excludes `skip_taskbar` after resolving attached dialogs. Therefore "match stock Shell" and "strict MRU" are distinct choices.

### Current-workspace preference

Two stock settings exist:

- `org.gnome.shell.app-switcher::current-workspace-only`, default `false`, used by the stock app switcher behind Alt/Super+Tab.
- `org.gnome.shell.window-switcher::current-workspace-only`, default `true`, used by the stock per-window switcher.

A replacement for `switch-applications` should normally respect the **app-switcher** preference even if it presents individual windows. If the product explicitly means "window switcher semantics", use the window-switcher preference and document that behavioral change.

### All monitors

`get_tab_list()` takes no monitor argument. Mutter builds its global list from every managed window and filters only by tab-chain type and optional workspace. Do not filter on `window.get_monitor()`; leaving the result intact includes every monitor. A sticky window qualifies on the active workspace through Mutter's workspace membership logic.

## 4. Mapping `Meta.Window` to `Shell.App`

Use the exported Shell library singleton:

```js
const tracker = Shell.WindowTracker.get_default();
const app = tracker.get_window_app(window); // Shell.App or null
```

`Shell.WindowTracker` owns the window-to-application association and uses desktop-file IDs plus platform heuristics. The stock Shell switcher uses exactly this lookup when grouping MRU windows under running apps. Do not infer apps manually from WM class, PID, or GTK application ID.

Treat `null` as valid. A custom switcher can show a generic executable icon/title while retaining the `Meta.Window`; dropping unmapped windows changes the candidate list.

Sources: [`Shell.WindowTracker` API](https://gnome.pages.gitlab.gnome.org/gnome-shell/shell/class.WindowTracker.html), [Shell 50 app grouping](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/altTab.js).

## 5. Activating a selected window

### Direct exported API

```js
window.activate(timestamp);
```

`Meta.Window.activate(guint32 timestamp)` is the direct platform API. Use the triggering event's time when available (`event.get_time()`), otherwise `global.get_current_time()` as Shell 50 does. Direct activation alone does not explicitly switch to another workspace.

### Shell helper with workspace switching

Shell 50 exports:

```js
Main.activateWindow(window, time, workspaceNum)
```

It determines the target workspace, calls `workspace.activate_with_focus(window, time)` when needed or `window.activate(time)` on the current workspace, then hides the overview and closes the calendar. This is the closest match to stock switcher completion.

If an associated app exists, `app.activate_window(window, timestamp)` is another exported C API, but it raises all app windows while ensuring the selected one is on top; that is not identical to activating only the chosen window.

Sources: [Shell 50 `Main.activateWindow()`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/main.js#L669-692), [`Meta.Window` API](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.Window.html), [`Shell.App.activate_window()`](https://gnome.pages.gitlab.gnome.org/gnome-shell/shell/method.App.activate_window.html).

Recommendation: use `Main.activateWindow()` for stock cross-workspace behavior. It is exported from a Shell JavaScript module but is not a version-stable extension API; pin the extension to Shell 50 and retest each Shell release.

## 6. Modal keyboard handling

The stock `SwitcherPopup` protocol in Shell 50 is the reference implementation:

1. Create a `reactive: true` `St.Widget` and add it to `Main.uiGroup`.
2. Call `const grab = Main.pushModal(actor)`. The default action mode is `Shell.ActionMode.NONE`, filtering global keybindings while the switcher handles input.
3. Handle `vfunc_key_press_event(event)` and `vfunc_key_release_event(event)`, returning `Clutter.EVENT_STOP` for consumed input.
4. In the initial keybinding callback, use `binding.is_reversed()`, `binding.get_name()`, and `binding.get_mask()`.
5. Reduce `binding.get_mask()` to the primary modifier (Shell chooses the highest set bit), and finish when that modifier is no longer present. Shell checks current modifier state with `global.get_pointer()` both immediately after grabbing and on key release to cover an Alt-release race.
6. Call `Main.popModal(grab)` exactly once before or during destruction. Shell also auto-pops if the grabbed actor is destroyed, but explicit ownership is clearer and avoids retaining an active grab during fade-out.

`Main.pushModal()` calls `global.stage.grab(actor)`, disables unredirect for the first modal, records/restores keyboard focus and `Main.actionMode`, and returns a `Clutter.Grab`. `Main.popModal(grab)` dismisses that grab and unwinds Shell's modal/focus stack. Calling `grab.dismiss()` directly would bypass Shell's stack accounting and is incorrect.

Sources: [Shell 50 `SwitcherPopup.show()` and key vfuncs](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/switcherPopup.js), [Shell 50 `pushModal()` / `popModal()`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/main.js#L532-663), [Shell 50 `_startSwitcher()` binding arguments](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/windowManager.js#L1642-1679).

Risks and edge cases:

- `Main.pushModal`, `Main.popModal`, `Main.uiGroup`, `Main.actionMode`, and `global.get_pointer()` are Shell internals, despite being exported/available to extensions.
- If a popup is already active when another binding fires, update/cycle that popup or destroy it before constructing another; never stack accidental grabs.
- Destroy the popup when `Main.layoutManager` emits `system-modal-opened`, as stock `SwitcherPopup` does, so authentication/system dialogs take precedence.
- Releasing Alt/Super before `pushModal()` succeeds is a real race; perform the immediate modifier-state check after selecting the initial item.

## 7. Window actors, clones, and transforms

### Obtaining the source actor

```js
const actor = window.get_compositor_private(); // Meta.WindowActor or null
```

The introspected API describes this as the compositor wrapper for the `Meta.Window`. It can be `null`, notably if no compositor actor is available or the window is being torn down. `Meta.WindowActor` is a `Clutter.Actor`, so normal actor geometry/transformation methods are available.

Sources: [`Meta.Window.get_compositor_private()` and `Meta.WindowActor`](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.Window.html), [`Meta.WindowActor` API](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.WindowActor.html).

### Live clone

Shell 50 creates previews with:

```js
const clone = new Clutter.Clone({
    source: actor,
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    x_align: Clutter.ActorAlign.CENTER,
    y_align: Clutter.ActorAlign.CENTER,
    x_expand: true,
    y_expand: true,
});
```

The clone source remains the real actor; destroying the clone does not destroy the window actor. Mutter tracks mapped clones, which keeps cloned windows effectively visible for compositor/suspend-state purposes. Therefore create clones only while the switcher is displayed and destroy them promptly.

Source: [Shell 50 `_createWindowClone()` and `WindowIcon`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/altTab.js), [Mutter 50 clone tracking](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/compositor/meta-window-actor.c#L110-136).

### Snapshot alternative

`Meta.WindowActor.paint_to_content(rect)` returns content that Shell 50 places on an `St.Widget` for resize animations. A snapshot avoids a continuously live clone but becomes stale and depends on actor availability/content capture. It is useful only if live previews are undesirable.

Source: [Shell 50 resize snapshot](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/windowManager.js).

### Transforming real actors

Although a `Meta.WindowActor` inherits writable Clutter transforms (`translation_x/y`, `scale_x/y`, `opacity`, `ease()`), changing the real actor for switcher presentation is high risk:

- It modifies compositor-owned state also used by workspace/window animations.
- Every property and transition must be restored on all exit paths, including disable, window destruction, interrupted animation, and system modal opening.
- Reparenting a window actor is especially unsafe because Shell/Mutter expect it in compositor-managed groups.

Prefer clones. If the visual design absolutely requires manipulating real actors, record each original property, call `remove_all_transitions()` during teardown, restore properties before destroying UI, and treat the feature as private implementation coupling.

## 8. Reacting to window closure

Use the `Meta.Window::unmanaged` signal as the authoritative candidate-lifetime event:

```js
window.connectObject('unmanaged', () => removeWindow(window), owner);
```

Shell 50's `WindowSwitcher` does exactly this, removes the corresponding icon, and disconnects with `window.disconnectObject(owner)` during destruction. `connectObject()` is convenient because ownership is explicit, but it is a GJS GObject convenience rather than a method documented on `Meta.Window`; normal `connect()` plus stored handler IDs is equally valid.

For each live clone, Shell's thumbnail switcher additionally listens to the `Meta.WindowActor`'s inherited `destroy` signal, removes the thumbnail, and disconnects clone-source object connections during teardown. Actor destruction may trail `unmanaged` while a close animation runs, so the window signal should drive model removal; actor destruction should invalidate only rendering resources.

When removal empties the list, close the popup. Otherwise clamp/recompute the selected index. Never activate an entry without confirming its `Meta.Window` is still in the live list.

Sources: [Shell 50 `WindowSwitcher._removeWindow()`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/altTab.js), [Shell 50 `ThumbnailSwitcher._removeThumbnail()`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/altTab.js), [`Meta.Window` signals](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.Window.html), [`Clutter.Actor::destroy` inherited by `Meta.WindowActor`](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.WindowActor.html).

## 9. Lifecycle and cleanup order

Official extension policy requires all mutation in `enable()` and complete reversal in `disable()`: destroy objects, disconnect signals, and remove every main-loop source. For this extension, use this order:

### Enable

1. Construct any `Gio.Settings` and handler state.
2. Install both custom binding handlers.
3. Do not create the popup until a binding invokes it.

### Popup destroy

1. Remove GLib timeout/idle source IDs and stop transitions that own callbacks.
2. Pop the exact `Clutter.Grab` if still modal.
3. Disconnect `Meta.Window`, actor, layout-manager, and settings signals owned by the popup.
4. Destroy clones and child widgets; clear window/app arrays and references.
5. Destroy the root actor and clear the extension's popup reference from its `destroy` path.

### Disable

1. Destroy the active popup first, ensuring no modal grab or transformed actor remains.
2. Restore both stock Shell handlers and `Shell.ActionMode.NORMAL` permissions.
3. Disconnect extension-level signals and remove extension-level sources.
4. Clear `Gio.Settings`, handler, popup, and other GObject references.

Official guidance says initialization/module scope and the extension constructor must not create GObjects or alter Shell. Cleanup belongs to the same class that creates each resource. GNOME 50 provides `GLib.timeout_add_once()` for one-shot sources, but even a one-shot source must be removed in `disable()` if still pending.

Sources: [official review lifecycle rules](https://gjs.guide/extensions/review-guidelines/review-guidelines.html), [official lifecycle best practices](https://gjs.guide/extensions/review-guidelines/best-practices.html), [GNOME Shell 50 one-shot source notes](https://gjs.guide/extensions/upgrading/gnome-shell-50.html), [stock `SwitcherPopup._onDestroy()`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/switcherPopup.js).

## 10. Public/private API inventory and risks

| API or class | Status | Risk / guidance |
|---|---|---|
| `Meta.keybindings_set_custom_handler()` | Exported/introspected Mutter API | Correct primitive for built-in bindings, but no previous-handler getter/stack. Cross-extension restoration conflicts remain. |
| `Meta.Display.get_tab_list()` and `Meta.TabList` | Exported/introspected Mutter API | Preferred MRU source. Semantics can evolve; choose `NORMAL_ALL` vs `NORMAL_ALL_MRU` deliberately. |
| `Meta.Window` methods/signals | Exported/introspected Mutter API | Preferred window lifetime and activation model. |
| `Shell.WindowTracker.get_default().get_window_app()` | Exported/introspected Shell C API | Preferred app mapping; result may be `null`. |
| `Meta.WindowActor`, `Clutter.Clone` | Introspected compositor/toolkit API | Cloning is lower risk than mutating the source, but actor availability/lifetime is asynchronous. |
| `Main.wm.setCustomKeybindingHandler()` | GNOME Shell JavaScript internal | Needed to keep Shell action-mode filtering consistent. Not stable across major versions. |
| `Main.wm._startSwitcher` | Private by naming and implementation | Needed to restore exact stock Shell handler in 50. Retest every release; conflicts with other switcher extensions are unavoidable. |
| `Main.activateWindow()` | Exported Shell JS helper, not stable extension ABI | Best stock behavior across workspaces, overview, and calendar. |
| `Main.pushModal()` / `Main.popModal()` | Exported Shell JS internals | Required for correct Shell-global grab/focus bookkeeping; exact return/signature can change. |
| `Main.uiGroup`, `Main.layoutManager` | Shell JS internals | Standard extension practice but version-coupled. |
| `SwitcherPopup.SwitcherPopup`, `SwitcherList` | Shell JS classes, internal | Reuse reduces code but subclassing/overrides couple to private fields and vfunc assumptions. A small extension-owned popup using only modal helpers is easier to control. |
| `AltTab.getWindows()` | Private, not exported | Cannot be imported. Reproduce the documented four-step policy or use tab-list output directly. |
| `AltTab._createWindowClone()` | Private, not exported | Reproduce the small clone sizing logic if needed. |
| `Meta.Window.get_compositor_private()` | Exported but explicitly exposes compositor wrapper | Guard `null`; do not retain beyond window/actor lifetime. |
| `global.get_pointer()` / `global.get_current_time()` | Shell global internals | Used by stock Shell and common in extensions, but not a stable standalone platform API. |
| `connectObject()` / `disconnectObject()` | GJS convenience used by Shell | Safe when consistently owner-scoped; plain handler IDs are more explicit and portable. |

Official GNOME documentation explicitly states that extensions can access and modify Shell internals, but there is no stable extension API; invasive monkey-patching is expected to break more often. Target only Shell 50 in `metadata.json`, avoid speculative multi-version shims, and verify against every Shell 50 point release and the next major before claiming support.

Sources: [official architecture guide](https://gjs.guide/extensions/overview/architecture.html), [official updates and breakage guide](https://gjs.guide/extensions/overview/updates-and-breakage.html), [GNOME 50 upgrade guide](https://gjs.guide/extensions/upgrading/gnome-shell-50.html).

## 11. Implementation checklist derived from sources

- Override exactly `switch-applications` and `switch-applications-backward` to cover default Alt/Super forward and Shift-backward combinations.
- Keep Shell's `Shell.ActionMode.NORMAL` filtering.
- Pass `binding.get_mask()` into popup modifier-release handling; do not assume Alt specifically because the same binding includes Super and can be user-rebound.
- Choose `NORMAL_ALL_MRU` for strict MRU or `NORMAL_ALL` plus Shell's dialog/skip-taskbar policy for stock behavior.
- Pass active workspace or `null` according to the selected stock preference; apply no monitor filter.
- Preserve entries whose `get_window_app()` result is `null`.
- Activate with an event timestamp through `Main.activateWindow()` for cross-workspace stock behavior.
- Use a modal root actor and pop the exact returned grab on every exit path.
- Use short-lived `Clutter.Clone` previews sourced from guarded window actors; do not reparent real actors.
- Remove candidates on `Meta.Window::unmanaged`, and invalidate clone resources on actor `destroy`.
- On disable: destroy popup, then restore both handlers to `Main.wm._startSwitcher.bind(Main.wm)`, then clear remaining resources.
- Document the last-writer-wins incompatibility with other switcher-replacement extensions.

## Primary sources

- [GNOME Shell 50 `windowManager.js`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/windowManager.js)
- [GNOME Shell 50 `altTab.js`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/altTab.js)
- [GNOME Shell 50 `switcherPopup.js`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/switcherPopup.js)
- [GNOME Shell 50 `main.js`](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/js/ui/main.js)
- [GNOME Shell 50 schemas](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.0/data/org.gnome.shell.gschema.xml.in)
- [Mutter 50 `keybindings.c`](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/core/keybindings.c)
- [Mutter 50 `display.c` tab-list implementation](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/core/display.c#L1844-1922)
- [Mutter 50 public `display.h`](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/meta/display.h)
- [Mutter 50 `meta-window-actor.c`](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.0/src/compositor/meta-window-actor.c)
- [GNOME 50 desktop WM keybinding schema](https://gitlab.gnome.org/GNOME/gsettings-desktop-schemas/-/blob/50.0/schemas/org.gnome.desktop.wm.keybindings.gschema.xml.in)
- [Official GJS extension architecture](https://gjs.guide/extensions/overview/architecture.html)
- [Official GJS updates and breakage guidance](https://gjs.guide/extensions/overview/updates-and-breakage.html)
- [Official GJS extension lifecycle/review rules](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
- [Official GJS Extension and InjectionManager docs](https://gjs.guide/extensions/topics/extension.html)
- [Official GNOME Shell 50 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-50.html)
