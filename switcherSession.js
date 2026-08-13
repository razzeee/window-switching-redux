// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    getGroupIndices,
    getInitialSelection,
    getScopedRemovalSelection,
    getTopLevelIndices,
    moveInScope,
    removeWindowFromTraversal,
} from './windowModel.js';
import {SwitcherView} from './switcherView.js';

function primaryModifier(mask) {
    let primary = 0;
    while (mask > 0) {
        primary = mask;
        mask &= mask - 1;
    }
    return primary;
}

export const SwitcherSession = GObject.registerClass(
class SwitcherSession extends St.Widget {
    _init({targets, startingWindow, direction, modifierMask, timestamp, onFinished}) {
        super._init({reactive: true, can_focus: true, track_hover: false});

        this._targets = targets;
        this._selectedIndex = getInitialSelection(targets, startingWindow, direction);
        this._enteredApplication = null;
        this._lastDirection = direction;
        this._modifierMask = primaryModifier(modifierMask);
        this._timestamp = timestamp;
        this._onFinished = onFinished;
        this._grab = null;
        this._view = null;
        this._windowSignals = new Map();
        this._systemModalSignal = 0;
        this._noModifierTimeout = 0;
    }

    start() {
        this.set_size(global.stage.width, global.stage.height);
        Main.uiGroup.add_child(this);

        this._view = new SwitcherView(
            this._targets,
            index => this._activateIndex(index));
        this.add_child(this._view);
        this._view.setSelection(this._selectedIndex);
        this._connectWindowSignals();
        this._systemModalSignal = Main.layoutManager.connect(
            'system-modal-opened', () => this._finish(false, true));

        this._grab = Main.pushModal(this);
        this.grab_key_focus();

        if (this._modifierMask === 0) {
            this._noModifierTimeout = GLib.timeout_add_once(
                GLib.PRIORITY_DEFAULT, 500, () => {
                    this._noModifierTimeout = 0;
                    this._finish(true, false, global.get_current_time());
                });
        } else {
            const [, , modifiers] = global.get_pointer();
            if ((modifiers & this._modifierMask) === 0)
                this._finish(true, false, global.get_current_time());
        }
    }

    _connectWindowSignals() {
        const windows = new Set();
        for (const target of this._targets) {
            if (target.kind === 'app-group') {
                for (const record of target.windows)
                    windows.add(record.window);
            } else {
                windows.add(target.window);
            }
        }

        for (const window of windows) {
            const signal = window.connect('unmanaged', () => this._removeWindow(window));
            this._windowSignals.set(window, signal);
        }
    }

    _disconnectInput() {
        if (this._noModifierTimeout !== 0) {
            GLib.source_remove(this._noModifierTimeout);
            this._noModifierTimeout = 0;
        }
        if (this._grab !== null) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        if (this._systemModalSignal !== 0) {
            Main.layoutManager.disconnect(this._systemModalSignal);
            this._systemModalSignal = 0;
        }
        for (const [window, signal] of this._windowSignals)
            window.disconnect(signal);
        this._windowSignals.clear();
    }

    advance(direction) {
        if (this._grab === null)
            return;

        this._lastDirection = direction;
        const indices = this._enteredApplication === null
            ? getTopLevelIndices(this._targets)
            : getGroupIndices(this._targets, this._enteredApplication);
        this._selectedIndex = moveInScope(this._selectedIndex, direction, indices);
        this._view.setSelection(this._selectedIndex);
    }

    _enterGroup() {
        const target = this._targets[this._selectedIndex];
        if (target.kind !== 'app-group')
            return;

        const indices = getGroupIndices(this._targets, target.application);
        if (indices.length === 0)
            return;
        this._enteredApplication = target.application;
        this._selectedIndex = indices[0];
        this._view.setSelection(this._selectedIndex);
    }

    _leaveGroup() {
        if (this._enteredApplication === null)
            return;

        const groupIndex = this._targets.findIndex(target =>
            target.kind === 'app-group' &&
            target.application === this._enteredApplication);
        this._enteredApplication = null;
        if (groupIndex === -1)
            return;
        this._selectedIndex = groupIndex;
        this._view.setSelection(this._selectedIndex);
    }

    _removeWindow(window) {
        const signal = this._windowSignals.get(window);
        if (signal !== undefined) {
            window.disconnect(signal);
            this._windowSignals.delete(window);
        }

        const previousTargets = this._targets;
        const previousSelected = previousTargets[this._selectedIndex];
        const previousApplication = this._enteredApplication;
        const result = removeWindowFromTraversal(
            previousTargets, this._selectedIndex, window, this._lastDirection);
        this._targets = result.targets;
        this._selectedIndex = result.selectedIndex;

        if (this._targets.length === 0) {
            this._finish(false);
            return;
        }

        if (previousApplication !== null) {
            const previousGroupIndices = getGroupIndices(previousTargets, previousApplication);
            const groupIndices = getGroupIndices(this._targets, previousApplication);
            if (groupIndices.length === 0) {
                this._enteredApplication = null;
                const previousGroupIndex = previousTargets.findIndex(target =>
                    target.kind === 'app-group' &&
                    target.application === previousApplication);
                const topLevelIndices = getTopLevelIndices(this._targets);
                const previousTopLevel = getTopLevelIndices(previousTargets);
                this._selectedIndex = getScopedRemovalSelection(
                    previousTargets,
                    this._targets,
                    previousGroupIndex,
                    this._lastDirection,
                    previousTopLevel,
                    topLevelIndices);
            } else {
                this._selectedIndex = getScopedRemovalSelection(
                    previousTargets,
                    this._targets,
                    previousTargets.indexOf(previousSelected),
                    this._lastDirection,
                    previousGroupIndices,
                    groupIndices);
            }
        } else {
            const previousTopLevel = getTopLevelIndices(previousTargets);
            const topLevelIndices = getTopLevelIndices(this._targets);
            this._selectedIndex = getScopedRemovalSelection(
                previousTargets,
                this._targets,
                previousTargets.indexOf(previousSelected),
                this._lastDirection,
                previousTopLevel,
                topLevelIndices);
        }

        this._view.setTargets(this._targets);
        this._view.setSelection(this._selectedIndex);
    }

    _activationWindow(target) {
        if (target.kind === 'app-group') {
            if (target.windows.length === 0)
                return null;
            return target.windows[0].window;
        }
        return target.window;
    }

    _activateIndex(index, timestamp) {
        if (this._grab === null || index < 0 || index >= this._targets.length)
            return;

        this._selectedIndex = index;
        this._finish(true, false, timestamp);
    }

    _finish(activate, synchronous = false, timestamp = this._timestamp) {
        if (this._grab === null)
            return;

        const target = this._targets[this._selectedIndex];
        const window = target === undefined ? null : this._activationWindow(target);
        this._disconnectInput();

        if (activate && window !== null)
            Main.activateWindow(window, timestamp);

        const view = this._view;
        this._view = null;
        if (view !== null)
            this.remove_child(view);

        const onFinished = this._onFinished;
        this._onFinished = null;
        this._targets = Object.freeze([]);
        super.destroy();

        if (synchronous) {
            if (view !== null)
                view.destroy();
            onFinished(this, null);
        } else {
            onFinished(this, view);
        }
    }

    vfunc_key_press_event(event) {
        const symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Escape) {
            this._finish(false, false, event.get_time());
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter || symbol === Clutter.KEY_space) {
            this._finish(true, false, event.get_time());
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Down) {
            this._enterGroup();
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Up) {
            this._leaveGroup();
            return Clutter.EVENT_STOP;
        }

        const action = global.display.get_keybinding_action(
            event.get_key_code(), event.get_state());
        if (action === Meta.KeyBindingAction.SWITCH_APPLICATIONS) {
            this.advance(1);
            return Clutter.EVENT_STOP;
        }
        if (action === Meta.KeyBindingAction.SWITCH_APPLICATIONS_BACKWARD) {
            this.advance(-1);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_STOP;
    }

    vfunc_key_release_event(event) {
        const [, , modifiers] = global.get_pointer();
        if (this._modifierMask !== 0 && (modifiers & this._modifierMask) === 0)
            this._finish(true, false, event.get_time());
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this._disconnectInput();
        if (this._view !== null) {
            this._view.destroy();
            this._view = null;
        }
        this._targets = Object.freeze([]);
        this._enteredApplication = null;
        this._onFinished = null;
        super.destroy();
    }
});
