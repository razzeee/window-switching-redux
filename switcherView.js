// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const GAP = 24;
const MARGIN = 48;
const LABEL_HEIGHT = 32;
const ICON_SIZE = 64;
const GROUP_OVERLAP = 0.15;
const MAX_PREVIEW_SCALE = 0.7;
const ENTRANCE_TIME = 220;
const EXIT_TIME = 180;

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

function recordBounds(record) {
    const actors = [record.window, ...record.auxiliarySurfaces]
        .map(surface => surface.get_compositor_private())
        .filter(actor => actor !== null);
    if (actors.length === 0)
        return {x: 0, y: 0, width: 960, height: 600};

    const geometries = actors.map(sourceGeometry);
    const left = Math.min(...geometries.map(geometry => geometry.x));
    const top = Math.min(...geometries.map(geometry => geometry.y));
    const right = Math.max(...geometries.map(geometry => geometry.x + geometry.width));
    const bottom = Math.max(...geometries.map(geometry => geometry.y + geometry.height));
    return {
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    };
}

function workArea() {
    const areas = Main.layoutManager.monitors.map((_, index) =>
        Main.layoutManager.getWorkAreaForMonitor(index));
    const left = Math.min(...areas.map(area => area.x));
    const top = Math.min(...areas.map(area => area.y));
    const right = Math.max(...areas.map(area => area.x + area.width));
    const bottom = Math.max(...areas.map(area => area.y + area.height));

    return {
        x: left + MARGIN,
        y: top + MARGIN,
        width: Math.max(1, right - left - MARGIN * 2),
        height: Math.max(1, bottom - top - MARGIN * 2),
    };
}

function directRows(directTargets) {
    if (directTargets.length <= 2)
        return [directTargets];
    return [directTargets.slice(0, 2), directTargets.slice(2)];
}

function rowSize(row, sizes) {
    return {
        width: row.reduce((sum, {index}) => sum + sizes.get(index).width, 0) +
            Math.max(0, row.length - 1) * GAP,
        height: Math.max(0, ...row.map(({index}) => sizes.get(index).height)),
    };
}

function groupSize(group, sizes) {
    let width = 0;
    let previousWidth = 0;
    let height = 0;
    for (const {index} of group.children) {
        const size = sizes.get(index);
        if (width > 0)
            width -= previousWidth * GROUP_OVERLAP;
        width += size.width;
        previousWidth = size.width;
        height = Math.max(height, size.height);
    }

    return {width, height: height + GAP + ICON_SIZE};
}

function calculateLayout(targets) {
    const area = workArea();
    const sizes = new Map();
    const directTargets = [];
    const groups = [];

    targets.forEach((target, index) => {
        if (target.kind === 'direct-window') {
            sizes.set(index, recordBounds(target));
            directTargets.push({target, index});
        } else if (target.kind === 'app-group') {
            groups.push({target, index, children: []});
        }
    });
    targets.forEach((target, index) => {
        if (target.kind !== 'grouped-window')
            return;
        sizes.set(index, recordBounds(target));
        groups.find(group => group.target.application === target.application)
            .children.push({target, index});
    });

    const rows = directRows(directTargets);
    const rowSizes = rows.map(row => rowSize(row, sizes));
    const groupSizes = groups.map(group => groupSize(group, sizes));
    const hasGroups = groups.length > 0;
    const regionGap = directTargets.length > 0 && hasGroups ? GAP * 2 : 0;
    const directNaturalWidth = Math.max(0, ...rowSizes.map(size => size.width));
    const directNaturalHeight = rowSizes.reduce((sum, size) => sum + size.height, 0) +
        Math.max(0, rows.length - 1) * GAP;
    const groupsNaturalWidth = groupSizes.reduce((sum, size) => sum + size.width, 0) +
        Math.max(0, groups.length - 1) * GAP;
    const groupsNaturalHeight = Math.max(0, ...groupSizes.map(size => size.height));
    const naturalHeight = directNaturalHeight + groupsNaturalHeight + regionGap;
    const naturalWidth = Math.max(directNaturalWidth, groupsNaturalWidth);
    const rowLabelClearance = Math.max(0, rows.length - 1) * LABEL_HEIGHT;
    const groupLabelClearance = hasGroups ? LABEL_HEIGHT : 0;
    const scale = Math.min(
        MAX_PREVIEW_SCALE,
        area.width / Math.max(1, naturalWidth),
        (area.height - LABEL_HEIGHT - rowLabelClearance - groupLabelClearance) /
            Math.max(1, naturalHeight));
    const scaledGap = GAP * scale;
    const directHeight = directNaturalHeight * scale;
    const groupsHeight = groupsNaturalHeight * scale;
    const contentHeight = directHeight + groupsHeight + (regionGap * scale) +
        rowLabelClearance + groupLabelClearance;
    let y = area.y + (area.height - LABEL_HEIGHT - contentHeight) / 2;
    const geometries = new Map();

    rows.forEach((row, rowIndex) => {
        const rowWidth = rowSizes[rowIndex].width * scale;
        const rowHeight = rowSizes[rowIndex].height * scale;
        let x = area.x + (area.width - rowWidth) / 2;
        for (const {index} of row) {
            const size = sizes.get(index);
            const width = size.width * scale;
            const height = size.height * scale;
            geometries.set(index, {x, y: y + (rowHeight - height) / 2, width, height});
            x += width + scaledGap;
        }
        y += rowHeight + scaledGap;
        if (rowIndex < rows.length - 1)
            y += LABEL_HEIGHT;
    });

    if (directTargets.length > 0 && hasGroups)
        y += scaledGap;
    const groupsWidth = groupsNaturalWidth * scale;
    let groupX = area.x + (area.width - groupsWidth) / 2;
    groups.forEach((group, groupIndex) => {
        const size = groupSizes[groupIndex];
        const width = size.width * scale;
        const height = (size.height - GAP - ICON_SIZE) * scale;
        let childX = groupX;
        let previousWidth = 0;
        for (const {index} of group.children) {
            const childSize = sizes.get(index);
            const childWidth = childSize.width * scale;
            const childHeight = childSize.height * scale;
            if (previousWidth > 0)
                childX -= previousWidth * GROUP_OVERLAP;
            geometries.set(index, {
                x: childX,
                y: y + (height - childHeight) / 2,
                width: childWidth,
                height: childHeight,
            });
            childX += childWidth;
            previousWidth = childWidth;
        }
        geometries.set(group.index, {
            x: groupX,
            y,
            width,
            height: size.height * scale + groupLabelClearance,
            iconSize: ICON_SIZE * scale,
        });
        groupX += width + scaledGap;
    });

    return {geometries, groups};
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
        this._chromeActors = [];
        this._selectedIndex = -1;
        this.set_size(global.stage.width, global.stage.height);
        this._build();
    }

    _createIcon(application, size) {
        if (application !== null)
            return application.create_icon_texture(size);
        return new St.Icon({icon_name: 'application-x-executable', icon_size: size});
    }

    _connectActivation(actor, index) {
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
    }

    _createWindowTarget(target, index, geometry) {
        const actor = new St.Widget({
            style_class: 'switcher-target',
            reactive: true,
            track_hover: false,
            accessible_role: Atk.Role.MENU_ITEM,
            accessible_name: targetName(target),
        });
        actor.set_position(geometry.x, geometry.y);
        actor.set_size(geometry.width, geometry.height);
        actor._previewActors = [];
        this._connectActivation(actor, index);

        const label = new St.Label({
            text: targetName(target),
            style_class: 'switcher-window-title',
            visible: false,
        });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        label.set_width(geometry.width);
        label.set_position(0, geometry.height + 8);
        actor.add_child(label);
        actor.label_actor = label;
        actor._selectionLabel = label;
        actor._selectionActor = actor;
        this._chromeActors.push(actor);
        this.add_child(actor);
        this._targetActors[index] = actor;
    }

    _createGroupTarget(target, index, geometry) {
        const actor = new St.Widget({
            style_class: 'switcher-group-target',
            reactive: true,
            track_hover: false,
            accessible_role: Atk.Role.MENU_ITEM,
            accessible_name: targetName(target),
        });
        actor.set_position(geometry.x, geometry.y);
        actor.set_size(geometry.width, geometry.height);
        this._connectActivation(actor, index);

        const iconBin = new St.Bin({style_class: 'switcher-app-icon'});
        const iconSize = Math.max(1, geometry.iconSize);
        iconBin.set_child(this._createIcon(target.application, iconSize));
        iconBin.set_size(iconSize, iconSize);
        iconBin.set_position((geometry.width - iconSize) / 2, geometry.height - iconSize);
        actor.add_child(iconBin);

        const label = new St.Label({
            text: targetName(target),
            style_class: 'switcher-app-name',
            visible: false,
        });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        label.set_width(Math.max(1, geometry.width));
        label.set_position(0, geometry.height + 8);
        actor.add_child(label);
        actor.label_actor = label;
        actor._selectionLabel = label;
        actor._selectionActor = iconBin;
        this._chromeActors.push(actor);
        this.add_child(actor);
        this._targetActors[index] = actor;
    }

    _createClones(record, geometry, targetActor) {
        const parentActor = record.window.get_compositor_private();
        if (parentActor === null)
            return false;

        const bounds = recordBounds(record);
        const scale = Math.min(
            geometry.width / bounds.width,
            geometry.height / bounds.height);
        for (const surface of [record.window, ...record.auxiliarySurfaces]) {
            const source = surface.get_compositor_private();
            if (source === null)
                continue;
            const sourceRect = sourceGeometry(source);
            const destination = {
                x: geometry.x + (sourceRect.x - bounds.x) * scale,
                y: geometry.y + (sourceRect.y - bounds.y) * scale,
                width: sourceRect.width * scale,
                height: sourceRect.height * scale,
            };
            const clone = new Clutter.Clone({source});
            clone.set_position(sourceRect.x, sourceRect.y);
            clone.set_size(sourceRect.width, sourceRect.height);
            this.set_child_below_sibling(clone, targetActor);
            targetActor._previewActors.push(clone);
            const entry = {
                clone,
                source,
                signal: 0,
                destination,
                targetActor,
                exitComplete: null,
            };
            entry.signal = source.connect('destroy', () => {
                clone.destroy();
                entry.clone = null;
                entry.source = null;
                entry.signal = 0;
                if (surface === record.window)
                    targetActor.add_style_class_name('switcher-target-unavailable');
                if (entry.exitComplete !== null)
                    entry.exitComplete();
            });
            this._cloneEntries.push(entry);
        }
        return true;
    }

    _createUnavailableTarget(target, geometry, targetActor) {
        const icon = this._createIcon(target.application, Math.max(1, Math.min(ICON_SIZE, geometry.height)));
        const placeholder = new St.Bin({
            style_class: 'switcher-preview-unavailable',
            child: icon,
        });
        placeholder.set_position(geometry.x, geometry.y);
        placeholder.set_size(geometry.width, geometry.height);
        this.set_child_below_sibling(placeholder, targetActor);
        targetActor._previewActors.push(placeholder);
        this._chromeActors.push(placeholder);
    }

    _build() {
        const {geometries, groups} = calculateLayout(this._targets);
        for (const group of groups) {
            const geometry = geometries.get(group.index);
            this._createGroupTarget(group.target, group.index, geometry);
        }

        this._targets.forEach((target, index) => {
            if (target.kind === 'app-group')
                return;
            const geometry = geometries.get(index);
            this._createWindowTarget(target, index, geometry);
            const targetActor = this._targetActors[index];
            if (!this._createClones(target, geometry, targetActor))
                this._createUnavailableTarget(target, geometry, targetActor);
        });

        // Stack each complete preview unit so newer grouped windows cover older ones.
        for (const group of groups) {
            let sibling = this._targetActors[group.index];
            for (let i = group.children.length - 1; i >= 0; i--) {
                const targetActor = this._targetActors[group.children[i].index];
                for (const previewActor of targetActor._previewActors) {
                    this.set_child_above_sibling(previewActor, sibling);
                    sibling = previewActor;
                }
                this.set_child_above_sibling(targetActor, sibling);
                sibling = targetActor;
            }
        }
        this._beginEntrance();
    }

    _beginEntrance() {
        const animationsEnabled = St.Settings.get().enable_animations;
        for (const actor of this._chromeActors)
            actor.opacity = animationsEnabled ? 0 : 255;

        if (!animationsEnabled) {
            for (const {clone, destination} of this._cloneEntries) {
                clone.set_position(destination.x, destination.y);
                clone.set_size(destination.width, destination.height);
            }
            return;
        }

        for (const {clone, destination} of this._cloneEntries) {
            clone.ease({
                ...destination,
                duration: ENTRANCE_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
        for (const actor of this._chromeActors) {
            actor.ease({
                opacity: 255,
                delay: Math.floor(ENTRANCE_TIME * 2 / 3),
                duration: Math.ceil(ENTRANCE_TIME / 3),
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    setTargets(targets) {
        this._clearActors();
        this._targets = targets;
        this._targetActors = [];
        this._chromeActors = [];
        this._build();
    }

    setSelection(index) {
        if (this._selectedIndex >= 0) {
            const previous = this._targetActors[this._selectedIndex];
            if (previous !== undefined) {
                previous._selectionActor.remove_style_pseudo_class('selected');
                previous._selectionLabel.visible = false;
                previous.remove_accessible_state(Atk.StateType.SELECTED);
            }
        }

        this._selectedIndex = index;
        const selected = this._targetActors[index];
        selected._selectionActor.add_style_pseudo_class('selected');
        selected._selectionLabel.visible = true;
        selected.add_accessible_state(Atk.StateType.SELECTED);
    }

    beginExit(onComplete) {
        for (const actor of this._targetActors) {
            if (actor !== undefined)
                actor.reactive = false;
        }
        for (const actor of this._chromeActors) {
            actor.remove_all_transitions();
            actor.opacity = 0;
        }

        const entries = this._cloneEntries.filter(({clone, source}) =>
            clone !== null && source !== null);
        const exits = entries.map(entry => ({
            entry,
            sourceRect: sourceGeometry(entry.source),
        }));
        if (entries.length === 0 || !St.Settings.get().enable_animations) {
            for (const {entry, sourceRect} of exits) {
                entry.clone.set_position(sourceRect.x, sourceRect.y);
                entry.clone.set_size(sourceRect.width, sourceRect.height);
            }
            onComplete();
            return;
        }

        let pending = exits.length;
        for (const {entry, sourceRect} of exits) {
            const {clone} = entry;
            entry.exitComplete = () => {
                if (entry.exitComplete === null)
                    return;
                entry.exitComplete = null;
                pending--;
                if (pending === 0)
                    onComplete();
            };
            clone.remove_all_transitions();
            clone.ease({
                x: sourceRect.x,
                y: sourceRect.y,
                width: sourceRect.width,
                height: sourceRect.height,
                duration: EXIT_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: entry.exitComplete,
            });
        }
    }

    _clearActors() {
        for (const {clone, source, signal} of this._cloneEntries) {
            if (clone !== null)
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
        this._chromeActors = [];
        this._activateTarget = null;
        super.destroy();
    }
});
