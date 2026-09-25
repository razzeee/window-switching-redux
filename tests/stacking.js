// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

function assertDesktopStack(view, windows, phase) {
    const children = view.get_children();
    const previews = new Map(windows.map(window => [window, children.find(actor =>
        actor.get_children().some(child => child instanceof Clutter.Clone &&
            child.get_source() === window.get_compositor_private()))]));
    const expected = global.display.sort_windows_by_stacking(windows);
    const actual = [...windows].sort((a, b) => children.indexOf(previews.get(a)) - children.indexOf(previews.get(b)));
    if (windows.some(window => previews.get(window) === undefined))
        throw new Error(`${phase}: missing live preview`);
    if (actual.some((window, index) => window !== expected[index]))
        throw new Error(`${phase}: previews put a background window above the desktop's foreground window`);
}

export async function testDesktopStacking(extension, records) {
    const {SwitcherView} = await import(extension.dir.get_child('switcherView.js').get_uri());
    const {buildTraversal} = await import(extension.dir.get_child('windowModel.js').get_uri());
    const pair = records.slice(0, 2);
    const windows = pair.map(record => record.window);
    const frames = windows.map(window => window.get_frame_rect());
    let view = null;
    try {
        for (const window of windows)
            window.move_frame(false, 240, 140);
        Main.activateWindow(windows[0]);
        await Scripting.sleep(300);
        const targets = buildTraversal(pair, 4);
        view = new SwitcherView(targets, windows[0], () => {}, () => {}, () => {}, () => {}, () => {});
        Main.uiGroup.add_child(view);
        view.build();
        assertDesktopStack(view, windows, 'Entrance');
        await Scripting.sleep(300);
        Main.activateWindow(windows[1]);
        view.setExitTarget(1);
        let finished = false;
        view.beginExit(() => { finished = true; });
        assertDesktopStack(view, windows, 'Confirmation');
        // Activation and workspace changes can restack actors after exit has begun.
        Main.activateWindow(windows[0]);
        await Scripting.sleep(40);
        assertDesktopStack(view, windows, 'Restack during exit');
        await Scripting.sleep(250);
        if (!finished)
            throw new Error('Desktop-ordered exit did not finish');
        view.destroy();
        view = null;

        view = new SwitcherView(targets, windows[0], () => {}, () => {}, () => {}, () => {}, () => {});
        Main.uiGroup.add_child(view);
        view.build();
        // Reproduce an exit that interrupts entrance, as with a quick Alt+Tab.
        Main.activateWindow(windows[1]);
        view.setExitTarget(1);
        view.beginExit(() => {});
        assertDesktopStack(view, windows, 'Quick confirmation');
        await Scripting.sleep(300);
        assertDesktopStack(view, windows, 'Quick confirmation completion');
        console.log('PASS: desktop preview stacking matches real compositor stacking on entrance, confirmation, quick switching and a restack during exit');
    } finally {
        if (view !== null)
            view.destroy();
        windows.forEach((window, index) => window.move_frame(false, frames[index].x, frames[index].y));
        Main.activateWindow(windows[0]);
        await Scripting.sleep(300);
    }
}
