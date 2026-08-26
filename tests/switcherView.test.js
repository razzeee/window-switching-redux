// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {calculateGroupHorizontalLayout} from '../switcherLayout.js';

const viewSource = readFileSync(new URL('../switcherView.js', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('../switcherSession.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../stylesheet.css', import.meta.url), 'utf8');

test('group overlap leaves a smaller older preview visible and reactive', () => {
    const widths = [1200, 300];
    const layout = calculateGroupHorizontalLayout(widths, 88);
    const newerRight = layout.previewX + layout.offsets[0] + widths[0];
    const olderLeft = layout.previewX + layout.offsets[1];
    const olderRight = olderLeft + widths[1];
    const overlap = newerRight - olderLeft;

    assert.ok(olderRight > newerRight, 'the older preview is fully covered by the newer target');
    assert.ok(overlap >= widths[1] * 0.12);
    assert.ok(overlap <= widths[1] * 0.18);
});

test('group app icon stays inside its activation region', () => {
    const iconSize = 88;
    const layout = calculateGroupHorizontalLayout([40, 400], iconSize);

    assert.ok(layout.iconX >= 0);
    assert.ok(layout.iconX + iconSize <= layout.width);
});

test('group app icon is centered beneath the complete group', () => {
    const iconSize = 88;
    const layout = calculateGroupHorizontalLayout([500, 300], iconSize);

    assert.equal(layout.iconX, (layout.width - iconSize) / 2);
});

test('group transitions fade selected titles without replacing their geometry transition', () => {
    const lateOpacity = viewSource.match(
        /\n    _setLateOpacity\([\s\S]*?\n    _setHiddenPreviewProperties/,
    )?.[0];
    const enterGroup = viewSource.match(
        /\n    enterGroup\([\s\S]*?\n    leaveGroup/,
    )?.[0];
    const setSelection = viewSource.match(
        /\n    setSelection\([\s\S]*?\n    setExitTarget/,
    )?.[0];

    assert.ok(lateOpacity, 'could not locate _setLateOpacity()');
    assert.match(lateOpacity, /remove_transition\('opacity'\)/);
    assert.doesNotMatch(lateOpacity, /remove_all_transitions/);
    assert.ok(enterGroup, 'could not locate enterGroup()');
    assert.match(enterGroup, /label\.opacity = 0/);
    assert.ok(setSelection, 'could not locate setSelection()');
    assert.match(setSelection, /remove_transition\('opacity'\)/);
    assert.match(setSelection, /get_transition\(property\) !== null/);
    assert.match(setSelection, /\[selected, selected\._selectionLabel\]/);
    assert.doesNotMatch(setSelection, /_selectionLabel\.opacity === 0/);
    assert.match(setSelection, /target\.kind === 'app-group'/);
    assert.match(setSelection, /isGroupTransitionTitle && geometryIsMoving/);
    assert.match(setSelection, /this\._enteredApplication !== null/);
    assert.match(setSelection, /_setLateOpacity\([\s\S]*?selected\._selectionLabel/);
});

test('target exhaustion finishes the switching session synchronously', () => {
    const removeWindow = sessionSource.match(
        /\n    _removeWindow\(window\) \{[\s\S]*?\n    _activationWindow/,
    )?.[0];

    assert.ok(removeWindow, 'could not locate _removeWindow()');
    assert.match(
        removeWindow,
        /if \(this\._targets\.length === 0\) \{\s*this\._finish\(false, true\);/,
    );
});

test('direct recent-window targets expose an accent outline on hover', () => {
    const createWindowTarget = viewSource.match(
        /_createWindowTarget\([\s\S]*?\n    _positionDirectIcon/,
    )?.[0];

    assert.ok(createWindowTarget, 'could not locate _createWindowTarget()');
    assert.match(createWindowTarget, /switcher-target switcher-direct-target/);
    assert.match(createWindowTarget, /track_hover:\s*true/);
    assert.match(
        stylesheet,
        /\.switcher-direct-target:hover[\s\S]*?border-color:\s*-st-accent-color/,
    );
});
