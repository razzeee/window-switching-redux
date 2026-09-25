// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

export const ICON_SIZE = 64;
export const DIRECT_ICON_SIZE = ICON_SIZE;
export const CHEVRON_SIZE = 24;
const GAP = 32;
const MARGIN = 48;

function inset(area, horizontal, vertical = horizontal) {
    return {x: area.x + horizontal, y: area.y + vertical,
        width: Math.max(1, area.width - horizontal * 2), height: Math.max(1, area.height - vertical * 2)};
}

function grid(indices, area, clearance, themeScale) {
    const cells = new Map();
    if (indices.length === 0)
        return cells;
    const gap = Math.min(GAP * themeScale, area.width / (indices.length * 2), area.height / (indices.length * 2));
    let best = null;
    for (let columns = 1; columns <= indices.length; columns++) {
        const rows = Math.ceil(indices.length / columns);
        const width = Math.max(1, (area.width - (columns - 1) * gap) / columns);
        const height = Math.max(1, (area.height - (rows - 1) * gap) / rows);
        const previewHeight = Math.max(1, height - clearance);
        const score = Math.min(width, previewHeight * 1.4);
        if (best === null || score > best.score)
            best = {columns, rows, width, height, score};
    }
    const width = Math.min(best.width, 360 * themeScale);
    const height = Math.min(best.height, width / 1.4 + clearance);
    const top = area.y + (area.height - best.rows * height - (best.rows - 1) * gap) / 2;
    indices.forEach((index, position) => {
        const row = Math.floor(position / best.columns);
        const column = position % best.columns;
        const count = Math.min(best.columns, indices.length - row * best.columns);
        cells.set(index, {
            x: area.x + (area.width - count * width - (count - 1) * gap) / 2 + column * (width + gap),
            y: top + row * (height + gap), width, height,
        });
    });
    return cells;
}

function fit(bounds, cell, clearance, themeScale, stack = false) {
    const padding = stack ? Math.min(12 * themeScale, cell.width * 0.1, cell.height * 0.1) : 0;
    const availableWidth = Math.max(1, cell.width - padding * 2);
    const availableHeight = Math.max(1, cell.height - clearance - padding * 2);
    const scale = Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height));
    const width = Math.max(1, bounds.width) * scale;
    const height = Math.max(1, bounds.height) * scale;
    return {
        x: cell.x + (cell.width - width) / 2,
        y: cell.y + padding + (availableHeight - height) / 2,
        width, height, chromeScale: 1, iconSize: ICON_SIZE * themeScale, rotation: 0,
    };
}

function groupChrome(cell, previewHeight, themeScale, titleHeight, entered = false) {
    const iconSize = ICON_SIZE * themeScale;
    const iconY = entered ? (CHEVRON_SIZE + 8) * themeScale : previewHeight - iconSize / 2;
    return {
        x: cell.x, y: cell.y, width: cell.width,
        height: iconY + iconSize + (entered ? 16 : CHEVRON_SIZE + 24) * themeScale + titleHeight,
        previewHeight, previewWidth: entered ? 0 : cell.width, previewX: 0,
        iconSize, iconX: (cell.width - iconSize) / 2, iconY, chromeScale: 1, rotation: 0,
    };
}

export function calculateFullLayout(targets, workArea, getBounds, titleHeights, themeScale = 1) {
    const area = inset(workArea, Math.min(MARGIN * themeScale, workArea.width / 8, workArea.height / 8));
    const clearance = (ICON_SIZE / 2 + CHEVRON_SIZE + 24) * themeScale + Math.max(titleHeights.app, titleHeights.window);
    const topLevel = targets.flatMap((target, index) => target.kind === 'grouped-window' ? [] : [index]);
    const cells = grid(topLevel, area, clearance, themeScale);
    const geometries = new Map();
    const groups = [];
    for (const index of topLevel) {
        const target = targets[index];
        const cell = cells.get(index);
        if (target.kind === 'direct-window') {
            geometries.set(index, fit(getBounds(target), cell, clearance, themeScale));
            continue;
        }
        const children = targets.flatMap((child, childIndex) =>
            child.kind === 'grouped-window' && child.application === target.application ? [{target: child, index: childIndex}] : []);
        const previewHeight = Math.max(1, cell.height - clearance);
        geometries.set(index, groupChrome(cell, previewHeight, themeScale, titleHeights.app));
        children.forEach((child, depth) => {
            const geometry = fit(getBounds(child.target), cell, clearance, themeScale, true);
            const offset = Math.min(10 * themeScale, cell.width * 0.03, previewHeight * 0.03);
            const slot = depth === 0 ? 0 : 1 + (depth - 1) % 4;
            geometry.x += slot % 2 ? -offset : slot === 0 ? 0 : offset;
            geometry.y += slot === 0 ? 0 : offset;
            geometry.rotation = slot === 0 ? 0 : slot % 2 ? -3 : 3;
            geometries.set(child.index, geometry);
        });
        groups.push({target, index, children});
    }
    return {geometries, groups, cells};
}

export function calculateEnteredLayout(targets, application, workArea, getBounds, titleHeights, themeScale = 1) {
    const groupIndex = targets.findIndex(target => target.kind === 'app-group' && target.application === application);
    if (groupIndex < 0)
        return null;
    const area = inset(workArea, workArea.width * 0.16, Math.min(MARGIN * themeScale, workArea.height / 8));
    const footerHeight = (ICON_SIZE + CHEVRON_SIZE + 24) * themeScale + titleHeights.app;
    const gallery = {...area, height: Math.max(1, area.height - footerHeight)};
    const indices = targets.flatMap((target, index) =>
        target.kind === 'grouped-window' && target.application === application ? [index] : []);
    const clearance = 16 * themeScale + titleHeights.window;
    const cells = grid(indices, gallery, clearance, themeScale);
    const geometries = new Map(indices.map(index => [index, fit(getBounds(targets[index]), cells.get(index), clearance, themeScale)]));
    geometries.set(groupIndex, groupChrome({x: area.x, y: gallery.y + gallery.height, width: area.width}, 0, themeScale, titleHeights.app, true));
    return {geometries, groupIndex, area, cells};
}

export function calculateEdgeLayout(targets, full, groupIndex, workArea) {
    const geometries = new Map();
    const indices = [...full.cells.keys()].filter(index => index !== groupIndex);
    for (const left of [true, false]) {
        const side = indices.filter(index => (index < groupIndex) === left);
        side.forEach((index, position) => {
            const cell = full.cells.get(index);
            const group = full.groups.find(candidate => candidate.index === index);
            const previews = group === undefined ? [full.geometries.get(index)]
                : group.children.map(child => full.geometries.get(child.index));
            const start = Math.min(...previews.map(geometry => geometry.x));
            const end = Math.max(...previews.map(geometry => geometry.x + geometry.width));
            const reveal = Math.min((end - start) * 0.45, workArea.width * (0.07 + 0.04 * (position + 1) / side.length));
            const dx = left ? workArea.x + reveal - end : workArea.x + workArea.width - reveal - start;
            const y = workArea.y + (workArea.height - cell.height) / 2 +
                (position - (side.length - 1) / 2) * Math.min(36, workArea.height * 0.4 / side.length);
            for (const member of [index, ...(group?.children.map(child => child.index) ?? [])]) {
                const geometry = full.geometries.get(member);
                geometries.set(member, {...geometry, x: geometry.x + dx, y: geometry.y + y - cell.y});
            }
        });
    }
    return geometries;
}
