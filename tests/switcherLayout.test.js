// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    calculateEnteredLayout,
    calculateFullLayout,
    CHEVRON_SIZE,
    DIRECT_ICON_SIZE,
    ICON_SIZE,
} from '../switcherLayout.js';
import {buildTraversal} from '../windowModel.js';

const EPSILON = 1e-7;
const titleHeights = {window: 32, app: 32};
const MARGIN = 48;
const getBounds = target => target.window;
const aspects = [[1280, 720], [360, 1440], [2560, 320], [640, 480], [900, 900]];

function record(index, application) {
    const [width, height] = aspects[index % aspects.length];
    return {window: {width, height}, application, auxiliarySurfaces: []};
}

function assertContained(rect, area, description) {
    for (const key of ['x', 'y', 'width', 'height'])
        assert.ok(Number.isFinite(rect[key]), `${description}: finite ${key}`);
    assert.ok(rect.width > 0 && rect.height > 0, `${description}: positive dimensions`);
    assert.ok(rect.x >= area.x - EPSILON, `${description}: left edge`);
    assert.ok(rect.y >= area.y - EPSILON, `${description}: top edge`);
    assert.ok(rect.x + rect.width <= area.x + area.width + EPSILON, `${description}: right edge`);
    assert.ok(rect.y + rect.height <= area.y + area.height + EPSILON, `${description}: bottom edge`);
}

function assertLayout(layout, targets, workArea, entered = false, heights = titleHeights, themeScale = 1) {
    const margin = Math.min(MARGIN * themeScale, workArea.width / 8, workArea.height / 8);
    const inset = {
        x: workArea.x + margin,
        y: workArea.y + margin,
        width: workArea.width - 2 * margin,
        height: workArea.height - 2 * margin,
    };
    for (const [index, geometry] of layout.geometries) {
        const target = targets[index];
        const description = `${entered ? 'entered' : 'full'} ${target.kind} ${index}`;
        assertContained(geometry, inset, description);
        const s = geometry.chromeScale;
        const spacingScale = s * themeScale;
        assert.ok(Number.isFinite(s) && s > 0 && s <= 1, `${description}: chrome scale`);
        if (target.kind !== 'app-group') {
            assert.ok(Math.abs(geometry.width / geometry.height - target.window.width / target.window.height) < EPSILON,
                `${description}: preserves aspect ratio`);
            const iconSize = target.kind === 'direct-window'
                ? Math.min(DIRECT_ICON_SIZE * spacingScale, geometry.height / 3, geometry.width)
                : 0;
            if (iconSize > 0) {
                assertContained({
                    x: geometry.x + (geometry.width - iconSize) / 2,
                    y: geometry.y + geometry.height - iconSize / 2,
                    width: iconSize,
                    height: iconSize,
                }, inset, `${description}: direct icon`);
            }
            assertContained({
                x: geometry.x,
                y: geometry.y + geometry.height + 8 * spacingScale + iconSize / 2,
                width: geometry.width,
                height: heights.window * s,
            }, inset, `${description}: title allowance`);
            continue;
        }

        // Check the visible chrome rectangles, not the hidden opposite chevron.
        const downY = geometry.iconY + geometry.iconSize + 8 * spacingScale;
        const chrome = [
            {
                x: geometry.iconX,
                y: geometry.iconY,
                width: geometry.iconSize,
                height: geometry.iconSize,
            },
            {
                x: geometry.iconX + (geometry.iconSize - (CHEVRON_SIZE + 16) * spacingScale) / 2,
                y: entered ? geometry.iconY - (CHEVRON_SIZE + 8) * spacingScale : downY,
                width: (CHEVRON_SIZE + 16) * spacingScale,
                height: (CHEVRON_SIZE + 8) * spacingScale,
            },
            {
                x: 0,
                y: downY + (entered ? 8 : CHEVRON_SIZE + 16) * spacingScale,
                width: geometry.width,
                height: heights.app * s,
            },
        ];
        for (const [chromeIndex, rect] of chrome.entries()) {
            const absolute = {...rect, x: geometry.x + rect.x, y: geometry.y + rect.y};
            assertContained(absolute, geometry, `${description}: chrome ${chromeIndex} within group`);
            assertContained(absolute, inset, `${description}: chrome ${chromeIndex} within monitor`);
        }
        if (entered) {
            assert.equal(geometry.iconSize, ICON_SIZE * spacingScale);
            assert.equal(geometry.previewHeight, 0);
            assert.equal(geometry.previewWidth, 0);
        } else {
            const preview = {
                x: geometry.x + geometry.previewX,
                y: geometry.y,
                width: geometry.previewWidth,
                height: geometry.previewHeight,
            };
            assertContained(preview, geometry, `${description}: preview region`);
            for (const child of layout.groups.find(group => group.index === index).children)
                assertContained(layout.geometries.get(child.index), preview, `${description}: child ${child.index}`);
        }
    }
}

const workAreas = [
    {x: 1920, y: 80, width: 1920, height: 1080},
    {x: -1366, y: 200, width: 1366, height: 448},
    {x: 2200, y: -400, width: 800, height: 304},
    {x: -900, y: -600, width: 320, height: 240},
    {x: 3000, y: 120, width: 96, height: 160},
];

for (const count of [1, 4, 5, 30, 100]) {
    for (const mode of ['direct', 'one group', 'many groups', 'mixed with unassociated']) {
        for (const {workArea, themeScale} of workAreas.flatMap(workArea => [1, 2].map(themeScale => ({workArea, themeScale})))) {
            test(`${mode}, ${count} records, ${workArea.width}x${workArea.height} at ${workArea.x},${workArea.y}, scale ${themeScale}`, () => {
                const heights = {window: titleHeights.window * themeScale, app: titleHeights.app * themeScale};
                const application = {};
                const records = Array.from({length: count}, (_, index) =>
                    record(index, mode === 'many groups' ? {} : application));
                if (mode === 'mixed with unassociated')
                    records.push(...Array.from({length: 5}, (_, index) => record(index, null)));
                const recentLimit = mode === 'direct' ? count : mode === 'mixed with unassociated' ? 4 : 0;
                const targets = buildTraversal(records, recentLimit);
                const full = calculateFullLayout(targets, workArea, getBounds, heights, themeScale);
                assert.equal(full.geometries.size, targets.length);
                assert.deepEqual([...full.geometries.keys()].sort((a, b) => a - b), targets.map((_, index) => index));
                assertLayout(full, targets, workArea, false, heights, themeScale);
                if (mode === 'mixed with unassociated') {
                    const unassociated = targets.filter(target => target.application === null);
                    assert.equal(unassociated.length, 5);
                    assert.ok(unassociated.every(target => target.kind === 'direct-window'));
                }
                for (const group of full.groups) {
                    const entered = calculateEnteredLayout(targets, group.target.application, workArea, getBounds, heights, themeScale);
                    assert.notEqual(entered, null);
                    assert.equal(entered.groupIndex, group.index);
                    assert.deepEqual([...entered.geometries.keys()].sort((a, b) => a - b),
                        [group.index, ...group.children.map(child => child.index)].sort((a, b) => a - b));
                    assertLayout(entered, targets, workArea, true, heights, themeScale);
                }
            });
        }
    }
}

test('canonical mixed layout keeps full-sized chrome on a 1920x1080 monitor', () => {
    const application = {};
    const targets = buildTraversal(Array.from({length: 5}, (_, index) => record(index, application)), 4);
    const workArea = workAreas[0];
    const full = calculateFullLayout(targets, workArea, getBounds, titleHeights);
    const entered = calculateEnteredLayout(targets, application, workArea, getBounds, titleHeights);
    assert.equal(full.groups.length, 1);
    assert.notEqual(entered, null);
    for (const layout of [full, entered]) {
        for (const geometry of layout.geometries.values())
            assert.equal(geometry.chromeScale, 1);
    }
    assertLayout(full, targets, workArea);
    assertLayout(entered, targets, workArea, true);
});

test('doubling theme, measured titles, bounds and work area doubles positions without changing shrink factors', () => {
    const application = {};
    const targets = buildTraversal(Array.from({length: 8}, (_, index) => record(index, application)), 4);
    const area = workAreas[0];
    const double = rect => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, value * 2]));
    for (const entered of [false, true]) {
        const calculate = (...args) => entered
            ? calculateEnteredLayout(targets, application, ...args)
            : calculateFullLayout(targets, ...args);
        const normal = calculate(area, getBounds, titleHeights);
        const hidpi = calculate(double(area), target => double(getBounds(target)), double(titleHeights), 2);
        for (const [index, geometry] of normal.geometries) {
            const scaled = hidpi.geometries.get(index);
            for (const [key, value] of Object.entries(geometry)) {
                const expected = key === 'chromeScale' ? value : value * 2;
                assert.ok(Math.abs(scaled[key] - expected) < EPSILON, `${entered}, target ${index}, ${key}`);
            }
        }
        assertLayout(hidpi, targets.map(target => target.window ? {...target, window: double(target.window)} : target),
            double(area), entered, double(titleHeights), 2);
    }
});

test('empty traversal and absent application groups have no layout', () => {
    const empty = buildTraversal([], 4);
    assert.deepEqual(calculateFullLayout(empty, workAreas[0], getBounds, titleHeights), {geometries: new Map(), groups: []});
    assert.equal(calculateEnteredLayout(empty, {}, workAreas[0], getBounds, titleHeights), null);
    const application = {};
    const direct = buildTraversal([record(0, application)], 4);
    assert.equal(calculateEnteredLayout(direct, application, workAreas[0], getBounds, titleHeights), null);
    const grouped = buildTraversal([record(0, application)], 0);
    assert.equal(calculateEnteredLayout(grouped, {}, workAreas[0], getBounds, titleHeights), null);
});

for (const heights of [{window: 96, app: 128}, {window: 320, app: 32}, {window: 32, app: 320}]) {
    for (const workArea of workAreas) {
        test(`styled titles ${heights.window}/${heights.app} fit rows at ${workArea.width}x${workArea.height}`, () => {
            const application = {};
            const targets = buildTraversal(Array.from({length: 8}, (_, index) => record(index, application)), 4);
            const full = calculateFullLayout(targets, workArea, getBounds, heights);
            const entered = calculateEnteredLayout(targets, application, workArea, getBounds, heights);
            assertLayout(full, targets, workArea, false, heights);
            assertLayout(entered, targets, workArea, true, heights);
            for (const [layout, kind] of [[full, 'direct-window'], [entered, 'grouped-window']]) {
                const indices = targets.flatMap((target, index) => target.kind === kind ? [index] : []);
                const split = Math.ceil(indices.length / 2);
                const nextRowTop = Math.min(...indices.slice(split).map(index => layout.geometries.get(index).y));
                for (const index of indices.slice(0, split)) {
                    const geometry = layout.geometries.get(index);
                    const s = geometry.chromeScale;
                    const icon = kind === 'direct-window' ? Math.min(DIRECT_ICON_SIZE * s, geometry.height / 3) / 2 : 0;
                    const titleBottom = geometry.y + geometry.height + icon + (8 + heights.window) * s;
                    assert.ok(titleBottom <= nextRowTop + EPSILON, 'styled title must not overlap the next preview row');
                }
            }
        });
    }
}
