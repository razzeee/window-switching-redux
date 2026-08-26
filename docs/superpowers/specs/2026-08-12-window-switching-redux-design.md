# Window Switching Redux Design

## Objective

Build a GNOME Shell 50 extension that prototypes the mixed window and application switcher shown in the GNOME Shell Design Dreams mockup. The prototype must make the four most-recent windows immediately reachable while retaining application groups as a route to every older window.

The first milestone is a behavioral prototype for informal daily use. It is not an EGO release candidate and does not include preferences, translations, or compatibility with Shell versions other than 50.

## Source Requirements

The design source states that:

- The last four windows are directly exposed in the switcher.
- Older windows remain grouped by application.
- A single `Alt+Tab` or `Super+Tab` switches to the last window regardless of application.
- Opening the switcher visually transforms the desktop windows instead of displaying a separate popup panel.

The screenshots define the intended spatial character: live window previews form independent recent-window targets and application-group arrangements over the desktop, with app identity and target labels attached to those previews.

## Candidate Windows

At the start of each switching session, obtain windows in strict most-recently-used order. Resolve attached dialogs to their parent for candidate identity, remove `skip-taskbar` windows, and remove duplicate parent windows. Retain attached dialogs as auxiliary preview surfaces so the visual representation can include the parent and its active transients. Minimized windows remain candidates in normal MRU position and are unminimized when activated. Unassociated windows remain candidates even when `Shell.WindowTracker` cannot associate them with an application.
Workspace scope follows `org.gnome.shell.app-switcher::current-workspace-only`, because the extension replaces the application-switcher binding. Passing the active workspace uses Mutter's stock workspace-scoped tab list, which can also include off-workspace windows demanding attention; passing `null` includes all workspaces. No monitor filter is applied. Sticky windows appear once. Transient dialogs travel with their parent.

The candidate list, MRU rank, application mapping, and group eligibility are frozen for the session. A window that closes is removed, but newly opened windows are not added and surviving targets are not reordered.

## Target Model

The first four candidate windows are recent windows. Each receives one direct window target.

An application is eligible for grouping when it owns at least one candidate after the first four. An eligible application's group contains all of that application's candidate windows, including recent windows already represented by direct targets. Applications are ordered by their newest candidate window. Windows inside each group use app-local MRU order.

An unassociated window can be a direct target but cannot form an application group because it has no stable application identity.

The flattened traversal sequence is:

1. Direct window targets in global MRU order.
2. Each eligible app group target in app MRU order.
3. Immediately after each app group target, all of that group's grouped window targets in app-local MRU order.

For MRU order `F1, T1, F2, B1, T2, F3`, the sequence is:

```text
F1 direct, T1 direct, F2 direct, B1 direct,
Files group, F1 grouped, F2 grouped, F3 grouped,
Text Editor group, T1 grouped, T2 grouped
```

The same `Meta.Window` may therefore appear in both a direct and grouped target. Target identity, not window identity, determines traversal position.

## Keyboard Interaction

The extension replaces `switch-applications` and `switch-applications-backward`. This covers the default `Alt+Tab`, `Super+Tab`, `Shift+Alt+Tab`, and `Shift+Super+Tab` accelerators while preserving user-rebound shortcuts. `Alt+Esc` and other GNOME switching bindings remain unchanged.

Forward invocation starts at the direct target after the starting window. In the common case this is the previously focused window, so tapping and releasing once switches to the last window regardless of application. The starting window's direct target remains visible and becomes reachable when traversal wraps. If the starting window has no direct target or there is no focused window, forward invocation starts at the first target. With one target, that target is selected; with no targets, no session opens. Reverse invocation always starts at the final target.

Forward Tab follows the complete flattened sequence. Reverse traversal is its exact circular inverse, including initial reverse invocation. Actual keyboard focus remains on the starting window while selection changes.

Releasing the primary modifier activates the selected target immediately, even if the entrance animation is incomplete:

- A direct or grouped window target activates its window.
- An app group target activates the newest surviving window in that group, even if it is the starting window.

Escape cancels the session, restores the pre-switch visual state, and leaves or returns focus to the starting window when it still exists.

If the selected window closes, selection advances through the pre-removal circular sequence in the last traversal direction, skips every target removed with that window, and selects the first survivor in the rebuilt sequence. If an app group target is selected and its newest window closes, selection remains on the group and its activation destination becomes the next app-local MRU survivor. The group disappears only when its final window closes. A group that loses the older window that originally made it eligible otherwise remains until the session ends. If no targets survive, the session closes without activation.

## Pointer And Touch Interaction

Every visible target is reactive. A primary mouse click or touch tap activates it immediately and ends the switching session, even while the keyboard modifier remains held. App group activation has the same meaning for every input method: activate the group's newest surviving window. A grouped window consumes the event before its containing group; only the group background and app identity affordance activate the app group target.

Pointer hover does not change selection in the first milestone. This avoids accidental selection when the transformed layout appears beneath a stationary pointer.

## Presentation

Opening a switching session transforms the visible desktop composition into the switcher arrangement without a separate switcher panel. The implementation uses short-lived `Clutter.Clone` previews rather than reparenting or transforming compositor-owned window actors. The source actors may be hidden only if the prototype proves that duplicate rendering is visible; any hidden actor must be restored on every exit path.

All targets remain visible simultaneously. The layout continues shrinking previews as target count increases rather than scrolling, clipping, or capping the supported count. Recognition at very high window counts relies on app icons and the selected target's label. Pointer and touch precision is allowed to degrade at extreme counts; keyboard traversal remains authoritative. This is a deliberate prototype tradeoff, not an accessibility claim.

Selection is indicated by a visible outline and a label. Unselected targets are not dimmed and do not show persistent title labels. The selected direct or grouped window target shows its window title. The selected app group target shows the application name, while every app group retains an application icon as persistent identity. Unassociated windows use a generic application icon when selected.

The first milestone should approximate the mockup's hierarchy rather than chase pixel fidelity:

- Recent direct targets are independently prominent.
- Each eligible app is a visually coherent group containing all its windows.
- The background remains recognizable as the current desktop.
- Entrance and exit animate between desktop positions and switcher positions.
- Input and activation never wait for animation completion.

### Mockup-Faithful Composition

The switcher must preserve the initial mockup's floating-window visual language. It does not use a panel, card background, persistent app-group border, or other enclosing switcher chrome. Window previews float directly over the recognizable desktop.

Direct window targets receive layout priority and occupy the upper portion of the usable stage. For one through four direct targets, arrange the previews as a balanced gallery rather than one horizontal strip. Preserve each window's aspect ratio and use the available width and height without enlarging any preview beyond a useful source-relative size.

App groups occupy the lower portion as loose clusters. Windows within a group retain app-local MRU order, overlap by approximately 12–18 percent, and stack with the newer window above older windows. The overlap must leave enough visible and reactive area for every grouped window target. Each cluster has a large persistent application icon anchored beneath it, matching the mockup. The icon and uncovered cluster area activate the app group target. No visible frame encloses the cluster.

The complete composition uses one deterministic scale that fits the direct gallery and all app clusters inside the usable work area. Direct targets retain priority, but every grouped target remains visible. At high counts, continue shrinking the complete composition rather than scrolling, clipping, or dropping targets.

Only the selected target shows a pill-shaped label. A direct or grouped window target shows its title; an app group target shows the application name. Selection uses a restrained accent outline. Unselected targets are neither dimmed nor rearranged.
Window preview pixels use the same 12-pixel corner radius as their selection outline, including throughout geometry transitions.

### Transform Animation

The starting window's direct representation begins at its source actor's exact stage-space geometry and animates to its assigned preview geometry over approximately 220 milliseconds using an ease-out curve.
Every other preview fades in at its destination, so overlapping desktop windows do not burst apart during entrance.
Clone geometry remains aspect-preserving throughout the transform. Attached-dialog clones keep their source-relative position and scale within the parent composition.

Application icons, the selected outline, and the selected label fade in during the final third of the entrance. Keyboard selection is active immediately; traversal changes only selection styling and never rearranges the frozen composition.

Commit and cancel release input immediately.
Commit animates only the activated target's preview from its current transform toward its current source geometry over approximately 180 milliseconds while every other preview and chrome actor fades out.
Cancel stops child geometry transitions and fades the current composition out over the same duration, avoiding activation-like expansion toward overlapping desktop windows.
If exit interrupts entrance, it starts from the current interpolated presentation without jumping. Activation never waits for either animation.
Animations-disabled mode applies the exit state immediately and completes cleanup synchronously.

Source window actors remain visible and unmodified. A source actor disappearing invalidates only its clone. Session disable, system-modal interruption, and target-set exhaustion cancel all transitions and synchronously destroy the animation layer.

## Architecture

`extension.js` remains a small lifecycle entry point. It creates one keybinding controller in `enable()` and destroys it before restoring the stock handlers in `disable()`.

The implementation is divided into focused Shell-process modules:

- `switcherController.js`: owns binding replacement, restoration, and the active switching session.
- `windowModel.js`: gathers candidates and builds immutable direct, group, and grouped targets.
- `switcherSession.js`: owns modal input, selection, activation, cancellation, and candidate removal.
- `switcherView.js`: owns the root actor, target actors, clone lifetimes, layout, labels, outlines, and animations.
- `stylesheet.css`: contains switcher-specific visual styling.

The model is pure JavaScript and does not import Shell UI libraries. This permits deterministic unit tests outside GNOME Shell. Each Shell-facing class owns and releases its signals, sources, actors, and grabs.

## Shell Integration

Use `Main.wm.setCustomKeybindingHandler()` with `Shell.ActionMode.NORMAL` for `switch-applications` and `switch-applications-backward`. On disable, destroy an active session first, then restore GNOME Shell 50's `_startSwitcher` handler for both binding names.

Use `global.display.get_tab_list(Meta.TabList.NORMAL_ALL_MRU, workspace)` for strict MRU input. Apply the stock attached-dialog, duplicate, and `skip-taskbar` policy after retrieval. Use `Shell.WindowTracker.get_default().get_window_app()` for application identity.

The session root is a reactive `St.Widget` in `Main.uiGroup`. It obtains a modal grab through `Main.pushModal()` and releases that exact grab through `Main.popModal()`. While modal, the root resolves key events through `global.display.get_keybinding_action()` because global switcher handlers are filtered out. Modifier release is detected from the binding mask rather than assuming Alt or Super. The session performs the stock immediate modifier-state check after acquiring the grab to handle fast taps.

Use `Main.activateWindow()` with the input timestamp for activation across workspaces. Listen to `Meta.Window::unmanaged` for candidate removal and to source actor destruction only for view invalidation.

These Shell JavaScript hooks are version-coupled. The extension supports only Shell 50 and must be retested before adding another version to `metadata.json`.

## Lifecycle And EGO Compliance

All generated JavaScript files carry the required personal-use AI notice from `AGENTS.md`. No Shell mutation or GObject creation occurs before `enable()`.

Session completion has two stages. Commit or cancel first releases input and focus synchronously, then an extension-owned exit view may finish its animation. Extension disable and system-modal interruption skip or cancel that animation and destroy everything synchronously.

Cleanup order is deterministic:

1. Remove pending sources and transitions owned by the object.
2. Pop the modal grab if held.
3. Disconnect window, actor, settings, and layout signals.
4. Restore any source actor visibility changed by the view.
5. Destroy clones and widgets, then clear references and notify the controller that the session ended.
6. Restore stock keybinding handlers after the active session and any exit view are gone.

No lifecycle flags, speculative compatibility checks, unnecessary exception wrappers, subprocesses, telemetry, or preferences process are introduced.

## Known Limitation

Mutter exposes no stack or getter for the previous custom handler of a built-in keybinding. Switcher-replacement extensions are therefore last-writer-wins. Disabling this extension restores GNOME Shell's stock handler, but it cannot restore another extension's handler that was installed before or after it. This limitation must be documented for daily-use testers.

## Milestone Acceptance

The behavioral prototype is ready for daily use when:

- Both forward shortcuts select the previous window on one tap regardless of application.
- Forward and reverse traversal match the frozen flattened sequence exactly.
- Four or fewer windows produce direct targets only.
- Eligible app groups contain all app windows and activate their newest window.
- Current-workspace scope follows the stock application-switcher setting, with all monitors included.
- Minimized, sticky, unassociated, and transient-window cases follow this document.
- Closing windows cannot leave a stale selection, clone, modal grab, or Shell error.
- Escape, quick modifier release, pointer activation, extension disable, and system-modal interruption restore the desktop cleanly.
- Repeated enable/disable cycles leave stock switching functional.
- The entire frozen target set remains visible at high window counts, with keyboard traversal remaining usable when pointer precision degrades.
- One through four direct targets form a balanced, aspect-preserving upper gallery rather than a horizontal strip.
- Eligible applications appear as unframed, slightly overlapping lower clusters with persistent app icons, matching the initial mockup's hierarchy.
- Entrance transforms clones from exact source geometry; exit reverses from current transforms without delaying activation or leaking transitions.
- A daily-use tester can run it without Shell restarts, persistent visual corruption, or excessive journal logging.

## Out Of Scope

- GNOME Shell versions other than 50
- Preferences or a configurable recent-window threshold
- Pixel-perfect mockup reproduction
- Pointer-hover selection
- Replacing `Alt+Esc`, `switch-windows`, or group/cycle bindings
- EGO submission, translations, or release packaging beyond a local installable ZIP
- Solving conflicts with other extensions that replace the same bindings
