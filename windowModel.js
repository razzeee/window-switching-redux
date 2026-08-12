// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

function freezeRecord(record) {
    return Object.freeze({
        window: record.window,
        auxiliarySurfaces: Object.freeze([...record.auxiliarySurfaces]),
        application: record.application,
    });
}

function directTarget(record) {
    return Object.freeze({kind: 'direct-window', ...record});
}

function groupedTarget(record) {
    return Object.freeze({kind: 'grouped-window', ...record});
}

function groupTarget(application, records) {
    return Object.freeze({
        kind: 'app-group',
        application,
        windows: Object.freeze(records),
    });
}

export function buildTraversal(windowRecords, recentLimit) {
    const records = windowRecords.map(freezeRecord);
    const targets = records.slice(0, recentLimit).map(directTarget);
    const groups = new Map();

    records.forEach((record, index) => {
        if (record.application === null)
            return;

        if (!groups.has(record.application))
            groups.set(record.application, {records: [], eligible: false});

        const group = groups.get(record.application);
        group.records.push(record);
        group.eligible ||= index >= recentLimit;
    });

    for (const [application, group] of groups) {
        if (!group.eligible)
            continue;

        targets.push(groupTarget(application, group.records));
        targets.push(...group.records.map(groupedTarget));
    }

    return Object.freeze(targets);
}

export function getInitialSelection(targets, startingWindow, direction) {
    if (targets.length === 0)
        return -1;
    if (direction < 0)
        return targets.length - 1;

    const startingIndex = targets.findIndex(target =>
        target.kind === 'direct-window' && target.window === startingWindow);
    return startingIndex === -1 ? 0 : moveSelection(startingIndex, 1, targets.length);
}

export function moveSelection(selectedIndex, direction, targetCount) {
    if (targetCount === 0)
        return -1;

    return (selectedIndex + direction + targetCount) % targetCount;
}

function targetsMatch(first, second) {
    if (first.kind !== second.kind)
        return false;
    if (first.kind === 'app-group')
        return first.application === second.application;
    return first.window === second.window;
}

function withoutWindow(targets, removedWindow) {
    const survivors = [];

    for (const target of targets) {
        if (target.kind === 'app-group') {
            const windows = target.windows.filter(record => record.window !== removedWindow);
            if (windows.length > 0)
                survivors.push(groupTarget(target.application, windows));
        } else if (target.window !== removedWindow) {
            survivors.push(target);
        }
    }

    return Object.freeze(survivors);
}

export function removeWindowFromTraversal(targets, selectedIndex, removedWindow, direction) {
    const selectedTarget = targets[selectedIndex];
    const survivors = withoutWindow(targets, removedWindow);
    if (survivors.length === 0)
        return Object.freeze({targets: survivors, selectedIndex: -1});

    const retainedSelection = survivors.findIndex(target => targetsMatch(target, selectedTarget));
    if (retainedSelection !== -1)
        return Object.freeze({targets: survivors, selectedIndex: retainedSelection});

    for (let offset = 1; offset < targets.length; offset++) {
        const candidateIndex = moveSelection(selectedIndex, direction * offset, targets.length);
        const candidate = targets[candidateIndex];
        const survivorIndex = survivors.findIndex(target => targetsMatch(target, candidate));
        if (survivorIndex !== -1)
            return Object.freeze({targets: survivors, selectedIndex: survivorIndex});
    }

    return Object.freeze({targets: survivors, selectedIndex: 0});
}
