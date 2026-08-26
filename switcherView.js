// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {calculateGroupHorizontalLayout} from './switcherLayout.js';

const GAP = 24;
const MARGIN = 48;
const LABEL_HEIGHT = 32;
const ICON_SIZE = 120;
const APP_ICON_CONTENT_SIZE = 110;
const DIRECT_ICON_SIZE = 48;
const CHEVRON_SIZE = 24;
const DIRECT_CHROME_CLEARANCE = 72;
const WINDOW_TITLE_CLEARANCE = LABEL_HEIGHT + 16;
const REGION_GAP = 64;
const GROUP_PREVIEW_SCALE = 0.58;
const GROUP_VERTICAL_OFFSET = 0.12;
const MIN_GROUP_ICON_SIZE = 88;
const PREVIEW_CORNER_RADIUS = 12;
const FULL_GROUP_CHROME_HEIGHT = 16 + MIN_GROUP_ICON_SIZE + CHEVRON_SIZE + 16 + LABEL_HEIGHT;
const ENTERED_GROUP_CHROME_HEIGHT = CHEVRON_SIZE + 16 + ICON_SIZE + 16 + LABEL_HEIGHT;
const MAX_PREVIEW_SCALE = 0.7;
const ENTRANCE_TIME = 220;
const TRANSITION_TIME = 180;
const EXIT_TIME = 180;

const ROUNDED_CLIP_DECLARATIONS = `
uniform vec2 target_size;
uniform vec2 clip_origin;
uniform vec2 clip_size;
uniform vec2 presentation_scale;
uniform float clip_radius;
`;

const ROUNDED_CLIP_CODE = `
vec2 point = (cogl_tex_coord_in[0].xy * target_size - clip_origin) *
    presentation_scale;
vec2 half_size = clip_size * presentation_scale * 0.5;
vec2 offset = abs(point - half_size) -
    (half_size - vec2(clip_radius));
float distance_to_edge = length(max(offset, vec2(0.0))) +
    min(max(offset.x, offset.y), 0.0) - clip_radius;
float coverage = 1.0 - smoothstep(-0.5, 0.5, distance_to_edge);
cogl_color_out *= coverage;
`;

const RoundedClipEffect = GObject.registerClass(
class RoundedClipEffect extends Shell.GLSLEffect {
    _init(radius) {
        this._radius = radius;
        super._init();

        this._targetSizeLocation = this.get_uniform_location('target_size');
        this._originLocation = this.get_uniform_location('clip_origin');
        this._sizeLocation = this.get_uniform_location('clip_size');
        this._presentationScaleLocation = this.get_uniform_location('presentation_scale');
        this._radiusLocation = this.get_uniform_location('clip_radius');
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(
            Cogl.SnippetHook.FRAGMENT,
            ROUNDED_CLIP_DECLARATIONS,
            ROUNDED_CLIP_CODE,
            false);
    }

    vfunc_paint_target(node, paintContext) {
        const [, targetWidth, targetHeight] = this.get_target_size();
        const resourceScale = this.actor.get_resource_scale();
        const width = this.actor.width * resourceScale;
        const height = this.actor.height * resourceScale;
        const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
        const presentationScale = [
            Math.max(0.001, Math.abs(this.actor.scale_x)),
            Math.max(0.001, Math.abs(this.actor.scale_y)),
        ];
        const radius = Math.min(
            this._radius * scaleFactor * resourceScale,
            width * presentationScale[0] / 2,
            height * presentationScale[1] / 2);
        // GNOME 50 gives offscreen effects two padding pixels on the top and left.
        this.set_uniform_float(
            this._targetSizeLocation, 2, [targetWidth, targetHeight]);
        this.set_uniform_float(
            this._originLocation, 2, [2 * resourceScale, 2 * resourceScale]);
        this.set_uniform_float(this._sizeLocation, 2, [width, height]);
        this.set_uniform_float(
            this._presentationScaleLocation, 2, presentationScale);
        this.set_uniform_float(this._radiusLocation, 1, [radius]);
        super.vfunc_paint_target(node, paintContext);
    }
});

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

function actorGeometry(actor) {
    return {
        x: actor.x,
        y: actor.y,
        width: actor.width,
        height: actor.height,
        opacity: actor.opacity,
    };
}

function transformedActorState(actor) {
    return {
        ...actorGeometry(actor),
        scale_x: actor.scale_x,
        scale_y: actor.scale_y,
    };
}

function previewGeometry(actor) {
    return {
        x: actor.x,
        y: actor.y,
        width: actor.width * actor.scale_x,
        height: actor.height * actor.scale_y,
        opacity: actor.opacity,
    };
}

function previewProperties(entry, geometry) {
    const properties = {
        x: geometry.x,
        y: geometry.y,
        scale_x: geometry.width / entry.baseWidth,
        scale_y: geometry.height / entry.baseHeight,
    };
    if (geometry.opacity !== undefined)
        properties.opacity = geometry.opacity;
    return properties;
}

function visitActorTree(actor, callback) {
    callback(actor);
    for (const child of actor.get_children())
        visitActorTree(child, callback);
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

function balancedRows(items) {
    if (items.length === 0)
        return [];
    if (items.length <= 2)
        return [items];
    const split = Math.ceil(items.length / 2);
    return [items.slice(0, split), items.slice(split)];
}

function rowSize(row, sizes) {
    return {
        width: row.reduce((sum, {index}) => sum + sizes.get(index).width, 0) +
            Math.max(0, row.length - 1) * GAP,
        height: Math.max(0, ...row.map(({index}) => sizes.get(index).height)),
    };
}

function placeGalleryRows(rows, rowSizes, sizes, area, y, scale, rowClearance) {
    const geometries = new Map();
    const scaledGap = GAP * scale;

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
        y += rowHeight + rowClearance;
        if (rowIndex < rows.length - 1)
            y += scaledGap;
    });

    return {geometries, bottom: y};
}

function scaledSize(size, scale) {
    return {
        ...size,
        width: size.width * scale,
        height: size.height * scale,
    };
}

function groupSize(group, sizes) {
    const horizontalLayout = calculateGroupHorizontalLayout(
        group.children.map(({index}) => sizes.get(index).width), 0);
    let height = 0;
    group.children.forEach(({index}, childIndex) => {
        const size = sizes.get(index);
        height = Math.max(height, size.height + childIndex * size.height * GROUP_VERTICAL_OFFSET);
    });

    return {width: horizontalLayout.previewWidth, height};
}

function calculateFullLayout(targets) {
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
        sizes.set(index, scaledSize(recordBounds(target), GROUP_PREVIEW_SCALE));
        groups.find(group => group.target.application === target.application)
            .children.push({target, index});
    });

    const rows = balancedRows(directTargets);
    const rowSizes = rows.map(row => rowSize(row, sizes));
    const groupSizes = groups.map(group => groupSize(group, sizes));
    const hasGroups = groups.length > 0;
    const regionGap = directTargets.length > 0 && hasGroups ? REGION_GAP : 0;
    const directNaturalWidth = Math.max(0, ...rowSizes.map(size => size.width));
    const directNaturalHeight = rowSizes.reduce((sum, size) => sum + size.height, 0) +
        Math.max(0, rows.length - 1) * GAP;
    const groupsNaturalHeight = Math.max(0, ...groupSizes.map(size => size.height));
    const naturalHeight = directNaturalHeight + groupsNaturalHeight;
    const directChromeClearance = rows.length * DIRECT_CHROME_CLEARANCE;
    const groupChromeClearance = hasGroups ? FULL_GROUP_CHROME_HEIGHT : 0;
    let scale = Math.min(
        MAX_PREVIEW_SCALE,
        area.width / Math.max(1, directNaturalWidth),
        (area.height - directChromeClearance - groupChromeClearance - regionGap) /
            Math.max(1, naturalHeight));
    const groupIconFloor = groups.length === 0
        ? MIN_GROUP_ICON_SIZE
        : Math.min(
            MIN_GROUP_ICON_SIZE,
            Math.max(1, (area.width - Math.max(0, groups.length - 1) * GAP * MAX_PREVIEW_SCALE) /
                groups.length));
    const groupHorizontalLayout = (group, candidateScale) =>
        calculateGroupHorizontalLayout(
            group.children.map(({index}) => sizes.get(index).width * candidateScale),
            groupIconFloor);
    const scaledGroupsWidth = candidateScale =>
        groups.reduce((sum, group) =>
            sum + groupHorizontalLayout(group, candidateScale).width, 0) +
        Math.max(0, groups.length - 1) * GAP * candidateScale;
    if (scaledGroupsWidth(scale) > area.width) {
        let lower = 0;
        let upper = scale;
        for (let iteration = 0; iteration < 20; iteration++) {
            const candidate = (lower + upper) / 2;
            if (scaledGroupsWidth(candidate) <= area.width)
                lower = candidate;
            else
                upper = candidate;
        }
        scale = lower;
    }
    const directHeight = directNaturalHeight * scale;
    const groupsHeight = groupsNaturalHeight * scale;
    const contentHeight = directHeight + groupsHeight + directChromeClearance +
        groupChromeClearance + regionGap;
    let y = area.y + (area.height - contentHeight) / 2;
    const directLayout = placeGalleryRows(
        rows, rowSizes, sizes, area, y, scale, DIRECT_CHROME_CLEARANCE);
    const geometries = directLayout.geometries;

    y = directLayout.bottom;
    if (directTargets.length > 0 && hasGroups)
        y += REGION_GAP;
    const scaledGap = GAP * scale;
    const groupHorizontalLayouts = groups.map(group =>
        groupHorizontalLayout(group, scale));
    const groupWidths = groupHorizontalLayouts.map(layout => layout.width);
    const groupsWidth = groupWidths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, groups.length - 1) * scaledGap;
    let groupX = area.x + (area.width - groupsWidth) / 2;
    groups.forEach((group, groupIndex) => {
        const size = groupSizes[groupIndex];
        const horizontalLayout = groupHorizontalLayouts[groupIndex];
        const {previewWidth, previewX, width} = horizontalLayout;
        const previewHeight = size.height * scale;
        const iconSize = groupIconFloor;
        group.children.forEach(({index}, childIndex) => {
            const childSize = sizes.get(index);
            const childWidth = childSize.width * scale;
            const childHeight = childSize.height * scale;
            geometries.set(index, {
                x: groupX + previewX + horizontalLayout.offsets[childIndex],
                y: y + childIndex * childHeight * GROUP_VERTICAL_OFFSET,
                width: childWidth,
                height: childHeight,
            });
        });
        geometries.set(group.index, {
            x: groupX,
            y,
            width,
            height: previewHeight + groupChromeClearance,
            previewHeight,
            previewWidth,
            previewX,
            iconSize,
            iconX: horizontalLayout.iconX,
            iconY: previewHeight + 8,
        });
        groupX += width + scaledGap;
    });

    return {geometries, groups};
}

function calculateEnteredLayout(targets, application) {
    const area = workArea();
    const items = [];
    const sizes = new Map();
    let groupIndex = -1;

    targets.forEach((target, index) => {
        if (target.kind === 'app-group' && target.application === application)
            groupIndex = index;
        if (target.kind === 'grouped-window' && target.application === application) {
            items.push({target, index});
            sizes.set(index, recordBounds(target));
        }
    });
    if (groupIndex === -1 || items.length === 0)
        return null;

    const rows = balancedRows(items);
    const rowSizes = rows.map(row => rowSize(row, sizes));
    const naturalWidth = Math.max(1, ...rowSizes.map(size => size.width));
    const naturalHeight = rowSizes.reduce((sum, size) => sum + size.height, 0) +
        Math.max(0, rows.length - 1) * GAP;
    const rowChromeHeight = rows.length * WINDOW_TITLE_CLEARANCE;
    const chromeHeight = rowChromeHeight + ENTERED_GROUP_CHROME_HEIGHT;
    const scale = Math.min(
        MAX_PREVIEW_SCALE,
        area.width / naturalWidth,
        (area.height - chromeHeight) / Math.max(1, naturalHeight));
    const galleryHeight = naturalHeight * scale;
    const contentHeight = galleryHeight + chromeHeight;
    const y = area.y + (area.height - contentHeight) / 2;
    const layout = placeGalleryRows(
        rows, rowSizes, sizes, area, y, scale, WINDOW_TITLE_CLEARANCE);
    const groupWidth = Math.max(ICON_SIZE, Math.min(area.width, naturalWidth * scale));

    layout.geometries.set(groupIndex, {
        x: area.x + (area.width - groupWidth) / 2,
        y: layout.bottom,
        width: groupWidth,
        height: ENTERED_GROUP_CHROME_HEIGHT,
        previewHeight: 0,
        previewWidth: 0,
        previewX: 0,
        iconSize: ICON_SIZE,
        iconX: (groupWidth - ICON_SIZE) / 2,
        iconY: CHEVRON_SIZE + 16,
    });
    return {geometries: layout.geometries, groupIndex};
}

function destinationForSurface(record, surface, geometry) {
    const bounds = recordBounds(record);
    const source = surface.get_compositor_private();
    if (source === null)
        return geometry;
    const sourceRect = sourceGeometry(source);
    const scale = Math.min(geometry.width / bounds.width, geometry.height / bounds.height);
    return {
        x: geometry.x + (sourceRect.x - bounds.x) * scale,
        y: geometry.y + (sourceRect.y - bounds.y) * scale,
        width: sourceRect.width * scale,
        height: sourceRect.height * scale,
    };
}

export const SwitcherView = GObject.registerClass(
class SwitcherView extends St.Widget {
    _init(targets, startingWindow, activateTarget, enterGroupRequested, leaveGroupRequested) {
        super._init({
            style_class: 'window-switching-redux',
            accessible_role: Atk.Role.MENU,
            reactive: false,
        });
        this._targets = targets;
        this._activateTarget = activateTarget;
        this._enterGroupRequested = enterGroupRequested;
        this._leaveGroupRequested = leaveGroupRequested;
        this._enteredApplication = null;
        this._targetActors = [];
        this._cloneEntries = [];
        this._chromeActors = [];
        this._selectedIndex = -1;
        this._exitTargetIndex = null;
        this._entranceTargetIndex = targets.findIndex(target =>
            target.kind === 'direct-window' && target.window === startingWindow);
        if (this._entranceTargetIndex === -1) {
            this._entranceTargetIndex = targets.findIndex(target =>
                target.kind === 'grouped-window' && target.window === startingWindow);
        }
        this._backdropActor = null;
        this._fullLayout = null;
        this.set_size(global.stage.width, global.stage.height);
    }

    build() {
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

    _connectRequest(actor, callback) {
        actor.connect('button-release-event', (_actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY)
                callback();
            return Clutter.EVENT_STOP;
        });
        actor.connect('touch-event', (_actor, event) => {
            if (event.type() === Clutter.EventType.TOUCH_END)
                callback();
            return Clutter.EVENT_STOP;
        });
    }

    _positionLabel(label, previewWidth, y, animate = false) {
        const [, naturalWidth] = label.get_preferred_width(-1);
        const width = Math.max(1, Math.min(previewWidth, naturalWidth));
        this._setActorProperties(label, {
            x: (previewWidth - width) / 2,
            y,
            width,
        }, animate);
    }

    _createWindowTarget(target, index, geometry) {
        const actor = new St.Widget({
            style_class: target.kind === 'direct-window'
                ? 'switcher-target switcher-direct-target'
                : 'switcher-target',
            reactive: true,
            track_hover: true,
            accessible_role: Atk.Role.MENU_ITEM,
            accessible_name: targetName(target),
        });
        actor.set_position(geometry.x, geometry.y);
        actor.set_size(geometry.width, geometry.height);
        actor._previewActors = [];
        this._connectActivation(actor, index);
        this.add_child(actor);
        if (target.kind === 'grouped-window') {
            actor.track_hover = true;
            const groupActor = this._targetActors.find(candidate =>
                candidate?._application === target.application);
            actor.connect('notify::hover', () => {
                if (actor.hover)
                    groupActor._hoveredPreviews.add(actor);
                else
                    groupActor._hoveredPreviews.delete(actor);
                groupActor._syncHover();
            });
        }

        let labelY = geometry.height + 8;
        if (target.kind === 'direct-window') {
            const iconBin = new St.Bin({style_class: 'switcher-window-app-icon'});
            iconBin.set_child(this._createIcon(target.application, DIRECT_ICON_SIZE));
            iconBin.set_size(DIRECT_ICON_SIZE, DIRECT_ICON_SIZE);
            actor.add_child(iconBin);
            actor._directIcon = iconBin;
            this._positionDirectIcon(actor, geometry, false);
            const iconSize = Math.max(1, Math.min(DIRECT_ICON_SIZE, geometry.height / 3));
            labelY += iconSize / 2;
        }

        const label = new St.Label({
            text: targetName(target),
            style_class: 'switcher-window-title',
            visible: false,
        });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        label.clutter_text.single_line_mode = true;
        actor.add_child(label);
        this._positionLabel(label, geometry.width, labelY);
        actor.label_actor = label;
        actor._selectionLabel = label;
        actor._selectionActor = actor;
        this._chromeActors.push(actor);
        this._targetActors[index] = actor;
    }

    _positionDirectIcon(actor, geometry, animate) {
        const iconSize = Math.max(1, Math.min(DIRECT_ICON_SIZE, geometry.height / 3));
        this._setActorProperties(actor._directIcon, {
            x: (geometry.width - iconSize) / 2,
            y: geometry.height - iconSize / 2,
            scale_x: iconSize / DIRECT_ICON_SIZE,
            scale_y: iconSize / DIRECT_ICON_SIZE,
        }, animate);
    }

    _createChevron(iconName, accessibleName, callback) {
        const button = new St.Bin({
            style_class: 'switcher-group-chevron',
            reactive: true,
            track_hover: false,
            accessible_role: Atk.Role.PUSH_BUTTON,
            accessible_name: accessibleName,
            child: new St.Icon({icon_name: iconName, icon_size: CHEVRON_SIZE}),
        });
        button.set_size(CHEVRON_SIZE + 16, CHEVRON_SIZE + 8);
        this._connectRequest(button, callback);
        return button;
    }

    _createGroupTarget(group, geometry) {
        const {target, index} = group;
        const actor = new St.Widget({
            style_class: 'switcher-group-target',
            reactive: true,
            track_hover: true,
            accessible_role: Atk.Role.MENU_ITEM,
            accessible_name: targetName(target),
        });
        actor.set_position(geometry.x, geometry.y);
        actor.set_size(geometry.width, geometry.height);
        this._connectActivation(actor, index);
        this.add_child(actor);

        const outline = new St.Widget({
            style_class: 'switcher-group-outline',
            reactive: false,
        });
        this.add_child(outline);
        actor._groupOutline = outline;
        actor._application = target.application;
        actor._hoveredPreviews = new Set();
        actor._syncHover = () => {
            if (actor.hover || actor._hoveredPreviews.size > 0)
                outline.add_style_class_name('switcher-hovered');
            else
                outline.remove_style_class_name('switcher-hovered');
        };
        actor.connect('notify::hover', actor._syncHover);

        const iconBin = new St.Bin({
            style_class: 'switcher-app-icon',
            reactive: false,
            track_hover: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        iconBin.set_child(this._createIcon(target.application, APP_ICON_CONTENT_SIZE));
        iconBin.set_size(ICON_SIZE, ICON_SIZE);
        actor.add_child(iconBin);
        actor._iconBin = iconBin;

        const downChevron = this._createChevron(
            'go-down-symbolic',
            `Show ${targetName(target)} windows`,
            () => this._enterGroupRequested(target.application));
        actor.add_child(downChevron);
        actor._downChevron = downChevron;

        const upChevron = this._createChevron(
            'go-up-symbolic',
            'Return to all windows',
            () => this._leaveGroupRequested());
        upChevron.opacity = 0;
        upChevron.reactive = false;
        actor.add_child(upChevron);
        actor._upChevron = upChevron;

        const label = new St.Label({
            text: targetName(target),
            style_class: 'switcher-app-name',
            visible: false,
        });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        label.clutter_text.single_line_mode = true;
        actor.add_child(label);
        actor.label_actor = label;
        actor._selectionLabel = label;
        actor._selectionActor = outline;
        this._positionGroupChrome(actor, geometry, false, false, false);
        this._chromeActors.push(actor);
        this._chromeActors.push(outline);
        this._targetActors[index] = actor;
    }

    _positionGroupChrome(
        actor, geometry, entered, isEntered, animate,
        duration = TRANSITION_TIME, lateFade = false) {
        const iconScale = geometry.iconSize / ICON_SIZE;
        const iconX = geometry.iconX;
        const chevronX = iconX + (geometry.iconSize - CHEVRON_SIZE - 16) / 2;
        const downChevronY = geometry.iconY + geometry.iconSize + 8;
        const upChevronY = geometry.iconY - CHEVRON_SIZE - 8;
        const outlineProperties = {
            x: geometry.x + geometry.previewX,
            y: geometry.y,
            width: geometry.previewWidth,
            height: geometry.previewHeight,
            opacity: entered ? 0 : 255,
        };
        if (lateFade)
            this._setLateFadeProperties(actor._groupOutline, outlineProperties, animate, duration);
        else
            this._setActorProperties(actor._groupOutline, outlineProperties, animate, duration);
        this._setActorProperties(actor._iconBin, {
            x: iconX,
            y: geometry.iconY,
            scale_x: iconScale,
            scale_y: iconScale,
        }, animate, duration);
        this._setActorProperties(
            actor._downChevron, {
                x: chevronX,
                y: downChevronY,
                opacity: entered ? 0 : 255,
            }, animate, duration);
        this._setActorProperties(
            actor._upChevron, {
                x: chevronX,
                y: upChevronY,
                opacity: isEntered ? 255 : 0,
            }, animate, duration);
        this._positionLabel(
            actor._selectionLabel,
            geometry.width,
            isEntered ? downChevronY + 8 : downChevronY + CHEVRON_SIZE + 16,
            animate);
    }

    _createClones(record, index, geometry, targetActor, initialPositions) {
        const parentActor = record.window.get_compositor_private();
        if (parentActor === null)
            return false;

        for (const surface of [record.window, ...record.auxiliarySurfaces]) {
            const source = surface.get_compositor_private();
            if (source === null)
                continue;
            const destination = destinationForSurface(record, surface, geometry);
            const savedState = initialPositions?.get(record)?.get(surface);
            const initial = savedState ?? sourceGeometry(source);
            let backingGeometry = destination;
            if (savedState !== undefined) {
                backingGeometry = {
                    width: Math.max(savedState.baseWidth, destination.width),
                    height: Math.max(savedState.baseHeight, destination.height),
                };
            } else if (index === this._entranceTargetIndex &&
                St.Settings.get().enable_animations) {
                backingGeometry = initial;
            }
            const baseWidth = Math.max(1, Math.round(backingGeometry.width));
            const baseHeight = Math.max(1, Math.round(backingGeometry.height));
            const clone = new Clutter.Clone({
                source,
                x_expand: true,
                y_expand: true,
            });
            const preview = new Clutter.Actor({
                clip_to_allocation: true,
                layout_manager: new Clutter.BinLayout(),
            });
            preview.add_child(clone);
            preview.add_effect(new RoundedClipEffect(PREVIEW_CORNER_RADIUS));
            preview.set_position(initial.x, initial.y);
            preview.set_size(baseWidth, baseHeight);
            preview.scale_x = initial.width / baseWidth;
            preview.scale_y = initial.height / baseHeight;
            if (initial.opacity !== undefined)
                preview.opacity = initial.opacity;
            this.add_child(preview);
            this.set_child_below_sibling(preview, targetActor);
            targetActor._previewActors.push(preview);
            const entry = {
                clone: preview,
                source,
                surface,
                signal: 0,
                targetIndex: index,
                targetActor,
                baseWidth,
                baseHeight,
                exitComplete: null,
            };
            entry.signal = source.connect('destroy', () => {
                preview.destroy();
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

    _createUnavailableTarget(target, index, geometry, targetActor) {
        const icon = this._createIcon(target.application, Math.max(1, Math.min(ICON_SIZE, geometry.height)));
        const placeholder = new St.Bin({
            style_class: 'switcher-preview-unavailable',
            child: icon,
        });
        placeholder.set_position(geometry.x, geometry.y);
        placeholder.set_size(geometry.width, geometry.height);
        this.add_child(placeholder);
        this.set_child_below_sibling(placeholder, targetActor);
        targetActor._previewActors.push(placeholder);
        this._cloneEntries.push({
            clone: placeholder,
            source: null,
            surface: null,
            signal: 0,
            targetIndex: index,
            targetActor,
            baseWidth: geometry.width,
            baseHeight: geometry.height,
            exitComplete: null,
        });
    }

    _build(initialState = null) {
        this._backdropActor = new St.Widget({
            style_class: 'switcher-backdrop',
            reactive: false,
        });
        this._backdropActor.set_size(global.stage.width, global.stage.height);
        this.add_child(this._backdropActor);
        this._chromeActors.push(this._backdropActor);
        this._fullLayout = calculateFullLayout(this._targets);
        for (const group of this._fullLayout.groups) {
            const geometry = this._fullLayout.geometries.get(group.index);
            this._createGroupTarget(group, geometry);
        }

        this._targets.forEach((target, index) => {
            if (target.kind === 'app-group')
                return;
            const geometry = this._fullLayout.geometries.get(index);
            this._createWindowTarget(target, index, geometry);
            const targetActor = this._targetActors[index];
            if (!this._createClones(target, index, geometry, targetActor, initialState?.surfaces))
                this._createUnavailableTarget(target, index, geometry, targetActor);
        });

        if (initialState !== null) {
            this._backdropActor.opacity = initialState.backdropOpacity;
            this._targets.forEach((target, index) => {
                const state = target.kind === 'app-group'
                    ? initialState.groups.get(target.application)
                    : initialState.targets.get(target);
                if (state === undefined)
                    return;
                this._setActorProperties(this._targetActors[index], state.actor, false);
                if (target.kind === 'app-group') {
                    this._setActorProperties(this._targetActors[index]._iconBin, state.icon, false);
                    this._setActorProperties(this._targetActors[index]._downChevron, state.downChevron, false);
                    this._setActorProperties(this._targetActors[index]._upChevron, state.upChevron, false);
                    this._setActorProperties(this._targetActors[index]._selectionLabel, state.label, false);
                    this._setActorProperties(
                        this._targetActors[index]._groupOutline, state.outline, false);
                } else {
                    if (state.icon !== null)
                        this._setActorProperties(this._targetActors[index]._directIcon, state.icon, false);
                    this._setActorProperties(this._targetActors[index]._selectionLabel, state.label, false);
                }
            });
        }

        for (const group of this._fullLayout.groups) {
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
            this.set_child_above_sibling(
                this._targetActors[group.index]._groupOutline, sibling);
        }

        if (initialState === null)
            this._beginEntrance();
        else {
            this._applyComposition(true);
            this._setActorProperties(
                this._backdropActor,
                {opacity: 255},
                St.Settings.get().enable_animations);
        }
    }

    _beginEntrance() {
        const animationsEnabled = St.Settings.get().enable_animations;
        for (const actor of this._chromeActors)
            actor.opacity = animationsEnabled ? 0 : 255;
        if (animationsEnabled) {
            for (const entry of this._cloneEntries) {
                if (entry.clone === null || entry.targetIndex === this._entranceTargetIndex)
                    continue;
                const target = this._targets[entry.targetIndex];
                const geometry = this._fullLayout.geometries.get(entry.targetIndex);
                const destination = entry.surface === null
                    ? geometry
                    : destinationForSurface(target, entry.surface, geometry);
                const properties = entry.surface === null
                    ? destination
                    : previewProperties(entry, destination);
                this._setActorProperties(entry.clone, {...properties, opacity: 0}, false);
            }
        }
        this._applyComposition(animationsEnabled, ENTRANCE_TIME, null, true);
        this._setActorProperties(
            this._backdropActor, {opacity: 255}, animationsEnabled, ENTRANCE_TIME);
        this._entranceTargetIndex = -1;
    }

    _setActorProperties(
        actor, properties, animate, duration = TRANSITION_TIME, onComplete = null) {
        actor.remove_all_transitions();
        if (!animate) {
            for (const [property, value] of Object.entries(properties))
                actor[property] = value;
            if (onComplete !== null)
                onComplete();
            return;
        }
        const params = {
            ...properties,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        };
        if (onComplete !== null)
            params.onComplete = onComplete;
        actor.ease(params);
    }

    _setLateFadeProperties(actor, properties, animate, duration, onComplete = null) {
        if (!animate) {
            this._setActorProperties(actor, properties, false, duration, onComplete);
            return;
        }

        const fadeDuration = Math.ceil(duration / 3);
        this._setActorProperties(
            actor,
            {...properties, opacity: 1},
            true,
            duration - fadeDuration,
            () => this._setActorProperties(
                actor, {opacity: properties.opacity}, true, fadeDuration, onComplete));
    }

    _setLateOpacity(actor, opacity, animate, duration) {
        actor.remove_transition('opacity');
        if (!animate) {
            actor.opacity = opacity;
            return;
        }

        actor.opacity = 0;
        const fadeDuration = Math.ceil(duration / 3);
        actor.ease({
            opacity: 1,
            duration: duration - fadeDuration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => actor.ease({
                opacity,
                duration: fadeDuration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            }),
        });
    }

    _setHiddenPreviewProperties(entry, properties, destination, animate, duration) {
        if (!animate) {
            this._setActorProperties(entry.clone, properties, false);
            this._rebasePreview(entry, destination, {...destination, opacity: 0});
            return;
        }

        const finalFadeDuration = Math.min(32, Math.ceil(duration / 3));
        this._setActorProperties(
            entry.clone,
            {...properties, opacity: 1},
            true,
            duration - finalFadeDuration,
            () => {
                this._rebasePreview(entry, destination, {...destination, opacity: 1});
                this._setActorProperties(
                    entry.clone, {opacity: 0}, true, finalFadeDuration);
            });
    }

    _rebasePreview(entry, geometry, presentedGeometry = null) {
        const baseWidth = Math.max(1, Math.round(geometry.width));
        const baseHeight = Math.max(1, Math.round(geometry.height));
        const sizeChanged = entry.baseWidth !== baseWidth || entry.baseHeight !== baseHeight;
        if (presentedGeometry === null && !sizeChanged)
            return;

        entry.clone.remove_all_transitions();
        presentedGeometry ??= previewGeometry(entry.clone);
        entry.baseWidth = baseWidth;
        entry.baseHeight = baseHeight;
        if (sizeChanged)
            entry.clone.set_size(baseWidth, baseHeight);
        this._setActorProperties(
            entry.clone, previewProperties(entry, presentedGeometry), false);
    }

    _applyComposition(
        animate, duration = TRANSITION_TIME, groupTransition = null, lateChrome = false) {
        animate &&= St.Settings.get().enable_animations;
        const entered = this._enteredApplication === null
            ? null
            : calculateEnteredLayout(this._targets, this._enteredApplication);
        const enteredIndices = entered === null
            ? new Set()
            : new Set(entered.geometries.keys());
        const stagedDirectIndices = groupTransition === null
            ? new Set()
            : new Set(this._targets.flatMap((target, index) => {
                if (target.kind !== 'direct-window' ||
                    target.application !== groupTransition.application) {
                    return [];
                }
                const duplicated = this._targets.some(candidate =>
                    candidate.kind === 'grouped-window' &&
                    candidate.application === groupTransition.application &&
                    candidate.window === target.window);
                return duplicated ? [index] : [];
            }));
        const stagedDuration = Math.ceil(duration / 3);

        this._targets.forEach((target, index) => {
            const actor = this._targetActors[index];
            const geometry = enteredIndices.has(index)
                ? entered.geometries.get(index)
                : this._fullLayout.geometries.get(index);
            const visible = entered === null || enteredIndices.has(index);
            const staged = stagedDirectIndices.has(index);
            const properties = {
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height,
                opacity: visible ? 255 : 0,
            };
            if (lateChrome) {
                this._setLateFadeProperties(actor, properties, animate, duration);
            } else if (staged && groupTransition.entering === false) {
                this._setLateFadeProperties(actor, properties, animate, duration);
            } else {
                this._setActorProperties(
                    actor, properties, animate, staged ? stagedDuration : duration);
            }

            if (target.kind === 'app-group') {
                const isEntered = entered !== null && index === entered.groupIndex;
                actor.reactive = entered === null || isEntered;
                actor._downChevron.reactive = entered === null;
                actor._upChevron.reactive = isEntered;
                this._positionGroupChrome(
                    actor, geometry, entered !== null, isEntered,
                    animate, duration, lateChrome);
            } else {
                actor.reactive = visible;
                if (target.kind === 'direct-window')
                    this._positionDirectIcon(actor, geometry, animate);
                const labelY = geometry.height + 8 + (target.kind === 'direct-window'
                    ? Math.max(1, Math.min(DIRECT_ICON_SIZE, geometry.height / 3)) / 2
                    : 0);
                this._positionLabel(actor._selectionLabel, geometry.width, labelY, animate);
            }
        });

        for (const entry of this._cloneEntries) {
            if (entry.clone === null)
                continue;
            const target = this._targets[entry.targetIndex];
            const visible = entered === null || enteredIndices.has(entry.targetIndex);
            const staged = stagedDirectIndices.has(entry.targetIndex);
            const geometry = enteredIndices.has(entry.targetIndex)
                ? entered.geometries.get(entry.targetIndex)
                : this._fullLayout.geometries.get(entry.targetIndex);
            const destination = entry.surface === null
                ? geometry
                : destinationForSurface(target, entry.surface, geometry);
            const properties = entry.surface === null
                ? destination
                : previewProperties(entry, destination);
            const settle = entry.surface === null
                ? null
                : () => this._rebasePreview(entry, destination, {
                    ...destination,
                    opacity: visible ? 255 : 0,
                });
            const presentedProperties = {...properties, opacity: visible ? 255 : 0};
            const backingChanges = entry.surface !== null &&
                (entry.baseWidth !== Math.max(1, Math.round(destination.width)) ||
                entry.baseHeight !== Math.max(1, Math.round(destination.height)));
            if (!visible && backingChanges) {
                this._setHiddenPreviewProperties(
                    entry,
                    presentedProperties,
                    destination,
                    animate,
                    staged ? stagedDuration : duration);
            } else if (staged && groupTransition.entering === false) {
                this._setLateFadeProperties(
                    entry.clone, presentedProperties, animate, duration, settle);
            } else {
                this._setActorProperties(
                    entry.clone,
                    presentedProperties,
                    animate,
                    staged ? stagedDuration : duration,
                    settle);
            }
        }
    }

    enterGroup(application) {
        const entered = calculateEnteredLayout(this._targets, application);
        this._targets.forEach((target, index) => {
            if (target.kind !== 'grouped-window' || target.application !== application)
                return;
            const label = this._targetActors[index]._selectionLabel;
            label.remove_transition('opacity');
            label.opacity = 0;
        });
        for (const entry of this._cloneEntries) {
            if (entry.clone === null || entry.surface === null)
                continue;
            const target = this._targets[entry.targetIndex];
            const geometry = target.kind === 'grouped-window' &&
                target.application === application
                ? entered.geometries.get(entry.targetIndex)
                : this._fullLayout.geometries.get(entry.targetIndex);
            const destination = destinationForSurface(target, entry.surface, geometry);
            const baseWidth = Math.max(1, Math.round(destination.width));
            const baseHeight = Math.max(1, Math.round(destination.height));
            if (baseWidth > entry.baseWidth || baseHeight > entry.baseHeight)
                this._rebasePreview(entry, destination);
        }
        this._enteredApplication = application;
        this._applyComposition(true, TRANSITION_TIME, {application, entering: true});
    }

    leaveGroup() {
        if (this._enteredApplication === null)
            return;
        const application = this._enteredApplication;
        this._enteredApplication = null;
        this._applyComposition(true, TRANSITION_TIME, {application, entering: false});
    }

    setTargets(targets) {
        const initialState = {
            backdropOpacity: this._backdropActor.opacity,
            surfaces: new Map(),
            targets: new Map(),
            groups: new Map(),
        };
        for (const entry of this._cloneEntries) {
            if (entry.clone === null || entry.surface === null)
                continue;
            const target = this._targets[entry.targetIndex];
            if (!initialState.surfaces.has(target))
                initialState.surfaces.set(target, new Map());
            initialState.surfaces.get(target).set(entry.surface, {
                ...previewGeometry(entry.clone),
                baseWidth: entry.baseWidth,
                baseHeight: entry.baseHeight,
            });
        }
        this._targets.forEach((target, index) => {
            const actor = this._targetActors[index];
            if (target.kind === 'app-group') {
                initialState.groups.set(target.application, {
                    actor: actorGeometry(actor),
                    icon: transformedActorState(actor._iconBin),
                    downChevron: actorGeometry(actor._downChevron),
                    upChevron: actorGeometry(actor._upChevron),
                    label: actorGeometry(actor._selectionLabel),
                    outline: actorGeometry(actor._groupOutline),
                });
            } else {
                initialState.targets.set(target, {
                    actor: actorGeometry(actor),
                    icon: actor._directIcon === undefined
                        ? null
                        : transformedActorState(actor._directIcon),
                    label: actorGeometry(actor._selectionLabel),
                });
            }
        });
        this._clearActors();
        this._targets = targets;
        this._targetActors = [];
        this._chromeActors = [];
        this._selectedIndex = -1;
        this._build(initialState);
    }

    setSelection(index) {
        if (this._selectedIndex >= 0) {
            const previous = this._targetActors[this._selectedIndex];
            if (previous !== undefined) {
                previous._selectionActor.remove_style_class_name('switcher-selected');
                previous._selectionLabel.remove_transition('opacity');
                if (this._enteredApplication !== null)
                    previous._selectionLabel.opacity = 0;
                previous._selectionLabel.visible = false;
                previous.remove_accessible_state(Atk.StateType.SELECTED);
            }
        }

        this._selectedIndex = index;
        const selected = this._targetActors[index];
        if (selected === undefined)
            return;
        selected._selectionActor.add_style_class_name('switcher-selected');
        selected._selectionLabel.visible = true;
        const target = this._targets[index];
        const geometryIsMoving = [selected, selected._selectionLabel].some(actor =>
            ['x', 'y', 'width', 'height']
                .some(property => actor.get_transition(property) !== null));
        const isGroupTransitionTitle = target.kind === 'app-group' ||
            (this._enteredApplication !== null &&
            target.kind === 'grouped-window' &&
            target.application === this._enteredApplication);
        if (isGroupTransitionTitle && geometryIsMoving) {
            this._setLateOpacity(
                selected._selectionLabel,
                255,
                St.Settings.get().enable_animations,
                TRANSITION_TIME);
        } else {
            selected._selectionLabel.remove_transition('opacity');
            selected._selectionLabel.opacity = 255;
        }
        selected.add_accessible_state(Atk.StateType.SELECTED);
    }

    setExitTarget(index) {
        this._exitTargetIndex = index;
    }

    _exitPreviewIndex() {
        const target = this._targets[this._exitTargetIndex];
        if (target === undefined)
            return -1;
        if (target.kind !== 'app-group')
            return this._exitTargetIndex;
        if (target.windows.length === 0)
            return -1;
        const window = target.windows[0].window;
        return this._targets.findIndex(candidate =>
            candidate.kind === 'grouped-window' &&
            candidate.application === target.application &&
            candidate.window === window);
    }

    beginExit(onComplete) {
        for (const actor of this._targetActors) {
            if (actor === undefined)
                continue;
            visitActorTree(actor, child => {
                child.reactive = false;
                child.remove_all_transitions();
            });
        }
        for (const actor of this._chromeActors)
            actor.remove_all_transitions();
        for (const {clone} of this._cloneEntries) {
            if (clone !== null)
                clone.remove_all_transitions();
        }

        if (this._exitTargetIndex === null) {
            if (!St.Settings.get().enable_animations) {
                this.opacity = 0;
                onComplete();
                return;
            }
            this.remove_all_transitions();
            this.ease({
                opacity: 0,
                duration: EXIT_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete,
            });
            return;
        }

        for (const actor of this._chromeActors) {
            if (St.Settings.get().enable_animations) {
                actor.ease({
                    opacity: 0,
                    duration: EXIT_TIME,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            } else {
                actor.opacity = 0;
            }
        }

        const heroIndex = this._exitPreviewIndex();
        const exits = this._cloneEntries
            .filter(({clone}) => clone !== null)
            .map(entry => ({
                entry,
                sourceRect: entry.targetIndex === heroIndex && entry.source !== null
                    ? sourceGeometry(entry.source)
                    : null,
            }));
        if (!St.Settings.get().enable_animations) {
            for (const {entry, sourceRect} of exits) {
                if (sourceRect !== null) {
                    this._setActorProperties(
                        entry.clone, previewProperties(entry, sourceRect), false);
                } else {
                    entry.clone.opacity = 0;
                }
            }
            onComplete();
            return;
        }
        if (exits.length === 0) {
            this.remove_all_transitions();
            this.ease({
                opacity: 0,
                duration: EXIT_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete,
            });
            return;
        }

        for (const {entry, sourceRect} of exits) {
            if (sourceRect !== null)
                this._rebasePreview(entry, sourceRect);
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
            const properties = sourceRect !== null
                ? {
                    ...previewProperties(entry, sourceRect),
                    opacity: 255,
                }
                : {opacity: 0};
            clone.ease({
                ...properties,
                duration: EXIT_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: entry.exitComplete,
            });
        }
    }

    _clearActors() {
        visitActorTree(this, actor => actor.remove_all_transitions());
        for (const {clone, source, signal} of this._cloneEntries) {
            if (signal !== 0)
                source.disconnect(signal);
        }
        this._cloneEntries = [];
        this.destroy_all_children();
        this._backdropActor = null;
    }

    destroy() {
        this._clearActors();
        this._targets = Object.freeze([]);
        this._targetActors = [];
        this._chromeActors = [];
        this._backdropActor = null;
        this._fullLayout = null;
        this._enteredApplication = null;
        this._exitTargetIndex = null;
        this._entranceTargetIndex = -1;
        this._activateTarget = null;
        this._enterGroupRequested = null;
        this._leaveGroupRequested = null;
        super.destroy();
    }
});
