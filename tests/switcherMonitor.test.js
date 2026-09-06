// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test from 'node:test';

const areas = [
    {x: 0, y: 32, width: 1920, height: 1048},
    {x: 1920, y: 800, width: 1920, height: 1080},
];
const modules = new Map([
    ['gi://Atk', 'export default {Role: {MENU: 1}}'],
    ['gi://Clutter', 'export default {}'],
    ['gi://Cogl', 'export default {}'],
    ['gi://GObject', 'export default {registerClass: klass => klass}'],
    ['gi://Meta', 'export default {}'],
    ['gi://Pango', 'export default {}'],
    ['gi://Shell', 'export default {GLSLEffect: class {}}'],
    ['gi://St', `export default {ThemeContext: {get_for_stage: () => ({scale_factor: 1})}, Widget: class {
        _init() {}
        set_size(width, height) { this.width = width; this.height = height; }
    }}`],
    ['resource:///org/gnome/shell/ui/main.js', `export const layoutManager = {
        monitors: ${JSON.stringify(areas)},
        getWorkAreaForMonitor(index) { return {...this.monitors[index]}; }
    }`],
]);
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (context.parentURL === new URL('../switcherView.js', import.meta.url).href && modules.has(specifier))
            return {url: `data:text/javascript,${encodeURIComponent(modules.get(specifier))}`, shortCircuit: true};
        return nextResolve(specifier, context);
    },
});
let SwitcherView;
try {
    ({SwitcherView} = await import('../switcherView.js'));
} finally {
    hooks.deregister();
}

for (const focusedMonitor of [0, 1, -1, null]) {
    test(`view captures focused monitor ${focusedMonitor}, not the combined desktop`, t => {
        for (const property of ['stage', 'display']) {
            const previous = Object.getOwnPropertyDescriptor(globalThis, property);
            t.after(() => {
                if (previous)
                    Object.defineProperty(globalThis, property, previous);
                else
                    delete globalThis[property];
            });
        }
        let pointerMonitor = focusedMonitor === 1 ? 0 : 1;
        globalThis.stage = {width: 3840, height: 1880};
        globalThis.display = {get_current_monitor: () => pointerMonitor};
        const startingWindow = focusedMonitor === null ? null : {get_monitor: () => focusedMonitor};
        const view = Object.create(SwitcherView.prototype);
        view._init([], startingWindow, () => {}, () => {}, () => {}, () => {});
        const expected = focusedMonitor === null || focusedMonitor < 0 ? pointerMonitor : focusedMonitor;
        assert.deepEqual(view._workArea, areas[expected]);

        pointerMonitor = 1 - expected;
        assert.deepEqual(view._workArea, areas[expected], 'moving the pointer must not move an open switcher');
    });
}
