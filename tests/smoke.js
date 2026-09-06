// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {ExtensionState} from 'resource:///org/gnome/shell/misc/extensionUtils.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

import {testLifecycle} from './lifecycle.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function assertNear(actual, expected, message) {
    assert(Math.abs(actual - expected) < 1, `${message}: expected ${expected}, got ${actual}`);
}

function assertWorkArea(view, expected) {
    for (const property of ['x', 'y', 'width', 'height']) {
        assertNear(view._workArea[property], expected[property], `Captured work area ${property}`);
        assertNear(view._backdropActor[property], expected[property], `Backdrop ${property}`);
    }
}

async function testLabel(view, index) {
    view.setSelection(index);
    const label = view._targetActors[index]._selectionLabel;
    label.text = 'i';
    view._positionLabel(label, 600, 20, 1);
    const shortWidth = label.width;
    const text = 'A much wider window title that must recover after a narrow preview';
    const probe = new St.Label({text, style_class: label.style_class});
    view.add_child(probe);
    const [, naturalWidth] = probe.get_preferred_width(-1);
    probe.destroy();
    assert(naturalWidth > shortWidth * 3, 'Title fixture must be wider than the short label');

    label.text = text;
    const narrow = naturalWidth / 3;
    const wide = naturalWidth * 2;
    view._positionLabel(label, narrow, 20, 1);
    assertNear(label.width, narrow, 'Short title grows to the narrow preview limit');
    view._positionLabel(label, wide, 20, 0.75);
    assertNear(label.width, naturalWidth, 'Wide preview restores intrinsic title width');
    assertNear(label.x, (wide - naturalWidth * 0.75) / 2, 'Scaled title is centered');

    view._positionLabel(label, narrow, 20, 1);
    await Scripting.waitLeisure();
    assert(label.mapped, 'Label must be mapped for real Clutter animations');
    assert(St.Settings.get().enable_animations, 'Run smoke with animations enabled');
    view._positionLabel(label, wide, 30, 0.75, true);
    assert(label.get_transition('width') !== null, 'Widening must create a real width transition');
    await Scripting.sleep(60);
    assert(label.width > narrow && label.width < naturalWidth, 'Widening reaches an intermediate width');
    view._positionLabel(label, narrow, 20, 1, true);
    await Scripting.sleep(300);
    await Scripting.waitLeisure();
    assertNear(label.width, narrow, 'Mid-animation reversal returns to narrow width');
    view._positionLabel(label, wide, 30, 0.75, true);
    await Scripting.sleep(300);
    await Scripting.waitLeisure();
    assertNear(label.width, naturalWidth, 'Animated widening restores intrinsic width after reversal');
    assertNear(label.x, (wide - naturalWidth * 0.75) / 2, 'Animated title is centered');
    assertNear(label.scale_x, 0.75, 'Animated title scale');
    assert(label.get_transition('width') === null, 'Width transition finishes');
    console.log('PASS: real St label short/wide sizing, animation and reversal');
}

async function testInitialLabels(view) {
    for (const [index, actor] of view._targetActors.entries()) {
        const label = actor._selectionLabel;
        assert(!label.visible, 'Initial selection label must still be hidden');
        const width = label.width;
        const x = label.x;
        view.setSelection(index);
        await Scripting.waitLeisure();
        const [, naturalWidth] = label.vfunc_get_preferred_width(-1);
        const geometry = view._fullLayout.geometries.get(index);
        const expected = Math.min(naturalWidth, geometry.width / geometry.chromeScale);
        assertNear(width, expected, 'Initial hidden title uses its styled width');
        assertNear(x, (geometry.width - expected * geometry.chromeScale) / 2, 'Initial hidden title is centered');
    }
    view.setSelection(-1);

    // A wide preview prevents clipping from masking an unstyled first measurement.
    const label = new St.Label({
        text: 'Initial hidden title', style_class: 'switcher-window-title',
        style: 'font-size: 32pt;', visible: false,
    });
    view.add_child(label);
    try {
        view._positionLabel(label, 4000, 0, 1);
        const initialWidth = label.width;
        label.show();
        await Scripting.waitLeisure();
        const [, naturalWidth] = label.vfunc_get_preferred_width(-1);
        assert(naturalWidth < 4000, 'Hidden title fixture must not be width-limited');
        assertNear(initialWidth, naturalWidth, 'First hidden measurement matches mapped styled title');
    } finally {
        label.destroy();
    }
    console.log('PASS: initial hidden window/application titles use styled intrinsic widths');
}

async function testEnlargedTitles(view, groupIndex) {
    const check = async entered => {
        const indices = view._targets.flatMap((target, index) => {
            if (!entered)
                return target.kind === 'grouped-window' ? [] : [index];
            return target.application === view._targets[groupIndex].application && target.kind !== 'direct-window' ? [index] : [];
        });
        const windows = indices.filter(index => view._targets[index].kind !== 'app-group');
        const split = windows.length > 2 ? Math.ceil(windows.length / 2) : windows.length;
        const nextRowTop = windows.length > split
            ? Math.min(...windows.slice(split).map(index => view._targetActors[index].y))
            : Infinity;
        for (const index of indices) {
            view.setSelection(index);
            // Shell leisure does not flush Clutter's pending allocation/paint.
            // Mutter 50 clutter-stage.c emits after-paint once the frame is painted.
            await new Promise(resolve => {
                const signal = global.stage.connect('after-paint', () => {
                    global.stage.disconnect(signal);
                    resolve();
                });
                global.stage.queue_redraw();
            });
            const actor = view._targetActors[index];
            const label = actor._selectionLabel;
            assert(label.mapped && label.has_allocation(), `Selected title ${index} must be mapped and allocated after paint`);
            const [, naturalHeight] = label.vfunc_get_preferred_height(-1);
            assert(naturalHeight > 72, 'Enlarged text fixture exceeds the former fixed title allowances');
            assertNear(label.height, naturalHeight, 'Allocated title height matches current style');
            const [x, y] = label.get_transformed_position();
            const [width, height] = label.get_transformed_size();
            const area = view._workArea;
            const diagnostic = JSON.stringify({
                index, entered, kind: view._targets[index].kind,
                area: {x: area.x, y: area.y, width: area.width, height: area.height},
                transformed: [x, y, width, height].map(String), naturalHeight,
                label: {x: label.x, y: label.y, width: label.width, height: label.height, scale: label.scale_y},
                actor: {x: actor.x, y: actor.y, width: actor.width, height: actor.height},
            });
            assert([x, y, width, height].every(Number.isFinite), `Painted title bounds must be finite: ${diagnostic}`);
            assert(x >= area.x - 1 && x + width <= area.x + area.width + 1 &&
                y >= area.y - 1 && y + height <= area.y + area.height + 1, `Enlarged title stays within work area: ${diagnostic}`);
            if (windows.slice(0, split).includes(index))
                assert(y + height <= nextRowTop + 1, `Enlarged title stays above next row at ${nextRowTop}: ${diagnostic}`);
            if (index === groupIndex)
                assert(y + height <= actor.y + actor.height + 1, 'Enlarged application title stays within group');
            else if (entered && windows.slice(split).includes(index))
                assert(y + height <= view._targetActors[groupIndex].y + 1, 'Last title row stays above application chrome');
        }
    };
    await check(false);
    view.enterGroup(view._targets[groupIndex].application);
    await Scripting.sleep(300);
    await Scripting.waitLeisure();
    await check(true);
    console.log('PASS: enlarged styled titles fit full/entered rows, application chrome and work area');
}

async function testLiveTheme(view, groupIndex, childIndex) {
    const context = St.ThemeContext.get_for_stage(global.stage);
    const originalScale = context.scale_factor;
    const originalFont = context.get_font().copy();
    const directIndex = view._targets.findIndex(target => target.kind === 'direct-window');
    const settle = async () => {
        await Scripting.sleep(300);
        await Scripting.waitLeisure();
    };
    try {
        view.setSelection(directIndex);
        const clones = view._cloneEntries.map(entry => entry.clone);
        const previousLayout = view._fullLayout;
        context.scale_factor = 2;
        await settle();
        assert(view._fullLayout !== previousLayout, 'Theme scale change refreshes the open layout');
        assert(view._themeScale === 2, 'View uses the current theme scale');
        assert(view._selectedIndex === directIndex, 'Theme refresh preserves selection');
        assert(view._cloneEntries.every((entry, index) => entry.clone === clones[index]), 'Theme refresh preserves live clones');
        const direct = view._targetActors[directIndex]._directIcon;
        const group = view._targetActors[groupIndex];
        assertNear(direct.width, 96, 'Direct icon backing scales to 200%');
        assertNear(group._iconBin.width, 240, 'Group icon backing scales to 200%');
        assertNear(group._downChevron.width, 80, 'Chevron backing scales to 200%');
        assertNear(direct.child.icon_size, 48, 'St.Icon keeps its logical size');

        for (const entered of [false, true]) {
            if (entered)
                view.enterGroup(view._targets[groupIndex].application);
            view.setSelection(entered ? childIndex : directIndex);
            context.set_font(originalFont);
            await settle();
            const label = view._targetActors[view._selectedIndex]._selectionLabel;
            const previousHeight = label.height;
            const fullLayout = view._fullLayout;
            context.set_font(Pango.FontDescription.from_string('Sans 48'));
            await settle();
            assert(view._fullLayout !== fullLayout, 'Font change refreshes cached full layout in either scope');
            assert(label.height > previousHeight, 'Live font change enlarges the allocated title');
            const [, naturalHeight] = label.vfunc_get_preferred_height(-1);
            assertNear(label.height, naturalHeight, 'Live title allocation matches new font metrics');
            const [, y] = label.get_transformed_position();
            const [, height] = label.get_transformed_size();
            assert(y + height <= view._workArea.y + view._workArea.height + 1, 'Live enlarged title stays inside the work area');
            assert(view._geometryLaterId === 0, 'Theme refresh does not keep scheduling frames');
        }
        view.leaveGroup();
        await settle();
        console.log('PASS: live theme scale and font changes resize real St chrome and titles in full/entered layouts without rebuilding clones');
    } finally {
        context.scale_factor = originalScale;
        context.set_font(originalFont);
        await settle();
    }
}

function assertSelection(view, index, message, selectionActor = view._targetActors[index]._selectionActor) {
    const styled = [];
    const visit = actor => {
        if (actor instanceof St.Widget) {
            assert(!actor.has_style_class_name('switcher-hovered'), `${message}: no independent hover outline`);
            if (actor.has_style_class_name('switcher-selected'))
                styled.push(actor);
        }
        for (const child of actor.get_children())
            visit(child);
    };
    visit(view);
    assert(styled.length === 1 && styled[0] === selectionActor,
        `${message}: exactly one selected-style actor at index ${index}`);
}

async function testPreviewMapping(view, application) {
    const settle = async () => {
        await Scripting.sleep(300);
        await Scripting.waitLeisure();
    };
    const check = entered => {
        for (const entry of view._cloneEntries) {
            const target = view._targets[entry.targetIndex];
            const expected = !entered || target.kind === 'grouped-window' && target.application === application;
            assert(entry.clone.mapped === expected, 'Preview wrapper mapping follows navigation scope');
            for (const clone of entry.clone.get_children())
                assert(clone.mapped === expected, 'Actual Clutter.Clone mapping follows navigation scope');
        }
    };
    check(false);
    // Force the hidden-preview backing resize path, including its second fade.
    const direct = view._cloneEntries.find(entry => view._targets[entry.targetIndex].kind === 'direct-window');
    view._rebasePreview(direct, {width: 1000, height: 750});
    view.enterGroup(application);
    await settle();
    check(true);
    view._rebasePreview(direct, {width: 1100, height: 825});
    view._applyComposition(true);
    check(true);
    assert(direct.clone.get_transition('opacity') === null, 'Hidden backing rebase does not animate or remap');
    view.leaveGroup();
    check(false);
    await settle();
    view._rebasePreview(direct, {width: 1000, height: 750});
    view.enterGroup(application);
    await Scripting.sleep(20);
    view.leaveGroup();
    await settle();
    check(false);
    assert(view._cloneEntries.every(entry => entry.clone.opacity === 255), 'Interrupted fade cannot hide returned previews');
    console.log('PASS: real preview wrapper/Clutter.Clone unmapping, hidden backing rebase, remapping and interrupted return');
}

function prepareHoveredTeardown(view, groupIndex, childIndex) {
    const group = view._targetActors[groupIndex];
    const child = view._targetActors[childIndex];
    const selected = view._targets.findIndex(target => target.kind === 'direct-window');
    view.setSelection(selected);
    const selectionActor = view._targetActors[selected]._selectionActor;
    const border = group._groupOutline.get_theme_node().get_border_width(St.Side.TOP);
    for (const hovered of [false, true]) {
        group.set_hover(hovered);
        child.set_hover(hovered);
        assertSelection(view, selected, 'set_hover preserves keyboard selection');
        assertNear(group._groupOutline.get_theme_node().get_border_width(St.Side.TOP), border,
            'set_hover does not add a group border');
    }
    const destroyChildren = view.destroy_all_children;
    let boundaries = 0;
    view.destroy_all_children = function () {
        this.destroy_all_children = destroyChildren;
        boundaries++;
        group.set_hover(false);
        child.set_hover(false);
        group.set_hover(true);
        child.set_hover(true);
        assertSelection(this, selected, 'Hover notifications before teardown preserve selection', selectionActor);
        destroyChildren.call(this);
        assert(this.get_n_children() === 0, 'Teardown removes all children');
    };
    return () => {
        assert(boundaries === 1, 'Teardown must destroy children exactly once');
    };
}

async function testSession(SwitcherSession, targets, startingWindow, groupIndex, childIndex) {
    const helper = await Scripting._getPerfHelper();
    // Mutter 50.0: clutter-seat.h and clutter-virtual-input-device.h.
    const seat = global.stage.context.get_backend().get_default_seat();
    let pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    let keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    let touchscreen = seat.create_virtual_device(Clutter.InputDeviceType.TOUCHSCREEN_DEVICE);
    const modalCount = Main.modalCount;
    let session = null;
    let pressedButton = null;
    let touching = false;
    const settle = async () => {
        // Shell 50's helper exits after 30 seconds without a D-Bus method call.
        await helper.WaitWindowsAsync();
        await Scripting.sleep(300);
        await Scripting.waitLeisure();
    };
    const key = async symbol => {
        keyboard.notify_keyval(GLib.get_monotonic_time(), symbol, Clutter.KeyState.PRESSED);
        keyboard.notify_keyval(GLib.get_monotonic_time(), symbol, Clutter.KeyState.RELEASED);
        await settle();
    };
    const motion = async (x, y) => {
        pointer.notify_absolute_motion(GLib.get_monotonic_time(), x, y);
        await settle();
    };
    // Mutter 50.0 meta-virtual-input-device-native.c converts Clutter button numbers to evdev.
    const button = async (number, state) => {
        pointer.notify_button(GLib.get_monotonic_time(), number, state);
        pressedButton = state === Clutter.ButtonState.PRESSED ? number : null;
        await settle();
    };
    const pointAtActor = async actor => {
        const [x, y] = actor.get_transformed_position();
        const [width, height] = actor.get_transformed_size();
        await motion(Math.floor(x + width / 2), Math.floor(y + height / 2));
    };
    const pointAt = index => pointAtActor(session._view._targetActors[index]);
    const check = (index, message) => {
        assert(session !== null, `${message}: session stays open with Alt held`);
        assert(session._selectedIndex === index, `${message}: expected ${index}, got ${session._selectedIndex}`);
        assertSelection(session._view, index, message);
        assert(global.stage.get_key_focus() === session._view._targetActors[index],
            `${message}: key focus follows selected target`);
    };
    try {
        // Move out of the hot corner before opening the modal; its barriers can stop the first motion.
        await motion(global.stage.width / 2, global.stage.height / 2);
        await motion(global.stage.width / 2 + 1, global.stage.height / 2 + 1);
        Main.overview.hide();
        await settle();
        keyboard.notify_keyval(GLib.get_monotonic_time(), Clutter.KEY_Alt_L, Clutter.KeyState.PRESSED);
        await settle();
        assert((global.get_pointer()[2] & Clutter.ModifierType.MOD1_MASK) !== 0, 'Virtual keyboard holds Alt');
        session = new SwitcherSession({
            targets, startingWindow, direction: 1,
            modifierMask: Clutter.ModifierType.MOD1_MASK,
            timestamp: global.get_current_time(),
            onFinished: (_session, view) => {
                session = null;
                if (view !== null)
                    view.destroy();
            },
        });
        const initialSelection = session._selectedIndex;
        session.start();
        await settle();
        assert(Main.modalCount === modalCount + 1, 'Session acquires one modal grab');
        check(initialSelection, 'Initial stationary pointer');
        const direct = targets.findIndex(target => target.kind === 'direct-window');
        await pointAt(direct);
        check(direct, 'Real pointer selects direct window');
        await pointAt(childIndex);
        check(groupIndex, 'Real pointer over collapsed child selects whole application');
        await key(Clutter.KEY_Right);
        const topLevel = targets.flatMap((target, index) => target.kind === 'grouped-window' ? [] : [index]);
        const next = topLevel[(topLevel.indexOf(groupIndex) + 1) % topLevel.length];
        check(next, 'Keyboard takes over from stationary pointer');
        const [x, y] = global.get_pointer();
        // Exercise filtered events directly; virtual devices produce genuine motion events.
        for (const [flags, emulated, coords] of [
            [0, false, [x + 0.5, y + 0.5]],
            [Clutter.EventFlags.FLAG_SYNTHETIC, false, [x + 10, y + 10]],
            [0, true, [x + 10, y + 10]],
        ]) {
            session._onPointerMotion(childIndex, {
                get_flags: () => flags, is_pointer_emulated: () => emulated, get_coords: () => coords,
            });
            check(next, 'Stationary, synthetic and emulated motion cannot take over');
        }
        await motion(x + 2, y);
        check(groupIndex, 'Real motion restores pointer selection');
        await key(Clutter.KEY_Down);
        check(childIndex, 'Enter group keeps keyboard selection with stationary pointer');
        for (const [index, target] of targets.entries()) {
            if (target.kind === 'direct-window' || target.application !== targets[groupIndex].application) {
                const actor = session._view._targetActors[index];
                assert(!actor.visible && !actor.can_focus && !actor.reactive,
                    'Out-of-scope target is hidden, unfocusable and nonreactive after enter animation');
                for (const preview of actor._previewActors) {
                    assert(!preview.mapped, 'Out-of-scope preview sibling must be unmapped');
                    for (const clone of preview.get_children())
                        assert(!clone.mapped, 'Out-of-scope Clutter.Clone must be unmapped');
                }
            }
        }
        const otherChild = targets.findIndex((target, index) => index !== childIndex &&
            target.kind === 'grouped-window' && target.application === targets[groupIndex].application);
        assert(otherChild >= 0, 'Entered group has another window');
        await pointAt(otherChild);
        check(otherChild, 'Real pointer selects individual entered window');
        await key(Clutter.KEY_Up);
        check(groupIndex, 'Leave group keeps keyboard selection with stationary pointer');
        assert(session._view._cloneEntries.every(entry => entry.clone.mapped && entry.clone.get_children().every(clone => clone.mapped)),
            'Leaving group remaps preview siblings and their Clutter.Clones');
        await pointAt(childIndex);
        await key(Clutter.KEY_Right);
        check(next, 'Keyboard selection before rebuild');
        session._view.setTargets(targets);
        session._view.setSelection(next);
        await settle();
        check(next, 'Rebuild beneath stationary pointer preserves keyboard selection');
        const [rebuildX, rebuildY] = global.get_pointer();
        await motion(rebuildX + 2, rebuildY);
        check(groupIndex, 'Rebuilt actors route real pointer motion');
        await motion(2, global.stage.height - 2);
        check(groupIndex, 'Background motion preserves selection');
        assert(session._pointerPosition.every((value, index) => value === global.get_pointer()[index]),
            'Background motion updates pointer baseline');
        await pointAt(direct);
        check(direct, 'Drag starts over a valid direct-window target');
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
        check(direct, 'Primary press alone must not finish');
        await motion(2, global.stage.height - 2);
        const actor = session._view._targetActors[direct];
        const [targetX, targetY] = actor.get_transformed_position();
        const [targetWidth, targetHeight] = actor.get_transformed_size();
        const [releaseX, releaseY] = global.get_pointer();
        assert(releaseX < targetX || releaseX >= targetX + targetWidth ||
            releaseY < targetY || releaseY >= targetY + targetHeight,
        'Drag release fixture must be outside the pressed target');
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        check(direct, 'Primary press on target then release outside must not finish');
        assert(Main.modalCount === modalCount + 1, 'Cancelled pointer click retains the modal grab');
        console.log('PASS: real primary press on target, drag outside and release does not activate');

        await pointAt(direct);
        await button(Clutter.BUTTON_SECONDARY, Clutter.ButtonState.PRESSED);
        await button(Clutter.BUTTON_SECONDARY, Clutter.ButtonState.RELEASED);
        check(direct, 'Secondary click must not finish');

        const group = session._view._targetActors[groupIndex];
        assert(!group._upChevron.visible, 'Inactive up chevron is hidden');
        const down = group._downChevron;
        const [downX, downY] = down.get_transformed_position();
        const [downWidth, downHeight] = down.get_transformed_size();
        await motion(Math.floor(downX + downWidth - 2), Math.floor(downY + downHeight / 2));
        const [pressX, pressY] = global.get_pointer();
        // Mutter 50 clutter-stage.h: pick independently of the implicit pointer grab.
        const pressedActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, pressX, pressY);
        assert(pressedActor === down || down.contains(pressedActor), 'Short drag starts on down chevron or descendant');
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
        await motion(Math.ceil(downX + downWidth + 4), pressY);
        const [shortReleaseX, shortReleaseY] = global.get_pointer();
        const releaseActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, shortReleaseX, shortReleaseY);
        assert(releaseActor === group, 'Short drag releases outside chevron but on parent group');
        const distance = Math.hypot(shortReleaseX - pressX, shortReleaseY - pressY);
        assert(distance > 0 && distance < 36, `Short chevron drag stays below 36px, got ${distance}`);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        assert(session !== null && session._enteredApplication === null,
            'Short chevron drag outside button onto parent must not activate group or enter');
        assert(Main.modalCount === modalCount + 1, 'Short chevron drag retains modal');
        console.log('PASS: short chevron drag cancels without falling through to parent click gesture');
        await pointAtActor(group._downChevron);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
        await motion(2, global.stage.height - 2);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        assert(session !== null && session._enteredApplication === null,
            'Down chevron release outside must not enter or activate');
        await pointAtActor(group._downChevron);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        assert(session !== null && session._enteredApplication === targets[groupIndex].application,
            'Down chevron click enters group instead of activating parent');
        assert(!group._downChevron.visible && group._upChevron.visible, 'Entered chevron visibility');
        await pointAtActor(group._upChevron);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
        await motion(2, global.stage.height - 2);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        assert(session !== null && session._enteredApplication === targets[groupIndex].application,
            'Up chevron release outside must not leave or activate');
        await pointAtActor(group._upChevron);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
        await button(Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        check(groupIndex, 'Up chevron click leaves group without activating parent');
        assert(session._enteredApplication === null && group._downChevron.visible && !group._upChevron.visible,
            'Leaving restores collapsed scope and chevrons');
        console.log('PASS: real chevron clicks and outside releases preserve modal and do not activate parent');

        await pointAt(direct);
        const [touchX, touchY] = global.get_pointer();
        // Mutter 50 exposes touch down/motion/up, not a virtual touch-cancel API.
        touchscreen.notify_touch_down(GLib.get_monotonic_time(), 0, touchX, touchY);
        touching = true;
        await settle();
        touchscreen.notify_touch_motion(GLib.get_monotonic_time(), 0, 2, global.stage.height - 2);
        await settle();
        touchscreen.notify_touch_up(GLib.get_monotonic_time(), 0);
        touching = false;
        await settle();
        assert(session !== null, 'Real touch slide outside then lift must not activate');
        console.log('PASS: real virtual touchscreen slide outside cancels click recognition');
        await key(Clutter.KEY_Escape);
        assert(session === null, 'Escape cancels the session');
        assert(Main.modalCount === modalCount, 'Cancel restores modal count');
        console.log('PASS: real pointer/keyboard shared selection, group scope, stationary rebuild and modal cleanup');
    } finally {
        if (touching)
            touchscreen.notify_touch_up(GLib.get_monotonic_time(), 0);
        if (pressedButton !== null)
            pointer.notify_button(GLib.get_monotonic_time(), pressedButton, Clutter.ButtonState.RELEASED);
        if (session !== null) {
            session.destroy();
            session = null;
        }
        keyboard.notify_keyval(GLib.get_monotonic_time(), Clutter.KEY_Alt_L, Clutter.KeyState.RELEASED);
        await settle();
        keyboard = null;
        pointer = null;
        touchscreen = null;
    }
}

export async function run() {
    await Main.extensionManager._initializationPromise;
    const extension = Main.extensionManager.lookup(
        'window-switching-redux@razzeee.github.io');
    if (extension === undefined)
        throw new Error('Window Switching Redux did not load');
    if (extension.state !== ExtensionState.ACTIVE)
        throw new Error(`Window Switching Redux state is ${extension.state}`);

    const {SwitcherView} = await import(extension.dir.get_child('switcherView.js').get_uri());
    const {SwitcherSession} = await import(extension.dir.get_child('switcherSession.js').get_uri());
    const helper = await Scripting._getPerfHelper();
    let view = null;
    try {
        // A group is eligible only beyond the four recent direct-window slots.
        // Scripting's convenience wrappers log and swallow D-Bus failures instead of rejecting.
        for (let i = 0; i < 5; i++)
            await helper.CreateWindowAsync(640 + i * 20, 480, false, false, false, false);
        await helper.WaitWindowsAsync();
        Main.overview.hide();
        await Scripting.waitLeisure();
        const targets = extension.stateObj._controller._snapshot();
        const groupIndex = targets.findIndex(target => target.kind === 'app-group' && target.windows.length >= 2);
        assert(groupIndex >= 0, 'Helper windows must form a real application group');
        const childIndex = targets.findIndex(target =>
            target.kind === 'grouped-window' && target.application === targets[groupIndex].application);
        assert(childIndex >= 0, 'Helper group must contain a preview');
        const startingWindow = targets[childIndex].window;
        const workArea = Main.layoutManager.getWorkAreaForMonitor(startingWindow.get_monitor());
        view = new SwitcherView(targets, startingWindow, () => {}, () => {}, () => {}, () => {}, () => {});
        Main.uiGroup.add_child(view);
        view.build();
        await Scripting.sleep(300);
        await Scripting.waitLeisure();
        assert(view._cloneEntries.some(entry => entry.source === startingWindow.get_compositor_private()),
            'Preview must clone the real helper window');
        assertWorkArea(view, workArea);
        await testInitialLabels(view);
        await testLabel(view, childIndex);
        await testLiveTheme(view, groupIndex, childIndex);
        await testPreviewMapping(view, targets[groupIndex].application);

        const checkRebuild = prepareHoveredTeardown(view, groupIndex, childIndex);
        view.setTargets(targets);
        checkRebuild();
        view.setSelection(groupIndex);
        assertSelection(view, groupIndex, 'Rebuilt view supports shared selection');
        assertWorkArea(view, workArea);
        await Scripting.sleep(300);
        await Scripting.waitLeisure();
        const checkDestroy = prepareHoveredTeardown(view, groupIndex, childIndex);
        view.destroy();
        view = null;
        checkDestroy();
        console.log('PASS: set_hover adds no independent outline; hovered preview rebuild/destroy is safe');

        const pointerWorkArea = Main.layoutManager.getWorkAreaForMonitor(global.display.get_current_monitor());
        view = new SwitcherView(targets, null, () => {}, () => {}, () => {}, () => {}, () => {});
        Main.uiGroup.add_child(view);
        view.build();
        assertWorkArea(view, pointerWorkArea);
        console.log(`PASS: starting-window work area and pointer fallback/backdrop (${Main.layoutManager.monitors.length} monitor(s))`);
        view.destroy();
        view = null;
        view = new SwitcherView(targets, startingWindow, () => {}, () => {}, () => {}, () => {}, () => {});
        view.style = 'font-size: 64pt;';
        Main.uiGroup.add_child(view);
        view.build();
        await Scripting.sleep(300);
        await Scripting.waitLeisure();
        await testInitialLabels(view);
        await testEnlargedTitles(view, groupIndex);
        view.destroy();
        view = null;
        await testSession(SwitcherSession, targets, startingWindow, groupIndex, childIndex);
        await testLifecycle(extension);
    } finally {
        if (view !== null) {
            view.destroy();
            view = null;
        }
        // Cleanup logs helper errors without replacing the original failed assertion.
        await Scripting.destroyTestWindows();
        await Scripting.waitLeisure();
    }
    console.log('PASS: Window Switching Redux smoke suite complete');
}
