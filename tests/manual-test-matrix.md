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
| One window from many apps | Only the four recent direct targets remain | Not run |
| `F1,T1,F2,B1,T2,F3` | Traversal matches the design sequence | Not run |
| Forward/reverse invocation and wrap | Reverse is the exact circular inverse | Not run |
| Current-workspace-only on/off | Candidate scope follows stock app setting | Not run |
| Two monitors | One centered composition includes both monitors | Not run |
| Cross-workspace activation | Selected window's workspace activates | Not run |
| Minimized/sticky/unassociated windows | Each remains reachable | Not run |
| Attached dialog | Parent is one target; dialog travels in preview | Not run |
| Close direct target | Both representations disappear if duplicated | Not run |
| Close grouped target | Selection follows traversal direction | Not run |
| Close newest group window | Group stays selected with next destination | Not run |
| Fast modifier tap | Activation does not wait for animation | Not run |
| Switcher entrance | Starting preview transforms; every other preview fades in at its destination | Not run |
| Commit selected window/group | Only the activated preview transforms to its source; every other preview fades | Not run |
| Held traversal | Every key press advances exactly one target | Not run |
| Escape/Return/Space | Cancel or commit immediately | Not run |
| Mouse/touch target activation | Chosen target activates once | Not run |
| Hover direct recent-window target | Target gains an accent outline without changing keyboard selection | Not run |
| Expandable group chevrons | Every app group has a clickable down-chevron | Not run |
| Multi-window group icon | The app icon and chevron are centered beneath the complete preview cluster | Not run |
| Enter group by key/chevron | Only group windows remain and form a balanced gallery | Not run |
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
| Window preview corners | Live previews remain clipped to the selection outline's 12px radius during every transition | Not run |
| Preview corners at 100%, 200%, and fractional scale | Live previews and selection outlines keep the same circular 12px radius | Not run |
| System modal | Session closes and releases modal grab | Not run |
| Lock/unlock | No stale actor or input capture remains | Not run |
| Disable while open | UI and grab are synchronously destroyed | Not run |
| Shell theme change | Selection remains visible | Not run |
| Repeated enable/disable | Stock switching works after every disable | Not run |
| Competing switcher extension | Last-writer-wins limitation is observed | Not run |
