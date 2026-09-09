# Window Switching Redux

A GNOME Shell 50 extension that combines recent-window switching with application
groups. Reach your four most recent windows directly, or enter a group to choose
from all of an application's windows.

This is a behavioral prototype, not an EGO-ready release. The source is
AI-generated. Do not upload it to extensions.gnome.org unless you understand the
JavaScript and can maintain it. Before submission, the maintainer must review the
source and manually remove the generated-code notices.

## How It Works

The switcher shows targets in this order:

1. Your four most recent windows, each selectable directly.
2. Any older windows without an associated application, also selectable directly.
3. Application groups for apps with at least one window outside the recent four.

Each application group contains **all of that app's windows**, including any
already shown as recent windows. Activating a group focuses its most recently
used window. Enter the group to choose a different one.

Window order stays fixed while the switcher is open, except that closed windows
are removed. Forward invocation skips the starting window so a quick switch takes
you to the previous one. Attached dialogs share their root window's target.

The switcher follows GNOME's existing `current-workspace-only` app-switcher
setting. It appears on the focused window's monitor, or the pointer's monitor
when no window is focused. Windows on other monitors remain selectable without
dimming those desktops. Monitor or work-area changes dismiss the switcher;
invoke it again to use the new layout.

## Install

Requires **GNOME Shell 50** and the `gnome-extensions` command. To build from this
checkout, you also need npm to run the packaging script.

From the repository root:

```sh
npm run pack
gnome-extensions install --force \
  dist/window-switching-redux@razzeee.github.io.shell-extension.zip
```

After installing or updating, restart your Shell session to load the extension
code. On Wayland, log out and back in. Then enable it:

```sh
gnome-extensions enable window-switching-redux@razzeee.github.io
```

## Controls

Use your configured GNOME application-switching shortcuts. The extension replaces
`switch-applications` and `switch-applications-backward` without changing their
accelerators. `Alt+Esc` is unchanged.

| Input | Action |
|---|---|
| Forward / backward switching shortcut | Move to the next / previous target |
| Left / Right | Move backward / forward within the current scope, wrapping at either end |
| Down or down-chevron | Enter the selected application group |
| Up or up-chevron | Leave the group |
| Move the pointer over a target | Select it without activating it |
| Click or tap a target | Select and activate it |
| Release the switching modifier | Activate the selected target |
| Enter or Space | Operate the focused chevron, otherwise activate the selected target |
| Escape | Cancel switching |

Return, keypad Enter, and ISO Enter all work as confirmation keys. Configured
switching shortcuts take precedence over navigation keys. A shortcut without a
modifier leaves the switcher open until you confirm or cancel; there is no timeout.

Keyboard and pointer share one selection. After hovering a target, keyboard
navigation continues from there. A stationary pointer does not steal selection
when the switcher opens or animates, and moving onto empty space keeps the last
selection.

Hovering or clicking a preview in a collapsed group selects or activates the
whole group. Enter it first to choose an individual window. Releasing a click or
touch outside the pressed control cancels that gesture without activation.

### Other Switcher Extensions

Avoid enabling multiple extensions that replace the application switcher. GNOME
Shell has no previous-handler stack, so the last extension to register a handler
wins. Disabling this extension restores the stock GNOME app switcher, not another
extension's overwritten handler.

## Development

Run model, layout, and stubbed Shell-input tests with Node.js 22.15 or later:

```sh
npm test
```

For integration tests, you also need GNOME Shell 50, `gnome-shell-test-tool`,
`dbus-run-session`, and `gnome-extensions`:

```sh
npm run test:shell
```

This command builds the package and runs an isolated headless Shell session.
The suite covers real previews, keyboard and pointer input, group navigation,
activation and cancellation, accessibility focus, animation interruption, and
disable/re-enable. It rejects JavaScript exceptions and GJS critical diagnostics;
other warnings remain visible for review.

Automated checks do not establish Orca usability, physical mixed-DPI behavior,
or monitor hotplug behavior. Some scenarios use injected signals or controlled
content rather than real client or hardware changes. Use the
[manual test matrix](tests/manual-test-matrix.md) for desktop validation.

To build and inspect the installable ZIP:

```sh
npm run pack
unzip -l dist/window-switching-redux@razzeee.github.io.shell-extension.zip
```

The package includes the runtime modules, metadata, stylesheet, and license files.
Tests, plans, and research are excluded.

See [CONTEXT.md](CONTEXT.md) for the switching model and terminology, and the
[GNOME Shell 50 API research](docs/research/gnome-shell-50-switcher-apis.md)
for implementation references.

## Known Limitations

- GNOME Shell 50 only. The implementation uses private Shell JavaScript APIs.
- Every target stays visible. At high window counts or in small work areas,
  previews and hit areas shrink; keyboard traversal remains the supported path.
  A usable overflow policy is still needed.
- Source windows remain visible behind their live previews.
- Orca announcements and navigation still need manual validation, as do large
  text, high-contrast themes, fractional scaling, and physical multi-monitor use.
- Hardware checks for hotplug, lock/unlock, suspend/resume, nested dialogs, and
  interrupted animations remain outstanding. Frame times and memory also need
  profiling across repeated sessions and large window counts.

## Troubleshooting

If the extension does not appear after installation, restart your Shell session
and check that you are running GNOME Shell 50. If another switcher appears,
disable competing switcher extensions.

Follow Shell logs with:

```sh
journalctl --user -f -o cat /usr/bin/gnome-shell
```

## Remove

```sh
gnome-extensions disable window-switching-redux@razzeee.github.io
gnome-extensions uninstall window-switching-redux@razzeee.github.io
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE) for the copyright notice and
[COPYING](COPYING) for the full license text.
