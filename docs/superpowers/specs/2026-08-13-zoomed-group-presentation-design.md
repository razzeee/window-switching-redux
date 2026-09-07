# Zoomed App Group Presentation Design

Historical design. The root `README.md` and `CONTEXT.md` define current
interaction and navigation requirements. In particular, collapsed previews
select or activate their app group, and the entered group's application icon
does not activate a window. Use the up-chevron to leave the group.

## Objective

Make hierarchical app-group descent spatially explicit. Entering an app group replaces the full switcher composition with a group-only balanced window gallery. The transition communicates that keyboard traversal is now scoped to that application's windows.

This design extends `2026-08-13-hierarchical-group-navigation-design.md`. It does not change candidate collection, grouping eligibility, activation semantics, or pointer activation of window previews.

## Full Composition

The full composition retains the four direct recent-window targets and compact app-group clusters. Every expandable app group has a persistent down-chevron beneath its application icon.

- `Down Arrow` enters the currently selected app group.
- Clicking the down-chevron enters that group without activating a window.
- Clicking the application icon or uncovered cluster background activates the group's newest surviving window.
- The chevron uses `St.Icon`, not text or an emoji.

## Entered Group Composition

Entering a group fades every direct target and every other app group out completely. The entered group's grouped window targets animate from their frozen cluster positions into the same balanced gallery arrangement used for direct recent windows. No unrelated targets remain visible around the edges.

The entered group's large application icon remains centered beneath the gallery. A persistent up-chevron appears above it.

- `Tab` and `Shift+Tab` continue wrapping among the entered group's windows.
- `Up Arrow` returns to the full composition and reselects the app group target.
- Clicking the up-chevron performs the same return operation.
- Clicking a grouped window activates it immediately.
- Clicking the application icon activates the group's newest surviving window.

## Transitions

Descent and return animate for approximately 180 milliseconds with an ease-out curve. Grouped previews animate between their cluster geometry and balanced gallery geometry.
Full-composition targets fade out on descent and back in on return. A direct preview that duplicates a moving grouped preview fades out during the first third of descent and fades in during the final third of return, preventing both representations from competing throughout the motion.
The app icon remains centered beneath the complete cluster and moves to the centered group-gallery position; the down-chevron is replaced by the up-chevron.

Keyboard and pointer input remain active during transitions. Selection changes and activation never wait for animation completion. Reversing direction while a transition is active starts from current interpolated geometry without jumping.

Animations-disabled mode applies the destination composition synchronously.

## Titles And Selection

Only the selected target shows a title pill. Window-title pills are horizontally centered beneath their preview in both the full direct-window gallery and the entered group gallery. Pills use their natural text width up to the preview width, with long titles ellipsized. They do not stretch across the complete preview width.
On group entry, the selected window title stays effectively transparent while its preview moves and fades in during the final third of the transition. On return, the selected app-group title follows the same staging instead of moving visibly with the cluster.

Selection remains an accent outline only. It does not dim, tint, shadow, resize, or rearrange the selected preview.

## Window Removal

If a window closes while its group is entered, the surviving grouped targets recompute the balanced gallery and animate from their current positions. Selection follows the scoped directional removal rule.

If the entered group loses its final window, the group disappears and the switcher returns to the full composition. Top-level selection advances from the removed group's former position using the existing directional survivor rule. No transition may retain a stale clone, clickable chevron, or selection actor.

## Architecture

`switcherSession.js` continues owning navigation scope and tells the view when a group is entered or left. `switcherView.js` owns both geometry sets, chevron actors, and transition lifetimes. The view exposes explicit `enterGroup(application)` and `leaveGroup()` operations plus callbacks for chevron requests; it does not decide keyboard traversal or activate windows.

The direct-gallery layout helper is reused for entered-group windows so both views share balancing, aspect preservation, fitting, and title placement. Cluster geometry remains frozen for return transitions except when window removal requires rebuilding the surviving target set.

## Acceptance Criteria

- Every expandable app group shows a down-chevron beneath its app icon.
- Clicking a down-chevron enters its group without activating a window.
- Entering a group completely hides every unrelated target.
- Group windows animate into a balanced, aspect-preserving gallery.
- The group app icon remains visible with a clickable up-chevron.
- `Up Arrow` and the up-chevron restore the full frozen composition.
- Clicking the app icon continues activating the group's newest window in either composition.
- `Tab` and `Shift+Tab` wrap among grouped windows while entered.
- Window-title pills are centered beneath previews and constrained to preview width.
- Selection changes only the accent outline.
- Transition interruption, window removal, and animations-disabled mode leave no stale actors or input state.
