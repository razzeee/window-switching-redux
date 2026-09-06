// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const runtime = mkdtempSync(join(tmpdir(), 'window-switcher-tests-'));
let result;
try {
    result = spawnSync('dbus-run-session', [
        '--', 'gnome-shell-test-tool', '--headless',
        '--extension', 'dist/window-switching-redux@razzeee.github.io.shell-extension.zip',
        'tests/smoke.js',
    ], {
        encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
        env: {...process.env, XDG_RUNTIME_DIR: runtime},
    });
} finally {
    rmSync(runtime, {recursive: true});
}

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

// Some test-tool versions do not forward a failed automation script's exit status.
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.error || result.status !== 0 ||
    !output.includes('PASS: Window Switching Redux smoke suite complete') ||
    output.includes('Script failed')) {
    console.error(result.error ?? 'Shell integration tests did not complete successfully.');
    process.exitCode = 1;
}
