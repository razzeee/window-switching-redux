# GNOME Shell Extension Guidelines

This project targets GNOME Shell 50 only. Do not add compatibility checks or fallback paths for other Shell versions unless the target changes explicitly.

Follow both official references:

- https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- https://gjs.guide/extensions/review-guidelines/best-practices.html

## Generated Code Notice

Every AI-generated extension source file must include this notice:

```js
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
```

The maintainer must remove the notice manually before an EGO submission. Its presence in a submission indicates that the code has not received the required human review.

## Review Requirements

- Do not create objects, connect signals, add main-loop sources, or modify GNOME Shell before `enable()`.
- `disable()` must undo everything done by `enable()`. Keep the methods adjacent.
- The class that creates a resource owns its cleanup. Remove sources, disconnect signals, release child references, and call `super.destroy()` last.
- Override a custom GObject widget's `destroy()` method instead of connecting to its `destroy` signal.
- Do not use lifecycle booleans such as `_enabled` or `_destroyed`. Null destroyed instances and do not reuse them.
- Do not add defensive `try`/`catch`, optional calls, or API-existence checks around guaranteed GNOME 50 APIs.
- Keep `extension.js` small and split substantial behavior into single-responsibility modules.
- Keep Shell-process modules separate from preferences-process modules. Never import `Gtk`, `Gdk`, or `Adw` into Shell code, or `Clutter`, `Meta`, `St`, or `Shell` into preferences code.
- Avoid subprocesses. Prefer platform APIs or D-Bus, and keep heavy work out of the Shell process.
- Use `St.Icon` in Shell UI and `Gtk.Image` in preferences. Do not use emoji or ASCII art as controls or indicators.
- If an extension-owned GSettings schema is introduced, put `settings-schema` in `metadata.json` and call `this.getSettings()` without repeating the schema ID. Construct settings for stock GNOME schemas explicitly with `Gio.Settings`.
- Keep lines at or below 200 characters. Prefer clear names over comments that restate the code.
- Do not ship placeholders, minified code, binaries, telemetry, excessive logging, or unnecessary files.
- Keep `metadata.json` minimal and valid, and use a GPL-2.0-or-later-compatible license.
- Verify every GNOME Shell API against GNOME 50 sources or documentation. Never invent an API.
