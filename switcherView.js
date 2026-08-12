// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

const PREVIEW_RATIO = 16 / 10;
const GAP = 16;
const MARGIN = 48;
const ICON_SIZE = 32;
const ANIMATION_TIME = 180;

function targetName(target) {
    if (target.kind === 'app-group')
        return target.application.get_name();
    return target.window.get_title();
}

function sourceGeometry(actor) {
    const [x, y] = actor.get_transformed_position();
    const [width, height] = actor.get_transformed_size();
    return {x, y, width, height};
}

function calculateLayout(targets, width, height) {
    const directCount = targets.filter(target => target.kind === 'direct-window').length;
    const groups = targets.filter(target => target.kind === 'app-group');
    const maxGroupWindows = Math.max(1, ...groups.map(group => group.windows.length));
    const availableWidth = Math.max(1, width - MARGIN * 2);
    const availableHeight = Math.max(1, height - MARGIN * 2);
    const directWidth = directCount === 0 ? availableWidth : (availableWidth - GAP * Math.max(0, directCount - 1)) / directCount;
    const groupWidth = groups.length === 0 ? availableWidth : (availableWidth - GAP * Math.max(0, groups.length - 1)) / groups.length;
    const previewWidth = Math.max(1, Math.min(
        directWidth,
        groupWidth / maxGroupWindows,
        Math.max(1, (availableHeight - GAP - 112) / 2) * PREVIEW_RATIO));
    const previewHeight = previewWidth / PREVIEW_RATIO;

    return {previewWidth, previewHeight};
}

export const SwitcherView = GObject.registerClass(
class SwitcherView extends St.Widget {
    _init(targets, activateTarget) {
        super._init({
            style_class: 'window-switching-redux',
            accessible_role: Atk.Role.MENU,
            reactive: false,
        });
        this._targets = targets;
        this._activateTarget = activateTarget;
        this._targetActors = [];
        this._cloneEntries = [];
        this._selectedIndex = -1;
        this.set_size(global.stage.width, global.stage.height);
        this._build();
    }

    _createIcon(application) {
        if (application !== null)
            return application.create_icon_texture(ICON_SIZE);
        return new St.Icon({icon_name: 'application-x-executable', icon_size: ICON_SIZE});
    }

    _createPreview(record, width, height) {
        const preview = new St.Widget({
            style_class: 'switcher-preview',
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
        });
        preview.set_size(width, height);
        const actor = record.window.get_compositor_private();

        if (actor === null) {
            preview.add_style_class_name('switcher-preview-unavailable');
            preview.add_child(this._createIcon(record.application));
            return preview;
        }

        const surfaces = [record.window, ...record.auxiliarySurfaces];
        const parentGeometry = sourceGeometry(actor);
        for (const surface of surfaces) {
            const source = surface.get_compositor_private();
            if (source === null)
                continue;
            const clone = new Clutter.Clone({source});
            preview.add_child(clone);
            const geometry = sourceGeometry(source);
            const scale = Math.min(
                preview.width / parentGeometry.width,
                preview.height / parentGeometry.height);
            clone.set_position(
                (geometry.x - parentGeometry.x) * scale,
                (geometry.y - parentGeometry.y) * scale);
            clone.set_size(geometry.width * scale, geometry.height * scale);
            const entry = {clone, source, signal: 0, geometry};
            entry.signal = source.connect('destroy', () => {
                clone.source = null;
                preview.add_style_class_name('switcher-preview-unavailable');
                entry.source = null;
                entry.signal = 0;
            });
            this._cloneEntries.push(entry);
        }

        return preview;
    }

    _createTargetActor(target, index, width, height) {
        const actor = new St.Widget({
            style_class: 'switcher-target',
            reactive: true,
            track_hover: false,
            accessible_role: Atk.Role.MENU_ITEM,
            accessible_name: targetName(target),
        });
        actor.set_size(width, height + 32);
        if (target.kind !== 'app-group') {
            const preview = this._createPreview(target, width, height);
            actor.add_child(preview);
        }

        const label = new St.Label({
            text: targetName(target),
            style_class: target.kind === 'app-group' ? 'switcher-app-name' : 'switcher-window-title',
            visible: false,
        });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        if (target.kind === 'app-group') {
            label.set_width(Math.max(1, width - 56));
            label.set_position(48, 8);
        } else {
            label.set_width(width);
            label.set_position(0, height + 6);
        }
        actor.add_child(label);
        actor.label_actor = label;
        actor._selectionLabel = label;

        if (target.kind === 'app-group') {
            const icon = this._createIcon(target.application);
            icon.add_style_class_name('switcher-app-icon');
            icon.set_position(8, 8);
            icon.reactive = true;
            icon.connect('button-release-event', (_actor, event) => {
                if (event.get_button() === Clutter.BUTTON_PRIMARY)
                    this._activateTarget(index, event.get_time());
                return Clutter.EVENT_STOP;
            });
            icon.connect('touch-event', (_actor, event) => {
                if (event.type() === Clutter.EventType.TOUCH_END)
                    this._activateTarget(index, event.get_time());
                return Clutter.EVENT_STOP;
            });
            actor.add_child(icon);
        }

        actor.connect('button-release-event', (_actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY)
                this._activateTarget(index, event.get_time());
            return Clutter.EVENT_STOP;
        });
        actor.connect('touch-event', (_actor, event) => {
            if (event.type() === Clutter.EventType.TOUCH_END)
                this._activateTarget(index, event.get_time());
            return Clutter.EVENT_STOP;
        });
        return actor;
    }

    _build() {
        const {previewWidth, previewHeight} = calculateLayout(
            this._targets, global.stage.width, global.stage.height);
        const directTargets = this._targets
            .map((target, index) => ({target, index}))
            .filter(({target}) => target.kind === 'direct-window');
        const groups = this._targets
            .map((target, index) => ({target, index}))
            .filter(({target}) => target.kind === 'app-group');

        const directTotal = directTargets.length * previewWidth + Math.max(0, directTargets.length - 1) * GAP;
        let x = (global.stage.width - directTotal) / 2;
        const directY = Math.max(MARGIN, global.stage.height / 2 - previewHeight - GAP);
        for (const {target, index} of directTargets) {
            const actor = this._createTargetActor(target, index, previewWidth, previewHeight);
            actor.set_position(x, directY);
            this.add_child(actor);
            this._targetActors[index] = actor;
            x += previewWidth + GAP;
        }

        const groupUnitWidth = previewWidth * Math.max(1, ...groups.map(({target}) => target.windows.length));
        const groupsTotal = groups.length * groupUnitWidth + Math.max(0, groups.length - 1) * GAP;
        x = (global.stage.width - groupsTotal) / 2;
        const groupY = global.stage.height / 2 + GAP;
        for (const {target, index} of groups) {
            const groupActor = this._createTargetActor(target, index, groupUnitWidth, previewHeight);
            groupActor.set_height(previewHeight + 80);
            groupActor.set_position(x, groupY);
            this.add_child(groupActor);
            this._targetActors[index] = groupActor;

            const groupedTargets = this._targets
                .map((candidate, candidateIndex) => ({candidate, candidateIndex}))
                .filter(({candidate}) => candidate.kind === 'grouped-window' && candidate.application === target.application);
            groupedTargets.forEach(({candidate, candidateIndex}, childIndex) => {
                const child = this._createTargetActor(candidate, candidateIndex, previewWidth, previewHeight);
                child.set_position(childIndex * previewWidth, 48);
                groupActor.add_child(child);
                this._targetActors[candidateIndex] = child;
            });
            x += groupUnitWidth + GAP;
        }
    }

    setTargets(targets) {
        this._clearActors();
        this._targets = targets;
        this._targetActors = [];
        this._build();
    }

    setSelection(index) {
        if (this._selectedIndex >= 0) {
            const previous = this._targetActors[this._selectedIndex];
            if (previous !== undefined) {
                previous.remove_style_pseudo_class('selected');
                previous._selectionLabel.visible = false;
                previous.remove_accessible_state(Atk.StateType.SELECTED);
            }
        }

        this._selectedIndex = index;
        const selected = this._targetActors[index];
        selected.add_style_pseudo_class('selected');
        selected._selectionLabel.visible = true;
        selected.add_accessible_state(Atk.StateType.SELECTED);
    }

    beginExit(onComplete) {
        for (const actor of this._targetActors) {
            if (actor !== undefined)
                actor.reactive = false;
        }
        const entries = this._cloneEntries.filter(({geometry}) => geometry !== null);
        if (entries.length === 0) {
            onComplete();
            return;
        }

        const overlay = new Clutter.Actor();
        overlay.set_size(global.stage.width, global.stage.height);
        this.add_child(overlay);
        let pending = entries.length;
        for (const {clone, geometry} of entries) {
            const [currentX, currentY] = clone.get_transformed_position();
            const [currentWidth, currentHeight] = clone.get_transformed_size();
            const parent = clone.get_parent();
            parent.remove_child(clone);
            overlay.add_child(clone);
            clone.set_position(currentX, currentY);
            clone.set_size(currentWidth, currentHeight);
            clone.ease({
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height,
                duration: ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    pending--;
                    if (pending === 0)
                        onComplete();
                },
            });
        }

    }

    _clearActors() {
        for (const {clone, source, signal} of this._cloneEntries) {
            clone.remove_all_transitions();
            if (signal !== 0)
                source.disconnect(signal);
        }
        this._cloneEntries = [];
        this.destroy_all_children();
    }

    destroy() {
        this._clearActors();
        this._targets = Object.freeze([]);
        this._targetActors = [];
        this._activateTarget = null;
        super.destroy();
    }
});
