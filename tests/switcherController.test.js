// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test from 'node:test';

const modelURL = new URL('../windowModel.js', import.meta.url).href;
const modules = new Map([
    ['gi://Gio', `export default {Settings: class {
        constructor(options) { this.options = options; this.currentWorkspaceOnly = false; }
        get_boolean(key) {
            if (key !== 'current-workspace-only') throw new Error(key);
            return this.currentWorkspaceOnly;
        }
    }}`],
    ['gi://Meta', 'export default {TabList: {NORMAL_ALL_MRU: 3}}'],
    ['gi://Shell', `export default {
        ActionMode: {NORMAL: 1},
        WindowTracker: {get_default: () => ({get_window_app: window => window.application})},
    }`],
    ['resource:///org/gnome/shell/ui/main.js', `
        export const wm = {
            handlers: new Map(), registrations: [], stockCalls: [],
            setCustomKeybindingHandler(name, mode, handler) {
                this.handlers.set(name, handler);
                this.registrations.push([name, mode, handler]);
            },
            _startSwitcher(...args) { this.stockCalls.push(args); },
        };
        export const layoutManager = {
            signals: new Map(), nextId: 1,
            connect(name, callback) {
                const id = this.nextId++;
                this.signals.set(id, {name, callback});
                return id;
            },
            disconnect(id) {
                if (!this.signals.delete(id)) throw new Error('Unknown signal');
            },
            emit(name) {
                for (const signal of [...this.signals.values()])
                    if (signal.name === name) signal.callback(this);
            },
        };
        export const uiGroup = {children: new Set(), add_child(view) {this.children.add(view);}};
    `],
    ['./switcherSession.js', `
        import {getInitialSelection, getTopLevelIndices, moveInScope} from '${modelURL}';
        export const sessions = [];
        export class SwitcherSession {
            constructor(options) {
                this.options = options;
                this.advances = [];
                this.destroyCount = 0;
                this.startCount = 0;
                sessions.push(this);
            }
            start() {
                this.startCount++;
                const {targets, startingWindow, direction} = this.options;
                this.selectedIndex = getInitialSelection(targets, startingWindow, direction);
            }
            advance(direction) {
                this.advances.push(direction);
                this.selectedIndex = moveInScope(this.selectedIndex, direction, getTopLevelIndices(this.options.targets));
            }
            finish(view) {this.options.onFinished(this, view);}
            destroy() {this.destroyCount++;}
        }
    `],
]);
const moduleURL = specifier => `data:text/javascript,${encodeURIComponent(modules.get(specifier))}`;
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (context.parentURL === new URL('../switcherController.js', import.meta.url).href && modules.has(specifier))
            return {url: moduleURL(specifier), shortCircuit: true};
        return nextResolve(specifier, context);
    },
});
let SwitcherController;
try {
    ({SwitcherController} = await import('../switcherController.js'));
} finally {
    hooks.deregister();
}
const {wm, layoutManager, uiGroup} = await import(moduleURL('resource:///org/gnome/shell/ui/main.js'));
const {sessions} = await import(moduleURL('./switcherSession.js'));

function window(name, parent = null, options = {}) {
    return {
        name, skip_taskbar: false, application: null, stack: 0, userTime: 0,
        get_user_time() {return this.userTime;},
        is_attached_dialog: () => parent !== null,
        get_transient_for: () => parent,
        ...options,
    };
}

function setup(t, tabs, currentTime = 1000) {
    sessions.length = 0;
    wm.registrations.length = 0;
    wm.stockCalls.length = 0;
    const previous = ['display', 'workspace_manager'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    const workspace = {};
    const tabCalls = [];
    const getCurrentTime = t.mock.fn(() => currentTime);
    globalThis.workspace_manager = {get_active_workspace: () => workspace};
    globalThis.display = {
        signals: new Map(), nextId: 1,
        connect: layoutManager.connect,
        disconnect: layoutManager.disconnect,
        emit: layoutManager.emit,
        get_current_time_roundtrip: getCurrentTime,
        get_tab_list(type, scope) {tabCalls.push([type, scope]); return tabs;},
        sort_windows_by_stacking: windows => [...windows].sort((a, b) => a.stack - b.stack),
    };
    const controller = new SwitcherController();
    t.after(() => {
        if (controller._settings !== null)
            controller.destroy();
        assert.equal(globalThis.display.signals.size, 0);
        for (const [key, descriptor] of previous) {
            if (descriptor)
                Object.defineProperty(globalThis, key, descriptor);
            else
                delete globalThis[key];
        }
        assert.equal(layoutManager.signals.size, 0);
        assert.equal(uiGroup.children.size, 0);
    });
    const invoke = (startingWindow = null, reversed = false) => {
        globalThis.display.focus_window = startingWindow;
        const name = reversed ? 'switch-applications-backward' : 'switch-applications';
        wm.handlers.get(name)(globalThis.display, null, {get_time: () => 1234}, {
            is_reversed: () => reversed, get_mask: () => 8,
        });
        return controller._session;
    };
    return {controller, invoke, workspace, tabCalls, getCurrentTime};
}

function exitView() {
    return {
        destroyCount: 0, completion: null,
        beginExit(callback) {this.completion = callback;},
        destroy() {
            this.destroyCount++;
            this.completion = null;
            uiGroup.children.delete(this);
        },
    };
}

test('null global binding window uses nested D2 -> D1 -> W focus and selects the next direct window', t => {
    const root = window('W');
    const d1 = window('D1', root, {skip_taskbar: true, stack: 1});
    const d2 = window('D2', d1, {skip_taskbar: true, stack: 2});
    const next = window('next');
    const {invoke} = setup(t, [d2, d1, next, root]);
    const session = invoke(d2);
    assert.equal(session.options.startingWindow, root);
    assert.deepEqual(session.options.targets.map(target => target.window), [root, next]);
    assert.equal(session.options.targets[session.selectedIndex].window, next);
    assert.deepEqual(session.options.targets[0].auxiliarySurfaces, [d1, d2]);
});

test('null global binding window skips the focused direct window', t => {
    const focused = window('focused');
    const next = window('next');
    const {invoke} = setup(t, [focused, next]);
    const session = invoke(focused);
    assert.equal(session.options.startingWindow, focused);
    assert.equal(session.options.targets[session.selectedIndex].window, next);
});

test('snapshot deduplicates ancestors and sorts dialog siblings by stacking, not MRU', t => {
    const root = window('W', null, {application: {name: 'app'}});
    const d1 = window('D1', root, {stack: 1});
    const d2 = window('D2', d1, {stack: 3});
    const sibling = window('sibling', root, {stack: 2});
    const next = window('next');
    const {invoke} = setup(t, [sibling, d2, next, d1, root, d2]);
    const {targets} = invoke().options;
    assert.deepEqual(targets.map(target => target.window), [root, next]);
    assert.equal(targets[0].application, root.application);
    assert.deepEqual(targets[0].auxiliarySurfaces, [d1, sibling, d2]);
    assert.equal(new Set([root, ...targets[0].auxiliarySurfaces]).size, 4);
});

test('an attached ancestor absent from the tab list remains in the root preview', t => {
    const root = window('W');
    const d1 = window('D1', root, {stack: 1});
    const d2 = window('D2', d1, {stack: 2});
    const {invoke} = setup(t, [d2, root]);
    assert.deepEqual(invoke().options.targets[0].auxiliarySurfaces, [d1, d2]);
});

test('skip_taskbar policy applies to the canonical root, not its attached dialogs', t => {
    const excluded = window('excluded', null, {skip_taskbar: true});
    const hiddenD1 = window('hiddenD1', excluded);
    const hiddenD2 = window('hiddenD2', hiddenD1);
    const root = window('included');
    const dialog = window('dialog', root, {skip_taskbar: true});
    const {invoke} = setup(t, [hiddenD2, hiddenD1, excluded, dialog, root]);
    const {targets} = invoke().options;
    assert.deepEqual(targets.map(target => target.window), [root]);
    assert.deepEqual(targets[0].auxiliarySurfaces, [dialog]);
});

test('null focus, workspace setting, and binding event values are preserved', t => {
    const {controller, invoke, workspace, tabCalls} = setup(t, [window('W')]);
    controller._settings.currentWorkspaceOnly = true;
    const session = invoke(null, true);
    assert.equal(session.options.startingWindow, null);
    assert.equal(session.options.direction, -1);
    assert.equal(session.options.modifierMask, 8);
    assert.equal(session.options.timestamp, 1234);
    assert.deepEqual(tabCalls, [[3, workspace]]);
});

test('workspace attention candidates stay included without taking recent slots or leading their app group', t => {
    const application = {name: 'app'};
    const urgent = window('old urgent elsewhere', null, {application, userTime: 1});
    const recent = [50, 40, 30, 20].map(userTime => window(`recent ${userTime}`, null, {userTime}));
    const newestInGroup = window('newest in app', null, {application, userTime: 10});
    // Mutter prepends off-workspace demands-attention windows to the scoped list.
    const {controller, invoke, workspace, tabCalls} = setup(t, [urgent, ...recent, newestInGroup]);
    controller._settings.currentWorkspaceOnly = true;
    const {targets} = invoke().options;
    assert.deepEqual(targets.filter(target => target.kind === 'direct-window').map(target => target.window), recent);
    assert.deepEqual(targets.find(target => target.kind === 'app-group').windows.map(record => record.window), [newestInGroup, urgent]);
    assert.deepEqual(targets.filter(target => target.kind === 'grouped-window').map(target => target.window), [newestInGroup, urgent]);
    assert.deepEqual(tabCalls, [[3, workspace]]);
});

test('workspace MRU ranks roots by their newest candidate dialog before normalization', t => {
    const root = window('old root', null, {userTime: 1});
    const d1 = window('D1', root, {skip_taskbar: true, userTime: 2, stack: 1});
    const d2 = window('recent D2', d1, {skip_taskbar: true, userTime: 50, stack: 2});
    const urgent = window('old urgent elsewhere', null, {userTime: 3});
    const next = window('next', null, {userTime: 40});
    const {controller, invoke} = setup(t, [urgent, d2, next, d1, root]);
    controller._settings.currentWorkspaceOnly = true;
    const session = invoke(d2);
    assert.deepEqual(session.options.targets.map(target => target.window), [root, next, urgent]);
    assert.deepEqual(session.options.targets[0].auxiliarySurfaces, [d1, d2]);
    assert.equal(session.options.targets[session.selectedIndex].window, next);
});

for (const currentWorkspaceOnly of [false, true]) {
    for (const currentTime of [3000000000, 1000]) {
        test(`30-day timestamp distance preserves MRU at time ${currentTime} with workspace scope ${currentWorkspaceOnly}`, t => {
            const application = {name: 'app'};
            const urgent = window('30-day-old urgent elsewhere', null, {
                application, userTime: (currentTime - 30 * 24 * 60 * 60 * 1000) >>> 0,
            });
            const newestInGroup = window('newest in app', null, {application, userTime: (currentTime - 500) >>> 0});
            const recent = [0, 100, 200, 300].map(age => window(`recent ${age}`, null, {userTime: (currentTime - age) >>> 0}));
            const {controller, invoke, getCurrentTime} = setup(t, [urgent, ...recent, newestInGroup], currentTime);
            controller._settings.currentWorkspaceOnly = currentWorkspaceOnly;
            const session = invoke(recent[0]);
            const {targets} = session.options;
            assert.deepEqual(targets.filter(target => target.kind === 'direct-window').map(target => target.window), recent);
            assert.deepEqual(targets.find(target => target.kind === 'app-group').windows.map(record => record.window), [newestInGroup, urgent]);
            assert.equal(targets[session.selectedIndex].window, recent[1]);
            assert.equal(getCurrentTime.mock.callCount(), 1);
        });
    }

    test(`timestamp rollover preserves recent slots and group MRU with workspace scope ${currentWorkspaceOnly}`, t => {
        const application = {name: 'app'};
        const older = window('before rollover', null, {application, userTime: 0xffffff00});
        const newestInGroup = window('after rollover', null, {application, userTime: 100});
        const recent = [500, 400, 300, 200].map(userTime => window(`recent ${userTime}`, null, {userTime}));
        const {controller, invoke} = setup(t, [older, ...recent, newestInGroup]);
        controller._settings.currentWorkspaceOnly = currentWorkspaceOnly;
        const session = invoke(recent[0]);
        const {targets} = session.options;
        assert.deepEqual(targets.filter(target => target.kind === 'direct-window').map(target => target.window), recent);
        assert.deepEqual(targets.find(target => target.kind === 'app-group').windows.map(record => record.window), [newestInGroup, older]);
        assert.equal(targets[session.selectedIndex].window, recent[1]);
    });
}

test('zero user times remain last and equal timestamps preserve tab order across rollover', t => {
    const unknown = window('unknown');
    const alsoUnknown = window('also unknown');
    const older = window('before rollover', null, {userTime: 0xffffff00});
    const recent = window('recent', null, {userTime: 100});
    const equallyRecent = window('equally recent', null, {userTime: 100});
    const {invoke} = setup(t, [unknown, older, recent, equallyRecent, alsoUnknown]);
    assert.deepEqual(invoke().options.targets.map(target => target.window), [recent, equallyRecent, older, unknown, alsoUnknown]);
});

test('repeated registered bindings advance the existing session without a new snapshot', t => {
    const root = window('W');
    const {invoke, tabCalls} = setup(t, [root, window('next')]);
    const session = invoke(root);
    assert.equal(invoke(root), session);
    assert.equal(invoke(root, true), session);
    assert.deepEqual(session.advances, [1, -1]);
    assert.equal(session.startCount, 1);
    assert.equal(sessions.length, 1);
    assert.deepEqual(tabCalls, [[3, null]]);
});

test('rapid reopen destroys the old exit view before starting a fresh session', t => {
    const {controller, invoke} = setup(t, [window('W')]);
    const first = invoke();
    const view = exitView();
    first.finish(view);
    assert.equal(controller._session, null);
    assert.equal(controller._exitView, view);
    assert.ok(uiGroup.children.has(view));
    const second = invoke();
    assert.notEqual(second, first);
    assert.equal(view.destroyCount, 1);
    assert.equal(view.completion, null);
    assert.equal(controller._exitView, null);
    assert.equal(second.startCount, 1);
});

for (const phase of ['active', 'exit']) {
    test(`system modal synchronously clears ${phase} presentation and cancels exit completion`, t => {
        const {controller, invoke} = setup(t, [window('W')]);
        const session = invoke();
        const view = exitView();
        if (phase === 'exit')
            session.finish(view);
        layoutManager.emit('system-modal-opened');
        assert.equal(controller._session, null);
        assert.equal(controller._exitView, null);
        assert.equal(phase === 'active' ? session.destroyCount : view.destroyCount, 1);
        assert.equal(view.completion, null);
        layoutManager.emit('system-modal-opened');
        assert.equal(phase === 'active' ? session.destroyCount : view.destroyCount, 1);
        assert.notEqual(invoke(), session);
        controller.destroy();
        assert.equal(layoutManager.signals.size, 0);
    });

    test(`monitor topology change synchronously clears ${phase} ownership and allows reopening`, t => {
        const {controller, invoke} = setup(t, [window('W')]);
        const first = invoke();
        const view = exitView();
        if (phase === 'exit')
            first.finish(view);
        layoutManager.emit('monitors-changed');
        assert.equal(controller._session, null);
        assert.equal(controller._exitView, null);
        assert.equal(phase === 'active' ? first.destroyCount : view.destroyCount, 1);
        layoutManager.emit('monitors-changed');
        assert.equal(phase === 'active' ? first.destroyCount : view.destroyCount, 1);
        assert.notEqual(invoke(), first);
    });

    test(`controller destruction clears ${phase}, disconnects signals, and restores both stock bindings`, t => {
        const {controller, invoke} = setup(t, [window('W')]);
        const session = invoke();
        const view = exitView();
        if (phase === 'exit')
            session.finish(view);
        assert.equal(layoutManager.signals.size, 2);
        assert.deepEqual([...globalThis.display.signals.values()].map(signal => signal.name), ['workareas-changed']);
        controller.destroy();
        assert.equal(controller._session, null);
        assert.equal(controller._exitView, null);
        assert.equal(phase === 'active' ? session.destroyCount : view.destroyCount, 1);
        assert.equal(layoutManager.signals.size, 0);
        assert.equal(globalThis.display.signals.size, 0);
        assert.equal(controller._workareasChangedId, 0);
        const clearPresentation = t.mock.method(controller, '_clearPresentation');
        globalThis.display.emit('workareas-changed');
        layoutManager.emit('monitors-changed');
        layoutManager.emit('system-modal-opened');
        assert.equal(clearPresentation.mock.callCount(), 0);
        for (const name of ['switch-applications', 'switch-applications-backward'])
            wm.handlers.get(name)('display', 'window', 'event', name);
        assert.deepEqual(wm.stockCalls, [
            ['display', 'window', 'event', 'switch-applications'],
            ['display', 'window', 'event', 'switch-applications-backward'],
        ]);
        assert.deepEqual(wm.registrations.map(([name, mode]) => [name, mode]), [
            ['switch-applications', 1], ['switch-applications-backward', 1],
            ['switch-applications', 1], ['switch-applications-backward', 1],
        ]);
    });

    test(`workarea-only change synchronously clears ${phase} presentation and allows reopening`, t => {
        const {controller, invoke, tabCalls} = setup(t, [window('W')]);
        const first = invoke();
        const view = exitView();
        if (phase === 'exit')
            first.finish(view);
        globalThis.display.emit('workareas-changed');
        assert.equal(controller._session, null);
        assert.equal(controller._exitView, null);
        assert.equal(phase === 'active' ? first.destroyCount : view.destroyCount, 1);
        assert.equal(view.completion, null);
        assert.equal(uiGroup.children.size, 0);
        globalThis.display.emit('workareas-changed');
        layoutManager.emit('monitors-changed');
        assert.equal(phase === 'active' ? first.destroyCount : view.destroyCount, 1);
        assert.notEqual(invoke(), first);
        assert.equal(tabCalls.length, 2);
    });
}

test('normal exit completion releases and destroys the detached view', t => {
    const {controller, invoke} = setup(t, [window('W')]);
    const view = exitView();
    invoke().finish(view);
    view.completion();
    assert.equal(controller._exitView, null);
    assert.equal(view.destroyCount, 1);
});

test('empty tab list does not construct a session', t => {
    const {invoke} = setup(t, []);
    assert.equal(invoke(), null);
    assert.equal(sessions.length, 0);
});
