# Window Switching

This context describes the user-visible concepts in a mixed window and application switcher for GNOME Shell.

## Language

**Window**:
An individual open application surface that can receive focus.

**Recent window**:
One of the four highest-ranked windows in the current most-recently-used order.
_Avoid_: Exposed window, ungrouped window

**Direct window target**:
A switcher target representing one recent window, or an older window without
an associated application, independently of any application group.
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
The focused window when a switching session begins. Its direct window target
is skipped on forward invocation but remains reachable by wrapping around.

**Switcher target**:
A selectable destination in the switcher. A target is a direct window target,
an app group target, or a grouped window target; the same window may be
reachable through multiple targets.
_Avoid_: Item, entry

**Selection**:
The single highlighted target that will be activated on confirmation. Keyboard
navigation and pointer movement update the same selection. The next keyboard
move continues from the pointer-selected target. A stationary pointer does not
change selection when the presentation moves beneath it.

**Navigation scope**:
The set of targets available for selection. In the full composition, these are
direct window targets and app group targets. An entered group exposes only its
grouped window targets. Hovering a preview in a collapsed group selects the
group without entering it.

**Traversal sequence**:
The circular order within a navigation scope. At the top level, recent windows
in most-recently-used order are followed by older unassociated windows in that
same order, then eligible applications in the order of each application's
newest window. Within an entered group, windows follow app-local
most-recently-used order. Reverse traversal is the inverse within each scope.
_Avoid_: Tab order, focus order
