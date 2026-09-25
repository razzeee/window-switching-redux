# Single-representation switcher grid

## Status and intent

Approved for implementation on 2026-09-25. This specifies the revised behavior.
The target is GNOME Shell 51 only.

The switcher should look like desktop windows moving into a shared grid. Each
window has one visible representation, either an individual recent window or
a member of an application stack. Opening a group should preserve the spatial
relationship to the rest of the grid.

The supplied mockup shows three individual windows in the first row, then one
individual window and two compact application stacks in the second row. It is
the reference for this six-target composition. Its wallpaper, application
contents, and screen dimensions are illustrative rather than requirements.

## Decisions this replaces

This revision replaces the following requirements in the earlier design specs:

- Recent windows also appearing in application groups.
- Separate layout regions for recent windows and application groups.
- Horizontally spreading, cascading group previews whose width grows with each
  additional window.
- Different icon sizes for individual windows and groups.
- Preview sizing based on one shared scale applied to source dimensions.
- Desktop source windows remaining visible behind their picker previews.
- Unrelated targets fading out completely when a group is entered.

The earlier hierarchical navigation design remains applicable where it does
not conflict with this document. README.md and CONTEXT.md describe the current
implementation and have been updated with this revision.

## Window membership and ordering

Collect candidates using the existing workspace, window eligibility, attached
dialog, and application association rules. Freeze candidate order and membership
at session start. Remove closed windows without admitting newly opened windows
or promoting group members into newly vacant recent-window positions.

The first four candidates are individual recent-window targets. The focused
window is included when it belongs to those four. With fewer than four
candidates, show only the available windows.

Partition the remaining candidates by application. Each associated window
belongs to exactly one application group and never also appears individually.
An application with only recent windows has no group. A group with one remaining
window is still an application group.

Older windows without an associated application remain individual targets.
The top-level traversal order is:

1. The four recent windows in frozen most-recently-used order.
2. Older unassociated windows in that same order.
3. Application groups ordered by their newest remaining member.

Group members follow their frozen app-local most-recently-used order. Activating
a collapsed group focuses its newest surviving member, never a recent window
outside the group.

For candidates `F1, T1, F2, B1, T2, F3`, the individual targets are
`F1, T1, F2, B1`, followed by the Text Editor group containing `T2` and the Files
group containing `F3`.

## Shared grid and sizing

Place all top-level targets in one centered, row-major grid. Individual windows
and collapsed groups receive comparable cell areas. The six-target composition
uses three columns and two rows, as in the mockup. Adapt the row and column count
to the available work area and target count; there is no separate group row.

Fit each preview independently into its cell's preview area while preserving
aspect ratio. Allow scaling above the source window's size. Do not stretch or
crop window content to force equal dimensions. Portrait and landscape windows
can occupy different proportions of otherwise equal cells.

Application icons use 64 logical pixels everywhere, including entered groups.
Center them over the bottom edge of their preview or stack. Scaling a window
preview must not scale its icon. Reserve space for icons, labels, and chevrons
when fitting the grid.

Only the selected target shows a title pill and selection outline. Preserve the
existing distinction between window titles and application names. A collapsed
group has a down-chevron; an entered group has an up-chevron.

Collapsed groups show their newest member at the front, with other members
behind it using small offsets and slight rotations. Bound the stack's total
width and height within its cell regardless of member count. Additional members
may overlap completely; they remain available upon entering the group. Selection
does not spread or resize a stack.

This revision addresses excessive shrinking caused by wide stacks and source
window size differences. It does not promise readable previews at arbitrary
window counts. Keep keyboard access to every target; a separate overflow design
is outside this revision.

## Entering and leaving a group

Entering a group spreads its members from their stack positions into a centered
grid using the same aspect-preserving sizing rules. Keep the group's application
identity and up-chevron visible. The entered group's icon uses the same 64-pixel
size as top-level icons.

Move top-level targets preceding the entered group toward the left edge of the
switcher's work area. Move targets following it toward the right edge. Keep
part of each target visible; multiple edge targets may overlap in compact
arrangements. Reserve the center for the entered group's windows. An empty side
does not require a placeholder.

Edge targets are context only. Exclude them and their controls from pointer,
touch, keyboard-focus, and accessibility activation while the group is entered.
Moving over an edge target must not change the current selection.

Leaving the group reverses these movements, collapses its windows back into the
stack, and restores top-level selection to the group. Preserve the original
grid destinations unless a window closure requires recomputing them.

The partially visible edge treatment is an approved prototype direction. Its
spacing, overlap, and motion timing should be assessed visually in Shell.

## Desktop-to-picker transitions

One visible representation per window is a user-visible requirement, not a
requirement to transform actual compositor-owned window actors.

The preferred implementation uses one live preview per candidate window,
including its attached-dialog surfaces, and suppresses the corresponding
desktop presentation while the preview is visible. Reuse that preview through
desktop, grid, stack, entered-group, and edge positions. Do not create a second
representation for group transitions.

For windows visible on the desktop, entrance starts at their desktop geometry
and moves to their picker destination. Handoff between source and preview must
avoid both visible duplication and blank frames. Return moves previews back
before handing presentation back to Shell.

Minimized windows and windows on other workspaces remain eligible under the
existing rules. Their previews can appear at their picker destinations without
pretending they were visible on the current desktop. Cancellation must not
unminimize them or change their workspace. Activating one retains normal window
activation behavior.

Preserve the existing choice of switcher monitor and workspace scope. Suppress
only the source presentation belonging to represented candidates, including
sources on other monitors; do not hide unrelated windows or dim other desktops.
Monitor or work-area changes dismiss the session and restore source presentation.

Cancellation restores the original desktop presentation and starting focus when
that window still exists. Confirmation focuses the selected destination and
restores normal Shell presentation. Input and activation must not wait for an
animation to finish.

Retarget interrupted animations from their current position, size, rotation,
and opacity. Reversing group entry must not jump back to a stored start frame.
When animations are disabled, apply the destination state synchronously.

## Navigation and window removal

Keep existing shortcut bindings, forward invocation skipping the starting
window, reverse traversal, confirmation, cancellation, and shared keyboard and
pointer selection. A stationary pointer must not select a target merely because
an animation moves that target underneath it.

At the top level, collapsed previews select or activate their whole group.
Entering a group limits traversal to its members. The entered group's icon is
not a window activation control; use the up-chevron or Up Arrow to leave.

When a window closes, remove its representation and apply the existing scoped,
directional selection rule. Recompute affected layouts from their current
animated geometry. A group disappears when its final member closes. If that
group was entered, return to the surviving top-level composition. If no targets
remain, dismiss without activation.

## Implementation boundaries

- `windowModel.js` owns the disjoint membership and frozen ordering rules.
- `switcherLayout.js` computes shared-grid, compact-stack, entered-group, and
  edge destinations without changing Shell actors.
- `switcherSession.js` owns navigation scope, selection, and activation requests.
- `switcherView.js` applies layouts, presents controls, and coordinates motion.
- A focused presentation resource owner should manage live previews and source
  suppression together, including restoration. Keep this lifecycle work separate
  from layout and input handling rather than expanding the view monolith.
- `switcherController.js` continues to own invocation and session lifetime.

The presentation owner must undo every source modification when the session
ends, including cancellation, immediate activation, interrupted exit, extension
disable, or loss of all candidates. It must release references to closed windows
and must not restore a destroyed actor. Cleanup belongs to the class that
created the resource or changed the source state.

## Rendering feasibility prerequisite

The rendering mechanism must be checked against GNOME Shell 51 and Mutter
sources or documentation, with runtime checks establishing how to:

1. Keep preview content live while suppressing the original desktop rendering.
2. Include attached dialogs without duplicate surfaces.
3. Restore Shell-owned presentation without overwriting legitimate changes made
   while switching.
4. Handle minimized, off-workspace, and other-monitor candidates.
5. Transfer presentation without flicker during quick activation or cancellation.

Do not assume that hiding a source actor preserves a live preview. Record the
verified mechanism and its lifecycle before relying on it. If the preview
approach cannot meet these requirements, bring the actual-window-actor option
back for design review rather than weakening the single-representation rule.

The implementation uses an owned `Clutter.Effect` that omits desktop painting
and chains to normal painting when `is_in_clone_paint()` is true. It leaves
source visibility, opacity, and transforms unchanged. Mutter 51.0 source review
and the GNOME 51.0 pixel tests in `tests/presentation.js` verified live clone
updates, source restoration, minimized previews, and source destruction.
Attached-dialog geometry has Node coverage; physical multi-monitor and
off-workspace presentation still require manual validation.

Follow the repository lifecycle requirements and the official
[review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
and [best practices](https://gjs.guide/extensions/review-guidelines/best-practices.html).

## Verification and acceptance

Use model and layout tests for behavioral invariants:

- Every candidate belongs to exactly one individual target or group.
- Four recent windows remain individual; group activation cannot resolve to one
  of them. Singleton groups and unassociated windows follow the stated rules.
- Group ordering uses remaining members, and closures do not promote windows
  into the recent section during a session.
- Six top-level targets form the mockup's shared three-by-two arrangement.
- Stack bounds stay within a cell as member count increases.
- Preview fitting preserves aspect ratio and permits upscaling, while app icons
  stay at 64 logical pixels.
- Entered-group layouts leave space for edge context and restore the full grid.

Extend Shell integration coverage for source restoration, live preview updates,
attached dialogs, edge-target inactivity, interrupted transitions, immediate
confirmation, cancellation, window closure, and disable during switching.
Exercise animations-disabled mode as well.

Visually validate in GNOME Shell 51 that there are no duplicate desktop copies,
blank handoff frames, growing cascades, tiny source-sized previews, or abrupt
disappearances of unrelated targets. Compare the six-target layout with the
supplied mockup. Include minimized windows, workspace changes on activation,
mixed window aspect ratios, large groups, and physical multi-monitor scaling.

Automated geometry tests alone cannot establish animation quality or readable
edge context. Record those results through Shell captures and manual review.
