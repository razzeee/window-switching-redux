// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const complete = 'PASS: Window Switching Redux smoke suite complete';
for (const [description, status, stderr, expected] of [
    ['completed suite', 0, complete, 0],
    ['missing completion despite zero exit', 0, 'Script failed', 1],
    ['helper disappeared without completion or script failure marker', 0,
        'Gio.DBusError: GDBus.Error:org.freedesktop.DBus.Error.ServiceUnknown: The name org.gnome.Shell.PerfHelper was not provided by any .service files', 1],
    ['failure after completion', 0, `${complete}\nScript failed`, 1],
    ['nonzero exit despite completion', 1, complete, 1],
    ['terminated process', null, '', 1],
]) {
    test(`Shell runner detects ${description}`, () => {
        const stub = `
            import {statSync} from 'node:fs';
            export const spawnSync = (_command, _args, options) => {
                if (options.env.XDG_RUNTIME_DIR === process.env.XDG_RUNTIME_DIR ||
                    (statSync(options.env.XDG_RUNTIME_DIR).mode & 0o777) !== 0o700)
                    throw new Error('Shell runtime directory must be private and isolated');
                return ${JSON.stringify({status, stderr, stdout: ''})};
            };
        `;
        const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
            import {registerHooks} from 'node:module';
            registerHooks({
                resolve(specifier, context, nextResolve) {
                    if (specifier === 'node:child_process')
                        return {url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(stub)}`)}, shortCircuit: true};
                    return nextResolve(specifier, context);
                },
            });
            await import(${JSON.stringify(new URL('./run-shell-tests.js', import.meta.url).href)});
        `], {encoding: 'utf8'});
        assert.equal(child.status, expected, child.stderr);
        assert.ok(child.stderr.includes(stderr));
    });
}
