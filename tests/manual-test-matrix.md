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
| Held traversal | Every key press advances exactly one target | Not run |
| Escape/Return/Space | Cancel or commit immediately | Not run |
| Mouse/touch target activation | Chosen target activates once | Not run |
| System modal | Session closes and releases modal grab | Not run |
| Lock/unlock | No stale actor or input capture remains | Not run |
| Disable while open | UI and grab are synchronously destroyed | Not run |
| Shell theme change | Selection remains visible | Not run |
| Repeated enable/disable | Stock switching works after every disable | Not run |
| Competing switcher extension | Last-writer-wins limitation is observed | Not run |
