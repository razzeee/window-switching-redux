// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {SwitcherController} from './switcherController.js';

export default class WindowSwitchingReduxExtension extends Extension {
    enable() {
        this._controller = new SwitcherController();
    }

    disable() {
        this._controller.destroy();
        this._controller = null;
    }
}
