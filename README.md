# Window Switching Redux

Window Switching Redux is a GNOME Shell 50 behavioral prototype that combines
four direct recent-window targets with complete groups for applications that
have older windows.

This extension is generated with AI for personal daily use. Do not upload it
to extensions.gnome.org unless you understand the JavaScript and can maintain
it. It is not an EGO-ready release.

## Requirements

- GNOME Shell 50 only
- Node.js for pure model tests
- `gnome-extensions` for packaging and installation

## Test And Package

```sh
npm test
npm run pack
unzip -l dist/window-switching-redux@razzeee.github.io.shell-extension.zip
```

The package contains only `metadata.json`, `extension.js`, `stylesheet.css`,
and the root runtime modules. It excludes tests, plans, and research.

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

## Logs

Follow Shell extension logs with:

```sh
journalctl --user -f -o cat /usr/bin/gnome-shell
```

## Prototype Limitations

- Runtime behavior is coupled to private GNOME Shell 50 JavaScript APIs.
- Every target remains visible, so previews and hit areas become very small at
  high window counts. Keyboard traversal remains the supported path.
- Source windows remain visible behind live clones during the prototype.
- Visual and interaction scenarios still require the manual matrix in
  `tests/manual-test-matrix.md` on the target desktop.
