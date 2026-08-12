# Window Switching

This context describes the user-visible concepts in a mixed window and application switcher for GNOME Shell.

## Language

**Window**:
An individual open application surface that can receive focus.

**Recent window**:
One of the four highest-ranked windows in the current most-recently-used order.
_Avoid_: Exposed window, ungrouped window

**Direct window target**:
A switcher target representing one recent window independently of its application.
_Avoid_: Window item, thumbnail

**App group target**:
A switcher target representing all windows belonging to one eligible application. Selecting it emphasizes the group as a whole; activating it focuses the app's newest window.
_Avoid_: Older-window group, app icon

**Grouped window target**:
A switcher target representing one window within an app group target. A recent window is represented by both a direct window target and a grouped window target.
_Avoid_: Child item, nested window

**Eligible application**:
An application with at least one window outside the four recent windows. Its app group target contains all of the application's windows, including recent windows.

**Switching session**:
The interval from invoking a switching shortcut until a target is activated or switching is cancelled. Its window set and most-recently-used ranking are fixed when it begins, except that closed windows cease to be targets.

**Starting window**:
The focused window when a switching session begins. Its direct window target is skipped initially, but it remains reachable as a grouped window target.

**Switcher target**:
A keyboard-selectable destination in the switcher. A target is a direct window target, an app group target, or a grouped window target; the same window may be reachable through multiple targets.
_Avoid_: Item, entry

**Traversal sequence**:
The circular keyboard order of switcher targets: recent windows in most-recently-used order, followed by eligible applications in the order of each application's newest window, with each app group target immediately followed by its grouped window targets in app-local most-recently-used order. The currently focused window is skipped when switching begins, and reverse traversal is the exact inverse, including on reverse invocation.
_Avoid_: Tab order, focus order
