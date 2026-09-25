// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

const TestClipEffect = GObject.registerClass(class TestClipEffect extends Clutter.Effect {});

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

async function pixel(x, y) {
    const screenshot = new Shell.Screenshot();
    const result = await new Promise(resolve => screenshot.pick_color(Math.round(x), Math.round(y), (_object, result) => resolve(result)));
    const [ok, color] = screenshot.pick_color_finish(result);
    assert(ok, 'Read stage pixels');
    return color;
}

export async function testPresentation(extension, window) {
    const {SwitcherPresentation} = await import(extension.dir.get_child('switcherPresentation.js').get_uri());
    Main.activateWindow(window);
    await Scripting.sleep(300);
    const source = window.get_compositor_private();
    const original = {visible: source.visible, opacity: source.opacity, x: source.x, y: source.y};
    const marker = new St.Widget({width: 100, height: 100,
        background_color: new Cogl.Color({red: 211, green: 37, blue: 173, alpha: 255})});
    source.add_child(marker);
    const owner = new SwitcherPresentation(() => new TestClipEffect(), () => {});
    try {
        const [x, y] = source.get_transformed_position();
        await Scripting.sleep(100);
        const before = await pixel(x + 30, y + 30);
        assert(before.red === 211 && before.green === 37, 'Fixture marker is visible on the desktop before suppression');
        const entry = owner.acquire(window, source.width, source.height);
        entry.clone.set_position(20, 60);
        Main.uiGroup.add_child(entry.clone);
        await Scripting.sleep(200);
        const desktop = await pixel(x + 30, y + 30);
        const preview = await pixel(50, 90);
        assert(!(desktop.red === 211 && desktop.green === 37), 'No desktop copy remains behind the preview');
        assert(preview.red === 211 && preview.green === 37, 'Clone paints the suppressed source');
        marker.background_color = new Cogl.Color({red: 0, green: 255, blue: 0, alpha: 255});
        await Scripting.sleep(200);
        const live = await pixel(50, 90);
        assert(live.green > 240 && live.red < 10, 'Suppressed source content remains live');
        owner.retain(new Set([window]));
        assert(owner.acquire(window, 200, 150) === entry, 'Reconciliation reuses the existing presentation');
        for (const [property, value] of Object.entries(original))
            assert(source[property] === value, `Source ${property} remains Shell-owned`);
        owner.retain(new Set());
        await Scripting.sleep(200);
        const restored = await pixel(x + 30, y + 30);
        assert(restored.green > 240 && restored.red < 10, 'Releasing presentation restores desktop pixels');
        window.minimize();
        await Scripting.sleep(300);
        const minimized = owner.acquire(window, source.width, source.height);
        minimized.clone.set_position(20, 60);
        Main.uiGroup.add_child(minimized.clone);
        await Scripting.sleep(200);
        const hiddenPreview = await pixel(50, 90);
        assert(hiddenPreview.green > 240 && hiddenPreview.red < 10, 'Minimized source still paints through its clone');
        owner.retain(new Set());
        assert(window.minimized, 'Releasing a minimized preview does not unminimize its window');
        Main.activateWindow(window);
        await Scripting.sleep(300);

        const closingSource = new St.Widget({width: 100, height: 100});
        Main.uiGroup.add_child(closingSource);
        const closingSurface = {get_compositor_private: () => closingSource};
        const closing = owner.acquire(closingSurface, 100, 100);
        Main.uiGroup.add_child(closing.clone);
        closingSource.destroy();
        assert(closing.source === null && closing.clone === null, 'Source destruction releases the presentation');
        console.log('PASS: actual presentation owner suppresses desktop pixels, keeps clone content live, reuses previews and restores source without changing Shell properties');
        console.log('PASS: minimized source pixels remain available without unminimizing, and destroyed sources release their previews');
    } finally {
        owner.destroy();
        marker.destroy();
    }
}
