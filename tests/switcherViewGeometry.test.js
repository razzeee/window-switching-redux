// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as layout from '../switcherLayout.js';

const source = readFileSync(new URL('../switcherView.js', import.meta.url), 'utf8');

class Actor {
    constructor(properties = {}) {
        Object.assign(this, {x: 0, y: 0, width: 1, height: 1, scale_x: 1, scale_y: 1, opacity: 255, visible: true}, properties);
        this.children = [];
        this.signals = new Map();
        this.nextSignal = 0;
    }

    connect(name, callback) { const id = ++this.nextSignal; this.signals.set(id, {name, callback}); return id; }
    disconnect(id) { assert.ok(this.signals.delete(id), `disconnecting unknown signal ${id}`); }
    emit(name) {
        for (const [id, signal] of [...this.signals]) {
            if (this.signals.has(id) && signal.name === name)
                signal.callback();
        }
    }
    get_transformed_position() { return [this.x, this.y]; }
    get_transformed_size() { return [this.width, this.height]; }
    set_position(x, y) { Object.assign(this, {x, y}); if (this.bufferRect) this.bufferRect = {...this.bufferRect, x, y}; }
    set_size(width, height) { Object.assign(this, {width, height}); if (this.bufferRect) this.bufferRect = {...this.bufferRect, width, height}; }
    add_child(child) { this.children.push(child); child.parent = this; }
    set_child(child) { this.add_child(child); }
    get_children() { return this.children; }
    contains(actor) { return actor === this || this.children.some(child => child.contains(actor)); }
    add_effect() {}
    set_child_below_sibling() {}
    remove_all_transitions() { this.transition = null; }
    remove_transition() { this.transition = null; }
    get_transition(name) {
        const property = name.replaceAll('-', '_');
        const transition = this.transition;
        return transition && Object.hasOwn(transition, property)
            ? {set_to(value) { transition[property] = value; }}
            : null;
    }
    finishTransition() {
        const transition = this.transition;
        this.transition = null;
        if (transition === null || transition === undefined)
            return;
        const {onComplete, duration, mode, ...properties} = transition;
        Object.assign(this, properties);
        onComplete?.();
    }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    add_style_class_name() {}
    add_accessible_state() {}
    remove_accessible_state() {}
    fake_release() {}
    ensure_style() {}
    vfunc_get_preferred_width() { return [20, 300]; }
    vfunc_get_preferred_height() { return [20, 20]; }
    ease(properties) { this.transition = properties; }
    destroy_all_children() { for (const child of [...this.children]) child.destroy(); }
    destroy() {
        this.emit('destroy');
        this.signals.clear();
        this.destroy_all_children();
        if (this.parent)
            this.parent.children = this.parent.children.filter(child => child !== this);
        this.parent = null;
    }
}

function fixture({entered = false, animations = false, themeScale = 1} = {}) {
    const theme = new Actor({scale_factor: themeScale, fontHeight: 20});
    const pending = new Map();
    let nextLater = 0;
    const laters = {
        add(when, callback) {
            assert.equal(when, 'before-redraw');
            const id = ++nextLater;
            pending.set(id, callback);
            return id;
        },
        remove(id) { assert.ok(pending.delete(id)); },
    };
    const stage = new Actor();
    stage.get_key_focus = () => stage.key_focus ?? null;
    const dependencies = {
        ...layout,
        Actor,
        Atk: {Role: {MENU_ITEM: 'menu-item'}, StateType: {EXPANDED: 'expanded'}},
        Pango: {EllipsizeMode: {END: 'end'}},
        global: {stage, compositor: {get_laters: () => laters}},
        Meta: {LaterType: {BEFORE_REDRAW: 'before-redraw'}},
        St: {Settings: {get: () => ({enable_animations: animations})}, Widget: Actor, Bin: Actor, Icon: Actor, Button: class extends Actor {}},
        Clutter: {Actor, Clone: Actor, BinLayout: class {}, AnimationMode: {EASE_OUT_QUAD: 0}},
        RoundedClipEffect: class {},
        PREVIEW_CORNER_RADIUS: 12,
        TRANSITION_TIME: 180,
        EXIT_TIME: 180,
    };
    dependencies.St.Label = class extends Actor {
        constructor(properties) { super(properties); this.clutter_text = {}; }
        vfunc_get_preferred_width() { return [0, this.text.length * 10 * theme.scale_factor]; }
        vfunc_get_preferred_height() { return [0, theme.fontHeight * theme.scale_factor]; }
    };
    const functions = ['targetName', 'actorGeometry', 'transformedActorState', 'sourceGeometry', 'previewGeometry',
        'previewProperties', 'recordBounds', 'destinationForSurface', 'visitActorTree']
        .map(name => source.match(new RegExp(`function ${name}\\([^]*?\\n}`))[0]).join('\n');
    const methods = ['_createClones', '_queueGeometryRefresh', '_disconnectSourceGeometry', '_refreshGeometry',
        '_applyComposition', '_setActorProperties', '_rebasePreview', '_setHiddenPreviewProperties', 'beginExit', '_clearActors',
        'build', '_disconnectKeyFocus', '_disconnectTheme', 'destroy', '_measureTitleHeights', '_positionLabel', '_positionDirectIcon', '_positionGroupChrome',
        '_exitPreviewIndex', '_createUnavailableTarget', '_createIcon', 'enterGroup', 'leaveGroup', '_setLateFadeProperties',
        '_createWindowTarget', '_queueTitleRefresh', '_disconnectWindowTitles', 'setTargets']
        .map(name => source.match(new RegExp(`    ${name}\\([^]*?\\n    }`))[0]).join('\n');
    const View = new Function(...Object.keys(dependencies), `${functions}\nreturn class extends Actor {${methods}};`)(...Object.values(dependencies));
    const parent = new Actor({x: 100, y: 100, width: 800, height: 600});
    const dialog = new Actor({x: 300, y: 200, width: 200, height: 100});
    dialog.parent = parent;
    const application = {create_icon_texture: () => new Actor()};
    const window = Object.assign(new Actor(), {
        title: 'Old', get_title() { return this.title; },
        get_compositor_private: () => parent, get_buffer_rect: () => parent.bufferRect,
    });
    const record = {kind: 'direct-window', application,
        window,
        auxiliarySurfaces: [{get_compositor_private: () => dialog.parent === null ? null : dialog, get_buffer_rect: () => dialog.bufferRect}]};
    for (const actor of [parent, dialog]) {
        actor.bufferRect = {x: actor.x, y: actor.y, width: actor.width, height: actor.height};
        actor.get_meta_window = () => ({get_buffer_rect: () => actor.bufferRect});
    }
    const targets = entered
        ? [record, {kind: 'app-group', application}, {...record, kind: 'grouped-window'}]
        : [record];
    const targetActors = targets.map(() => {
        const actor = Object.assign(new Actor(), {
            _previewActors: [], _selectionLabel: new Actor(), _directIcon: new Actor(), _clickGesture: {set_enabled() {}},
            _iconBin: new Actor(), _downChevron: new Actor(), _upChevron: new Actor(), _groupOutline: new Actor(),
        });
        actor._selectionLabel.vfunc_get_preferred_height = () => [theme.fontHeight * theme.scale_factor, theme.fontHeight * theme.scale_factor];
        for (const child of [actor._selectionLabel, actor._directIcon, actor._iconBin, actor._downChevron, actor._upChevron])
            actor.add_child(child);
        return actor;
    });
    const view = Object.assign(new View(), {
        _themeContext: theme, _themeScale: themeScale, _themeSignalId: 0,
        _windowTitleSignals: new Map(),
        _pendingTitleLabels: new Set(), _titleLaterId: 0,
        _targets: targets, _targetActors: targetActors, _cloneEntries: [], _sourceGeometrySignals: new Map(), _geometryLaterId: 0,
        _selectedIndex: entered ? 2 : 0, _enteredApplication: entered ? application : null, _entranceTargetIndex: -1,
        _exitTargetIndex: null, _clickActions: [], _chromeActors: [], _workArea: {x: 0, y: 0, width: 1920, height: 1080},
        _connectActivation(actor) { actor._clickGesture = {set_enabled() {}}; },
        _build() {
            this._backdropActor = new Actor();
            this._targets.forEach((target, index) => {
                if (target.kind !== 'app-group') {
                    this._targetActors[index]?.destroy();
                    this._createWindowTarget(target, index);
                }
            });
            this._refreshGeometry();
        },
    });
    for (const actor of targetActors)
        view.add_child(actor);
    view.build();
    targets.forEach((target, index) => {
        if (target.kind !== 'app-group')
            view._createClones(target, index, view._fullLayout.geometries.get(index), targetActors[index], null);
    });
    view._refreshGeometry();
    function flush() {
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks)
            assert.equal(callback(), false);
    }
    return {view, parent, dialog, pending, flush, record, application, theme, stage};
}

function presented(entry) {
    return {x: entry.clone.x, y: entry.clone.y,
        width: entry.clone.width * entry.clone.scale_x, height: entry.clone.height * entry.clone.scale_y};
}

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test('title changes update direct and grouped window names and remeasure hidden labels without rebuilding', () => {
    const {view, record, pending, flush} = fixture({entered: true});
    const actors = [view._targetActors[0], view._targetActors[2]];
    actors[1]._selectionLabel.visible = true;
    const clones = view._cloneEntries.map(entry => entry.clone);
    for (const actor of actors) {
        assert.equal(actor._selectionLabel.text, 'Old');
        assert.equal(actor._selectionLabel.width, 30);
    }
    for (const title of ['Intermediate', 'Updated title']) {
        record.window.title = title;
        record.window.emit('notify::title');
    }
    for (const actor of actors) {
        assert.equal(actor._selectionLabel.text, 'Updated title');
        assert.equal(actor.accessible_name, 'Updated title');
        assert.equal(actor._selectionLabel.visible, actor === actors[1]);
    }
    assert.equal(record.window.signals.size, 1, 'duplicate targets share a title subscription');
    assert.equal(pending.size, 1);
    flush();
    for (const actor of actors) {
        assert.equal(actor._selectionLabel.width, 130);
        near(actor._selectionLabel.x, (actor.width - 130 * actor._selectionLabel.scale_x) / 2);
    }
    assert.deepEqual(view._cloneEntries.map(entry => entry.clone), clones);
    assert.equal(view._selectedIndex, 2);
    view.destroy();
});

for (const phase of ['enter', 'return', 'entrance']) {
    test(`title notification preserves active composition and label transitions during ${phase}`, () => {
        const {view, record, application, flush} = fixture({entered: true, animations: true});
        view.leaveGroup();
        if (phase === 'enter')
            view.enterGroup(application);
        else if (phase === 'entrance')
            view._applyComposition(true, 220, null, true);
        const labels = [view._targetActors[0]._selectionLabel, view._targetActors[2]._selectionLabel];
        for (const label of labels) {
            label.opacity = 17;
            label.transition.opacity = 255;
        }
        const destinations = labels.map(label => ({...label.transition}));
        const transitions = labels.map(label => label.transition);
        for (const label of labels) {
            label.scale_x = 0.75;
            label.y = -99;
        }
        const others = [...view._cloneEntries.map(entry => entry.clone),
            ...view._chromeActors.flatMap(actor => [actor, ...actor.get_children()])]
            .filter(actor => !labels.includes(actor));
        const states = others.map(actor => ({actor, transition: actor.transition, properties: {...actor.transition},
            x: actor.x, width: actor.width, opacity: actor.opacity}));
        const full = view._fullLayout;
        record.window.title = 'Updated title';
        record.window.emit('notify::title');
        flush();
        assert.equal(view._fullLayout, full, 'title measurement must not recalculate composition');
        for (const state of states) {
            assert.equal(state.actor.transition, state.transition);
            assert.deepEqual({...state.actor.transition}, state.properties);
            assert.equal(state.actor.x, state.x);
            assert.equal(state.actor.width, state.width);
            assert.equal(state.actor.opacity, state.opacity);
        }
        labels.forEach((label, index) => {
            const destination = destinations[index];
            assert.equal(label.transition, transitions[index], 'keep the existing timeline and completion callback');
            assert.equal(label.opacity, 17, 'do not force selected title opacity');
            assert.equal(label.scale_x, 0.75, 'do not settle the presented scale');
            assert.equal(label.y, -99, 'do not settle the presented vertical position');
            assert.equal(label.transition.opacity, 255);
            for (const property of ['y', 'scale_x', 'scale_y', 'duration', 'mode', 'onComplete'])
                assert.equal(label.transition[property], destination[property]);
            const previewWidth = 2 * destination.x + destination.width * destination.scale_x;
            const width = Math.min(130, previewWidth / destination.scale_x);
            near(label.transition.width, width);
            near(label.transition.x, (previewWidth - width * destination.scale_x) / 2);
            assert.equal(label.width, 30, 'retarget rather than snap the animated width');
            label.finishTransition();
            near(label.width, width);
            near(label.x, (previewWidth - width * destination.scale_x) / 2);
        });
        view.destroy();
    });
}

test('target rebuild replaces title subscriptions and cancels pending title measurement', () => {
    const {view, record, pending, flush} = fixture();
    const obsolete = view._targetActors[0];
    record.window.title = 'Before rebuild';
    record.window.emit('notify::title');
    assert.equal(pending.size, 1);
    view.setTargets([record]);
    assert.equal(pending.size, 0);
    assert.equal(record.window.signals.size, 1);
    const replacement = view._targetActors[0];
    assert.notEqual(replacement, obsolete);
    assert.equal(replacement._selectionLabel.text, 'Before rebuild');
    record.window.title = 'After rebuild';
    record.window.emit('notify::title');
    assert.equal(replacement._selectionLabel.text, 'After rebuild');
    assert.equal(replacement.accessible_name, 'After rebuild');
    assert.equal(obsolete._selectionLabel.text, 'Before rebuild');
    flush();
    view.setTargets([]);
    assert.equal(record.window.signals.size, 0);
    record.window.emit('notify::title');
    assert.equal(pending.size, 0);
    view.destroy();
});

for (const exit of ['destroy', 'cancel', 'activate']) {
    test(`title changes cannot revive a closing view, exit=${exit}`, () => {
        const {view, record, pending, flush} = fixture({entered: true, animations: true});
        record.window.title = 'Closing';
        record.window.emit('notify::title');
        assert.equal(pending.size, 1);
        if (exit === 'activate')
            view._exitTargetIndex = 2;
        if (exit === 'destroy')
            view.destroy();
        else
            view.beginExit(() => {});
        assert.equal(pending.size, 0);
        assert.equal(record.window.signals.size, 0);
        assert.equal(view._pendingTitleLabels.size, 0);
        assert.equal(view._titleLaterId, 0);
        view._refreshGeometry = () => assert.fail('title refresh after exit or destruction');
        record.window.emit('notify::title');
        flush();
        assert.equal(pending.size, 0);
        if (exit !== 'destroy')
            view.destroy();
    });
}

test('closing dialog retains its own destination while compositor lookup is null and clone survives', () => {
    const {view, dialog} = fixture();
    const before = presented(view._cloneEntries[1]);
    dialog.parent = null;
    view._applyComposition(false);
    assert.deepEqual(presented(view._cloneEntries[1]), before);
    view.destroy();
});

for (const entered of [false, true]) {
    test(`gallery ignores transformed source geometry, entered=${entered}`, () => {
        const {view, parent, dialog} = fixture({entered});
        const before = view._cloneEntries.map(presented);
        const full = view._fullLayout;
        parent.get_transformed_position = () => [700, 1000];
        parent.get_transformed_size = () => [0, 0];
        dialog.get_transformed_size = () => [10, 90];
        view._refreshGeometry();
        assert.deepEqual(view._fullLayout, full);
        assert.deepEqual(view._cloneEntries.map(presented), before);
        view.destroy();
    });
}

test('unchanged buffer notifications do not interrupt an active composition transition', () => {
    const {view, parent, pending, flush} = fixture({animations: true});
    view._applyComposition(true);
    const transitions = view._cloneEntries.map(entry => entry.clone.transition);
    const full = view._fullLayout;
    for (const property of ['position', 'size', 'allocation', 'scale-x', 'scale-y', 'translation-x', 'translation-y'])
        parent.emit(`notify::${property}`);
    flush();
    assert.equal(view._fullLayout, full);
    assert.deepEqual(view._cloneEntries.map(entry => entry.clone.transition), transitions);
    assert.equal(pending.size, 0);
    view.destroy();
});

for (const animations of [false, true]) {
    for (const rebase of [false, true]) {
        test(`out-of-scope previews hide after fade and return, animations=${animations}, rebase=${rebase}`, () => {
            const {view, application} = fixture({entered: true, animations});
            view.leaveGroup();
            for (const entry of view._cloneEntries) {
                entry.clone.finishTransition();
                entry.clone.finishTransition();
                if (rebase && entry.targetIndex === 0)
                    view._rebasePreview(entry, {width: 1000, height: 750});
            }
            view.enterGroup(application);
            for (const entry of view._cloneEntries) {
                if (animations)
                    assert.equal(entry.clone.visible, true, 'stay visible during fade');
                entry.clone.finishTransition();
                entry.clone.finishTransition();
                assert.equal(entry.clone.visible, entry.targetIndex === 2);
            }
            view.leaveGroup();
            for (const entry of view._cloneEntries) {
                assert.equal(entry.clone.visible, true, 'remap before returning fade');
                entry.clone.finishTransition();
                entry.clone.finishTransition();
                assert.equal(entry.clone.opacity, 255);
            }
            view.destroy();
        });
    }
}

for (const phase of [0, 1]) {
    test(`return interrupts hidden preview two-step fade at phase ${phase}`, () => {
        const {view, application} = fixture({entered: true, animations: true});
        view.leaveGroup();
        const entry = view._cloneEntries[0];
        entry.clone.finishTransition();
        entry.clone.finishTransition();
        view._rebasePreview(entry, {width: 1000, height: 750});
        view.enterGroup(application);
        if (phase === 1)
            entry.clone.finishTransition();
        view.leaveGroup();
        entry.clone.finishTransition();
        entry.clone.finishTransition();
        assert.equal(entry.clone.visible, true);
        assert.equal(entry.clone.opacity, 255);
        assert.equal(entry.clone.transition, null);
        view.destroy();
    });
}

test('already hidden previews rebase synchronously without remapping or starting a fade', () => {
    const {view} = fixture({entered: true, animations: true});
    const entry = view._cloneEntries[0];
    entry.clone.hide();
    view._rebasePreview(entry, {width: 1000, height: 750});
    view._applyComposition(true);
    assert.equal(entry.clone.visible, false);
    assert.equal(entry.clone.transition, null);
    assert.equal(entry.clone.opacity, 0);
    view.destroy();
});

for (const animations of [false, true]) {
    for (const targetIndex of [0, 1, 2]) {
        test(`exit uses each source window buffer rect during unminimize, animations=${animations}, target=${targetIndex}`, () => {
            const {view, parent, dialog} = fixture({entered: true, animations});
            parent.bufferRect = {x: 90, y: 80, width: 728, height: 509};
            dialog.bufferRect = {x: 250, y: 170, width: 230, height: 120};
            for (const actor of [parent, dialog]) {
                actor.get_transformed_position = () => [700, 1000];
                actor.get_transformed_size = () => [0, 0];
            }
            view._targets[1].windows = [view._targets[0]];
            view._exitTargetIndex = targetIndex;
            let completed = 0;
            view.beginExit(() => completed++);
            const heroIndex = targetIndex === 0 ? 0 : 2;
            for (const entry of view._cloneEntries) {
                if (animations)
                    Object.assign(entry.clone, entry.clone.transition);
                if (entry.targetIndex === heroIndex) {
                    assert.equal(entry.clone.visible, true, 'exit hero must be shown even outside the entered scope');
                    const rect = presented(entry);
                    for (const [property, expected] of Object.entries(entry.source.bufferRect))
                        near(rect[property], expected);
                } else {
                    assert.equal(entry.clone.opacity, 0);
                }
                if (animations)
                    entry.exitComplete();
            }
            assert.equal(completed, 1);
            view.destroy();
        });
    }
}

test('new previews still start at instantaneous transformed source geometry', () => {
    const {view, parent, dialog, record} = fixture({animations: true});
    view._clearActors();
    for (const actor of [parent, dialog]) {
        actor.get_transformed_position = () => [40, 60];
        actor.get_transformed_size = () => [364, 254.5];
    }
    const target = Object.assign(new Actor(), {_previewActors: []});
    view._createClones(record, 0, {x: 0, y: 0, width: 400, height: 300}, target, null);
    for (const entry of view._cloneEntries) {
        const rect = presented(entry);
        near(rect.x, 40);
        near(rect.y, 60);
        near(rect.width, 364);
        near(rect.height, 254.5);
    }
    view.destroy();
});

test('source resize coalesces notifications and updates full layout and preview aspect ratios', () => {
    const {view, parent, dialog, pending, flush} = fixture();
    const previous = view._fullLayout;
    const entries = [...view._cloneEntries];
    parent.set_size(300, 900);
    for (const name of ['size', 'allocation', 'position'])
        parent.emit(`notify::${name}`);
    dialog.emit('notify::allocation');
    assert.equal(pending.size, 1);
    assert.equal(view._fullLayout, previous);
    flush();
    assert.notEqual(view._fullLayout, previous);
    assert.deepEqual(view._cloneEntries, entries, 'refresh must not rebuild clones');
    const rect = presented(entries[0]);
    near(rect.width / rect.height, 1 / 3);
    assert.equal(entries[0].clone.transition, null, 'do not tween through the old aspect ratio');
    assert.equal(view._selectedIndex, 0);
    assert.equal(view._targetActors[0]._selectionLabel.opacity, 255);
    assert.equal(view._geometryLaterId, 0);
    parent.set_size(310, 900);
    parent.emit('notify::size');
    assert.equal(pending.size, 1, 'another frame can be scheduled');
    view._clearActors();
});

test('attached dialog movement within unchanged bounds updates its relative position', () => {
    const {view, parent, dialog, flush} = fixture();
    const before = presented(view._cloneEntries[1]);
    dialog.set_position(dialog.x + 100, dialog.y + 50);
    dialog.emit('notify::position');
    flush();
    const main = presented(view._cloneEntries[0]);
    const moved = presented(view._cloneEntries[1]);
    const scale = main.width / parent.width;
    near(moved.x - before.x, 100 * scale);
    near(moved.y - before.y, 50 * scale);
    near(moved.width / moved.height, dialog.width / dialog.height);
    view._clearActors();
});

test('entered layout and hidden full layout both follow resize and expanded dialog bounds', () => {
    const {view, parent, dialog, pending, flush, application} = fixture({entered: true});
    const previousFull = view._fullLayout.geometries.get(0);
    const previousEnteredWidth = view._targetActors[2].width;
    parent.set_size(400, 1000);
    dialog.set_position(-100, -50);
    parent.emit('notify::size');
    dialog.emit('notify::position');
    assert.equal(pending.size, 1, 'duplicate direct/grouped clones share one geometry subscription');
    assert.equal(view._sourceGeometrySignals.size, 2);
    assert.equal([...parent.signals.values()].filter(signal => signal.name === 'notify::size').length, 1);
    flush();
    assert.notDeepEqual(view._fullLayout.geometries.get(0), previousFull);
    assert.notEqual(view._targetActors[2].width, previousEnteredWidth);
    for (const entry of view._cloneEntries) {
        const rect = presented(entry);
        near(rect.width / rect.height, entry.source.width / entry.source.height);
        assert.equal(entry.clone.opacity, entry.targetIndex === 2 ? 255 : 0);
    }
    const main = presented(view._cloneEntries[2]);
    const attached = presented(view._cloneEntries[3]);
    near(main.x - attached.x, (parent.x - dialog.x) * main.width / parent.width);
    near(main.y - attached.y, (parent.y - dialog.y) * main.height / parent.height);
    assert.equal(view._selectedIndex, 2);
    assert.equal(view._enteredApplication, application);
    view._clearActors();
});

test('rebuild cleanup removes pending refreshes and subscriptions, then permits new tracking', () => {
    const {view, parent, dialog, pending, record} = fixture();
    parent.set_size(810, 600);
    parent.emit('notify::size');
    view._clearActors();
    assert.equal(pending.size, 0);
    assert.equal(view._sourceGeometrySignals.size, 0);
    assert.equal(parent.signals.size, 0);
    assert.equal(dialog.signals.size, 0);
    assert.equal(view._cloneEntries.length, 0);
    const target = Object.assign(new Actor(), {_previewActors: []});
    view._createClones(record, 0, {x: 0, y: 0, width: 400, height: 300}, target, null);
    parent.set_size(820, 600);
    parent.emit('notify::size');
    assert.equal(pending.size, 1);
    view._clearActors();
    view._clearActors();
    assert.equal(parent.signals.size, 0);
});

for (const entered of [false, true]) {
    test(`destroying an outlying dialog refreshes surviving preview bounds, entered=${entered}`, () => {
        const {view, dialog, pending, flush} = fixture({entered});
        const originalFull = view._fullLayout.geometries.get(0);
        const index = entered ? 2 : 0;
        const originalPreview = presented(view._cloneEntries[index]);
        dialog.set_position(-1000, -500);
        dialog.emit('notify::position');
        flush();
        assert.notDeepEqual(view._fullLayout.geometries.get(0), originalFull);
        dialog.destroy();
        assert.equal(pending.size, 1, 'source destruction schedules one deferred bounds refresh');
        assert.equal(view._cloneEntries[index + 1].clone, null);
        flush();
        assert.deepEqual(view._fullLayout.geometries.get(0), originalFull);
        assert.deepEqual(presented(view._cloneEntries[index]), originalPreview);
        view._clearActors();
        assert.equal(pending.size, 0);
    });
}

for (const animations of [false, true]) {
    test(`exit cancels geometry work but retains source destruction handling, animations=${animations}`, () => {
        const {view, parent, dialog, pending} = fixture({animations});
        parent.set_size(810, 600);
        parent.emit('notify::size');
        assert.equal(pending.size, 1);
        let completed = 0;
        view.beginExit(() => completed++);
        assert.equal(completed, animations ? 0 : 1);
        assert.equal(pending.size, 0);
        const oldLayout = view._fullLayout;
        for (const actor of [parent, dialog]) {
            actor.emit('notify::size');
            assert.deepEqual([...actor.signals.values()].map(signal => signal.name), ['destroy']);
        }
        assert.equal(pending.size, 0);
        parent.destroy();
        dialog.destroy();
        assert.equal(pending.size, 0, 'source destruction during exit must not queue geometry work');
        assert.equal(view._cloneEntries[0].clone, null);
        assert.equal(view._targetActors[0]._previewActors.length, 0);
        assert.equal(view._fullLayout, oldLayout);
        view._clearActors();
        assert.equal(dialog.signals.size, 0);
    });
}

test('destroying a duplicated source releases all geometry signals and preview references', () => {
    const {view, parent, dialog, pending} = fixture({entered: true});
    parent.destroy();
    assert.equal(view._sourceGeometrySignals.has(parent), false);
    for (const index of [0, 2]) {
        assert.equal(view._cloneEntries[index].clone, null);
        assert.equal(view._cloneEntries[index].source, null);
        assert.equal(view._cloneEntries[index].signal, 0);
    }
    assert.equal(view._targetActors[0]._previewActors.length, 1);
    assert.equal(view._targetActors[2]._previewActors.length, 1);
    assert.equal(pending.size, 1);
    view._clearActors();
    assert.equal(pending.size, 0, 'cleanup cancels the destruction-triggered refresh');
    dialog.destroy();
    assert.equal(pending.size, 0, 'sources cannot schedule work after cleanup');
});

for (const entered of [false, true]) {
    test(`live scale and font changes remeasure and reposition without rebuilding, entered=${entered}`, () => {
        const {view, theme, parent, pending, flush, application} = fixture({entered});
        const oldLayout = view._fullLayout;
        const clones = view._cloneEntries.map(entry => entry.clone);
        theme.scale_factor = 2;
        theme.emit('changed');
        theme.emit('changed');
        parent.emit('notify::size');
        assert.equal(pending.size, 1);
        assert.equal(view._fullLayout, oldLayout);
        flush();
        assert.equal(view._themeScale, 2);
        assert.notDeepEqual(view._fullLayout, oldLayout);
        const bounds = () => ({width: parent.width, height: parent.height});
        const heights = {window: 40, app: entered ? 40 : 0};
        assert.deepEqual(view._fullLayout, layout.calculateFullLayout(view._targets, view._workArea, bounds, heights, 2));
        const index = entered ? 2 : 0;
        const expected = entered
            ? layout.calculateEnteredLayout(view._targets, application, view._workArea, bounds, heights, 2)
            : view._fullLayout;
        const geometry = expected.geometries.get(index);
        const actor = view._targetActors[index];
        near(actor.x, geometry.x);
        near(actor.y, geometry.y);
        near(actor.width, geometry.width);
        near(actor._selectionLabel.height, 40);
        near(actor._selectionLabel.scale_y, geometry.chromeScale);
        assert.equal(actor._selectionLabel.opacity, 255);
        assert.deepEqual(view._cloneEntries.map(entry => entry.clone), clones);
        assert.equal(pending.size, 0, 'measurement must not start a refresh loop');

        const beforeFont = {full: view._fullLayout, geometry: [actor.y, actor._selectionLabel.scale_y]};
        theme.fontHeight = 160;
        theme.emit('changed');
        flush();
        assert.notDeepEqual(view._fullLayout, beforeFont.full, 'font-only changes update full layout');
        assert.notDeepEqual([actor.y, actor._selectionLabel.scale_y], beforeFont.geometry, 'font-only changes update visible geometry');
        assert.equal(actor._selectionLabel.height, 320);
        assert.equal(view._selectedIndex, index);
        assert.equal(view._enteredApplication, entered ? application : null);
        theme.scale_factor = 1;
        theme.fontHeight = 20;
        theme.emit('changed');
        flush();
        assert.deepEqual(view._fullLayout, oldLayout, 'returning to scale 1 restores the original layout');
        assert.equal(view._targetActors[0]._directIcon.width, 48);
        assert.equal(actor._selectionLabel.height, 20);
        view.destroy();
        assert.equal(theme.signals.size, 0);
    });
}

test('HiDPI icon backing sizes and chrome positions apply theme scale exactly once', () => {
    const {view} = fixture({entered: true, themeScale: 2});
    const direct = view._targetActors[0]._directIcon;
    const directGeometry = view._fullLayout.geometries.get(0);
    assert.equal(direct.width, 96);
    near(direct.width * direct.scale_x, Math.min(96 * directGeometry.chromeScale, directGeometry.height / 3, directGeometry.width));
    near(direct.x + direct.width * direct.scale_x / 2, directGeometry.width / 2);
    const group = view._targetActors[1];
    const s = group._upChevron.scale_x;
    assert.ok(s > 0 && s <= 1);
    assert.equal(group._iconBin.width, 240);
    assert.equal(group._upChevron.width, 80);
    assert.equal(group._upChevron.height, 64);
    near(group._iconBin.scale_x, s);
    near(group._upChevron.x + 40 * s, group.width / 2);
    near(group._upChevron.y + 64 * s, group._iconBin.y);
    near(group._selectionLabel.y, group._iconBin.y + 240 * s + 32 * s);
    near(group._selectionLabel.scale_y, s, 'label uses shrink scale only');
    view._enteredApplication = null;
    view._applyComposition(false);
    const geometry = view._fullLayout.geometries.get(1);
    near(group._iconBin.width * group._iconBin.scale_x, geometry.iconSize);
    near(group._downChevron.y, geometry.iconY + geometry.iconSize + 16 * geometry.chromeScale);
    near(group._downChevron.x + group._downChevron.width * group._downChevron.scale_x / 2, group.width / 2);
    near(group._selectionLabel.y, group._downChevron.y + 80 * geometry.chromeScale);
    view.destroy();
});

test('unavailable preview icons convert fitted stage dimensions back to logical icon size on refresh', () => {
    const {view, theme, flush} = fixture({themeScale: 2});
    view._workArea = {x: 0, y: 0, width: 320, height: 240};
    view._refreshGeometry();
    const geometry = view._fullLayout.geometries.get(0);
    view._createUnavailableTarget({...view._targets[0], application: null}, 0, geometry, view._targetActors[0]);
    const placeholder = view._cloneEntries.at(-1).clone;
    const expectedSize = () => Math.max(1, Math.floor(Math.min(120, placeholder.width / theme.scale_factor, placeholder.height / theme.scale_factor)));
    assert.equal(placeholder.child.icon_size, expectedSize());
    const original = placeholder.child.icon_size;
    theme.scale_factor = 1;
    theme.emit('changed');
    flush();
    assert.equal(placeholder.child.icon_size, expectedSize());
    assert.notEqual(placeholder.child.icon_size, original);
    view.destroy();
});

test('rebuild cleanup keeps one theme and focus subscription and cancels its pending refresh', () => {
    const {view, theme, pending, flush, stage} = fixture();
    const signal = view._themeSignalId;
    const focusSignal = view._keyFocusSignalId;
    const oldTarget = view._targetActors[0];
    theme.emit('changed');
    view._clearActors();
    assert.equal(pending.size, 0);
    assert.equal(view._themeSignalId, signal);
    assert.equal(theme.signals.size, 1);
    assert.equal(view._keyFocusSignalId, focusSignal);
    assert.equal(stage.signals.size, 1);
    stage.key_focus = oldTarget;
    view._targetFocused = () => assert.fail('focus must not select an obsolete target during rebuild');
    stage.emit('notify::key-focus');
    let refreshed = 0;
    view._refreshGeometry = () => refreshed++;
    theme.emit('changed');
    flush();
    assert.equal(refreshed, 1);
    view.destroy();
    assert.equal(theme.signals.size, 0);
    assert.equal(stage.signals.size, 0);
});

for (const exit of ['destroy', 'cancel', 'activate']) {
    test(`theme work cannot revive a closing view, exit=${exit}`, () => {
        const {view, theme, parent, pending, flush, stage} = fixture({entered: true, animations: true});
        const descendant = view._targetActors[1]._upChevron;
        assert.equal(stage.signals.size, 1);
        theme.emit('changed');
        parent.emit('notify::size');
        assert.equal(pending.size, 1);
        if (exit === 'activate')
            view._exitTargetIndex = 2;
        if (exit !== 'destroy')
            view.beginExit(() => {});
        else
            view.destroy();
        assert.equal(view._themeContext, null);
        assert.equal(view._themeSignalId, 0);
        assert.equal(pending.size, 0);
        assert.equal(theme.signals.size, 0);
        assert.equal(view._keyFocusSignalId, 0);
        assert.equal(stage.signals.size, 0);
        view._targetFocused = () => assert.fail('focus handling after exit or destruction');
        stage.key_focus = descendant;
        stage.emit('notify::key-focus');
        assert.equal(stage.key_focus, descendant);
        view._refreshGeometry = () => assert.fail('refresh after exit or destruction');
        theme.emit('changed');
        parent.emit('notify::size');
        flush();
        if (exit !== 'destroy') {
            assert.ok(view._targetActors.every(actor => !actor.reactive));
            view.destroy();
        }
        assert.equal(pending.size, 0);
    });
}
