# Hierarchical App Group Navigation Design

Historical design. The later zoomed-group design supersedes the static
presentation below. For current interaction and navigation requirements, use
the root `README.md` and `CONTEXT.md`: pointer movement selects targets, and
collapsed previews select or activate their app group, not individual windows.

## Objective

Change keyboard traversal so grouped window targets remain visible but are not part of normal top-level `Tab` traversal. A user selects an app group first and deliberately descends into that group's windows.

This design supersedes the flattened keyboard traversal described in `2026-08-12-window-switching-redux-design.md`. It does not change candidate collection, target construction, pointer activation, or app-group activation semantics.

## Navigation Model

A switching session has one of two navigation scopes:

- **Top level:** direct window targets followed by app group targets. `Tab` and `Shift+Tab` wrap within this sequence. Grouped window targets cannot be selected at this level.
- **Inside group:** only grouped window targets belonging to the entered app group. `Tab` and `Shift+Tab` wrap within that group in app-local MRU order.

`Down Arrow` enters a selected app group and selects its newest grouped window. It has no effect on a direct or grouped window target. `Up Arrow` returns from a grouped window to its containing app group target. It has no effect at the top level.

Forward invocation starts at the top-level direct target after the starting window. Reverse invocation starts at the final top-level target. Releasing the primary modifier activates the selected direct window, grouped window, or app group's newest surviving window as before.

## Pointer And Touch

Every grouped window remains directly reactive. Clicking or tapping a grouped window activates it immediately without first entering the group through keyboard navigation. Clicking the group background or app icon activates the app group's newest surviving window.

Pointer hover does not change selection or navigation scope.

## Window Removal

Top-level removal follows the existing directional survivor rule but considers only top-level targets. If the session is inside a group and the selected window closes, selection advances in the last traversal direction among that group's surviving windows.

If the entered group loses its final window, the group disappears and selection advances from its former top-level position using the existing directional survivor rule. If another window in the entered group survives, the session remains inside that group. Removing an unselected window does not change navigation scope or selection.

## Presentation

Entering or leaving a group changes only selection styling and the selected label. It does not rearrange, resize, dim, or animate the frozen composition. The app group receives the outline at the top level; a grouped window receives it only after descent. All grouped previews and the persistent app icon remain visible in both scopes.

## Architecture

`switcherSession.js` owns navigation scope because it already owns keyboard interpretation, selection, traversal direction, and removal behavior. The pure model continues returning the complete immutable target array. Small pure helpers derive the top-level indices and the grouped indices for an application, allowing deterministic unit tests without importing Shell UI modules.

`switcherView.js` remains unaware of navigation scope. It receives only the selected target index and continues handling pointer activation by complete target index.

## Acceptance Criteria

- Normal `Tab` and `Shift+Tab` traversal never select grouped windows.
- `Down Arrow` on an app group selects its newest grouped window.
- `Tab` and `Shift+Tab` wrap only within the entered group.
- `Up Arrow` returns to the containing app group target.
- Modifier release activates the currently selected target in either scope.
- Clicking or tapping a grouped window activates it directly from either scope.
- Entering and leaving a group never rearranges or dims the composition.
- Window removal cannot leave a stale grouped selection or invalid navigation scope.
