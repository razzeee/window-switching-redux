# Window Switching Redux

Window Switching Redux is a GNOME Shell 50 behavioral prototype that combines
four direct recent-window targets with complete groups for applications that
have older windows. Older windows without an associated application remain
available as additional direct targets, before the application groups.

The switcher appears only on the monitor containing the focused window when
switching starts, including when entering a group. If there is no focused
window with a monitor, it uses the pointer's monitor. Windows from other
monitors remain selectable; their desktops are not dimmed by the switcher.
Changing the monitor configuration cancels any open switcher or exit animation
immediately. Invoke switching again to use the new layout.

Public distribution is the goal, but this is not an EGO-ready release. The
source is AI-generated. Do not upload it to extensions.gnome.org unless you
understand the JavaScript and can maintain it. The maintainer must review the
source and remove its generated-code notices manually before submission.

## Requirements

- GNOME Shell 50 only
- Node.js 22.15 or later for model, layout, and stubbed Shell input tests
- `gnome-extensions` for packaging and installation
- `gnome-shell-test-tool` and `dbus-run-session` for isolated Shell integration tests

## Test And Package

```sh
npm test
npm run pack
unzip -l dist/window-switching-redux@razzeee.github.io.shell-extension.zip
```

The package contains only `metadata.json`, `extension.js`, `stylesheet.css`,
the root runtime modules, `LICENSE` (copyright and GPL-2.0-or-later notice),
and `COPYING` (the full GNU GPL version 2 text). It excludes tests, plans,
and research.

Run the widget integration checks in an isolated headless Shell 50 session:

```sh
npm run test:shell
```

This builds the package and tests real window previews, label resizing and
animation reversal, shared pointer/keyboard selection, click/touch cancellation,
actual shortcut invocation and activation, system-modal interruption, final-window
closure, rapid reopening, and disable/re-enable. It also checks local ATK focus
transfer and activation, clicks on protruding icons and titles, live preview
resizing, hidden controls, and single-monitor placement. The runner isolates the session
bus and runtime directory; the Shell test tool isolates configuration and the
extension installation.
Live theme-scale and font changes are tested in full and entered-group layouts,
including 200% St icon/control allocation and title remeasurement without rebuilding
previews. This does not replace physical mixed-DPI or fractional-scaling checks.
Accessible focus on a collapsed grouped preview selects its app group and
confirmation activates that group's newest window without entering the group.
Focus requests on target icons and titles return to their owning navigation target.
Chevron focus returns to its app group when collapsed, or the current window target
when entered; focus alone does not change scope. The suite also verifies that
minimized-window exit previews use the final window rectangle during unminimization.
Node regressions check closing-dialog geometry while its compositor lookup is null,
stable gallery rectangles despite source animation transforms, and unchanged-buffer
notifications preserving transitions. They also cover preview hiding with animations
on/off and reversal during either step of a backing-resize fade. The Shell suite
checks that out-of-scope preview wrappers and their actual `Clutter.Clone` children
are unmapped, stay unmapped during hidden backing resize, and remap on return.
These are mapping assertions, not measurements of client suspension or power use.
Multi-monitor placement policy and small work-area geometry are covered by
the Node tests. Monitor cancellation is exercised by injecting the Shell's
monitor-change signal, not by physical hotplug. Nested-dialog identity and
stacking are tested with controller fixtures. Physical multi-monitor interaction,
nested-dialog presentation, and Orca still need manual testing.

## Install

```sh
gnome-extensions install --force \
  dist/window-switching-redux@razzeee.github.io.shell-extension.zip
gnome-extensions enable window-switching-redux@razzeee.github.io
```

Restart the Shell session after installation if the extension is not visible.
On Wayland, log out and back in. Remove it with:

```sh
gnome-extensions disable window-switching-redux@razzeee.github.io
rm -rf ~/.local/share/gnome-shell/extensions/window-switching-redux@razzeee.github.io
```

## Bindings And Conflicts

The extension replaces `switch-applications` and
`switch-applications-backward`, preserving the user's configured accelerators.
`Alt+Esc` is unchanged. Switcher extensions are last-writer-wins because GNOME
Shell exposes no previous-handler stack. Disabling this extension restores the
stock GNOME Shell app switcher, not another extension's overwritten handler.

## Navigation

| Input | Action |
|---|---|
| Switching shortcut, Left/Right | Move backward/forward within the current scope |
| Down or down-chevron | Enter the selected application group |
| Up or up-chevron | Leave the group and return to the full composition |
| Move the pointer over a target | Select it without activating a window |
| Click/tap a target | Select and activate it |
| Release the switching modifier, Return, or Space | Activate the selected target |
| Escape | Cancel switching |

Without a modifier in the configured switching shortcut, the switcher stays
open until explicit confirmation or cancellation. There is no automatic
activation timeout. Releasing a press outside its control cancels the click or
tap; a cancelled chevron press never activates its parent group.

Configured switching shortcuts take precedence over the navigation keys above.
There is one selection and one highlight, shared by keyboard and pointer.
Moving the pointer onto a target updates the selection; the next keyboard move
continues from there. A stationary pointer does not reclaim selection when
the switcher opens, animates, or rebuilds. Moving onto empty space keeps the
last selection.

In the full composition, hovering or clicking any preview in a collapsed group
selects or activates the whole group. Group activation focuses its newest
window. Enter the group to select individual windows with either input method.
The up-chevron leaves an entered group without selecting or activating its
header.

Attached dialogs, including nested dialogs, share their root window's target.
Their preview surfaces follow the compositor's stacking order. Forward
invocation from an attached dialog skips that root window initially.
Preview geometry follows source resizing and attached-dialog movement without
changing the session's target order or selection.

## Logs

Follow Shell extension logs with:

```sh
journalctl --user -f -o cat /usr/bin/gnome-shell
```

## Prototype Limitations

- Runtime behavior is coupled to private GNOME Shell 50 JavaScript APIs.
- Every target remains visible, so previews and hit areas become very small at
  high window counts. Chrome and spacing also shrink when the work area is
  small. Keyboard traversal remains the supported path.
- Source windows remain visible behind live clones during the prototype.
- Visual and interaction scenarios still require the manual matrix in
  `tests/manual-test-matrix.md` on the target desktop.

## Before Public Release

- Validate screen-reader announcements, group navigation, and activation with Orca.
- Validate actual text and control sizing with large text, fractional scaling,
  and high-contrast themes; choose a usable overflow policy for high window counts.
- Complete hardware checks for monitor hotplug, lock/unlock, suspend/resume,
  nested dialogs, and interrupted animations, including animations disabled.
- Profile frame times and memory across repeated sessions and large window counts.
- Complete maintainer review before submission.
