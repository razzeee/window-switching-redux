// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildTraversal,
    getGroupIndices,
    getInitialSelection,
    getScopedRemovalSelection,
    getTopLevelIndices,
    moveInScope,
    moveSelection,
    removeWindowFromTraversal,
} from '../windowModel.js';

const windows = Object.fromEntries(
    ['F1', 'T1', 'F2', 'B1', 'T2', 'F3', 'U1'].map(name => [name, {name}]));
const apps = Object.fromEntries(
    ['Files', 'Text Editor', 'Browser'].map(name => [name, {name}]));

function record(windowName, appName = null) {
    return {
        window: windows[windowName],
        auxiliarySurfaces: Object.freeze([]),
        application: appName === null ? null : apps[appName],
    };
}

function labels(targets) {
    return targets.map(target => {
        if (target.kind === 'app-group')
            return `${target.application.name} group`;

        return `${target.window.name} ${target.kind === 'direct-window' ? 'direct' : 'grouped'}`;
    });
}

test('zero windows returns no targets', () => {
    assert.deepEqual(buildTraversal([], 4), []);
});

test('one through four windows return only direct targets', () => {
    const records = [record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'), record('B1', 'Browser')];

    for (let count = 1; count <= 4; count++)
        assert.deepEqual(labels(buildTraversal(records.slice(0, count), 4)), records.slice(0, count).map(({window}) => `${window.name} direct`));
});

test('canonical mixed traversal has the exact target sequence', () => {
    const targets = buildTraversal([
        record('F1', 'Files'),
        record('T1', 'Text Editor'),
        record('F2', 'Files'),
        record('B1', 'Browser'),
        record('T2', 'Text Editor'),
        record('F3', 'Files'),
    ], 4);

    assert.deepEqual(labels(targets), [
        'F1 direct', 'T1 direct', 'F2 direct', 'B1 direct',
        'Files group', 'F1 grouped', 'F2 grouped', 'F3 grouped',
        'Text Editor group', 'T1 grouped', 'T2 grouped',
    ]);
});

test('top-level navigation excludes grouped windows', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'),
        record('B1', 'Browser'), record('T2', 'Text Editor'), record('F3', 'Files'),
    ], 4);

    assert.deepEqual(getTopLevelIndices(targets).map(index => labels([targets[index]])[0]), [
        'F1 direct', 'T1 direct', 'F2 direct', 'B1 direct',
        'Files group', 'Text Editor group',
    ]);
});

test('group navigation contains only app-local grouped windows', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'),
        record('B1', 'Browser'), record('T2', 'Text Editor'), record('F3', 'Files'),
    ], 4);

    assert.deepEqual(getGroupIndices(targets, apps.Files).map(index => labels([targets[index]])[0]), [
        'F1 grouped', 'F2 grouped', 'F3 grouped',
    ]);
});

test('scoped movement wraps within the provided target indices', () => {
    const scope = Object.freeze([4, 7, 10]);

    assert.equal(moveInScope(4, 1, scope), 7);
    assert.equal(moveInScope(10, 1, scope), 4);
    assert.equal(moveInScope(4, -1, scope), 10);
});

test('scoped removal skips grouped representations at top level', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'),
        record('B1', 'Browser'), record('T2', 'Text Editor'), record('F3', 'Files'),
    ], 4);
    const removedIndex = targets.findIndex(target =>
        target.kind === 'direct-window' && target.window === windows.B1);
    const result = removeWindowFromTraversal(targets, removedIndex, windows.B1, 1);
    const selectedIndex = getScopedRemovalSelection(
        targets,
        result.targets,
        removedIndex,
        1,
        getTopLevelIndices(targets),
        getTopLevelIndices(result.targets));

    assert.equal(result.targets[selectedIndex].kind, 'app-group');
    assert.equal(result.targets[selectedIndex].application, apps.Files);
});

test('scoped removal advances within an entered group', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'),
        record('B1', 'Browser'), record('T2', 'Text Editor'), record('F3', 'Files'),
    ], 4);
    const removedIndex = targets.findIndex(target =>
        target.kind === 'grouped-window' && target.window === windows.F2);
    const result = removeWindowFromTraversal(targets, removedIndex, windows.F2, 1);
    const selectedIndex = getScopedRemovalSelection(
        targets,
        result.targets,
        removedIndex,
        1,
        getGroupIndices(targets, apps.Files),
        getGroupIndices(result.targets, apps.Files));

    assert.equal(result.targets[selectedIndex].window, windows.F3);
});

test('reverse invocation starts at the final top-level target', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'),
        record('B1', 'Browser'), record('T2', 'Text Editor'), record('F3', 'Files'),
    ], 4);

    const selectedIndex = getInitialSelection(targets, windows.F1, -1);
    assert.equal(targets[selectedIndex].kind, 'app-group');
    assert.equal(targets[selectedIndex].application, apps['Text Editor']);
});

test('a recent single-window application receives no app group', () => {
    const targets = buildTraversal([
        record('B1', 'Browser'), record('F1', 'Files'), record('F2', 'Files'), record('F3', 'Files'), record('T1', 'Text Editor'),
    ], 4);

    assert.equal(targets.some(target => target.kind === 'app-group' && target.application === apps.Browser), false);
});

test('an older single-window application remains reachable through its app group', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'),
        record('B1', 'Files'), record('U1', 'Browser'),
    ], 4);

    assert.deepEqual(labels(targets).slice(-2), [
        'Browser group',
        'U1 grouped',
    ]);
});

test('recent windows reappear in eligible application groups', () => {
    const targets = buildTraversal([record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'), record('B1', 'Browser'), record('F3', 'Files')], 4);

    assert.equal(labels(targets).filter(label => label.startsWith('F1 ')).length, 2);
    assert.equal(labels(targets).filter(label => label.startsWith('F2 ')).length, 2);
});

test('unassociated windows stay direct and never form a group', () => {
    const targets = buildTraversal([record('U1'), record('F1', 'Files'), record('T1', 'Text Editor'), record('B1', 'Browser'), record('F2', 'Files')], 4);

    assert.equal(labels(targets)[0], 'U1 direct');
    assert.equal(targets.some(target => target.kind === 'app-group' && target.application === null), false);
});

test('more than four unassociated windows remain direct targets in MRU order', () => {
    const records = Object.keys(windows).map(name => record(name));
    const targets = buildTraversal(records, 4);

    assert.deepEqual(labels(targets), records.map(({window}) => `${window.name} direct`));
    assert.ok(targets.every(target => target.application === null));
    assert.deepEqual(getTopLevelIndices(targets), records.map((_, index) => index));
    assert.equal(targets[getInitialSelection(targets, windows.F1, -1)].window, windows.U1);
});

test('older unassociated windows follow recent direct targets before application groups', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'),
        record('B1', 'Browser'), record('T2'), record('F3', 'Files'), record('U1'),
    ], 4);

    assert.deepEqual(labels(targets), [
        'F1 direct', 'T1 direct', 'F2 direct', 'B1 direct', 'T2 direct', 'U1 direct',
        'Files group', 'F1 grouped', 'F2 grouped', 'F3 grouped',
    ]);
    assert.equal(targets[4].application, null);
    assert.equal(targets[5].application, null);

    for (const [direction, expectedLabel] of [[1, 'Files group'], [-1, 'T2 direct']]) {
        const result = removeWindowFromTraversal(targets, 5, windows.U1, direction);
        const selectedIndex = getScopedRemovalSelection(
            targets, result.targets, 5, direction,
            getTopLevelIndices(targets), getTopLevelIndices(result.targets));
        assert.equal(labels(result.targets)[selectedIndex], expectedLabel);
        assert.equal(result.targets.some(target => target.window === windows.U1), false);
        assert.equal(result.targets.find(target => target.window === windows.T2).application, null);
    }

    const result = removeWindowFromTraversal(targets, 5, windows.F1, 1);
    assert.equal(result.targets[result.selectedIndex].window, windows.U1);
});

test('group order uses each application newest global window', () => {
    const targets = buildTraversal([
        record('F1', 'Files'), record('T1', 'Text Editor'), record('B1', 'Browser'), record('F2', 'Files'), record('T2', 'Text Editor'), record('F3', 'Files'),
    ], 4);

    assert.deepEqual(targets.filter(target => target.kind === 'app-group').map(target => target.application.name), ['Files', 'Text Editor']);
});

test('forward and reverse traversal are exact circular inverses', () => {
    const targets = buildTraversal([record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'), record('B1', 'Browser'), record('F3', 'Files')], 4);

    for (let index = 0; index < targets.length; index++) {
        assert.equal(moveSelection(moveSelection(index, 1, targets.length), -1, targets.length), index);
        assert.equal(moveSelection(moveSelection(index, -1, targets.length), 1, targets.length), index);
    }
});

test('the starting direct target remains reachable after forward wrap', () => {
    const targets = buildTraversal([record('F1', 'Files'), record('T1', 'Text Editor')], 4);
    let selectedIndex = getInitialSelection(targets, windows.F1, 1);

    selectedIndex = moveSelection(selectedIndex, 1, targets.length);
    assert.equal(targets[selectedIndex].window, windows.F1);
});

test('removal selects the next target in each traversal direction', () => {
    const targets = buildTraversal([record('F1', 'Files'), record('T1', 'Text Editor'), record('B1', 'Browser')], 4);

    const forward = removeWindowFromTraversal(targets, 1, windows.T1, 1);
    assert.equal(forward.targets[forward.selectedIndex].window, windows.B1);

    const reverse = removeWindowFromTraversal(targets, 1, windows.T1, -1);
    assert.equal(reverse.targets[reverse.selectedIndex].window, windows.F1);
});

test('removing a duplicated recent window removes both targets and selects one survivor', () => {
    const targets = buildTraversal([record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'), record('B1', 'Browser'), record('F3', 'Files')], 4);
    const groupedF1Index = targets.findIndex(target => target.kind === 'grouped-window' && target.window === windows.F1);
    const result = removeWindowFromTraversal(targets, groupedF1Index, windows.F1, 1);

    assert.equal(result.targets.some(target => target.window === windows.F1), false);
    assert.equal(result.targets[result.selectedIndex].window, windows.F2);
});

test('a selected group stays selected when its newest window closes', () => {
    const targets = buildTraversal([record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'), record('B1', 'Browser'), record('F3', 'Files')], 4);
    const groupIndex = targets.findIndex(target => target.kind === 'app-group');
    const result = removeWindowFromTraversal(targets, groupIndex, windows.F1, 1);

    assert.equal(result.targets[result.selectedIndex].kind, 'app-group');
    assert.equal(result.targets[result.selectedIndex].application, apps.Files);
    assert.equal(result.targets[result.selectedIndex].windows[0].window, windows.F2);
});

test('a formerly eligible group survives removal of its only older window', () => {
    const targets = buildTraversal([record('F1', 'Files'), record('T1', 'Text Editor'), record('F2', 'Files'), record('B1', 'Browser'), record('F3', 'Files')], 4);
    const result = removeWindowFromTraversal(targets, 0, windows.F3, 1);
    const group = result.targets.find(target => target.kind === 'app-group');

    assert.ok(group);
    assert.deepEqual(group.windows.map(entry => entry.window.name), ['F1', 'F2']);
});
