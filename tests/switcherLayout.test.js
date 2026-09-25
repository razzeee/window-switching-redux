// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateFullLayout, calculateEnteredLayout, calculateEdgeLayout} from '../switcherLayout.js';
import {buildTraversal, getTopLevelIndices} from '../windowModel.js';

const area = {x: 100, y: 40, width: 1440, height: 856};
const titles = {window: 32, app: 32};
const bounds = target => target.window;
const app = {};
const other = {};
const record = (application = app, width = 800, height = 600) => ({window: {width, height}, application, auxiliarySurfaces: []});
const mixed = () => buildTraversal([
    record(), record(), record(), record(), record(app), record(app), record(other), record(other),
], 4);

function contained(rect, container) {
    assert.ok(rect.width > 0 && rect.height > 0);
    assert.ok(rect.x >= container.x - 1e-6 && rect.y >= container.y - 1e-6);
    assert.ok(rect.x + rect.width <= container.x + container.width + 1e-6);
    assert.ok(rect.y + rect.height <= container.y + container.height + 1e-6);
}

test('four recent windows and two groups share the mockup three-by-two grid', () => {
    const targets = mixed();
    const full = calculateFullLayout(targets, area, bounds, titles);
    const cells = getTopLevelIndices(targets).map(index => full.cells.get(index));
    assert.equal(cells[0].y, cells[2].y);
    assert.equal(cells[3].y, cells[5].y);
    assert.ok(cells[3].y > cells[0].y);
    assert.equal(cells[0].x, cells[3].x);
    assert.equal(cells[1].x, cells[4].x);
    assert.equal(cells[2].x, cells[5].x);
    for (const cell of cells) {
        contained(cell, area);
        assert.equal(cell.width, cells[0].width);
        assert.equal(cell.height, cells[0].height);
    }
});

test('small source windows upscale independently while icons keep their logical size', () => {
    const targets = buildTraversal([record(app, 80, 60), record(app, 1600, 1200)], 4);
    const full = calculateFullLayout(targets, area, bounds, titles);
    const [small, large] = [full.geometries.get(0), full.geometries.get(1)];
    assert.ok(small.width > 80);
    assert.equal(small.width, large.width);
    assert.equal(small.height, large.height);
    assert.equal(small.iconSize, 64);
    assert.equal(large.iconSize, 64);
});

test('stack footprint is independent of its window count and every member preserves aspect', () => {
    let footprint;
    for (const count of [1, 3, 30]) {
        const targets = buildTraversal(Array.from({length: count}, (_, i) => record(app, i % 2 ? 400 : 800, 600)), 0);
        const full = calculateFullLayout(targets, area, bounds, titles);
        const group = full.geometries.get(0);
        const size = [group.width, group.height];
        if (footprint)
            assert.deepEqual(size, footprint);
        footprint = size;
        for (const {index} of full.groups[0].children) {
            const preview = full.geometries.get(index);
            assert.ok(Math.abs(preview.width / preview.height - targets[index].window.width / 600) < 1e-6);
            contained(preview, full.cells.get(0));
            assert.ok(Math.abs(preview.rotation) <= 4);
        }
        assert.equal(full.geometries.get(1).rotation, 0);
        assert.equal(group.iconSize, 64);
    }
});

test('entering a group reserves edge context on both sides and keeps it out of the center', () => {
    const targets = mixed();
    const full = calculateFullLayout(targets, area, bounds, titles);
    const entered = calculateEnteredLayout(targets, app, area, bounds, titles);
    const edges = calculateEdgeLayout(targets, full, entered.groupIndex, area);
    assert.equal(edges.size, targets.length - 3);
    for (const [index, geometry] of edges) {
        const left = index < entered.groupIndex;
        if (left) {
            assert.ok(geometry.x < area.x);
            assert.ok(geometry.x + geometry.width > area.x);
            assert.ok(geometry.x + geometry.width < entered.area.x);
        } else {
            assert.ok(geometry.x < area.x + area.width);
            assert.ok(geometry.x > entered.area.x + entered.area.width);
        }
    }
    for (const geometry of entered.geometries.values())
        contained(geometry, entered.area);
});

for (const scale of [1, 2]) {
    for (const count of [1, 4, 6, 30]) {
        test(`${count} windows retain positive aspect-preserving previews at scale ${scale}`, () => {
            const targets = buildTraversal(Array.from({length: count}, (_, i) => record(null, i % 2 ? 300 : 1200, 600)), 4);
            const workArea = {x: -1920, y: 100, width: 1920 * scale, height: 1080 * scale};
            const full = calculateFullLayout(targets, workArea, bounds, {window: 32 * scale, app: 32 * scale}, scale);
            for (const [index, geometry] of full.geometries) {
                contained(geometry, workArea);
                assert.ok(Math.abs(geometry.width / geometry.height - targets[index].window.width / 600) < 1e-6);
                assert.equal(geometry.iconSize, 64 * scale);
            }
        });
    }
}

test('empty traversal and absent groups have no presentation', () => {
    assert.equal(calculateFullLayout([], area, bounds, titles).geometries.size, 0);
    assert.equal(calculateEnteredLayout([], app, area, bounds, titles), null);
});
