// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const CloneOnlyEffect = GObject.registerClass(
class CloneOnlyEffect extends Clutter.Effect {
    vfunc_paint_node(node, context, flags) {
        // Mutter 51 marks the source while a Clutter.Clone paints it.
        if (this.get_actor().is_in_clone_paint())
            super.vfunc_paint_node(node, context, flags);
    }
});

export class SwitcherPresentation {
    constructor(createClipEffect, sourceDestroyed) {
        this._entries = new Map();
        this._createClipEffect = createClipEffect;
        this._sourceDestroyed = sourceDestroyed;
    }

    acquire(surface, baseWidth, baseHeight) {
        const retained = this._entries.get(surface);
        if (retained !== undefined)
            return retained;
        const source = surface.get_compositor_private();
        if (source === null)
            return null;
        const preview = new Clutter.Actor({clip_to_allocation: true, layout_manager: new Clutter.BinLayout()});
        preview.add_child(new Clutter.Clone({source, x_expand: true, y_expand: true}));
        preview.add_effect(this._createClipEffect());
        preview.set_size(baseWidth, baseHeight);
        const effect = new CloneOnlyEffect();
        source.add_effect(effect);
        const entry = {clone: preview, source, surface, effect, baseWidth, baseHeight, signal: 0, exitComplete: null};
        entry.signal = source.connect('destroy', () => {
            this._sourceDestroyed(source, entry);
            this._entries.delete(surface);
            entry.source = null;
            entry.signal = 0;
            entry.effect = null;
            entry.clone.destroy();
            entry.clone = null;
            if (entry.exitComplete !== null)
                entry.exitComplete();
        });
        this._entries.set(surface, entry);
        return entry;
    }

    retain(surfaces) {
        for (const [surface, entry] of this._entries) {
            if (!surfaces.has(surface)) {
                this._release(entry);
                this._entries.delete(surface);
            }
        }
    }

    _release(entry) {
        entry.source.disconnect(entry.signal);
        entry.signal = 0;
        entry.source.remove_effect(entry.effect);
        entry.source = null;
        entry.effect = null;
        entry.clone.remove_all_transitions();
        entry.clone.destroy();
        entry.clone = null;
        entry.exitComplete = null;
    }

    destroy() {
        for (const entry of this._entries.values())
            this._release(entry);
        this._entries.clear();
        this._createClipEffect = null;
        this._sourceDestroyed = null;
    }
}
