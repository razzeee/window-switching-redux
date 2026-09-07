// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test from 'node:test';

import {buildTraversal, getGroupIndices, getTopLevelIndices} from '../windowModel.js';

const keys = ['Escape', 'Return', 'KP_Enter', 'ISO_Enter', 'space', 'Down', 'Up', 'Right', 'Left', 'Tab', 'x'];
const Clutter = {
    EVENT_STOP: true,
    EVENT_PROPAGATE: false,
    EventFlags: {FLAG_SYNTHETIC: 1, FLAG_REPEATED: 4},
    EventType: {KEY_PRESS: 1, KEY_RELEASE: 2, MOTION: 3, BUTTON_PRESS: 4, TOUCH_BEGIN: 5},
    ...Object.fromEntries(keys.map(key => [`KEY_${key}`, key])),
};
const Meta = {KeyBindingAction: {NONE: 0, SWITCH_APPLICATIONS: 1, SWITCH_APPLICATIONS_BACKWARD: 2}};
const modules = new Map([
    ['gi://Clutter', `export default ${JSON.stringify(Clutter)}`],
    ['gi://Meta', `export default ${JSON.stringify(Meta)}`],
    ['gi://GLib', 'export default {}'],
    ['gi://GObject', 'export default {registerClass: klass => klass}'],
    ['gi://St', 'export default {Widget: class {_init() {} destroy() {}}}'],
    ['resource:///org/gnome/shell/ui/main.js', 'export const activations = []; export function activateWindow(...args) {activations.push(args);}'],
    ['./switcherView.js', 'export class SwitcherView {}'],
]);
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (context.parentURL === new URL('../switcherSession.js', import.meta.url).href && modules.has(specifier))
            return {url: `data:text/javascript,${encodeURIComponent(modules.get(specifier))}`, shortCircuit: true};
        return nextResolve(specifier, context);
    },
});
let SwitcherSession;
const {activations} = await import(`data:text/javascript,${encodeURIComponent(modules.get('resource:///org/gnome/shell/ui/main.js'))}`);
try {
    ({SwitcherSession} = await import('../switcherSession.js'));
} finally {
    hooks.deregister();
}

function createSession(t, action = Meta.KeyBindingAction.NONE) {
    const pointer = [10, 20, 8];
    const previousPointer = Object.getOwnPropertyDescriptor(globalThis, 'get_pointer');
    globalThis.get_pointer = () => [...pointer];
    t.after(() => {
        if (previousPointer)
            Object.defineProperty(globalThis, 'get_pointer', previousPointer);
        else
            delete globalThis.get_pointer;
    });
    const application = {name: 'Files'};
    const records = Array.from({length: 6}, (_, index) => ({
        window: {name: `W${index}`},
        auxiliarySurfaces: [],
        application: index % 2 === 0 ? application : null,
    }));
    const session = Object.create(SwitcherSession.prototype);
    session._init({
        targets: buildTraversal(records, 4), startingWindow: records[0].window,
        direction: 1, modifierMask: 8, timestamp: 1234, onFinished: () => {},
    });
    const selections = [];
    const groupChanges = [];
    const finishes = [];
    Object.assign(session, {
        _selectedIndex: 0,
        _enteredApplication: null,
        _lastDirection: 1,
        _grab: {},
        _view: {
            activateFocusedChevron: () => false,
            setSelection: index => selections.push(index),
            enterGroup: app => groupChanges.push(app),
            leaveGroup: () => groupChanges.push(null),
        },
        _finish: (...args) => finishes.push(args),
    });
    const previousDisplay = Object.getOwnPropertyDescriptor(globalThis, 'display');
    t.after(() => {
        if (previousDisplay)
            Object.defineProperty(globalThis, 'display', previousDisplay);
        else
            delete globalThis.display;
    });
    const lookups = [];
    globalThis.display = {
        get_keybinding_action: (code, state) => {
            lookups.push([code, state]);
            return action;
        },
    };
    return {session, application, selections, groupChanges, finishes, lookups, pointer};
}

function motion(session, index, coords = [30, 40], flags = 0, emulated = false) {
    const event = {
        get_coords: () => coords,
        get_flags: () => flags,
        is_pointer_emulated: () => emulated,
    };
    if (index === -1)
        assert.equal(session.vfunc_motion_event(event), Clutter.EVENT_PROPAGATE);
    else
        session._onPointerMotion(index, event);
}

function press(session, key, state = 0, flags = 0) {
    assert.equal(session.vfunc_key_press_event({
        get_key_symbol: () => Clutter[`KEY_${key}`],
        get_key_code: () => 42,
        get_state: () => state,
        get_flags: () => flags,
        get_time: () => 1234,
    }), Clutter.EVENT_STOP);
}

for (const [action, direction, state] of [
    [Meta.KeyBindingAction.SWITCH_APPLICATIONS, 1, 8],
    [Meta.KeyBindingAction.SWITCH_APPLICATIONS_BACKWARD, -1, 9],
]) {
    for (const entered of [false, true]) {
        for (const key of keys.filter(key => key !== 'x')) {
            test(`switch action ${direction} wins over ${key}, entered group ${entered}`, t => {
                const {session, application, selections, groupChanges, finishes, lookups} = createSession(t, action);
                session._view.activateFocusedChevron = () => assert.fail('binding must win over focused chevron');
                session._selectedIndex = session._targets.findIndex(target => target.kind === 'app-group');
                if (entered)
                    session._enterGroup();
                selections.length = 0;
                groupChanges.length = 0;
                const scope = entered
                    ? getGroupIndices(session._targets, application)
                    : getTopLevelIndices(session._targets);
                const position = scope.indexOf(session._selectedIndex);
                const expectedIndex = scope[(position + direction + scope.length) % scope.length];

                press(session, key, state);

                assert.equal(session._selectedIndex, expectedIndex);
                assert.equal(session._lastDirection, direction);
                assert.equal(session._enteredApplication, entered ? application : null);
                assert.deepEqual(selections, [expectedIndex]);
                assert.deepEqual(groupChanges, []);
                assert.deepEqual(finishes, []);
                assert.deepEqual(lookups, [[42, state]]);
                const repeatedIndex = scope[(position + 2 * direction + scope.length * 2) % scope.length];
                press(session, key, state, Clutter.EventFlags.FLAG_REPEATED);
                assert.equal(session._selectedIndex, repeatedIndex, 'switching bindings continue to autorepeat');
                assert.deepEqual(selections, [expectedIndex, repeatedIndex]);
                assert.deepEqual(finishes, []);
            });
        }
    }
}

for (const key of ['Escape', 'Return', 'KP_Enter', 'ISO_Enter', 'space']) {
    test(`unbound ${key} keeps its finish fallback`, t => {
        const {session, finishes, selections} = createSession(t);
        press(session, key);
        assert.deepEqual(finishes, [[key !== 'Escape', false, 1234]]);
        assert.deepEqual(selections, []);
    });
}

for (const key of ['Return', 'KP_Enter', 'ISO_Enter', 'space']) {
    test(`${key} operates a focused chevron without committing the session`, t => {
        const {session, finishes} = createSession(t);
        session._modifierMask = 0;
        let activated = 0;
        session._view.activateFocusedChevron = () => { activated++; return true; };
        press(session, key);
        assert.equal(activated, 1);
        assert.deepEqual(finishes, []);
    });
    for (const entered of [false, true]) {
        test(`held ${key} does not commit after ${entered ? 'leaving' : 'entering'} a group`, t => {
            const {session, application, finishes, groupChanges} = createSession(t);
            session._modifierMask = 0;
            if (entered)
                session._enterGroup(application);
            groupChanges.length = 0;
            session._view.activateFocusedChevron = () => {
                if (entered)
                    session._leaveGroup();
                else
                    session._enterGroup(application);
                // Scope changes restore target focus, so later confirmation would commit.
                session._view.activateFocusedChevron = () => false;
                return true;
            };
            press(session, key);
            assert.equal(session._enteredApplication, entered ? null : application);
            assert.deepEqual(groupChanges, [entered ? null : application]);
            const selected = session._selectedIndex;
            for (const flags of [Clutter.EventFlags.FLAG_REPEATED, Clutter.EventFlags.FLAG_REPEATED | Clutter.EventFlags.FLAG_SYNTHETIC])
                press(session, key, 0, flags);
            assert.deepEqual(finishes, [], 'autorepeat must not activate the newly focused window');
            assert.equal(session._selectedIndex, selected);
            press(session, key);
            assert.deepEqual(finishes, [[true, false, 1234]], 'a second physical press still confirms');
        });
    }
}

test('unbound arrows enter, navigate within, and leave a group', t => {
    const {session, application, finishes, groupChanges} = createSession(t);
    const groupIndex = session._targets.findIndex(target => target.kind === 'app-group');
    const indices = getGroupIndices(session._targets, application);
    session._selectedIndex = groupIndex;

    press(session, 'Down');
    assert.equal(session._enteredApplication, application);
    assert.equal(session._selectedIndex, indices[0]);
    press(session, 'Left');
    assert.equal(session._selectedIndex, indices.at(-1));
    press(session, 'Right');
    assert.equal(session._selectedIndex, indices[0]);
    press(session, 'Up');
    assert.equal(session._enteredApplication, null);
    assert.equal(session._selectedIndex, groupIndex);
    press(session, 'Right');
    assert.equal(session._selectedIndex, 0);
    press(session, 'Left');
    assert.equal(session._selectedIndex, groupIndex);
    assert.deepEqual(groupChanges, [application, null]);
    assert.deepEqual(finishes, []);
});

test('an unrelated action and key are consumed without changing selection', t => {
    const {session, finishes, selections, groupChanges} = createSession(t, 999);
    press(session, 'x', 8);
    assert.equal(session._selectedIndex, 0);
    assert.deepEqual(finishes, []);
    assert.deepEqual(selections, []);
    assert.deepEqual(groupChanges, []);
});

test('initial pointer baseline contains coordinates, not modifiers', t => {
    const {session, pointer} = createSession(t);
    assert.deepEqual(session._pointerPosition, pointer.slice(0, 2));
    pointer[0]++;
    assert.deepEqual(session._pointerPosition, [10, 20]);
});

for (const [name, type] of Object.entries(Clutter.EventType)) {
    test(`capture dispatches ${name} without intercepting pointer/touch gestures`, t => {
        const {session} = createSession(t);
        const calls = [];
        session.vfunc_key_press_event = () => { calls.push('KEY_PRESS'); return Clutter.EVENT_STOP; };
        session.vfunc_key_release_event = () => { calls.push('KEY_RELEASE'); return Clutter.EVENT_STOP; };
        const keyboard = name === 'KEY_PRESS' || name === 'KEY_RELEASE';
        assert.equal(session.vfunc_captured_event({type: () => type}), keyboard ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE);
        assert.deepEqual(calls, keyboard ? [name] : []);
    });
}

for (const entered of [false, true]) {
    for (const direction of [1, -1]) {
        test(`keyboard wraps from hovered selection: entered ${entered}, direction ${direction}`, t => {
            const {session, application, selections, groupChanges} = createSession(t,
                direction === 1 ? Meta.KeyBindingAction.SWITCH_APPLICATIONS : Meta.KeyBindingAction.SWITCH_APPLICATIONS_BACKWARD);
            if (entered)
                session._enterGroup(application);
            const scope = entered ? getGroupIndices(session._targets, application) : getTopLevelIndices(session._targets);
            const hovered = direction === 1 ? scope.at(-1) : scope[0];
            session._selectedIndex = direction === 1 ? scope[0] : scope.at(-1);
            selections.length = 0;
            groupChanges.length = 0;

            motion(session, hovered);
            press(session, 'Tab');

            const expected = direction === 1 ? scope[0] : scope.at(-1);
            assert.equal(session._selectedIndex, expected);
            assert.equal(session._enteredApplication, entered ? application : null);
            assert.deepEqual(selections, [hovered, expected]);
            assert.deepEqual(groupChanges, []);
        });
    }
}

for (const activate of [false, true]) {
    test(`every collapsed child selects its group without expanding, activate ${activate}`, t => {
        const {session, application, selections, groupChanges, finishes} = createSession(t);
        const group = session._targets.findIndex(target => target.kind === 'app-group');
        for (const index of getGroupIndices(session._targets, application)) {
            session._selectedIndex = 0;
            selections.length = 0;
            finishes.length = 0;
            if (activate)
                session._activateIndex(index, 4321);
            else
                motion(session, index, [30 + index, 40]);
            assert.equal(session._selectedIndex, group);
            assert.equal(session._enteredApplication, null);
            assert.deepEqual(selections, [group]);
            assert.deepEqual(groupChanges, []);
            assert.deepEqual(finishes, activate ? [[true, false, 4321]] : []);
        }
    });
}

for (const [label, coords, flags, emulated] of [
    ['stationary', [10, 20], 0, false],
    ['fractional', [10.9, 20.9], 0, false],
    ['synthetic', [30, 40], Clutter.EventFlags.FLAG_SYNTHETIC | 2, false],
    ['emulated', [30, 40], 0, true],
]) {
    test(`${label} motion changes neither selection nor baseline`, t => {
        const {session, selections} = createSession(t);
        const index = getTopLevelIndices(session._targets)[1];
        motion(session, index, coords, flags, emulated);
        assert.equal(session._selectedIndex, 0);
        assert.deepEqual(session._pointerPosition, [10, 20]);
        assert.deepEqual(selections, []);
        motion(session, index, [30.9, 40.9]);
        assert.equal(session._selectedIndex, index);
        assert.deepEqual(session._pointerPosition, [30, 40]);
        assert.deepEqual(selections, [index]);
    });
}

for (const operation of ['advance', 'enter', 'leave']) {
    test(`${operation} refreshes baseline when the pointer has moved elsewhere`, t => {
        const {session, application, pointer, selections} = createSession(t);
        if (operation === 'leave')
            session._enterGroup(application);
        pointer.splice(0, 2, 80, 90);
        if (operation === 'advance')
            press(session, 'Right');
        else if (operation === 'enter')
            session._enterGroup(application);
        else
            press(session, 'Up');
        const selected = session._selectedIndex;
        const scope = session._enteredApplication ? getGroupIndices(session._targets, application) : getTopLevelIndices(session._targets);
        const other = scope.find(index => index !== selected);
        selections.length = 0;
        assert.deepEqual(session._pointerPosition, [80, 90]);
        motion(session, other, [80.7, 90.2]);
        assert.equal(session._selectedIndex, selected);
        assert.deepEqual(selections, []);
        motion(session, other, [81, 90]);
        assert.equal(session._selectedIndex, other);
        assert.deepEqual(selections, [other]);
    });
}

test('movement within a target does not repeat selection or restart its fade', t => {
    const {session, selections} = createSession(t);
    const index = getTopLevelIndices(session._targets)[1];
    motion(session, index);
    motion(session, index, [31, 40]);
    motion(session, index, [31, 41]);
    assert.equal(session._selectedIndex, index);
    assert.deepEqual(selections, [index]);
    assert.deepEqual(session._pointerPosition, [31, 41]);
});

test('background motion retains selection but updates the baseline', t => {
    const {session, selections} = createSession(t);
    const index = getTopLevelIndices(session._targets)[1];
    motion(session, index);
    motion(session, -1, [70.8, 80.2]);
    motion(session, 0, [70.9, 80.9]);
    assert.equal(session._selectedIndex, index);
    assert.deepEqual(session._pointerPosition, [70, 80]);
    assert.deepEqual(selections, [index]);
});

for (const activate of [false, true]) {
    test(`entered scope ignores headers, direct windows and other groups, activate ${activate}`, t => {
        const {session, application, selections, finishes} = createSession(t);
        const other = {name: 'Other'};
        session._targets = [...session._targets,
            {kind: 'app-group', application: other, windows: []},
            {kind: 'grouped-window', application: other, window: {}},
        ];
        session._enterGroup(application);
        const selected = session._selectedIndex;
        selections.length = 0;
        const hidden = session._targets.flatMap((target, index) =>
            target.kind === 'grouped-window' && target.application === application ? [] : [index]);
        for (const index of [-2, ...hidden, session._targets.length]) {
            if (activate)
                session._activateIndex(index, 4321);
            else
                motion(session, index, [50 + index, 60]);
            assert.equal(session._selectedIndex, selected);
        }
        assert.deepEqual(selections, []);
        assert.deepEqual(finishes, []);
    });
}

for (const entered of [false, true]) {
    for (const trigger of ['Return', 'release', 'click']) {
        test(`${trigger} activates hovered ${entered ? 'group child' : 'collapsed group'} and clears pointer state`, t => {
            const {session, application, pointer, selections} = createSession(t);
            if (entered)
                session._enterGroup(application);
            const child = getGroupIndices(session._targets, application).at(-1);
            motion(session, child);
            const selected = session._selectedIndex;
            const target = session._targets[selected];
            const expectedWindow = entered ? target.window : target.windows[0].window;
            const exits = [];
            const completed = [];
            const view = session._view;
            view.setExitTarget = index => exits.push(index);
            session.remove_child = childView => assert.equal(childView, view);
            session._disconnectInput = () => { session._grab = null; };
            session._onFinished = (...args) => completed.push(args);
            delete session._finish;
            activations.length = 0;

            if (trigger === 'Return') {
                press(session, 'Return');
            } else if (trigger === 'release') {
                assert.equal(session.vfunc_key_release_event({get_time: () => 1234}), Clutter.EVENT_STOP);
                assert.deepEqual(activations, []);
                pointer[2] = 0;
                assert.equal(session.vfunc_key_release_event({get_time: () => 1234}), Clutter.EVENT_STOP);
            } else {
                session._activateIndex(child, 1234);
            }

            assert.deepEqual(activations, [[expectedWindow, 1234]]);
            assert.deepEqual(exits, [selected]);
            assert.deepEqual(completed, [[session, view]]);
            assert.equal(session._pointerPosition, null);
            assert.equal(session._grab, null);
            const previousSelections = [...selections];
            motion(session, child);
            motion(session, -1);
            session._activateIndex(child, 5678);
            session.advance(1);
            session._finish(true);
            assert.equal(session._pointerPosition, null);
            assert.deepEqual(selections, previousSelections);
            assert.deepEqual(activations, [[expectedWindow, 1234]]);
            assert.equal(completed.length, 1);
        });
    }
}
