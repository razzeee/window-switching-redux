// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

const GROUP_OVERLAP = 0.15;
const GAP = 24;
const MARGIN = 48;
export const ICON_SIZE = 120;
export const DIRECT_ICON_SIZE = 48;
export const CHEVRON_SIZE = 24;
const REGION_GAP = 64;
const GROUP_PREVIEW_SCALE = 0.58;
const GROUP_VERTICAL_OFFSET = 0.12;
const MIN_GROUP_ICON_SIZE = 88;
const MAX_PREVIEW_SCALE = 0.7;

export function calculateGroupHorizontalLayout(widths, iconSize) {
    const offsets = [];
    let x = 0;
    let previousWidth = 0;

    for (const width of widths) {
        if (previousWidth > 0)
            x -= Math.min(previousWidth, width) * GROUP_OVERLAP;
        offsets.push(x);
        x += width;
        previousWidth = width;
    }

    const previewWidth = x;
    const width = Math.max(previewWidth, iconSize);
    const previewX = (width - previewWidth) / 2;
    return {
        offsets,
        width,
        previewWidth,
        previewX,
        iconX: (width - iconSize) / 2,
    };
}

function insetWorkArea(area, themeScale) {
    const margin = Math.min(MARGIN * themeScale, area.width / 8, area.height / 8);
    return {
        x: area.x + margin,
        y: area.y + margin,
        width: area.width - margin * 2,
        height: area.height - margin * 2,
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

function rowSize(row, sizes, themeScale) {
    return {
        width: row.reduce((sum, {index}) => sum + sizes.get(index).width, 0) +
            Math.max(0, row.length - 1) * GAP * themeScale,
        height: Math.max(0, ...row.map(({index}) => sizes.get(index).height)),
    };
}

function placeGalleryRows(rows, rowSizes, sizes, area, y, scale, rowClearance, chromeScale, themeScale) {
    const geometries = new Map();
    const scaledGap = GAP * themeScale * scale;

    rows.forEach((row, rowIndex) => {
        const rowWidth = rowSizes[rowIndex].width * scale;
        const rowHeight = rowSizes[rowIndex].height * scale;
        let x = area.x + (area.width - rowWidth) / 2;
        for (const {index} of row) {
            const size = sizes.get(index);
            const width = size.width * scale;
            const height = size.height * scale;
            geometries.set(index, {x, y: y + (rowHeight - height) / 2, width, height, chromeScale});
            x += width + scaledGap;
        }
        y += rowHeight + rowClearance;
        if (rowIndex < rows.length - 1)
            y += scaledGap;
    });

    return {geometries, bottom: y};
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

export function calculateFullLayout(targets, workArea, getBounds, titleHeights, themeScale = 1) {
    // Label measurements already include theme and text scaling.
    const directTitleClearance = (DIRECT_ICON_SIZE / 2 + 16) * themeScale + titleHeights.window;
    const groupChromeHeight = Math.max(
        (16 + MIN_GROUP_ICON_SIZE + CHEVRON_SIZE + 16) * themeScale + titleHeights.app,
        8 * themeScale + titleHeights.window);
    const area = insetWorkArea(workArea, themeScale);
    const sizes = new Map();
    const directTargets = [];
    const groups = [];

    targets.forEach((target, index) => {
        if (target.kind === 'direct-window') {
            sizes.set(index, getBounds(target));
            directTargets.push({target, index});
        } else if (target.kind === 'app-group') {
            groups.push({target, index, children: []});
        }
    });
    targets.forEach((target, index) => {
        if (target.kind !== 'grouped-window')
            return;
        const bounds = getBounds(target);
        sizes.set(index, {
            width: bounds.width * GROUP_PREVIEW_SCALE,
            height: bounds.height * GROUP_PREVIEW_SCALE,
        });
        groups.find(group => group.target.application === target.application)
            .children.push({target, index});
    });

    const rows = balancedRows(directTargets);
    const rowSizes = rows.map(row => rowSize(row, sizes, themeScale));
    const groupSizes = groups.map(group => groupSize(group, sizes));
    const hasGroups = groups.length > 0;
    const naturalRegionGap = directTargets.length > 0 && hasGroups ? REGION_GAP * themeScale : 0;
    const naturalChromeHeight = rows.length * directTitleClearance +
        (hasGroups ? groupChromeHeight : 0) + naturalRegionGap;
    // Reserve at least half the available height and group-row width for previews.
    const chromeScale = Math.min(
        1,
        area.height / Math.max(1, naturalChromeHeight * 2),
        area.width / (Math.max(ICON_SIZE, groups.length * MIN_GROUP_ICON_SIZE * 2) * themeScale));
    const regionGap = naturalRegionGap * chromeScale;
    const directChromeClearance = rows.length * directTitleClearance * chromeScale;
    const groupChromeClearance = hasGroups ? groupChromeHeight * chromeScale : 0;
    const directNaturalWidth = Math.max(0, ...rowSizes.map(size => size.width));
    const directNaturalHeight = rowSizes.reduce((sum, size) => sum + size.height, 0) +
        Math.max(0, rows.length - 1) * GAP * themeScale;
    const groupsNaturalHeight = Math.max(0, ...groupSizes.map(size => size.height));
    const naturalHeight = directNaturalHeight + groupsNaturalHeight;
    let scale = Math.min(
        MAX_PREVIEW_SCALE,
        area.width / Math.max(1, directNaturalWidth),
        (area.height - directChromeClearance - groupChromeClearance - regionGap) /
            Math.max(1, naturalHeight));
    const groupIconSize = MIN_GROUP_ICON_SIZE * themeScale * chromeScale;
    const groupHorizontalLayout = (group, candidateScale) =>
        calculateGroupHorizontalLayout(
            group.children.map(({index}) => sizes.get(index).width * candidateScale),
            groupIconSize);
    const scaledGroupsWidth = candidateScale =>
        groups.reduce((sum, group) =>
            sum + groupHorizontalLayout(group, candidateScale).width, 0) +
        Math.max(0, groups.length - 1) * GAP * themeScale * candidateScale;
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
        rows, rowSizes, sizes, area, y, scale, directTitleClearance * chromeScale, chromeScale, themeScale);
    const geometries = directLayout.geometries;

    y = directLayout.bottom + regionGap;
    const scaledGap = GAP * themeScale * scale;
    const groupHorizontalLayouts = groups.map(group => groupHorizontalLayout(group, scale));
    const groupWidths = groupHorizontalLayouts.map(layout => layout.width);
    const groupsWidth = groupWidths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, groups.length - 1) * scaledGap;
    let groupX = area.x + (area.width - groupsWidth) / 2;
    groups.forEach((group, groupIndex) => {
        const size = groupSizes[groupIndex];
        const horizontalLayout = groupHorizontalLayouts[groupIndex];
        const {previewWidth, previewX, width} = horizontalLayout;
        const previewHeight = size.height * scale;
        group.children.forEach(({index}, childIndex) => {
            const childSize = sizes.get(index);
            const childWidth = childSize.width * scale;
            const childHeight = childSize.height * scale;
            geometries.set(index, {
                x: groupX + previewX + horizontalLayout.offsets[childIndex],
                y: y + childIndex * childHeight * GROUP_VERTICAL_OFFSET,
                width: childWidth,
                height: childHeight,
                chromeScale,
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
            iconSize: groupIconSize,
            iconX: horizontalLayout.iconX,
            iconY: previewHeight + 8 * themeScale * chromeScale,
            chromeScale,
        });
        groupX += width + scaledGap;
    });

    return {geometries, groups};
}

export function calculateEnteredLayout(targets, application, workArea, getBounds, titleHeights, themeScale = 1) {
    const windowTitleClearance = titleHeights.window + 16 * themeScale;
    const groupChromeHeight = (CHEVRON_SIZE + 16 + ICON_SIZE + 16) * themeScale + titleHeights.app;
    const area = insetWorkArea(workArea, themeScale);
    const items = [];
    const sizes = new Map();
    let groupIndex = -1;

    targets.forEach((target, index) => {
        if (target.kind === 'app-group' && target.application === application)
            groupIndex = index;
        if (target.kind === 'grouped-window' && target.application === application) {
            items.push({target, index});
            sizes.set(index, getBounds(target));
        }
    });
    if (groupIndex === -1 || items.length === 0)
        return null;

    const rows = balancedRows(items);
    const rowSizes = rows.map(row => rowSize(row, sizes, themeScale));
    const naturalWidth = Math.max(1, ...rowSizes.map(size => size.width));
    const naturalHeight = rowSizes.reduce((sum, size) => sum + size.height, 0) +
        Math.max(0, rows.length - 1) * GAP * themeScale;
    const naturalChromeHeight = rows.length * windowTitleClearance + groupChromeHeight;
    const chromeScale = Math.min(1, area.height / (naturalChromeHeight * 2), area.width / (ICON_SIZE * themeScale));
    const chromeHeight = naturalChromeHeight * chromeScale;
    const scale = Math.min(
        MAX_PREVIEW_SCALE,
        area.width / naturalWidth,
        (area.height - chromeHeight) / Math.max(1, naturalHeight));
    const galleryHeight = naturalHeight * scale;
    const contentHeight = galleryHeight + chromeHeight;
    const y = area.y + (area.height - contentHeight) / 2;
    const layout = placeGalleryRows(
        rows, rowSizes, sizes, area, y, scale, windowTitleClearance * chromeScale, chromeScale, themeScale);
    const iconSize = ICON_SIZE * themeScale * chromeScale;
    const groupWidth = Math.max(iconSize, Math.min(area.width, naturalWidth * scale));

    layout.geometries.set(groupIndex, {
        x: area.x + (area.width - groupWidth) / 2,
        y: layout.bottom,
        width: groupWidth,
        height: groupChromeHeight * chromeScale,
        previewHeight: 0,
        previewWidth: 0,
        previewX: 0,
        iconSize,
        iconX: (groupWidth - iconSize) / 2,
        iconY: (CHEVRON_SIZE + 16) * themeScale * chromeScale,
        chromeScale,
    });
    return {geometries: layout.geometries, groupIndex};
}
