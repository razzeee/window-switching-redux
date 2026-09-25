# Single-representation grid implementation plan

## Scope and approval

Implements [the approved design](../specs/2026-09-25-single-representation-grid-design.md).
The user approved this plan for sequential execution in the current session
on 2026-09-25.

Recommended execution is sequential work in this session. The rendering owner,
view transitions, and layout contracts overlap enough that parallel agents would
add coordination overhead. No subagents are required.

## Source verification and environment

Reviewed Mutter tag `51.0`, commit
`138a14fbeef09d49ebf5be8a0cb83b042dd5c841`, in a temporary source checkout.

- [clutter-clone.c](https://gitlab.gnome.org/GNOME/mutter/-/blob/51.0/clutter/clutter/clutter-clone.c),
  `clutter_clone_paint`, lines 124-187: clone painting sets the source's
  in-clone-paint flag, overrides paint opacity, disables its source transform,
  and temporarily permits painting an unmapped source. The source still needs
  to be realized.
- [clutter-actor.h](https://gitlab.gnome.org/GNOME/mutter/-/blob/51.0/clutter/clutter/clutter-actor.h):
  `clutter_actor_is_in_clone_paint` is public.
- [clutter-effect.c](https://gitlab.gnome.org/GNOME/mutter/-/blob/51.0/clutter/clutter/clutter-effect.c),
  lines 205-253: the default paint-node virtual adds an actor node. An override
  can omit that node for desktop painting and chain to the parent virtual for
  clone painting.
- [clutter-effect.h](https://gitlab.gnome.org/GNOME/mutter/-/blob/51.0/clutter/clutter/clutter-effect.h):
  the paint-node virtual and actor effect attachment/removal APIs are public.
- [GNOME Shell 51 windowPreview.js](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/51.0/js/ui/windowPreview.js):
  stock previews use 64-pixel application icons and compose attached dialogs
  with their parent through the preview layout.

These sources support testing an extension-owned paint effect that allows clone
painting and omits ordinary source painting. It avoids saving and restoring
Shell-owned visibility, opacity, or transforms. Removing the owned effect
restores the normal painting path. This is a source-supported candidate, not a
runtime-verified mechanism. Effects ordering, live updates, and handoff behavior
must pass step 1 before this implementation is accepted.

The current host reports `GNOME Shell 50.5`. Use a GNOME Shell 51 test environment
for integration and visual validation. Do not alter metadata or add compatibility
paths to run the GNOME 51 extension on this host. Existing build artifacts must
not be treated as runtime evidence.

During execution, a Fedora 45 Podman image was built with GNOME Shell and Mutter
51.0 from the updates-testing repository. A headless pixel probe confirmed
suppressed desktop painting, live clone updates, and restoration on effect
removal. The image uses software rendering and mock system services. It does
not establish physical monitor, suspend, or lock behavior.

## 1. Prove source suppression and restoration

Files: a focused Shell integration case in `tests/smoke.js` or a dedicated test
module imported by it, plus `switcherPresentation.js` once the mechanism works.

1. In GNOME Shell 51, create a live preview of a test window and attach an owned
   effect to its source. In the effect's paint-node virtual, chain to the parent
   only when the source is in clone painting.
2. Check real pixels, not just actor properties: the desktop copy disappears,
   the preview remains visible, and changing client content updates the preview.
3. Remove the effect and verify the original presentation returns. Repeat for
   immediate cancellation, source destruction, and an existing Shell effect.
4. Exercise an attached dialog and a minimized window. Confirm that suppressing
   source painting does not interfere with input-grab release or restoration.
5. Verify other-workspace and other-monitor cases in the GNOME 51 environment.

If this mechanism fails, stop the rendering work and review the actual-actor
alternative. Do not replace it with unverified opacity or visibility mutations.
If the GNOME 51 environment is unavailable, report this step as blocked rather
than claiming that Node stubs establish rendering correctness.

## 2. Make membership disjoint

Files: `windowModel.js`, `tests/windowModel.test.js`, and affected session fixtures.

1. Add behavioral tests for four recent windows, groups containing only older
   members, group order based on the newest remaining member, singleton groups,
   and older unassociated windows.
2. Build groups only from records beyond the recent limit. Remove the separate
   eligibility flag, which becomes redundant.
3. Test group activation destinations and closure without promotion into recent
   positions. Preserve frozen order and scoped directional removal.
4. Update session test fixtures that assume duplicated recent members. Preserve
   existing navigation and pointer-selection coverage.

Run `node --test tests/windowModel.test.js tests/switcherSession.test.js`.

## 3. Replace the layout contracts

Files: `switcherLayout.js`, `tests/switcherLayout.test.js`.

1. Use one 64-logical-pixel app-icon constant. Reserve icon, title, and chevron
   space independently of preview scale.
2. Generate a row-major grid over top-level target indices. Evaluate candidate
   column counts against the usable area, keeping cells comparable and rows
   centered. Require the mockup's three-by-two result for six targets at its
   landscape work-area proportions.
3. Fit each window independently into a cell, allowing upscaling and preserving
   the parent-plus-attached-dialog bounds.
4. Generate bounded stack offsets and rotations within the group cell. Use the
   newest member at the front. Reuse bounded depth positions for large groups.
5. Return explicit cell, preview, icon, title, chevron, and rotation geometry so
   the view no longer reconstructs sizes from source-window scale.
6. Produce entered-group geometry with side space reserved for partially visible
   context. Partition edge targets by top-level order, retain their order on each
   side, and overlap them within the reserved strips.
7. Test six-target composition, varied aspect ratios, small source windows,
   singleton and large groups, scale factors, empty sides, and stack bounds.

Run `node --test tests/switcherLayout.test.js`.

## 4. Introduce the presentation resource owner

Files: new `switcherPresentation.js`, `switcherView.js`, and focused lifecycle tests.

1. Move preview/source lifecycle into an owner keyed by actual window surface,
   not target index. It owns the preview, suppression effect, source signals,
   geometry refresh resources, and destruction cleanup.
2. Treat each root window and its attached surfaces as one presentation unit for
   placement and rotation. Preserve relative dialog geometry.
3. Provide focused operations for reconciling records, applying destination
   geometry, reading current geometry, returning to desktop, and destruction.
   Keep selection and activation out of this module.
4. Retain surviving previews when `setTargets()` removes a closed window. The
   current implementation destroys and rebuilds every preview there; replace
   that behavior so suppression survives reconciliation without a flash.
5. Remove effects only from live source actors and release destroyed sources
   immediately. Own every signal and callback in the class that creates it.
6. Confirm that the existing `switcher*.js` packaging pattern includes the new
   module and that extension initialization creates no runtime resources.

Use lifecycle tests to cover ownership, balanced attachment/removal, closed
sources, repeated sessions, and destruction during transitions. Use GNOME 51
integration tests for paint behavior established in step 1.

## 5. Wire shared-grid and edge transitions

Files: `switcherView.js`, `stylesheet.css`, view tests, and session lifecycle tests.

1. Consume the new layout geometry and render equal-sized app icons without
   applying preview scale to them.
2. Reuse each presentation through grid, stack, entered-group, and edge states.
   Delete duplicate-preview transition handling.
3. Disable all edge-target input and focus paths immediately on group entry,
   including descendant chevrons and accessibility actions. Restore them on
   return according to the existing navigation scope.
4. Preserve the stationary-pointer rule and existing click/touch cancellation.
5. Include rotation in captured and retargeted animation state. Keep chrome
   upright and hit regions consistent with the presented composition.
6. Animate every visible desktop candidate into the picker. Replace the current
   starting-window-only entrance and selected-window-only return behavior.
7. Restore normal source presentation on every exit path. Confirm immediately
   through the existing session activation path, then complete the visual exit
   without delaying focus or leaving a duplicate desktop copy.
8. On cancellation, return visible sources to desktop geometry. For minimized
   or off-workspace windows, retire previews without changing window state.
9. Handle group reversal, window closure, disable, and animation-disabled mode
   without jumping, stale callbacks, or temporarily releasing source suppression.

Run focused view and lifecycle test files after each integration change.

## 6. Validate and update documentation

Files: `tests/smoke.js`, `tests/lifecycle.js`, `tests/manual-test-matrix.md`,
`README.md`, and `CONTEXT.md`.

1. Update Shell scenarios whose expected membership or geometry encodes the old
   duplicated model. Add assertions for inactive edge context and source cleanup.
2. Capture entrance, group entry/return, cancellation, and confirmation in GNOME
   Shell 51. Check pixels for duplicates and blank handoff frames. Include rapid
   input and an interrupted animation.
3. Check small windows, attached dialogs, mixed aspect ratios, large groups,
   workspace activation, and multi-monitor scaling. Record which checks were
   automated, manually verified, or blocked.
4. Update user docs and domain terminology to describe the implemented disjoint
   groups, shared grid, equal icons, and edge context. Remove obsolete known
   limitations only after the corresponding behavior is verified.
5. Run syntax checks on changed JavaScript files with `node --check`. This repo
   has no configured typechecker; do not describe syntax checks as typechecking.
6. Run `npm test` once after the focused tests pass, then `npm run test:shell` in
   the GNOME Shell 51 environment. That command also packages the extension.
   Inspect the package contents for the new runtime module.
7. Review the complete diff using the code-review skill. Fix discovered bugs and
   rerun affected checks. Summarize completed work and any unverified runtime
   behavior accurately.

## Completion criteria

The model has no duplicated membership, the grid and stacks match the approved
composition, icons stay consistent, and group transitions retain inactive edge
context. The GNOME 51 runtime demonstrates one visible representation per window
with live updates and reliable restoration. Node tests alone do not establish
that last requirement.
