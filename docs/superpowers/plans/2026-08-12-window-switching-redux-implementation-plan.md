# Window Switching Redux Implementation Plan

## Goal

Deliver a GNOME Shell 50 behavioral prototype of the mixed recent-window and app-group switcher defined in `../specs/2026-08-12-window-switching-redux-design.md`. Work in narrow vertical slices, keep `extension.js` minimal, and verify cleanup after every Shell integration step.

## Constraints

- Follow `AGENTS.md`, the official EGO review guidelines, and GNOME Extension Best Practices.
- Add the mandatory AI personal-use notice to every generated JavaScript source file.
- Target only Shell 50. Do not add compatibility branches.
- Use no preferences process or project GSettings schema in this milestone.
- Do not transform or reparent real `Meta.WindowActor` instances. Use live clones.
- Do not claim EGO readiness. The final artifact is for local daily use.
- Run all Shell integration testing in a nested GNOME Shell 50 session where possible.

## Planned Project Shape

```text
window-switching-redux/
├── AGENTS.md
├── CONTEXT.md
├── LICENSE
├── README.md
├── extension.js
├── metadata.json
├── stylesheet.css
├── src/
│   ├── switcherController.js
│   ├── switcherSession.js
│   ├── switcherView.js
│   └── windowModel.js
├── tests/
│   ├── smoke.js
│   ├── windowModel.test.js
│   └── manual-test-matrix.md
└── docs/
    ├── research/
    │   └── gnome-shell-50-switcher-apis.md
    └── superpowers/
        ├── plans/
        │   └── 2026-08-12-window-switching-redux-implementation-plan.md
        └── specs/
            └── 2026-08-12-window-switching-redux-design.md
```

Before creating `metadata.json`, select a final UUID using a namespace controlled by the maintainer. Treat that UUID as persistent extension identity; do not use `gnome.org`. Omit optional metadata keys until a real repository URL exists.

## Phase 1: Scaffold A Reviewable Extension

### Files

- Add `metadata.json` with the selected UUID, descriptive name, concise description, and `"shell-version": ["50"]` only.
- Add `LICENSE` using `GPL-2.0-or-later` text or another GNOME-compatible GPL license chosen by the maintainer.
- Add `README.md` with local-use status, GNOME 50 requirement, installation/testing commands, binding conflict warning, and the AI maintainership warning.
- Add `extension.js` with the required AI notice and a small `Extension` subclass.
- Add `stylesheet.css` with an empty-but-valid initial stylesheet only when the first view styles land; do not ship a placeholder stylesheet in the first scaffold commit.

### Lifecycle

- `enable()` creates `SwitcherController` and stores it.
- `disable()` destroys the controller and sets the reference to `null`.
- Keep `enable()` and `disable()` adjacent.
- Do not create GObjects or modify Shell in module scope or the constructor.
- Do not leave empty lifecycle methods: land this phase together with Phase 2 binding behavior or keep scaffolding uncommitted.

### Verification

- Validate `metadata.json` as JSON.
- Run ESLint with GNOME Shell's current extension rules if available locally.
- Package and inspect the ZIP contents; exclude docs, tests, and development-only files from the extension payload.
- Install in a nested GNOME Shell 50 session and verify enable/disable produces no journal errors.

## Phase 2: Build And Test The Pure Target Model

### File: `src/windowModel.js`

Implement a Shell-independent function that accepts already-normalized window records:

```js
buildTraversal(windowRecords, recentLimit)
```

Each record contains an opaque window value, optional auxiliary transient surfaces, and an optional opaque application value. The function returns immutable target descriptions with explicit kinds:

- `direct-window`
- `app-group`
- `grouped-window`

Keep `recentLimit` as a function argument for testability, but production always passes `4`; do not expose it as a setting.

Algorithm:

1. Take the first four records as recent windows and create direct targets.
2. Group every record with a non-null application by application identity.
3. Retain groups containing at least one record whose global index is four or greater.
4. Preserve eligible group order by each group's first global MRU occurrence.
5. Emit the group target followed by grouped targets for all its records in app-local MRU order.
6. Concatenate direct and grouped segments without deduplicating repeated windows.

Keep initial-selection and circular-index helpers in this pure module:

- Forward starts at the direct target after the starting window. If the starting window has no direct target or focus is null, it starts at index `0`; with one target it selects index `0`; with no targets no session starts.
- Reverse starts at the final target.
- Forward and reverse wrap over the exact flattened array.
- Removal scans the pre-removal circular sequence in the last traversal direction, skips every target removed for the same window, then maps the first survivor into the rebuilt sequence.

### File: `tests/windowModel.test.js`

Use a lightweight JavaScript test runner that can execute outside the Shell process. Prefer Node's built-in test runner if the pure module remains standards-compliant ESM; otherwise use `gjs -m` with a minimal assertion harness. Do not add a dependency solely for these tests.

Cover:

1. Zero windows returns no targets.
2. One through four windows return only direct targets.
3. The `F1, T1, F2, B1, T2, F3` scenario returns the exact sequence from the spec.
4. A single-window app among the recent four receives no app group.
5. Recent windows reappear as grouped targets for eligible apps.
6. Unmapped windows remain direct but never create a group.
7. Group ordering uses each app's newest window, not its newest older window.
8. Forward and reverse traversal are exact circular inverses.
9. The starting direct target remains reachable after wrap.
10. Removal selects the next target in forward and reverse directions.
11. Removal of a duplicated recent window removes both representations and selects one deterministic survivor.
12. A selected group remains selected when its newest window closes and another group window survives.
13. A formerly eligible group survives removal of its only older window for the current session.

### Verification

- Run all model tests.
- Run ESLint.
- Review the model vocabulary against `CONTEXT.md`; do not introduce synonyms such as “item” for a switcher target.

## Phase 3: Normalize The GNOME Window Snapshot

### File: `src/switcherController.js`

Add a private snapshot method used only when a binding starts a session:

1. Read `org.gnome.shell.app-switcher::current-workspace-only` from a `Gio.Settings` instance owned by the controller.
2. Pass the active workspace or `null` to `global.display.get_tab_list(Meta.TabList.NORMAL_ALL_MRU, workspace)`.
3. Map attached dialogs to `get_transient_for()` for candidate identity while retaining the dialog window/actor as an auxiliary preview surface on the normalized parent record.
4. Remove `skip_taskbar` windows and duplicate parent windows without disturbing MRU order.
5. Map each window with `Shell.WindowTracker.get_default().get_window_app(window)` and retain `null` mappings as unassociated windows.
6. Pass records to `buildTraversal(records, 4)`.

This deliberately chooses strict MRU over stock Shell's minimized-last `NORMAL_ALL` behavior because the design requires the last four windows regardless of minimized state.

### Tests And Diagnostics

- Keep normalization logic small enough to inspect directly; avoid wrappers around every Shell call.
- Add temporary diagnostic logging only in local development if needed, then remove it before marking the phase complete.
- In the nested session, create windows in a known focus order and compare the generated sequence through the Shell debugger or a single temporary structured log entry.
- Verify current-workspace-only on and off, sticky windows, minimized windows, an attached dialog, and windows on two monitors.

## Phase 4: Replace And Restore Bindings Safely

### File: `src/switcherController.js`

On controller construction during `enable()`:

- Create and retain one bound custom-handler function.
- Replace `switch-applications` and `switch-applications-backward` through `Main.wm.setCustomKeybindingHandler()` with `Shell.ActionMode.NORMAL`.
- In the handler, derive direction from `binding.is_reversed()`, retain `binding.get_mask()`, and use the triggering event timestamp.
- If a handler is invoked during the brief interval before the modal grab is established, advance the existing session rather than stacking another popup. Once modal, repeated switching is handled by the session root's key event vfunc because Shell action-mode filtering suppresses the global handlers.

On `destroy()`:

1. Force-destroy the active session and any exit view, then clear their references.
2. Restore both bindings to one retained `Main.wm._startSwitcher.bind(Main.wm)` handler.
3. Clear settings and callback references.

Do not use `Meta.keybindings_set_custom_handler(name, null)` because that restores Mutter's fallback rather than GNOME Shell's stock popup.

### Verification

- Confirm `Alt+Tab` and `Super+Tab` start the custom handler.
- Confirm both Shift variants start reverse traversal.
- Confirm user-rebound accelerators still invoke the handler.
- Confirm `Alt+Esc` remains unchanged.
- Repeatedly enable and disable the extension; after every disable, confirm the stock app switcher works.
- Enable a known competing switcher extension and document the expected last-writer-wins conflict rather than attempting unsafe detection.

## Phase 5: Implement Modal Session Semantics Without Presentation

### File: `src/switcherSession.js`

Create a reactive full-stage `St.Widget` and add it to `Main.uiGroup`. The session owns:

- Frozen target descriptions and current selected index.
- Starting window and last traversal direction.
- Primary modifier mask derived from the binding mask.
- The exact `Clutter.Grab` returned by `Main.pushModal()`.
- Window `unmanaged` handler IDs.
- Root key, pointer, touch, and system-modal signals.

Input behavior:

- Initial forward selection skips the starting direct target; initial reverse selection uses the final target.
- Matching forward/backward keybinding actions move exactly one target.
- Resolve those actions inside `vfunc_key_press_event()` with `global.display.get_keybinding_action(event.get_key_code(), event.get_state())`; do not expect the controller's global handlers to run while modal.
- Modifier release activates immediately.
- Escape cancels without activation.
- Return or Space activates the selected target.
- Pointer click or touch tap on a target activates it and closes immediately.
- Ignore hover for selection.
- Perform the stock modifier-state race check immediately after obtaining the modal grab.

Activation behavior:

- Direct and grouped targets call `Main.activateWindow(window, timestamp)`.
- App groups activate their newest surviving grouped window.
- Verify the target still has a surviving window before activation.

Removal behavior:

- Remove every target associated with an unmanaged window as one atomic model update.
- Keep the app group if any grouped windows survive, regardless of current eligibility.
- If the selected window closes, scan the pre-removal sequence in the last direction, skip all of that window's direct/grouped targets, and select the first survivor.
- If a group is selected and its newest window closes, keep the group selected and change its activation destination; remove the group only after its final window closes.
- End without activation if no target survives.

Completion and cleanup:

1. On commit or cancel, stop accepting input and pop the modal grab immediately.
2. Disconnect input and window-lifetime handlers before beginning exit animation.
3. Transfer the view to a short exit phase that animates clones from their current transforms toward source geometry.
4. When exit completes, destroy the view, clear arrays/references, and invoke one controller-owned completion callback that sets `_session` and `_exitView` to `null`.
5. On disable or system-modal interruption, cancel transitions and synchronously destroy the session/view before returning.

Do not add `_enabled` or `_destroyed` flags. The completion callback clears the controller reference, and the controller never reuses a completed or destroyed session.

### Verification

- Use temporary simple target buttons before live previews.
- Exercise exact forward/reverse order with the canonical six-window scenario.
- Verify quick tap activation before the view animation completes.
- Verify Escape, Return, mouse click, and touch tap.
- Close the selected window and an unselected grouped window while switching.
- Trigger a system modal and verify the session closes and releases its grab.
- Disable the extension while the switcher is open and verify no input lock remains.

## Phase 6: Build The Live-Clone View

### File: `src/switcherView.js`

Create one extension-owned view for the session. It receives target descriptions and emits target activation requests; it does not decide traversal or activate windows.

For each unique window:

- Read `window.get_compositor_private()`.
- When an actor exists, create short-lived `Clutter.Clone` instances for each target representation that needs the window.
- When no actor exists, render a generic icon and title placeholder without dropping the target.
- Compose retained attached-dialog surfaces with the parent preview so transient dialogs visually travel with their candidate parent.
- Listen to actor destruction only to invalidate the affected preview.

For application groups:

- Render all grouped windows in app-local MRU order.
- Add the app icon and app-name label.
- Expose the group container as a separate reactive app group target.
- Expose each child preview as its grouped window target.
- Consume child button/touch events with `Clutter.EVENT_STOP`; only uncovered group background and its app identity affordance activate the app group.

For direct targets:

- Render the live window clone independently of its app group representation.
- Provide its window title as the label shown only while that target is selected.

Selection updates only style state and accessibility state. Use a visible outline and show only the selected target's title/app-name label; do not dim unselected targets.

Use `Shell.App.create_icon_texture(size)` for associated app icons, matching Shell 50's switcher. Use `new St.Icon({icon_name: 'application-x-executable', icon_size: size})` for unassociated windows. The view owns and destroys every created icon actor.

### Layout Algorithm

Implement the first milestone as a deterministic fit-to-stage layout:

1. Reserve stage-safe margins based on monitor work areas.
2. Give the direct-target region priority size.
3. Treat each app group as one layout unit whose children preserve aspect ratios.
4. Compute a common scale that fits every target unit in the available stage bounds.
5. Continue reducing visual and reactive target geometry with no hard minimum until all targets fit. At extreme counts, pointer/touch precision may degrade; keyboard traversal remains the supported path.
6. Center the complete composition across the logical stage so windows from all monitors participate in one switcher.

Keep layout math in pure helper functions inside `switcherView.js` initially. Extract a separate module only if the calculations become independently testable and substantial.

### Animation

- Record each source window actor's stage-space geometry without mutating it.
- Start clones at source geometry and animate to switcher geometry.
- On activation or cancellation, animate surviving clones toward source geometry and destroy them.
- If input commits during entrance, interrupt the entrance and begin exit immediately from current clone transforms.
- Never delay activation waiting for an animation.
- Use short durations consistent with Shell's existing switcher/window animations and honor Shell's animations-disabled state.

Do not hide source actors in the first implementation. Evaluate duplicate visual rendering in the nested session. If hiding is necessary, add it as a separate reviewed change with a per-actor restoration map and tests for every exit path.

### File: `stylesheet.css`

Add only styles used by the view:

- Selection outline
- Window-title label
- App-name label
- App icon container
- Generic unavailable-preview treatment

Use GNOME Shell theme colors and spacing where practical. Do not use emojis as icons.

### Verification

- Compare the hierarchy and transitions with the supplied mockups at common window counts.
- Verify HiDPI scaling and both left-to-right and right-to-left layout.
- Verify all targets fit with 1, 4, 5, 12, and 30 windows.
- Verify previews update live and minimized windows have a usable representation.
- Verify selection remains visible against light and dark wallpapers.
- Verify no source actor remains hidden, transformed, or transition-modified after every exit path.
- Inspect the Shell journal for warnings and repeated logs.

## Phase 7: Accessibility And Input Hardening

### View Changes

- Give the root and targets appropriate accessible roles supported by Shell 50.
- Set each target's `label_actor` or accessible name from the window title or app name.
- Expose selected state on exactly one target.
- Keep reactive geometry aligned with visual targets so overlapping hit areas cannot activate the wrong target. Do not claim a minimum touch size when the fit-all requirement forces smaller targets.
- Preserve keyboard behavior under non-default keybindings by matching actions and modifier masks, not hardcoded key symbols.

### Verification

- Inspect the accessibility tree with Orca or Shell tooling available in the GNOME 50 environment.
- Verify keyboard-only operation, mouse activation, and touch emulation.
- Verify focus returns correctly after cancel, activation, system modal interruption, and disable.
- Verify modifier-release handling for both Alt and Super and for rebound shortcuts.

## Phase 8: Automated Shell Smoke Tests

### Packaging

Add a packaging command that produces an extension ZIP containing only runtime files. Prefer `gnome-extensions pack` rather than a custom build system.

### GNOME 50 Test Tool

Use GNOME 50's `gnome-shell-test-tool --extension extension-package.zip tests/smoke.js` support where available. Verify the exact automation-script contract against the installed GNOME 50 tool before writing the script. Add `tests/smoke.js` with focused automation for:

- Extension loads and enables.
- Forward binding opens one session.
- Disable destroys an active session.
- Stock bindings work after disable.
- A window closing while the session is active does not produce an exception.

Keep interaction-heavy visual and MRU scenarios in `tests/manual-test-matrix.md` if test-tool APIs cannot express them reliably. Do not create brittle tests around private actor-tree details.

### Verification

- Run pure model tests.
- Run ESLint.
- Run automated nested-Shell smoke tests.
- Run `git diff --check`.
- Inspect package contents and metadata.

## Phase 9: Daily-Use Candidate

### Documentation

Update `README.md` with:

- Installation and removal commands.
- How to collect Shell journal logs.
- Known last-writer-wins conflict with other switcher extensions.
- GNOME 50-only support.
- Personal-use AI notice and the requirement for maintainership before EGO upload.
- Current prototype limitations, especially shrinking previews at high counts and private Shell API coupling.

### Manual Test Matrix

Record pass/fail for:

- 1, 2, 4, 5, 12, and 30 windows.
- Several windows from one app and one window from many apps.
- Canonical duplicate-target sequence.
- Forward and reverse initial invocation and wrap.
- Current-workspace-only enabled and disabled.
- Two monitors and cross-workspace activation.
- Minimized, sticky, unassociated, and attached-dialog windows.
- Window closure at every target kind.
- Fast tap, held traversal, Escape, Return, mouse, and touch.
- System modal interruption, lock/unlock boundary, extension disable, and Shell theme change.
- Repeated enable/disable cycles.

### Daily-Use Gate

Install locally for several days. Record workflow failures and qualitative observations without adding telemetry. The milestone passes when no issue causes input capture, persistent visual corruption, stale targets, Shell restarts, or loss of stock switching after disable.

## Commit Strategy

Keep commits reviewable and aligned with cleanup ownership:

1. Add extension metadata, license, and lifecycle controller together.
2. Add the pure target model with complete unit tests.
3. Add GNOME snapshot normalization.
4. Add keybinding replacement/restoration and nested-session verification.
5. Add modal session behavior with temporary presentation.
6. Replace temporary presentation with live-clone view and styling.
7. Add accessibility and input hardening.
8. Add packaging, smoke tests, and daily-use documentation.

Do not commit an extension entry point with empty `enable()` or `disable()` methods. Do not combine unrelated refactors with these phases.

## Risks To Reassess At Each Phase

- **Binding ownership:** another extension may replace the same custom handlers.
- **Private Shell APIs:** `Main.wm._startSwitcher`, modal helpers, and Shell actor groups may change even within development snapshots.
- **Clone lifetime:** source actors may disappear independently of `Meta.Window` lifetime.
- **Modal cleanup:** any leaked grab can make the desktop unusable until Shell restarts.
- **Visual duplication:** source actors plus clones may undermine the intended desktop-transform effect.
- **Scale pressure:** fitting every target may make high-count layouts unusable despite satisfying the spatial invariant.
- **Accessibility at tiny sizes:** visual fitting and usable hit targets may conflict and require a later design decision.

Stop and revise the design rather than hiding any of these failures behind broad exception handling, optional API calls, or version fallbacks.
