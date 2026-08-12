// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {buildTraversal} from './windowModel.js';
import {SwitcherSession} from './switcherSession.js';

const FORWARD_BINDING = 'switch-applications';
const BACKWARD_BINDING = 'switch-applications-backward';

export class SwitcherController {
    constructor() {
        this._settings = new Gio.Settings({
            schema_id: 'org.gnome.shell.app-switcher',
        });
        this._session = null;
        this._exitView = null;
        this._bindingHandler = this._onBinding.bind(this);
        this._stockHandler = Main.wm._startSwitcher.bind(Main.wm);

        Main.wm.setCustomKeybindingHandler(
            FORWARD_BINDING, Shell.ActionMode.NORMAL, this._bindingHandler);
        Main.wm.setCustomKeybindingHandler(
            BACKWARD_BINDING, Shell.ActionMode.NORMAL, this._bindingHandler);
    }

    _snapshot() {
        const workspace = this._settings.get_boolean('current-workspace-only')
            ? global.workspace_manager.get_active_workspace()
            : null;
        const tracker = Shell.WindowTracker.get_default();
        const recordsByWindow = new Map();

        for (const tabWindow of global.display.get_tab_list(Meta.TabList.NORMAL_ALL_MRU, workspace)) {
            const window = tabWindow.is_attached_dialog()
                ? tabWindow.get_transient_for()
                : tabWindow;
            if (window.skip_taskbar)
                continue;

            if (!recordsByWindow.has(window)) {
                recordsByWindow.set(window, {
                    window,
                    auxiliarySurfaces: [],
                    application: tracker.get_window_app(window),
                });
            }

            if (tabWindow !== window)
                recordsByWindow.get(window).auxiliarySurfaces.push(tabWindow);
        }

        return buildTraversal([...recordsByWindow.values()], 4);
    }

    _onBinding(display, window, event, binding) {
        const direction = binding.is_reversed() ? -1 : 1;
        if (this._session !== null) {
            this._session.advance(direction);
            return;
        }

        const targets = this._snapshot();
        if (targets.length === 0)
            return;

        if (this._exitView !== null) {
            this._exitView.destroy();
            this._exitView = null;
        }

        const session = new SwitcherSession({
            targets,
            startingWindow: window,
            direction,
            modifierMask: binding.get_mask(),
            timestamp: event.get_time(),
            onFinished: (finishedSession, exitView) =>
                this._onSessionFinished(finishedSession, exitView),
        });
        this._session = session;
        session.start();
    }

    _onSessionFinished(session, exitView) {
        if (this._session === session)
            this._session = null;

        if (exitView === null)
            return;

        this._exitView = exitView;
        Main.uiGroup.add_child(exitView);
        exitView.beginExit(() => {
            if (this._exitView === exitView)
                this._exitView = null;
            exitView.destroy();
        });
    }

    destroy() {
        if (this._session !== null) {
            this._session.destroy();
            this._session = null;
        }
        if (this._exitView !== null) {
            this._exitView.destroy();
            this._exitView = null;
        }

        Main.wm.setCustomKeybindingHandler(
            FORWARD_BINDING, Shell.ActionMode.NORMAL, this._stockHandler);
        Main.wm.setCustomKeybindingHandler(
            BACKWARD_BINDING, Shell.ActionMode.NORMAL, this._stockHandler);

        this._settings = null;
        this._bindingHandler = null;
        this._stockHandler = null;
    }
}
