// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {calculateFullLayout, calculateGroupHorizontalLayout, CHEVRON_SIZE, DIRECT_ICON_SIZE} from '../switcherLayout.js';

const viewSource = readFileSync(new URL('../switcherView.js', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('../switcherSession.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../stylesheet.css', import.meta.url), 'utf8');

test('accessible focus follows selection across collapsed and entered group scopes', () => {
    const stageSignals = new Map();
    let focused = null;
    const stage = {
        connect(name, callback) { stageSignals.set(name, callback); return name; },
        disconnect(id) { assert.ok(stageSignals.delete(id)); },
        get_key_focus() { return focused; },
    };
    const methods = ['build', '_disconnectKeyFocus', '_connectActivation', 'setSelection'].map(name =>
        viewSource.match(new RegExp(`    ${name}\\([^]*?\\n    }`))[0]).join(',\n');
    const implementation = new Function('Clutter', 'Atk', 'global', `return {${methods}};`)(
        {ClickGesture: class { connect() { return 1; } }}, {StateType: {SELECTED: 'selected'}}, {stage});
    const selectIndex = new Function(`return ({${sessionSource.match(/    _selectIndex\([^]*?\n    }/)[0]}})._selectIndex;`)();
    const app = {};
    const otherApp = {};
    const targets = [{kind: 'direct-window'}, {kind: 'app-group', application: app},
        {kind: 'grouped-window', application: app}, {kind: 'grouped-window', application: app},
        {kind: 'app-group', application: otherApp}, {kind: 'grouped-window', application: otherApp}];
    const makeActor = () => {
        const signals = new Map();
        const actor = {
            reactive: true, can_focus: true, visible: true,
            connect(name, callback) { signals.set(name, callback); },
            add_action() {}, add_accessible_state() {}, remove_accessible_state() {},
            add_style_class_name() {}, remove_style_class_name() {},
            remove_transition() {}, get_transition() { return null; },
            contains(child) { return child === this || this.children.some(actor => actor.contains(child)); },
            children: [],
            grab_key_focus() {
                if (focused === this)
                    return;
                focused = this;
                signals.get('key-focus-in')?.();
                stageSignals.get('notify::key-focus')?.();
            },
        };
        actor._selectionActor = actor;
        actor._selectionLabel = actor;
        return actor;
    };
    const actors = targets.map(() => makeActor());
    for (const actor of actors) {
        actor.children = Array.from({length: 4}, makeActor); // Icon bin, label, down/up chevrons.
        for (const child of actor.children)
            child.children.push(makeActor()); // Icon children and Clutter.Text do not bubble focus.
        actor._groupOutline = makeActor(); // Group outline is a sibling, not a target child.
    }
    for (const index of [1, 4]) {
        actors[index]._downChevron = actors[index].children[2];
        actors[index]._upChevron = actors[index].children[3];
        actors[index]._upChevron.visible = actors[index]._upChevron.can_focus = false;
    }
    const view = {...implementation, _targets: targets, _targetActors: actors,
        _selectedIndex: -1, _enteredApplication: null, _clickActions: [],
        _build() {}, _themeContext: {connect() { return 1; }}};
    const session = {_grab: {}, _targets: targets, _selectedIndex: -1, _enteredApplication: null,
        _view: view, _selectIndex: selectIndex};
    view._targetFocused = index => session._selectIndex(index);
    actors.forEach((actor, index) => view._connectActivation(actor, index));
    view.build();
    for (const index of [2, 3, 5])
        actors[index].can_focus = false;
    session._selectIndex(0);
    actors[2].grab_key_focus(); // ATK bypasses can_focus.
    assert.equal(session._selectedIndex, 1, 'collapsed child selects its app group');
    assert.equal(focused, actors[1]);
    actors[3].grab_key_focus();
    assert.equal(focused, actors[1], 'already-selected group still recovers key focus');
    actors[5].grab_key_focus();
    assert.equal(session._selectedIndex, 4);
    assert.equal(focused, actors[4]);
    for (let index = 0; index < actors.length; index++) {
        const actor = actors[index];
        const expected = index === 2 || index === 3 ? 1 : index === 5 ? 4 : index;
        for (const child of [...actor.children.flatMap(child => [child, ...child.children]), actor._groupOutline]) {
            session._selectIndex(expected === 0 ? 1 : 0);
            child.grab_key_focus();
            assert.equal(session._selectedIndex, expected, 'descendant focus selects its scoped owner');
            const down = actor._downChevron;
            const expectedFocus = down?.contains(child) ? down : actors[expected];
            assert.equal(focused, expectedFocus, 'visible chevrons retain focus; decorative descendants normalize');
        }
    }

    session._enteredApplication = view._enteredApplication = app;
    actors.forEach((actor, index) => {
        actor.can_focus = index === 2 || index === 3;
        actor.reactive = actor.can_focus || index === 1;
        if (actor._downChevron) {
            actor._downChevron.can_focus = actor._downChevron.visible = false;
            actor._upChevron.can_focus = actor._upChevron.visible = index === 1;
        }
    });
    session._selectIndex(2);
    actors[3].grab_key_focus();
    assert.equal(session._selectedIndex, 3, 'entered child selects itself');
    for (const index of [0, 1, 4, 5]) {
        for (const child of [actors[index], ...actors[index].children.flatMap(child => [child, ...child.children]), actors[index]._groupOutline]) {
            child.grab_key_focus();
            assert.equal(session._selectedIndex, 3, 'focus must not escape the entered scope');
            const up = actors[1]._upChevron;
            assert.equal(focused, up.contains(child) ? up : actors[3]);
        }
    }
    actors[2].children[1].children[0].grab_key_focus();
    assert.equal(session._selectedIndex, 2);
    assert.equal(focused, actors[2]);
    session._selectIndex(3);
    const outside = makeActor();
    outside.grab_key_focus();
    assert.equal(focused, outside, 'unrelated stage focus must not be stolen');
    assert.equal(stageSignals.size, 1);
    view._disconnectKeyFocus();
    view._disconnectKeyFocus();
    assert.equal(stageSignals.size, 0);
    actors.forEach(actor => { actor.reactive = false; actor.can_focus = false; });
    view._targetFocused = () => assert.fail('exit must not request selection');
    actors[2].grab_key_focus();
    assert.equal(session._selectedIndex, 3);
    assert.equal(focused, actors[2], 'exit must not grab focus back from another actor');
    actors[1].children[2].children[0].grab_key_focus();
    assert.equal(focused, actors[1].children[2].children[0], 'exit leaves descendant focus alone too');
});

test('four narrow direct windows keep positioned icons within their own preview widths', () => {
    const method = viewSource.match(/    _positionDirectIcon\([^]*?\n    }/)[0];
    const position = new Function('DIRECT_ICON_SIZE', `return ({${method}})._positionDirectIcon;`)(DIRECT_ICON_SIZE);
    const targets = Array.from({length: 4}, () => ({kind: 'direct-window'}));
    const {geometries} = calculateFullLayout(targets, {x: 0, y: 0, width: 1280, height: 720},
        () => ({width: 200, height: 1200}), {window: 20, app: 20});
    const icons = [...geometries.values()].map(geometry => {
        const actor = {_directIcon: {}};
        position.call({_themeScale: 1, _setActorProperties: (icon, properties) => Object.assign(icon, properties)}, actor, geometry, false);
        const icon = actor._directIcon;
        const width = DIRECT_ICON_SIZE * icon.scale_x;
        assert.ok(icon.x >= 0, 'icon must not protrude left of a narrow preview');
        assert.ok(icon.x + width <= geometry.width + 1e-8, 'icon must not protrude right of a narrow preview');
        return {x: geometry.x + icon.x, right: geometry.x + icon.x + width};
    });
    assert.ok(icons[0].right < icons[1].x);
    assert.ok(icons[2].right < icons[3].x);
});

test('confirmation activates only a visible, reactive, focusable chevron owned by the view', () => {
    const method = viewSource.match(/    activateFocusedChevron\([^]*?\n    }/);
    assert.ok(method, 'view must expose direct focused-chevron confirmation');
    let focused = null;
    const activate = new Function('global', `return ({${method[0]}}).activateFocusedChevron;`)(
        {stage: {get_key_focus: () => focused}});
    const down = {visible: true, reactive: true, can_focus: true};
    const up = {...down};
    const application = {};
    const calls = [];
    const view = {
        _targets: [{kind: 'direct-window'}, {kind: 'app-group', application}],
        _targetActors: [{}, {_downChevron: down, _upChevron: up}],
        _enterGroupRequested: app => calls.push(app),
        _leaveGroupRequested: () => calls.push(null),
    };
    for (const button of [down, up]) {
        focused = button;
        assert.equal(activate.call(view), true);
        for (const property of ['visible', 'reactive', 'can_focus']) {
            button[property] = false;
            assert.equal(activate.call(view), false, `${property} is required for confirmation`);
            button[property] = true;
        }
    }
    for (focused of [null, {}, view._targetActors[1]])
        assert.equal(activate.call(view), false);
    assert.deepEqual(calls, [application, null]);
});

test('group composition makes only the active scope chevron focusable', () => {
    const method = viewSource.match(/    _positionGroupChrome\([^]*?\n    }/)[0];
    const position = new Function('ICON_SIZE', 'CHEVRON_SIZE', 'TRANSITION_TIME', 'Atk',
        `return ({${method}})._positionGroupChrome;`)(120, CHEVRON_SIZE, 180, {StateType: {EXPANDED: 1}});
    const button = () => ({show() { this.visible = true; }, hide() { this.visible = false; }, fake_release() {}});
    const actor = {_downChevron: button(), _upChevron: button(), _groupOutline: {}, _iconBin: {},
        add_accessible_state() {}, remove_accessible_state() {}};
    const view = {_themeScale: 1, _positionLabel() {},
        _setActorProperties(target, properties, _animate, _duration, complete = null) {
            Object.assign(target, properties);
            complete?.();
        }};
    const geometry = {x: 0, y: 0, width: 120, iconSize: 120, chromeScale: 1, iconX: 0, iconY: 32, previewX: 0, previewWidth: 0, previewHeight: 0};
    for (const [entered, isEntered, down, up] of [[false, false, true, false], [true, true, false, true], [true, false, false, false], [false, false, true, false]]) {
        position.call(view, actor, geometry, entered, isEntered, false);
        for (const [chevron, expected] of [[actor._downChevron, down], [actor._upChevron, up]]) {
            assert.equal(chevron.can_focus, expected);
            assert.equal(chevron.reactive, expected);
            assert.equal(chevron.visible, expected);
        }
    }
});

test('hidden label sizing applies style before querying unconstrained intrinsic width', () => {
    const method = viewSource.match(/    _positionLabel\([^]*?\n    }/)[0];
    const positionLabel = new Function(`return ({${method}})._positionLabel;`)();
    let styled = false;
    const label = {
        width: 20,
        height: 32,
        ensure_style() { styled = true; },
        vfunc_get_preferred_width(height) {
            assert.equal(height, -1);
            assert.ok(styled, 'font style must be applied before measurement');
            return [10, 240];
        },
        vfunc_get_preferred_height(width) {
            assert.equal(width, -1);
            assert.ok(styled);
            return [96, 96];
        },
    };
    const view = {_setActorProperties: (actor, properties) => Object.assign(actor, properties)};
    positionLabel.call(view, label, 80, 20, 1);
    assert.equal(label.width, 80);
    assert.equal(label.height, 96, 'saved explicit height is replaced by current styled height');
    styled = false;
    positionLabel.call(view, label, 400, 30, 0.75);
    assert.equal(label.width, 240);
    assert.equal(label.x, 110);
});

test('HiDPI icon factories keep logical icon sizes and scale only explicit chevron dimensions', () => {
    const methods = ['_createIcon', '_createChevron'].map(name =>
        viewSource.match(new RegExp(`    ${name}\\([^]*?\\n    }`))[0]).join(',\n');
    class Icon {
        constructor(properties) { Object.assign(this, properties); }
    }
    class Button extends Icon {
        set_size(width, height) { Object.assign(this, {width, height}); }
        connect(name, callback) { this.signal = {name, callback}; }
    }
    const implementation = new Function('St', 'CHEVRON_SIZE', `return {${methods}};`)(
        {Icon, Button, ButtonMask: {ONE: 1}}, CHEVRON_SIZE);
    const view = {...implementation, _themeScale: 2};
    const app = {create_icon_texture: size => new Icon({icon_size: size})};
    assert.equal(view._createIcon(app, 110).icon_size, 110);
    assert.equal(view._createIcon(null, 48).icon_size, 48);
    const callback = () => {};
    const chevron = view._createChevron('go-down-symbolic', 'Enter group', callback);
    assert.equal(chevron.child.icon_size, 24);
    assert.equal(chevron.width, 80);
    assert.equal(chevron.height, 64);
    assert.deepEqual(chevron.signal, {name: 'clicked', callback});
});

test('layout title heights come from styled labels including hidden application names', () => {
    const method = viewSource.match(/    _measureTitleHeights\([^]*?\n    }/)[0];
    const measure = new Function(`return ({${method}})._measureTitleHeights;`)();
    const view = {
        _targets: [{kind: 'direct-window'}, {kind: 'grouped-window'}, {kind: 'app-group'}],
        _targetActors: [96, 128, 160].map(height => {
            let styled = false;
            return {_selectionLabel: {
                ensure_style() { styled = true; },
                vfunc_get_preferred_height(width) {
                    assert.ok(styled);
                    assert.equal(width, -1);
                    return [height, height];
                },
            }};
        }),
    };
    assert.deepEqual(measure.call(view), {window: 128, app: 160});
});

test('group overlap leaves a smaller older preview visible and reactive', () => {
    const widths = [1200, 300];
    const layout = calculateGroupHorizontalLayout(widths, 88);
    const newerRight = layout.previewX + layout.offsets[0] + widths[0];
    const olderLeft = layout.previewX + layout.offsets[1];
    const olderRight = olderLeft + widths[1];
    const overlap = newerRight - olderLeft;

    assert.ok(olderRight > newerRight, 'the older preview is fully covered by the newer target');
    assert.ok(overlap >= widths[1] * 0.12);
    assert.ok(overlap <= widths[1] * 0.18);
});

test('group app icon stays inside its activation region', () => {
    const iconSize = 88;
    const layout = calculateGroupHorizontalLayout([40, 400], iconSize);

    assert.ok(layout.iconX >= 0);
    assert.ok(layout.iconX + iconSize <= layout.width);
});

test('group app icon is centered beneath the complete group', () => {
    const iconSize = 88;
    const layout = calculateGroupHorizontalLayout([500, 300], iconSize);

    assert.equal(layout.iconX, (layout.width - iconSize) / 2);
});

test('group transitions fade selected titles without replacing their geometry transition', () => {
    const lateOpacity = viewSource.match(
        /\n    _setLateOpacity\([\s\S]*?\n    _setHiddenPreviewProperties/,
    )?.[0];
    const enterGroup = viewSource.match(
        /\n    enterGroup\([\s\S]*?\n    leaveGroup/,
    )?.[0];
    const setSelection = viewSource.match(
        /\n    setSelection\([\s\S]*?\n    setExitTarget/,
    )?.[0];

    assert.ok(lateOpacity, 'could not locate _setLateOpacity()');
    assert.match(lateOpacity, /remove_transition\('opacity'\)/);
    assert.doesNotMatch(lateOpacity, /remove_all_transitions/);
    assert.ok(enterGroup, 'could not locate enterGroup()');
    assert.match(enterGroup, /label\.opacity = 0/);
    assert.ok(setSelection, 'could not locate setSelection()');
    assert.match(setSelection, /remove_transition\('opacity'\)/);
    assert.match(setSelection, /get_transition\(property\) !== null/);
    assert.match(setSelection, /\[selected, selected\._selectionLabel\]/);
    assert.doesNotMatch(setSelection, /_selectionLabel\.opacity === 0/);
    assert.match(setSelection, /target\.kind === 'app-group'/);
    assert.match(setSelection, /isGroupTransitionTitle && geometryIsMoving/);
    assert.match(setSelection, /this\._enteredApplication !== null/);
    assert.match(setSelection, /_setLateOpacity\([\s\S]*?selected\._selectionLabel/);
});

test('target exhaustion finishes the switching session synchronously', () => {
    const removeWindow = sessionSource.match(
        /\n    _removeWindow\(window\) \{[\s\S]*?\n    _activationWindow/,
    )?.[0];

    assert.ok(removeWindow, 'could not locate _removeWindow()');
    assert.match(
        removeWindow,
        /if \(this\._targets\.length === 0\) \{\s*this\._finish\(false, true\);/,
    );
});

test('target outlines follow selection rather than independent hover styling', () => {
    assert.match(
        stylesheet,
        /\.switcher-selected\s*\{[^}]*border-color:\s*-st-accent-color/,
    );
    assert.doesNotMatch(stylesheet, /\.switcher-(?:direct-)?target:hover|\.switcher-group-outline\.switcher-hovered/);
});
