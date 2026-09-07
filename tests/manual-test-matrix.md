# Manual Test Matrix

Run this matrix in a nested GNOME Shell 50 session where possible. Record the
result and relevant journal excerpt for every failure.

| Scenario | Expected result | Result |
|---|---|---|
| 1 window | One direct target; forward selects it | Not run |
| 2 windows | One tap selects the previous window | Not run |
| 4 windows | Direct targets only | Not run |
| 5 windows | Eligible app groups appear | Not run |
| 12 windows | Every frozen target fits | Not run |
| 30 windows | Every target fits; keyboard remains usable | Not run |
| Several windows from one app | One group contains all app windows | Not run |
| One window from many apps | Four recent direct targets, plus one group for each older app | Not run |
| `F1,T1,F2,B1,T2,F3` | Traversal matches the design sequence | Not run |
| Forward/reverse invocation and wrap | Reverse is the exact circular inverse | Not run |
| Current-workspace-only on/off | Candidate scope follows stock app setting | Not run |
| Two monitors, including staggered/portrait layouts | Full composition and entered groups stay on the starting window's monitor; other desktops are not dimmed | Not run |
| Pointer on a different monitor than the focused window | Focused window's monitor wins; moving the pointer does not move the open switcher | Not run |
| No focused window | Switcher uses the pointer's monitor | Not run |
| Monitor disconnect, rotation, or resolution change while open/exiting | Presentation disappears synchronously without activation or stale modal capture | Not run |
| Small logical work area, including 448px height | Previews retain positive dimensions; scaled chrome fits within the monitor | Not run |
| Cross-workspace activation | Selected window's workspace activates | Not run |
| Minimized/sticky/unassociated windows | Each remains reachable | Not run |
| Unassociated window older than the four recent windows | Appears as an additional direct target, before app groups | Not run |
| Attached dialog | Parent is one target; dialog travels in preview | Not run |
| Nested attached dialogs | One root target; all attached surfaces stack correctly; forward invocation skips the current root | Not run |
| Close direct target | Both representations disappear if duplicated | Not run |
| Close grouped target | Selection follows traversal direction | Not run |
| Close newest group window | Group stays selected with next destination | Not run |
| Fast modifier tap | Activation does not wait for animation | Not run |
| Switcher entrance | Starting preview transforms; every other preview fades in at its destination | Not run |
| Commit selected window/group | Only the activated preview transforms to its source; every other preview fades | Not run |
| Held traversal | Every key press advances exactly one target | Not run |
| Forward rebound to Alt+Left or Alt+Space | Repeated presses advance forward without reversing or committing | Not run |
| Forward rebound to Alt+Menu or Alt+Shift+F10 | Repeated presses advance despite focused widget popup-menu handling | Not run |
| Modifier-free switching shortcut | No automatic timeout; navigation stays open until explicit confirmation or cancellation | Not run |
| Escape/Return/Space | Cancel or commit immediately | Not run |
| Mouse/touch target activation | Chosen target activates once | Not run |
| Click with small pointer movement inside target | Valid click still activates once | Not run |
| Press target, drag or slide outside, release/lift | Gesture cancels without activating | Not run |
| Press chevron, move just outside onto parent group, release | Neither group activation nor scope change occurs | Not run |
| Move pointer onto a direct target | Shared selection and title move to that target; exactly one target is highlighted | Not run |
| Pointer selection followed by keyboard navigation | Next/previous continues from the pointer-selected target within the current scope | Not run |
| Keyboard navigation with stationary pointer over another target | Keyboard selection remains; no independent hover outline appears | Not run |
| Open, animate, or rebuild beneath a stationary pointer | Selection does not change due to crossing/hover events | Not run |
| Move pointer onto empty space | Last selection remains | Not run |
| Hover/click a collapsed grouped preview | Whole group is selected/activated; no automatic group entry | Not run |
| Hover an individual preview in an entered group | That window becomes the shared selection; keyboard continues from it | Not run |
| Expandable group chevrons | Every app group has a clickable down-chevron | Not run |
| Multi-window group icon | The app icon and chevron are centered beneath the complete preview cluster | Not run |
| Enter group by key/chevron | Only group windows remain and form a balanced gallery | Not run |
| Accessible selection and scope | Selected target has key focus; out-of-scope targets are hidden/unfocusable after fading; inactive chevrons are hidden | Not run |
| Accessible chevron focus and held confirmation | Focus alone preserves scope; Enter/Space operates the visible chevron once; holding the key does not activate a window | Not run |
| Orca navigation and confirmation | Names, selected target and group context are announced; confirmation activates the announced destination | Not run |
| Entered group window title | The selected title fades in near its destination instead of flying from outside the gallery | Not run |
| Leave group by key/chevron | Full frozen composition returns and the selected group title fades in near its destination | Not run |
| Left/Right traversal | Wraps backward/forward within the current navigation scope | Not run |
| Entered group chrome | Up-chevron appears above the centered app icon | Not run |
| Reverse group transition | Geometry continues from its interpolated position without jumping | Not run |
| Duplicated window during group transition | Direct duplicate fades early on descent and late on return | Not run |
| Interrupt staged duplicate fade | Reversing, committing, or cancelling leaves no late opacity change | Not run |
| Close entered group window | Gallery rebalances and scoped selection advances | Not run |
| Close final entered window | Full composition returns without stale actors or chevrons | Not run |
| Animations disabled | Enter, leave, and removal apply synchronously | Not run |
| Long selected title | Pill is centered, natural-width, ellipsized, and preview-constrained | Not run |
| Client changes a title while open or animating | Every duplicate label and accessible name updates without changing selection or interrupting animations | Not run |
| Long title after repeated enter/leave and interrupted transitions | Title grows with the preview instead of retaining its previous width | Not run |
| Rebuild or disable while pointer is over a grouped preview | No cross-actor hover callbacks or destroyed-actor errors; rebuild does not steal selection | Not run |
| Window preview corners | Live previews remain clipped to the selection outline's 12px radius during every transition | Not run |
| Preview corners at 100%, 200%, and fractional scale | Live previews and selection outlines keep the same circular 12px radius | Not run |
| System modal while open or exiting | Session releases its grab; active presentation or detached exit animation is destroyed synchronously | Not run |
| Lock/unlock | No stale actor or input capture remains | Not run |
| Disable while open | UI and grab are synchronously destroyed | Not run |
| Shell theme change | Selection remains visible | Not run |
| Repeated enable/disable | Stock switching works after every disable | Not run |
| Competing switcher extension | Last-writer-wins limitation is observed | Not run |

## Automated Coverage

Verified on GNOME Shell/Mutter 50.4 on 2026-09-07 with `npm run test:shell`.
These checks complement, rather than complete, the physical-desktop matrix:

- Real virtual keyboard, pointer, and touchscreen events exercise shared
  selection, valid clicks with small movement, cancelled slides, chevrons,
  rebound Alt+Menu, modifier release, and explicit confirmation.
- The actual controller/session handles Escape, system-modal interruption,
  final-window closure, rapid reopen, and disable during open/exiting states.
- Real system modals interrupt active sessions and detached commit/cancel exits.
  Selected entered-group window closure preserves scope and selects a survivor.
  While disabled, both stock switching bindings open the real stock popup and
  activate a different window before the extension is re-enabled.
- Monitor cancellation uses an injected `monitors-changed` signal on one
  headless monitor. Focus/visibility assertions do not constitute an Orca test.
- Local `Atk.Component.grab_focus()` on a nonselected target updates selection
  and the activation destination for both Enter and modifier release. This does
  not test the AT-SPI bridge or screen-reader announcements.
- ATK focus on icon bins, icons, and title text normalizes to the owning target
  before confirmation. Visible chevrons retain focus and confirmation operates
  them without activating a window. Scope changes restore target focus; hidden
  chevron focus requests normalize to the selected target.
- Real held Return/Space input produces autorepeat events without committing
  after chevron activation. Return, keypad Enter, and Space use virtual input;
  ISO Enter uses a captured-event fixture because the headless keymap lacks it.
- Three real minimize/activate cycles verify that the exit preview destination
  matches the restored window's buffer rectangle, not its unminimize transform.
- ATK focus on a collapsed grouped preview selects and focuses its app group
  without entering it; Enter and modifier release activate the group's newest window.
- Real pointer clicks on the lower half of direct-window icons and selected
  titles activate their target; dragging outside cancels those clicks.
- Resizing a real helper window during a modifier-free session updates the
  preview aspect ratio without changing selection. The fixture restores its
  original frame and keeps the helper alive through its D-Bus interface.
- `npm test` additionally covers nested attached-dialog normalization/stacking,
  no-modifier deadlines, controller signal ownership, and small-area layouts
  using pure functions and stubbed GNOME APIs.
- Node regressions cover urgent-window MRU ordering, attached-dialog movement,
  entered-group geometry updates, and pending geometry-source cleanup.
- Node regressions also cover outlying attached-dialog destruction in full and
  entered layouts, and nonoverlapping direct-window icons for narrow previews.
- The Shell suite changes the live theme context to 200% scale and a larger font,
  checking icon/control backing sizes and title allocations in full and entered
  layouts without rebuilding clones. It restores the original scale and font.
  This is not a physical mixed-DPI or fractional-scaling test.
- Node regressions cover 30-day MRU intervals with and without timestamp rollover,
  scale-2 layout containment, and pending theme-refresh cleanup on exit/destruction.
- Node geometry regressions retain a closing dialog's own rectangle after compositor
  lookup becomes null while its clone survives. Full and entered galleries ignore
  source transforms; unchanged buffer notifications preserve active transitions.
  Entrance still uses transformed geometry, and exit still uses buffer rectangles.
- Node preview regressions cover hiding with animations on/off, backing resize,
  reversal during either fade step, hidden backing refresh, and showing an exit
  hero that was outside the entered scope.
- Real preview wrappers and their `Clutter.Clone` children are checked for unmapping
  after group entry and remapping on return, including backing resize and an
  interrupted return. Hidden backing resize does not remap the preview. These checks
  do not measure client suspension, power use, or physical animation appearance.
- A real `Meta.Window` title-signal fixture updates duplicate St labels and local
  ATK names, retargets active label animation endpoints, and preserves preview
  animations. It emits `notify::title` rather than renaming a client window.
  Node regressions additionally verify subscription and pending-refresh cleanup.
