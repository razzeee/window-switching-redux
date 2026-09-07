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

function resolveRootWindow(window, attachedSurfaces = []) {
    while (window !== null && window.is_attached_dialog()) {
        attachedSurfaces.push(window);
        window = window.get_transient_for();
    }
    return window;
}

export class SwitcherController {
    constructor() {
        this._settings = new Gio.Settings({
            schema_id: 'org.gnome.shell.app-switcher',
        });
        this._session = null;
        this._exitView = null;
        this._bindingHandler = this._onBinding.bind(this);
        this._stockHandler = Main.wm._startSwitcher.bind(Main.wm);
        this._monitorsChangedId = Main.layoutManager.connect(
            'monitors-changed', () => this._clearPresentation());
        this._systemModalId = Main.layoutManager.connect(
            'system-modal-opened', () => this._clearPresentation());

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
        const tabWindows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL_MRU, workspace);
        const currentTime = global.display.get_current_time_roundtrip();

        // Mutter prepends off-workspace attention windows. Restore its user-time MRU
        // before normalization so a recent attached dialog also ranks its root.
        tabWindows.sort((a, b) => {
            const aTime = a.get_user_time();
            const bTime = b.get_user_time();
            if (aTime === 0 || bTime === 0)
                return bTime - aTime;
            // Unsigned ages handle rollover, but cannot distinguish ages beyond
            // the full 32-bit timestamp horizon (about 49.7 days).
            return ((currentTime - aTime) >>> 0) - ((currentTime - bTime) >>> 0);
        });
        for (const tabWindow of tabWindows) {
            const attachedSurfaces = [];
            const window = resolveRootWindow(tabWindow, attachedSurfaces);
            if (window.skip_taskbar)
                continue;

            if (!recordsByWindow.has(window)) {
                recordsByWindow.set(window, {
                    window,
                    auxiliarySurfaces: new Set(),
                    application: tracker.get_window_app(window),
                });
            }

            for (const surface of attachedSurfaces)
                recordsByWindow.get(window).auxiliarySurfaces.add(surface);
        }

        // MRU determines root ranking; clones need compositor order, bottom to top.
        for (const record of recordsByWindow.values()) {
            record.auxiliarySurfaces = global.display.sort_windows_by_stacking(
                [...record.auxiliarySurfaces]);
        }

        return buildTraversal([...recordsByWindow.values()], 4);
    }

    _onBinding(display, _window, event, binding) {
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

        const startingWindow = resolveRootWindow(display.focus_window);
        const session = new SwitcherSession({
            targets,
            startingWindow,
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

    _clearPresentation() {
        if (this._session !== null) {
            const session = this._session;
            this._session = null;
            session.destroy();
        }
        if (this._exitView !== null) {
            const exitView = this._exitView;
            this._exitView = null;
            exitView.destroy();
        }
    }

    destroy() {
        Main.layoutManager.disconnect(this._monitorsChangedId);
        this._monitorsChangedId = 0;
        Main.layoutManager.disconnect(this._systemModalId);
        this._systemModalId = 0;
        this._clearPresentation();

        Main.wm.setCustomKeybindingHandler(
            FORWARD_BINDING, Shell.ActionMode.NORMAL, this._stockHandler);
        Main.wm.setCustomKeybindingHandler(
            BACKWARD_BINDING, Shell.ActionMode.NORMAL, this._stockHandler);

        this._settings = null;
        this._bindingHandler = null;
        this._stockHandler = null;
    }
}
