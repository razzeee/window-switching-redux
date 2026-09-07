// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test from 'node:test';
import {buildTraversal} from '../windowModel.js';

const url = source => `data:text/javascript,${encodeURIComponent(source).replaceAll("'", '%27')}`;
const fakeURL = url(`
export const state = {};
export class Signals {
    signals = new Map();
    next = 0;
    connect(name, callback) { const id = ++this.next; this.signals.set(id, [name, callback]); return id; }
    disconnect(id) { if (!this.signals.delete(id)) throw Error('Unknown signal'); }
    emit(name) { for (const [signal, callback] of [...this.signals.values()]) if (signal === name) callback(); }
}
export class Widget {
    constructor(...args) { this._init(...args); }
    _init() { this.children = new Set(); this.destroyCount = 0; }
    add_child(child) { this.children.add(child); child.parent = this; }
    remove_child(child) { this.children.delete(child); child.parent = null; }
    set_size(...size) { this.size = size; }
    grab_key_focus() { state.focus = this; state.calls.push('widget-focus'); }
    destroy() {
        this.destroyCount++;
        for (const child of [...this.children]) child.destroy();
        this.parent?.remove_child(this);
    }
}
export class SwitcherView {
    constructor(targets, startingWindow, activate, enter, leave, hover, focus) {
        Object.assign(this, {targets, startingWindow, activate, enter, leave, hover, focus, destroyCount: 0, calls: []});
        state.view = this;
    }
    build() { this.calls.push(['build']); }
    setSelection(index) { this.calls.push(['selection', index]); state.calls.push('selection'); state.focus = {view: this, index}; }
    setTargets(targets) { this.targets = targets; this.calls.push(['targets', targets]); }
    enterGroup(app) { this.calls.push(['enter', app]); }
    leaveGroup() { this.calls.push(['leave']); }
    activateFocusedChevron() { return false; }
    setExitTarget(index) { this.calls.push(['exit', index]); }
    destroy() { this.destroyCount++; this.parent?.remove_child(this); }
}
export const GLib = {
    PRIORITY_DEFAULT: 0,
    timeout_add_once(priority, delay, callback) {
        const id = ++state.scheduled; state.timers.set(id, {deadline: state.now + delay, callback}); return id;
    },
    source_remove(id) { state.timers.delete(id); },
};
export function elapse(duration) {
    state.now += duration;
    for (const [id, timer] of [...state.timers]) {
        if (timer.deadline <= state.now) { state.timers.delete(id); timer.callback(); }
    }
}
export const uiGroup = new Widget();
export const layoutManager = new Signals();
export function pushModal(session) { state.calls.push('push'); state.focus = session; return state.grab = {session}; }
export function popModal(grab) {
    if (grab !== state.grab) throw Error('Unknown grab');
    state.calls.push('pop'); state.grab = null;
}
export function activateWindow(...args) { state.calls.push('activate'); state.activations.push(args); }
`);
const {state, Signals, uiGroup, layoutManager, elapse} = await import(fakeURL);
const keys = ['Escape', 'Return', 'KP_Enter', 'ISO_Enter', 'space', 'Right', 'Left', 'Down', 'Up'];
const modules = new Map([
    ['gi://Clutter', `export default ${JSON.stringify({EVENT_STOP: true, EventFlags: {FLAG_SYNTHETIC: 1, FLAG_REPEATED: 4},
        ...Object.fromEntries(keys.map(key => [`KEY_${key}`, key]))})}`],
    ['gi://Meta', 'export default {KeyBindingAction: {SWITCH_APPLICATIONS: 1, SWITCH_APPLICATIONS_BACKWARD: 2}}'],
    ['gi://GObject', 'export default {registerClass: klass => klass}'],
    ['gi://GLib', `export {GLib as default} from '${fakeURL}'`],
    ['gi://St', `import {Widget} from '${fakeURL}'; export default {Widget}`],
    ['./switcherView.js', `export {SwitcherView} from '${fakeURL}'`],
    ['resource:///org/gnome/shell/ui/main.js', `export * from '${fakeURL}'`],
]);
const hooks = registerHooks({resolve(specifier, context, nextResolve) {
    if (context.parentURL === new URL('../switcherSession.js', import.meta.url).href && modules.has(specifier))
        return {url: url(modules.get(specifier)), shortCircuit: true};
    return nextResolve(specifier, context);
}});
let SwitcherSession;
try { ({SwitcherSession} = await import('../switcherSession.js')); } finally { hooks.deregister(); }

function start(t, modifierMask = 0, modifiers = modifierMask) {
    Object.assign(state, {calls: [], activations: [], timers: new Map(), scheduled: 0, now: 0, grab: null, focus: null});
    const pointer = [10, 20, modifiers];
    const globals = {get_pointer: () => pointer, get_current_time: () => 900,
        stage: {width: 1920, height: 1080}, display: {get_keybinding_action: () => 0}};
    for (const [key, value] of Object.entries(globals)) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        globalThis[key] = value;
        t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
    }
    const windows = [new Signals(), new Signals()];
    const targets = buildTraversal(windows.map(window => ({window, application: null, auxiliarySurfaces: []})), 4);
    const finished = [];
    const session = new SwitcherSession({targets, startingWindow: windows[0], direction: 1, modifierMask,
        timestamp: 100, onFinished: (...args) => finished.push(args)});
    t.after(() => {
        if (!session.destroyCount) session.destroy();
        if (!state.view.destroyCount) state.view.destroy();
    });
    session.start();
    return {session, view: state.view, windows, pointer, finished};
}
const event = key => ({get_key_symbol: () => key, get_key_code: () => 42, get_state: () => 0, get_flags: () => 0, get_time: () => 700});
const press = (session, key) => assert.equal(session.vfunc_key_press_event(event(key)), true);
const release = session => assert.equal(session.vfunc_key_release_event(event('Right')), true);
function cleaned({session, windows}) {
    assert.equal(state.grab, null);
    assert.equal(state.calls.filter(call => call === 'pop').length, 1);
    assert.equal(layoutManager.signals.size, 0);
    assert.ok(windows.every(window => window.signals.size === 0));
    assert.equal(state.timers.size, 0);
    assert.equal(uiGroup.children.size, 0);
    assert.equal(session.children.size, 0);
    assert.equal(session.destroyCount, 1);
}

test('no modifier schedules no automatic finish', t => {
    const {session, finished} = start(t);
    assert.equal(state.scheduled, 0);
    elapse(60_000);
    release(session);
    assert.deepEqual(finished, []);
    assert.deepEqual(state.activations, []);
    assert.notEqual(state.grab, null);
});

for (const confirmation of ['Return', 'modifier release']) {
    test(`target focus updates selection before ${confirmation}`, t => {
        const fixture = start(t, confirmation === 'Return' ? 0 : 8);
        const {session, view, pointer, windows} = fixture;
        assert.equal(session._selectedIndex, 1);
        view.focus(0);
        assert.equal(session._selectedIndex, 0);
        assert.deepEqual(view.calls.at(-1), ['selection', 0]);
        const calls = view.calls.length;
        view.focus(0);
        assert.equal(view.calls.length, calls, 'selection-driven focus does not recurse');
        if (confirmation === 'Return') {
            press(session, 'Return');
        } else {
            pointer[2] = 0;
            release(session);
        }
        assert.deepEqual(state.activations, [[windows[0], 700]]);
        cleaned(fixture);
    });
}

test('no modifier stays open past the old deadline during navigation and hover', t => {
    const {session, view, finished} = start(t);
    elapse(501);
    release(session);
    assert.deepEqual(finished, []);
    for (let i = 0; i < 4; i++) {
        press(session, 'Right');
        release(session);
        view.hover(0, {get_flags: () => 0, is_pointer_emulated: () => false, get_coords: () => [30 + i, 40]});
        elapse(60_000);
        assert.equal(session._selectedIndex, 0);
        assert.deepEqual(finished, []);
        assert.deepEqual(state.activations, []);
    }
});

test('initial target receives focus after the modal grab', t => {
    const {session, view, windows} = start(t, 8);
    assert.deepEqual(state.calls, ['push', 'selection']);
    assert.deepEqual(state.focus, {view, index: 1});
    assert.deepEqual(view.calls, [['build'], ['selection', 1]]);
    assert.deepEqual(session.size, [1920, 1080]);
    assert.ok(windows.every(window => window.signals.size === 1));
    assert.equal(layoutManager.signals.size, 1);
});

for (const trigger of ['Return', 'KP_Enter', 'ISO_Enter', 'space', 'click/tap', 'Escape', 'modifier release', 'fast release']) {
    test(`${trigger} finishes once and releases input before handing off the view`, t => {
        const held = trigger.includes('release');
        const fixture = start(t, held ? 8 : 0, trigger === 'fast release' ? 0 : held ? 8 : 0);
        const {session, view, windows, pointer, finished} = fixture;
        if (trigger === 'modifier release') {
            release(session);
            assert.deepEqual(finished, []);
            pointer[2] = 0;
            release(session);
        } else if (trigger === 'click/tap') view.activate(1, 700);
        else if (trigger !== 'fast release') press(session, trigger);
        assert.deepEqual(finished, [[session, view]], 'the requested trigger finishes before any subsequent input');
        press(session, 'Return');
        release(session);
        view.activate(1, 800);
        elapse(60_000);
        assert.deepEqual(state.activations, trigger === 'Escape' ? [] : [[windows[1], trigger === 'fast release' ? 900 : 700]]);
        assert.deepEqual(finished, [[session, view]]);
        assert.deepEqual(view.calls.at(-1), ['exit', trigger === 'Escape' ? null : 1]);
        assert.equal(view.destroyCount, 0);
        assert.ok(state.calls.indexOf('pop') > state.calls.indexOf('push'));
        if (trigger !== 'Escape') assert.ok(state.calls.indexOf('activate') > state.calls.indexOf('pop'));
        cleaned(fixture);
    });
}

for (const trigger of ['last window removed', 'system modal', 'destroy']) {
    test(`${trigger} synchronously destroys the view without activation`, t => {
        const fixture = start(t);
        const {session, view, windows, finished} = fixture;
        if (trigger === 'last window removed') {
            windows[1].emit('unmanaged');
            assert.equal(windows[1].signals.size, 0);
            assert.deepEqual(finished, []);
            assert.deepEqual(view.calls.slice(-3), [['targets', session._targets], ['leave'], ['selection', 0]]);
            windows[0].emit('unmanaged');
        } else if (trigger === 'system modal') layoutManager.emit('system-modal-opened');
        else session.destroy();
        assert.deepEqual(finished, trigger === 'destroy' ? [] : [[session, null]]);
        assert.equal(view.destroyCount, 1);
        elapse(60_000);
        assert.deepEqual(state.activations, []);
        cleaned(fixture);
    });
}
