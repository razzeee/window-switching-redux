// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

export async function testLifecycle(extension) {
    const helper = await Scripting._getPerfHelper();
    const seat = global.stage.context.get_backend().get_default_seat();
    let keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    let pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    const modalCount = Main.modalCount;
    let altHeld = false;
    let pressedButton = false;
    const settle = async () => {
        // Shell 50 shell-perf-helper.c: every D-Bus method renews the 30-second idle timeout.
        await helper.WaitWindowsAsync();
        await Scripting.sleep(250);
        await Scripting.waitLeisure();
    };
    const key = symbol => {
        keyboard.notify_keyval(GLib.get_monotonic_time(), symbol, Clutter.KeyState.PRESSED);
        keyboard.notify_keyval(GLib.get_monotonic_time(), symbol, Clutter.KeyState.RELEASED);
    };
    const alt = async held => {
        keyboard.notify_keyval(GLib.get_monotonic_time(), Clutter.KEY_Alt_L,
            held ? Clutter.KeyState.PRESSED : Clutter.KeyState.RELEASED);
        altHeld = held;
        await settle();
    };
    const controller = () => extension.stateObj._controller;
    const assertOpen = message => {
        const session = controller()._session;
        assert(session !== null && session._grab !== null, `${message}: controller owns grabbed session`);
        assert(Main.modalCount === modalCount + 1, `${message}: one modal acquired`);
        assert(global.stage.get_key_focus() === session._view._targetActors[session._selectedIndex],
            `${message}: selected target has key focus`);
        return session;
    };
    const assertClosed = message => {
        assert(controller()._session === null && controller()._exitView === null, `${message}: controller references cleared`);
        assert(Main.modalCount === modalCount, `${message}: modal count restored`);
    };
    const open = async () => {
        await alt(true);
        key(Clutter.KEY_Tab);
        await settle();
        return assertOpen('Real Alt+Tab');
    };
    const noModifier = () => {
        // Explicitly synthetic binding fixture; all controller/session/view objects are real.
        controller()._onBinding(global.display, null,
            {get_time: () => global.get_current_time()}, {is_reversed: () => false, get_mask: () => 0});
        return assertOpen('Zero-modifier binding fixture');
    };
    const selectedWindow = session => {
        const target = session._targets[session._selectedIndex];
        return target.kind === 'app-group' ? target.windows[0].window : target.window;
    };
    const waitForExit = async () => {
        for (let i = 0; i < 100 && controller()._exitView === null; i++)
            await Scripting.sleep(5);
        assert(controller()._session === null && controller()._exitView !== null, 'Caught real animated exit before completion');
        return controller()._exitView;
    };
    try {
        const startingWindow = global.display.focus_window;
        await open();
        key(Clutter.KEY_Escape);
        await settle();
        assertClosed('Escape');
        assert(global.display.focus_window === startingWindow, 'Escape does not activate another window');
        await alt(false);

        const beforeSwitch = global.display.focus_window;
        assert(beforeSwitch !== null, 'Real Alt+Tab regression starts with a focused window');
        const session = await open();
        const expected = selectedWindow(session);
        assert(expected !== beforeSwitch, 'First real Alt+Tab skips the focused window');
        await alt(false);
        assertClosed('Modifier release');
        assert(global.display.focus_window === expected, 'Modifier release activates selected window');

        const persistent = noModifier();
        await Scripting.sleep(650);
        assert(assertOpen('Zero-modifier after 650ms') === persistent, 'Zero-modifier session must not auto-finish');
        const confirmed = selectedWindow(persistent);
        key(Clutter.KEY_Return);
        await settle();
        assertClosed('Explicit Enter');
        assert(global.display.focus_window === confirmed, 'Enter activates zero-modifier selection');
        console.log('PASS: real controller Alt+Tab, Escape, modifier-release activation and zero-modifier explicit Enter');

        for (const [region, releaseModifier] of [
            ['target', false], ['target', true], ['icon bin', false], ['icon', true], ['title text', false],
        ]) {
            const focused = releaseModifier ? await open() : noModifier();
            await settle();
            const previousIndex = focused._selectedIndex;
            const destination = focused._targets.findIndex((candidate, candidateIndex) =>
                candidate.kind === 'direct-window' && candidateIndex !== previousIndex &&
                candidate.window !== global.display.focus_window);
            assert(destination >= 0, 'ATK fixture has a nonselected destination distinct from the focused window');
            const expectedWindow = focused._targets[destination].window;
            const destinationActor = focused._view._targetActors[destination];
            const focusActor = region === 'icon bin' ? destinationActor._directIcon
                : region === 'icon' ? destinationActor._directIcon.get_child()
                    : region === 'title text' ? destinationActor._selectionLabel.clutter_text : destinationActor;
            const accessible = focusActor.get_accessible();
            assert(accessible instanceof Atk.Component, 'Target exposes the real Atk.Component interface');
            // Mutter 50.0 clutter/clutter/clutter-actor-accessible.c: grab_focus sets stage key focus.
            // This exercises local ATK, not Orca or the AT-SPI D-Bus bridge.
            assert(accessible.grab_focus(), 'ATK grab_focus succeeds on a nonselected target');
            await settle();
            assert(assertOpen('ATK focus transfer') === focused && focused._selectedIndex === destination &&
                focused._view._selectedIndex === destination, 'ATK focus updates both session and view selection');
            assert(destinationActor.get_accessible().ref_state_set().contains_state(Atk.StateType.SELECTED), 'ATK destination reports selected');
            assert(!focused._view._targetActors[previousIndex].get_accessible().ref_state_set().contains_state(Atk.StateType.SELECTED),
                'Previous ATK target no longer reports selected');
            if (releaseModifier)
                await alt(false);
            else {
                key(Clutter.KEY_Return);
                await settle();
            }
            assertClosed('Activation after ATK focus transfer');
            assert(global.display.focus_window === expectedWindow,
                `${releaseModifier ? 'Modifier release' : 'Enter'} activates the ATK-focused ${region} destination`);
        }
        console.log('PASS: local ATK target/icon/title focus synchronizes selection and destination for Enter and modifier release');

        for (const releaseModifier of [false, true]) {
            const focused = releaseModifier ? await open() : noModifier();
            await settle();
            const previousIndex = focused._selectedIndex;
            const groupIndex = focused._targets.findIndex(candidate => candidate.kind === 'app-group');
            assert(groupIndex >= 0 && groupIndex !== previousIndex, 'Collapsed ATK fixture has a nonselected application group');
            const group = focused._targets[groupIndex];
            const expectedWindow = group.windows[0].window;
            const childIndex = focused._targets.findIndex(candidate => candidate.kind === 'grouped-window' &&
                candidate.application === group.application && candidate.window !== expectedWindow);
            assert(childIndex >= 0 && selectedWindow(focused) !== expectedWindow,
                'Collapsed ATK child and previous selection differ from the group activation destination');
            const view = focused._view;
            const child = view._targetActors[childIndex];
            assert(focused._enteredApplication === null && child.mapped && !child.can_focus,
                'Collapsed child is visible but excluded from keyboard traversal');
            const accessible = child.get_accessible();
            assert(accessible instanceof Atk.Component, 'Collapsed child exposes real Atk.Component');
            assert(accessible.grab_focus(), 'ATK can request focus even on a collapsed child excluded from traversal');
            await settle();
            assert(assertOpen('Collapsed child ATK focus') === focused && focused._selectedIndex === groupIndex &&
                view._selectedIndex === groupIndex, 'Collapsed child ATK focus selects and focuses its group');
            assert(focused._enteredApplication === null && view._enteredApplication === null, 'ATK focus does not enter the group');
            assert(view._targetActors[groupIndex].get_accessible().ref_state_set().contains_state(Atk.StateType.SELECTED),
                'Collapsed group reports selected through ATK');
            for (const index of [previousIndex, childIndex]) {
                assert(!view._targetActors[index].get_accessible().ref_state_set().contains_state(Atk.StateType.SELECTED),
                    'Neither previous target nor collapsed child reports selected');
            }
            if (releaseModifier)
                await alt(false);
            else {
                key(Clutter.KEY_Return);
                await settle();
            }
            assertClosed('Confirmation after collapsed child ATK focus');
            assert(global.display.focus_window === expectedWindow,
                `${releaseModifier ? 'Modifier release' : 'Enter'} activates the group newest window, not its ATK-focused child or stale selection`);
        }
        console.log('PASS: collapsed-child Atk.Component.grab_focus selects its group; Enter and modifier release activate the group newest window');

        for (const entered of [false, true]) {
            const focused = noModifier();
            await settle();
            const groupIndex = focused._targets.findIndex(candidate => candidate.kind === 'app-group');
            assert(groupIndex >= 0, 'Chevron focus fixture has an application group');
            const group = focused._view._targetActors[groupIndex];
            if (entered) {
                focused._enterGroup(focused._targets[groupIndex].application);
                await settle();
            }
            const expectedIndex = entered ? focused._selectedIndex : groupIndex;
            const chevron = entered ? group._upChevron : group._downChevron;
            assert(chevron.mapped, 'ATK focus fixture uses a visible chevron');
            assert(chevron.get_accessible().grab_focus(), 'ATK chevron focus request succeeds');
            assert(assertOpen('Chevron focus normalization') === focused && focused._selectedIndex === expectedIndex,
                'Chevron focus returns to its valid navigation target');
            assert((focused._enteredApplication !== null) === entered, 'Chevron focus alone does not change scope');
            const expectedWindow = selectedWindow(focused);
            key(Clutter.KEY_Return);
            await settle();
            assertClosed('Confirmation after chevron focus');
            assert(global.display.focus_window === expectedWindow, 'Return activates the normalized focus destination');
        }
        console.log('PASS: local ATK chevron focus returns to the owning group or current entered target before confirmation');

        const minimizedWindow = global.display.focus_window;
        assert(minimizedWindow !== null && !minimizedWindow.is_maximized(), 'Minimize fixture has a nonmaximized window');
        for (let trial = 0; trial < 3; trial++) {
            minimizedWindow.minimize();
            await settle();
            await Scripting.sleep(250);
            assert(minimizedWindow.minimized, 'Real helper window is minimized');
            const focused = noModifier();
            await settle();
            const index = focused._targets.findIndex(candidate => candidate.kind === 'direct-window' && candidate.window === minimizedWindow);
            assert(index >= 0, 'Minimized window remains a direct target');
            focused._view._targetActors[index].get_accessible().grab_focus();
            const view = focused._view;
            let destination = null;
            const rebase = view._rebasePreview;
            view._rebasePreview = function (entry, geometry, presented) {
                if (this._exitTargetIndex !== null && entry.targetIndex === index && entry.surface === minimizedWindow)
                    destination = {x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height};
                return rebase.call(this, entry, geometry, presented);
            };
            key(Clutter.KEY_Return);
            await settle();
            await Scripting.sleep(250);
            assertClosed('Minimized window confirmation');
            assert(global.display.focus_window === minimizedWindow && !minimizedWindow.minimized, 'Confirmation restores the minimized window');
            assert(destination !== null && destination.width > 0 && destination.height > 0, 'Exit captures a nonzero destination');
            const buffer = minimizedWindow.get_buffer_rect();
            for (const property of ['x', 'y', 'width', 'height'])
                assert(Math.abs(destination[property] - buffer[property]) < 1, `Exit destination ${property} matches the final buffer rectangle`);
        }
        console.log('PASS: three real minimize/activate cycles use final window geometry for the exit preview');

        for (const region of ['lower icon', 'selected title']) {
            const chromeSession = noModifier();
            await settle();
            const chromeIndex = chromeSession._targets.findIndex(candidate =>
                candidate.kind === 'direct-window' && candidate.window !== global.display.focus_window);
            assert(chromeIndex >= 0, `${region}: helper destination differs from focused window`);
            const chromeWindow = chromeSession._targets[chromeIndex].window;
            const chromeActor = chromeSession._view._targetActors[chromeIndex];
            assert(chromeActor.get_accessible().grab_focus(), `${region}: select target through ATK`);
            await settle();
            const child = region === 'lower icon' ? chromeActor._directIcon : chromeActor._selectionLabel;
            assert(child.mapped && child.opacity === 255, `${region}: click region is visible`);
            const [childX, childY] = child.get_transformed_position();
            const [childWidth, childHeight] = child.get_transformed_size();
            const clickX = Math.floor(childX + childWidth / 2);
            const clickY = Math.floor(childY + childHeight * (region === 'lower icon' ? 0.8 : 0.5));
            const [, actorY] = chromeActor.get_transformed_position();
            const [, actorHeight] = chromeActor.get_transformed_size();
            assert(clickY > actorY + actorHeight, `${region}: click lies below the parent preview allocation`);
            const beforeClick = global.display.focus_window;
            for (const cancel of [true, false]) {
                // Mutter 50.0 clutter-virtual-input-device.h: timestamps are monotonic microseconds.
                pointer.notify_absolute_motion(GLib.get_monotonic_time(), clickX, clickY);
                await settle();
                const [pressX, pressY] = global.get_pointer();
                assert(Math.abs(pressX - clickX) < 1 && Math.abs(pressY - clickY) < 1, `${region}: virtual pointer reaches click region`);
                const picked = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, pressX, pressY);
                assert(picked === child || (picked !== null && child.contains(picked)), `${region}: reactive pick hits child, not preview`);
                pointer.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
                pressedButton = true;
                await Scripting.sleep(30);
                if (cancel) {
                    pointer.notify_absolute_motion(GLib.get_monotonic_time(), 2, global.stage.height - 2);
                    await settle();
                    const [releaseX, releaseY] = global.get_pointer();
                    const pickedRelease = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, releaseX, releaseY);
                    assert(pickedRelease !== chromeActor && (pickedRelease === null || !chromeActor.contains(pickedRelease)),
                        `${region}: cancelled drag releases outside target and descendants`);
                }
                pointer.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
                pressedButton = false;
                await settle();
                if (cancel) {
                    assert(assertOpen(`${region}: cancelled drag`) === chromeSession, `${region}: cancelled drag retains session`);
                    assert(global.display.focus_window === beforeClick, `${region}: cancelled drag does not activate`);
                } else {
                    assertClosed(`${region}: primary click`);
                    assert(global.display.focus_window === chromeWindow, `${region}: primary click activates destination`);
                }
            }
        }
        console.log('PASS: real lower-half icon and selected-title clicks activate; drags outside cancel');

        const resizing = noModifier();
        await settle();
        const resizeIndex = resizing._targets.findIndex(candidate => candidate.kind === 'direct-window' &&
            candidate.window.allows_resize() && !candidate.window.is_maximized() && !candidate.window.is_fullscreen());
        assert(resizeIndex >= 0, 'Resize fixture has a resizable, unmaximized helper window');
        const resizeWindow = resizing._targets[resizeIndex].window;
        // Mutter 50.0 src/meta/window.h: frame rectangles and move_resize_frame use stage coordinates.
        const originalFrame = resizeWindow.get_frame_rect();
        try {
            const view = resizing._view;
            const selection = resizing._selectedIndex;
            const selectedTarget = resizing._targets[selection];
            const entry = view._cloneEntries.find(candidate => candidate.targetIndex === resizeIndex && candidate.surface === resizeWindow);
            assert(entry !== undefined && entry.source !== null, 'Resize fixture previews the real compositor source');
            const [oldWidth, oldHeight] = entry.source.get_transformed_size();
            const area = view._workArea;
            // shell-perf-helper.c uses gtk_widget_set_size_request: creation dimensions are minima.
            const width = Math.floor(Math.min(originalFrame.width * 1.5, area.width * 0.9));
            const height = originalFrame.height;
            assert(width / originalFrame.width > 1.2, 'Helper can grow enough to change aspect without violating its minimum size');
            resizeWindow.move_resize_frame(false, originalFrame.x, originalFrame.y, width, height);
            // Wayland configure/commit and the BEFORE_REDRAW refresh are asynchronous.
            let matches = false;
            for (let attempt = 0; attempt < 20; attempt++) {
                await settle();
                assert(assertOpen('Live source resize') === resizing && resizing._view === view,
                    'Resize retains the same no-modifier session and view');
                assert(resizing._selectedIndex === selection && resizing._targets[selection] === selectedTarget && view._selectedIndex === selection,
                    'Source geometry changes preserve selected target and index');
                const [sourceWidth, sourceHeight] = entry.source.get_transformed_size();
                const [previewWidth, previewHeight] = entry.clone.get_transformed_size();
                const sourceAspect = sourceWidth / sourceHeight;
                matches = Math.abs(sourceAspect / (oldWidth / oldHeight) - 1) > 0.2 &&
                    previewWidth > 0 && previewHeight > 0 && Math.abs(previewWidth / previewHeight / sourceAspect - 1) < 0.005;
                if (matches)
                    break;
            }
            assert(matches, 'Resized source changes aspect by >20% and transformed preview matches within 0.5%');
            assert(view._geometryLaterId === 0, 'Coalesced geometry refresh drains after resize');
            console.log('PASS: real Meta.Window resize updates transformed preview aspect without changing selection');
        } finally {
            assert(global.get_window_actors().some(actor => actor.meta_window === resizeWindow),
                'Cannot restore an unmanaged helper window; check fixture lifetime before calling Meta resize');
            resizeWindow.move_resize_frame(false, originalFrame.x, originalFrame.y, originalFrame.width, originalFrame.height);
            let restored = false;
            for (let attempt = 0; attempt < 20; attempt++) {
                await settle();
                const frame = resizeWindow.get_frame_rect();
                restored = ['x', 'y', 'width', 'height'].every(property => frame[property] === originalFrame[property]);
                if (restored)
                    break;
            }
            assert(restored, 'Resize fixture restores the original helper window frame');
        }
        key(Clutter.KEY_Escape);
        await settle();
        assertClosed('Escape after live source resize');

        const bindings = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.keybindings'});
        const savedForward = bindings.get_user_value('switch-applications');
        try {
            assert(bindings.set_strv('switch-applications', ['<Alt>Menu']), 'Temporary Alt+Menu binding is writable');
            await settle();
            await alt(true);
            key(Clutter.KEY_Menu);
            await settle();
            const menuSession = assertOpen('First real Alt+Menu');
            const initial = menuSession._selectedIndex;
            const topLevel = menuSession._targets.flatMap((candidate, candidateIndex) =>
                candidate.kind === 'grouped-window' ? [] : [candidateIndex]);
            const next = topLevel[(topLevel.indexOf(initial) + 1) % topLevel.length];
            assert(next !== initial, 'Alt+Menu fixture has another top-level target');
            key(Clutter.KEY_Menu);
            await settle();
            assert(assertOpen('Second real Alt+Menu') === menuSession, 'Repeated binding retains same session');
            assert(menuSession._selectedIndex === next,
                `Focused target must not consume repeated Alt+Menu: expected ${next}, got ${menuSession._selectedIndex}`);
            key(Clutter.KEY_Escape);
            await settle();
            assertClosed('Escape after repeated Alt+Menu');
            console.log('PASS: repeated real Alt+Menu advances despite selected St.Widget key focus');
        } finally {
            // Preserve an unset user value as well as any explicit accelerator list.
            if (savedForward === null)
                bindings.reset('switch-applications');
            else
                bindings.set_value('switch-applications', savedForward);
            if (controller()._session !== null) {
                key(Clutter.KEY_Escape);
                await settle();
            }
            await alt(false);
        }

        const clickable = noModifier();
        await settle();
        const index = clickable._targets.findIndex(target => target.kind === 'direct-window');
        const target = clickable._targets[index].window;
        const actor = clickable._view._targetActors[index];
        const [x, y] = actor.get_transformed_position();
        const [width, height] = actor.get_transformed_size();
        pointer.notify_absolute_motion(GLib.get_monotonic_time(), x + width / 2, y + height / 2);
        await settle();
        pointer.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
        pressedButton = true;
        await Scripting.sleep(30);
        pointer.notify_absolute_motion(GLib.get_monotonic_time(), x + width / 2 + 2, y + height / 2);
        await Scripting.sleep(30);
        pointer.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        pressedButton = false;
        await settle();
        assertClosed('Valid primary click with small pointer movement');
        assert(global.display.focus_window === target, 'Valid primary click activates clicked window');
        console.log('PASS: real primary click activates target through controller');

        const monitored = await open();
        let destroyed = false;
        monitored._view.connect('destroy', () => { destroyed = true; });
        Main.layoutManager.emit('monitors-changed');
        assertClosed('Injected monitors-changed signal during modal');
        assert(destroyed, 'Monitor signal destroys active view synchronously');
        await alt(false);

        noModifier();
        await settle();
        key(Clutter.KEY_Escape);
        const exit = await waitForExit();
        destroyed = false;
        exit.connect('destroy', () => { destroyed = true; });
        Main.layoutManager.emit('monitors-changed');
        assertClosed('Injected monitors-changed signal during exit');
        assert(destroyed, 'Monitor signal destroys exiting view synchronously');

        noModifier();
        await settle();
        key(Clutter.KEY_Escape);
        const previousExit = await waitForExit();
        destroyed = false;
        previousExit.connect('destroy', () => { destroyed = true; });
        noModifier();
        assert(destroyed && controller()._exitView === null, 'Rapid reopen destroys previous exit view');
        await settle();
        assertOpen('Rapid reopen survives old exit deadline');
        console.log('PASS: controller monitor-signal cancellation during modal/exit and rapid reopen');

        for (const duringExit of [false, true]) {
            const oldController = controller();
            if (duringExit) {
                key(Clutter.KEY_Escape);
                await waitForExit();
            }
            const view = duringExit ? oldController._exitView : oldController._session._view;
            destroyed = false;
            view.connect('destroy', () => { destroyed = true; });
            extension.stateObj.disable();
            assert(extension.stateObj._controller === null && oldController._session === null && oldController._exitView === null,
                'Disable clears extension and controller references');
            assert(destroyed && Main.modalCount === modalCount, 'Disable destroys presentation and restores modal count');
            extension.stateObj.enable();
            await settle();
            await open();
            await alt(false);
            assertClosed('Real Alt+Tab works after re-enable');
            if (!duringExit) {
                noModifier();
                await settle();
            }
        }
        console.log('PASS: disable during modal and animated exit, re-enable restores real binding');

        const interrupted = noModifier();
        await settle();
        const interruptedActors = new Set([interrupted, interrupted._view, ...interrupted._view._targetActors]);
        let interruptedViewDestroyed = false;
        interrupted._view.connect('destroy', () => { interruptedViewDestroyed = true; });
        // GNOME Shell 50.0 js/ui/modalDialog.js: open() pushes modal and emits system-modal-opened synchronously.
        let dialog = new ModalDialog.ModalDialog({destroyOnClose: false});
        dialog.addButton({label: 'Close', action: () => dialog.close()});
        try {
            assert(dialog.open(), 'Stock system modal opens');
            assert(controller()._session === null && controller()._exitView === null,
                'Stock system modal synchronously cancels controller without an exit view');
            assert(interruptedViewDestroyed && interrupted._view === null && interrupted._windowSignals.size === 0,
                'System-modal interruption destroys view and disconnects window signals');
            assert(Main.modalCount === modalCount + 1, 'Only stock dialog modal remains after interruption');
            assert(dialog.contains(global.stage.get_key_focus()), 'Stock dialog owns key focus after interruption');
            await settle();
        } finally {
            dialog.close();
            await settle();
            dialog.destroy();
            dialog = null;
        }
        assertClosed('Stock system modal closed');
        assert(!interruptedActors.has(global.stage.get_key_focus()), 'Closing stock dialog does not restore destroyed switcher focus');
        console.log('PASS: actual stock system modal synchronously cancels switcher and restores modal baseline after close');

        const closing = noModifier();
        await settle();
        assert(closing._windowSignals.size > 0, 'Final-target closure starts with real tracked helper windows');
        const closingActors = new Set([closing, closing._view, ...closing._view._targetActors]);
        let closingViewDestroyed = false;
        closing._view.connect('destroy', () => { closingViewDestroyed = true; });
        await helper.DestroyWindowsAsync();
        await settle();
        assert(controller()._snapshot().length === 0, 'Destroying helper pool leaves no switcher targets');
        assertClosed('Final real target closed');
        assert(closingViewDestroyed && closing._view === null && closing._windowSignals.size === 0,
            'Final-target closure destroys view and disconnects all window signals');
        assert(!closingActors.has(global.stage.get_key_focus()), 'Final-target closure moves focus outside destroyed switcher');
        console.log('PASS: closing all real helper windows releases final-target session, view, signals and modal');
    } finally {
        if (pressedButton)
            pointer.notify_button(GLib.get_monotonic_time(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        if (extension.stateObj._controller !== null)
            extension.stateObj.disable();
        extension.stateObj.enable();
        if (altHeld)
            await alt(false);
        await settle();
        keyboard = null;
        pointer = null;
    }
}
