// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    calculateEnteredLayout,
    calculateFullLayout,
    CHEVRON_SIZE,
    DIRECT_ICON_SIZE,
    ICON_SIZE,
} from './switcherLayout.js';

const APP_ICON_CONTENT_SIZE = 110;
const PREVIEW_CORNER_RADIUS = 12;
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
// Offscreen color is premultiplied. Cogl rejects Shell 50's RGB-only blend
// statement (missing A), leaving its default premultiplied source-over blend.
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
    const geometries = [record.window, ...record.auxiliarySurfaces]
        .filter(surface => surface.get_compositor_private() !== null)
        .map(surface => surface.get_buffer_rect());
    if (geometries.length === 0)
        return {x: 0, y: 0, width: 960, height: 600};

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

function destinationForSurface(record, surface, geometry) {
    const bounds = recordBounds(record);
    const sourceRect = surface.get_buffer_rect();
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
    _init(targets, startingWindow, activateTarget, enterGroupRequested, leaveGroupRequested, pointerMoved, targetFocused) {
        super._init({
            style_class: 'window-switching-redux',
            accessible_role: Atk.Role.MENU,
            reactive: false,
        });
        this._targets = targets;
        this._activateTarget = activateTarget;
        this._enterGroupRequested = enterGroupRequested;
        this._leaveGroupRequested = leaveGroupRequested;
        this._pointerMoved = pointerMoved;
        this._targetFocused = targetFocused;
        this._enteredApplication = null;
        this._targetActors = [];
        this._cloneEntries = [];
        this._sourceGeometrySignals = new Map();
        this._windowTitleSignals = new Map();
        this._pendingTitleLabels = new Set();
        this._titleLaterId = 0;
        this._geometryLaterId = 0;
        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._themeScale = this._themeContext.scale_factor;
        this._themeSignalId = 0;
        this._keyFocusSignalId = 0;
        this._clickActions = [];
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
        let monitorIndex = startingWindow === null ? -1 : startingWindow.get_monitor();
        if (monitorIndex < 0)
            monitorIndex = global.display.get_current_monitor();
        this._workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
        this.set_size(global.stage.width, global.stage.height);
    }

    build() {
        this._build();
        this._themeSignalId = this._themeContext.connect('changed', () => this._queueGeometryRefresh());
        this._keyFocusSignalId = global.stage.connect('notify::key-focus', () => {
            const focused = global.stage.get_key_focus();
            if (focused === null)
                return;
            const index = this._targetActors.findIndex(actor =>
                actor.contains(focused) || actor._groupOutline?.contains(focused) ||
                actor._previewActors?.some(preview => preview.contains(focused)));
            if (index < 0)
                return;
            if (this._targetActors[index].reactive && index !== this._selectedIndex)
                this._targetFocused(index);
            const owner = this._targetActors[index];
            const chevron = [owner._downChevron, owner._upChevron].find(button =>
                button?.visible && button.reactive && button.can_focus && button.contains(focused));
            if (chevron !== undefined) {
                if (chevron !== global.stage.get_key_focus())
                    chevron.grab_key_focus();
                return;
            }
            // ATK can focus descendants and targets outside the navigation scope.
            const selected = this._targetActors[this._selectedIndex];
            if (selected?.can_focus && selected !== global.stage.get_key_focus())
                selected.grab_key_focus();
        });
    }

    _disconnectKeyFocus() {
        if (this._keyFocusSignalId !== 0) {
            global.stage.disconnect(this._keyFocusSignalId);
            this._keyFocusSignalId = 0;
        }
    }

    activateFocusedChevron() {
        const focused = global.stage.get_key_focus();
        for (const [index, actor] of this._targetActors.entries()) {
            if (this._targets[index].kind !== 'app-group')
                continue;
            for (const button of [actor._downChevron, actor._upChevron]) {
                if (focused !== button || !button.visible || !button.reactive || !button.can_focus)
                    continue;
                if (button === actor._downChevron)
                    this._enterGroupRequested(this._targets[index].application);
                else
                    this._leaveGroupRequested();
                return true;
            }
        }
        return false;
    }

    _disconnectTheme() {
        if (this._themeSignalId !== 0) {
            this._themeContext.disconnect(this._themeSignalId);
            this._themeSignalId = 0;
        }
        this._themeContext = null;
    }

    _createIcon(application, size) {
        // St.Icon applies the theme scale to this logical size itself.
        if (application !== null)
            return application.create_icon_texture(size);
        return new St.Icon({icon_name: 'application-x-executable', icon_size: size});
    }

    _connectActivation(actor, index) {
        actor.connect('motion-event', (_actor, event) => {
            this._pointerMoved(index, event);
            // Consuming motion cancels Clutter's in-progress click gestures.
            return Clutter.EVENT_PROPAGATE;
        });
        const gesture = new Clutter.ClickGesture({required_button: Clutter.BUTTON_PRIMARY});
        const signal = gesture.connect('recognize', click => {
            const timestamp = click.get_point_event(-1).get_time();
            this._activateTarget(index, timestamp);
        });
        actor.add_action(gesture);
        actor._clickGesture = gesture;
        const clickAction = {actor, gesture, signal, sequenceSignal: 0};
        this._clickActions.push(clickAction);
        return clickAction;
    }

    _positionLabel(label, previewWidth, y, chromeScale, animate = false, titleOnly = false) {
        label._titleLayout = [previewWidth, y, chromeScale];
        // GNOME 50 St.Label applies its font in style-changed, even when hidden.
        label.ensure_style();
        // Bypass explicit dimensions from the previous layout or rebuild.
        const [, naturalWidth] = label.vfunc_get_preferred_width(-1);
        const width = Math.min(previewWidth / chromeScale, naturalWidth);
        const [, height] = label.vfunc_get_preferred_height(-1);
        if (titleOnly) {
            // Retarget the existing timeline without resetting its opacity or completion callback.
            for (const [property, value] of Object.entries({x: (previewWidth - width * chromeScale) / 2, width, height})) {
                const transition = label.get_transition(property);
                if (transition !== null)
                    transition.set_to(value);
                else
                    label[property] = value;
            }
            return;
        }
        this._setActorProperties(label, {
            x: (previewWidth - width * chromeScale) / 2,
            y,
            width,
            height,
            scale_x: chromeScale,
            scale_y: chromeScale,
        }, animate);
    }

    _createWindowTarget(target, index) {
        const actor = new St.Widget({
            style_class: 'switcher-target',
            reactive: true,
            accessible_role: Atk.Role.MENU_ITEM,
            accessible_name: targetName(target),
        });
        actor._previewActors = [];
        this._connectActivation(actor, index);
        this.add_child(actor);

        if (target.kind === 'direct-window') {
            const iconBin = new St.Bin({style_class: 'switcher-window-app-icon', reactive: true});
            iconBin.set_child(this._createIcon(target.application, DIRECT_ICON_SIZE));
            iconBin.set_size(DIRECT_ICON_SIZE * this._themeScale, DIRECT_ICON_SIZE * this._themeScale);
            actor.add_child(iconBin);
            actor._directIcon = iconBin;
        }

        const label = new St.Label({
            text: targetName(target),
            style_class: 'switcher-window-title',
            reactive: true,
            visible: false,
        });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        label.clutter_text.single_line_mode = true;
        actor.add_child(label);
        actor.label_actor = label;
        actor._selectionLabel = label;
        actor._selectionActor = actor;
        this._chromeActors.push(actor);
        this._targetActors[index] = actor;
        if (!this._windowTitleSignals.has(target.window)) {
            const signal = target.window.connect('notify::title', () => {
                const title = target.window.get_title();
                this._targets.forEach((candidate, targetIndex) => {
                    if (candidate.kind === 'app-group' || candidate.window !== target.window)
                        return;
                    const targetActor = this._targetActors[targetIndex];
                    targetActor._selectionLabel.text = title;
                    targetActor.accessible_name = title;
                    this._queueTitleRefresh(targetActor._selectionLabel);
                });
            });
            this._windowTitleSignals.set(target.window, signal);
        }
    }

    _queueTitleRefresh(label) {
        this._pendingTitleLabels.add(label);
        if (this._titleLaterId !== 0)
            return;
        this._titleLaterId = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._titleLaterId = 0;
            for (const pendingLabel of this._pendingTitleLabels)
                this._positionLabel(pendingLabel, ...pendingLabel._titleLayout, false, true);
            this._pendingTitleLabels.clear();
            return false;
        });
    }

    _disconnectWindowTitles() {
        if (this._titleLaterId !== 0) {
            global.compositor.get_laters().remove(this._titleLaterId);
            this._titleLaterId = 0;
        }
        this._pendingTitleLabels.clear();
        for (const [window, signal] of this._windowTitleSignals)
            window.disconnect(signal);
        this._windowTitleSignals.clear();
    }

    _positionDirectIcon(actor, geometry, animate) {
        const backingSize = DIRECT_ICON_SIZE * this._themeScale;
        const iconSize = Math.min(backingSize * geometry.chromeScale, geometry.height / 3, geometry.width);
        this._setActorProperties(actor._directIcon, {
            x: (geometry.width - iconSize) / 2,
            y: geometry.height - iconSize / 2,
            width: backingSize,
            height: backingSize,
            scale_x: iconSize / backingSize,
            scale_y: iconSize / backingSize,
        }, animate);
    }

    _createChevron(iconName, accessibleName, callback) {
        const button = new St.Button({
            style_class: 'switcher-group-chevron',
            can_focus: false,
            track_hover: false,
            button_mask: St.ButtonMask.ONE,
            accessible_name: accessibleName,
            child: new St.Icon({icon_name: iconName, icon_size: CHEVRON_SIZE}),
        });
        button.set_size((CHEVRON_SIZE + 16) * this._themeScale, (CHEVRON_SIZE + 8) * this._themeScale);
        button.connect('clicked', callback);
        return button;
    }

    _createGroupTarget(group) {
        const {target, index} = group;
        const actor = new St.Widget({
            style_class: 'switcher-group-target',
            reactive: true,
            accessible_role: Atk.Role.MENU_ITEM,
            accessible_name: targetName(target),
        });
        const clickAction = this._connectActivation(actor, index);
        this.add_child(actor);

        const outline = new St.Widget({
            style_class: 'switcher-group-outline',
            reactive: false,
        });
        this.add_child(outline);
        actor._groupOutline = outline;
        actor.add_accessible_state(Atk.StateType.EXPANDABLE);

        const iconBin = new St.Bin({
            style_class: 'switcher-app-icon',
            reactive: false,
            track_hover: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        iconBin.set_child(this._createIcon(target.application, APP_ICON_CONTENT_SIZE));
        iconBin.set_size(ICON_SIZE * this._themeScale, ICON_SIZE * this._themeScale);
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
        upChevron.hide();
        actor.add_child(upChevron);
        actor._upChevron = upChevron;

        // A cancelled chevron press must not become a click on its parent group.
        clickAction.sequenceSignal = clickAction.gesture.connect(
            'should-handle-sequence', (_gesture, event) => {
                const [x, y] = event.get_coords();
                const pressedActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
                return pressedActor === null || ![downChevron, upChevron].some(button =>
                    pressedActor === button || button.contains(pressedActor));
            });

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
        this._chromeActors.push(actor);
        this._chromeActors.push(outline);
        this._targetActors[index] = actor;
    }

    _positionGroupChrome(
        actor, geometry, entered, isEntered, animate,
        duration = TRANSITION_TIME, lateFade = false) {
        const backingSize = ICON_SIZE * this._themeScale;
        const iconScale = geometry.iconSize / backingSize;
        const {chromeScale} = geometry;
        const spacingScale = this._themeScale * chromeScale;
        const iconX = geometry.iconX;
        const chevronX = iconX + (geometry.iconSize - (CHEVRON_SIZE + 16) * spacingScale) / 2;
        const downChevronY = geometry.iconY + geometry.iconSize + 8 * spacingScale;
        const upChevronY = geometry.iconY - (CHEVRON_SIZE + 8) * spacingScale;
        for (const [button, visible] of [[actor._downChevron, !entered], [actor._upChevron, isEntered]]) {
            button.reactive = visible;
            button.can_focus = visible;
            if (visible)
                button.show();
            else
                button.fake_release();
        }
        if (isEntered)
            actor.add_accessible_state(Atk.StateType.EXPANDED);
        else
            actor.remove_accessible_state(Atk.StateType.EXPANDED);
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
            width: backingSize,
            height: backingSize,
            scale_x: iconScale,
            scale_y: iconScale,
        }, animate, duration);
        this._setActorProperties(
            actor._downChevron, {
                x: chevronX,
                y: downChevronY,
                width: (CHEVRON_SIZE + 16) * this._themeScale,
                height: (CHEVRON_SIZE + 8) * this._themeScale,
                scale_x: chromeScale,
                scale_y: chromeScale,
                opacity: entered ? 0 : 255,
            }, animate, duration, entered ? () => actor._downChevron.hide() : null);
        this._setActorProperties(
            actor._upChevron, {
                x: chevronX,
                y: upChevronY,
                width: (CHEVRON_SIZE + 16) * this._themeScale,
                height: (CHEVRON_SIZE + 8) * this._themeScale,
                scale_x: chromeScale,
                scale_y: chromeScale,
                opacity: isEntered ? 255 : 0,
            }, animate, duration, isEntered ? null : () => actor._upChevron.hide());
        this._positionLabel(
            actor._selectionLabel,
            geometry.width,
            downChevronY + (isEntered ? 8 : CHEVRON_SIZE + 16) * spacingScale,
            chromeScale,
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
                const geometrySignals = this._sourceGeometrySignals.get(source);
                if (geometrySignals !== undefined) {
                    for (const signal of geometrySignals)
                        source.disconnect(signal);
                    this._sourceGeometrySignals.delete(source);
                    this._queueGeometryRefresh();
                }
                targetActor._previewActors = targetActor._previewActors.filter(actor => actor !== preview);
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
            if (!this._sourceGeometrySignals.has(source)) {
                let previousRect = surface.get_buffer_rect();
                const geometryChanged = () => {
                    const rect = surface.get_buffer_rect();
                    // Shell effects transform actors without changing window geometry.
                    if (['x', 'y', 'width', 'height'].every(property => rect[property] === previousRect[property]))
                        return;
                    previousRect = rect;
                    this._queueGeometryRefresh();
                };
                const signals = ['position', 'size', 'allocation', 'scale-x', 'scale-y', 'translation-x', 'translation-y']
                    .map(property => source.connect(`notify::${property}`, geometryChanged));
                this._sourceGeometrySignals.set(source, signals);
            }
        }
        return true;
    }

    _queueGeometryRefresh() {
        if (this._geometryLaterId !== 0)
            return;
        this._geometryLaterId = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._geometryLaterId = 0;
            this._refreshGeometry();
            return false;
        });
    }

    _disconnectSourceGeometry() {
        if (this._geometryLaterId !== 0) {
            global.compositor.get_laters().remove(this._geometryLaterId);
            this._geometryLaterId = 0;
        }
        for (const [source, signals] of this._sourceGeometrySignals) {
            for (const signal of signals)
                source.disconnect(signal);
        }
        this._sourceGeometrySignals.clear();
    }

    _refreshGeometry() {
        this._themeScale = this._themeContext.scale_factor;
        this._fullLayout = calculateFullLayout(
            this._targets, this._workArea, recordBounds, this._measureTitleHeights(), this._themeScale);
        // Settle immediately: tweening from the old aspect ratio stretches resized sources.
        this._applyComposition(false);
        if (this._selectedIndex >= 0)
            this._targetActors[this._selectedIndex]._selectionLabel.opacity = 255;
    }

    _createUnavailableTarget(target, index, geometry, targetActor) {
        const iconSize = Math.max(1, Math.floor(Math.min(ICON_SIZE, geometry.width / this._themeScale, geometry.height / this._themeScale)));
        const icon = this._createIcon(target.application, iconSize);
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

    _measureTitleHeights() {
        const heights = {window: 0, app: 0};
        this._targets.forEach((target, index) => {
            const label = this._targetActors[index]._selectionLabel;
            label.ensure_style();
            const [, height] = label.vfunc_get_preferred_height(-1);
            const kind = target.kind === 'app-group' ? 'app' : 'window';
            heights[kind] = Math.max(heights[kind], height);
        });
        return heights;
    }

    _build(initialState = null) {
        this._themeScale = this._themeContext.scale_factor;
        this._backdropActor = new St.Widget({
            style_class: 'switcher-backdrop',
            reactive: false,
        });
        this._backdropActor.set_position(this._workArea.x, this._workArea.y);
        this._backdropActor.set_size(this._workArea.width, this._workArea.height);
        this.add_child(this._backdropActor);
        this._chromeActors.push(this._backdropActor);
        this._targets.forEach((target, index) => {
            if (target.kind === 'app-group')
                this._createGroupTarget({target, index});
            else
                this._createWindowTarget(target, index);
        });
        this._fullLayout = calculateFullLayout(
            this._targets, this._workArea, recordBounds, this._measureTitleHeights(), this._themeScale);
        this._applyComposition(false);

        this._targets.forEach((target, index) => {
            if (target.kind === 'app-group')
                return;
            const geometry = this._fullLayout.geometries.get(index);
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
        if (!animate || !entry.clone.visible) {
            this._setActorProperties(entry.clone, properties, false);
            this._rebasePreview(entry, destination, {...destination, opacity: 0});
            entry.clone.hide();
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
                    entry.clone, {opacity: 0}, true, finalFadeDuration, () => entry.clone.hide());
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
            : calculateEnteredLayout(this._targets, this._enteredApplication, this._workArea, recordBounds, this._measureTitleHeights(), this._themeScale);
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
            if (visible)
                actor.show();
            actor.can_focus = visible && (entered === null
                ? target.kind !== 'grouped-window'
                : target.kind === 'grouped-window');
            actor._clickGesture.set_enabled(visible && (target.kind !== 'app-group' || entered === null));
            const onComplete = visible ? null : () => actor.hide();
            const properties = {
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height,
                opacity: visible ? 255 : 0,
            };
            if (lateChrome) {
                this._setLateFadeProperties(actor, properties, animate, duration, onComplete);
            } else if (staged && groupTransition.entering === false) {
                this._setLateFadeProperties(actor, properties, animate, duration, onComplete);
            } else {
                this._setActorProperties(
                    actor, properties, animate, staged ? stagedDuration : duration, onComplete);
            }

            if (target.kind === 'app-group') {
                const isEntered = entered !== null && index === entered.groupIndex;
                actor.reactive = entered === null || isEntered;
                this._positionGroupChrome(
                    actor, geometry, entered !== null, isEntered,
                    animate, duration, lateChrome);
            } else {
                actor.reactive = visible;
                actor._selectionLabel.reactive = visible;
                if (target.kind === 'direct-window') {
                    actor._directIcon.reactive = visible;
                    this._positionDirectIcon(actor, geometry, animate);
                }
                const labelY = geometry.height + 8 * this._themeScale * geometry.chromeScale + (target.kind === 'direct-window'
                    ? Math.min(DIRECT_ICON_SIZE * this._themeScale * geometry.chromeScale, geometry.height / 3, geometry.width) / 2
                    : 0);
                this._positionLabel(actor._selectionLabel, geometry.width, labelY, geometry.chromeScale, animate);
            }
        });

        for (const entry of this._cloneEntries) {
            if (entry.clone === null)
                continue;
            const target = this._targets[entry.targetIndex];
            const visible = entered === null || enteredIndices.has(entry.targetIndex);
            if (visible)
                entry.clone.show();
            const staged = stagedDirectIndices.has(entry.targetIndex);
            const geometry = enteredIndices.has(entry.targetIndex)
                ? entered.geometries.get(entry.targetIndex)
                : this._fullLayout.geometries.get(entry.targetIndex);
            const destination = entry.surface === null
                ? geometry
                : destinationForSurface(target, entry.surface, geometry);
            if (entry.surface === null) {
                entry.clone.child.icon_size = Math.max(1, Math.floor(Math.min(
                    ICON_SIZE, geometry.width / this._themeScale, geometry.height / this._themeScale)));
            }
            const properties = entry.surface === null
                ? destination
                : previewProperties(entry, destination);
            const settle = () => {
                if (entry.surface !== null) {
                    this._rebasePreview(entry, destination, {
                        ...destination,
                        opacity: visible ? 255 : 0,
                    });
                }
                if (!visible)
                    entry.clone.hide();
            };
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
        const entered = calculateEnteredLayout(this._targets, application, this._workArea, recordBounds, this._measureTitleHeights(), this._themeScale);
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
                    downChevron: transformedActorState(actor._downChevron),
                    upChevron: transformedActorState(actor._upChevron),
                    label: transformedActorState(actor._selectionLabel),
                    outline: actorGeometry(actor._groupOutline),
                });
            } else {
                initialState.targets.set(target, {
                    actor: actorGeometry(actor),
                    icon: actor._directIcon === undefined
                        ? null
                        : transformedActorState(actor._directIcon),
                    label: transformedActorState(actor._selectionLabel),
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
        selected.grab_key_focus();
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
        this._disconnectWindowTitles();
        this._disconnectKeyFocus();
        this._disconnectTheme();
        this._disconnectSourceGeometry();
        for (const {gesture} of this._clickActions)
            gesture.set_enabled(false);
        for (const actor of this._targetActors) {
            if (actor === undefined)
                continue;
            visitActorTree(actor, child => {
                if (child instanceof St.Button)
                    child.fake_release();
                child.reactive = false;
                if (child instanceof St.Widget)
                    child.can_focus = false;
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
                    ? entry.source.get_meta_window().get_buffer_rect()
                    : null,
            }));
        for (const {entry, sourceRect} of exits) {
            if (sourceRect !== null)
                entry.clone.show();
        }
        if (!St.Settings.get().enable_animations) {
            for (const {entry, sourceRect} of exits) {
                if (sourceRect !== null) {
                    this._setActorProperties(
                        entry.clone, {...previewProperties(entry, sourceRect), opacity: 255}, false);
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
        this._disconnectWindowTitles();
        this._disconnectSourceGeometry();
        for (const {actor, gesture, signal, sequenceSignal} of this._clickActions) {
            gesture.disconnect(signal);
            if (sequenceSignal !== 0)
                gesture.disconnect(sequenceSignal);
            actor.remove_action(gesture);
            actor._clickGesture = null;
        }
        this._clickActions = [];
        visitActorTree(this, actor => actor.remove_all_transitions());
        for (const {clone, source, signal} of this._cloneEntries) {
            if (signal !== 0)
                source.disconnect(signal);
        }
        this._cloneEntries = [];
        this._targetActors = [];
        this.destroy_all_children();
        this._backdropActor = null;
    }

    destroy() {
        this._disconnectKeyFocus();
        this._disconnectTheme();
        this._clearActors();
        this._targets = Object.freeze([]);
        this._targetActors = [];
        this._chromeActors = [];
        this._backdropActor = null;
        this._fullLayout = null;
        this._workArea = null;
        this._enteredApplication = null;
        this._exitTargetIndex = null;
        this._entranceTargetIndex = -1;
        this._activateTarget = null;
        this._enterGroupRequested = null;
        this._leaveGroupRequested = null;
        this._pointerMoved = null;
        this._targetFocused = null;
        super.destroy();
    }
});
