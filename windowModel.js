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

function countApplicationWindows(records) {
    const applicationCounts = new Map();
    for (const record of records)
        applicationCounts.set(record.application, (applicationCounts.get(record.application) ?? 0) + 1);
    return applicationCounts;
}

export function buildTraversal(windowRecords, recentLimit) {
    const records = windowRecords.map(freezeRecord);
    const targets = records.slice(0, recentLimit).map(directTarget);
    const groups = new Map();
    const applicationCounts = countApplicationWindows(records);

    records.slice(recentLimit).forEach(record => {
        if (record.application === null || applicationCounts.get(record.application) === 1) {
            targets.push(directTarget(record));
            return;
        }

        if (!groups.has(record.application))
            groups.set(record.application, []);

        groups.get(record.application).push(record);
    });

    for (const [application, group] of groups) {
        targets.push(groupTarget(application, group));
        targets.push(...group.map(groupedTarget));
    }

    return Object.freeze(targets);
}

export function getInitialSelection(targets, startingWindow, direction) {
    const topLevelIndices = getTopLevelIndices(targets);
    if (topLevelIndices.length === 0)
        return -1;
    if (direction < 0)
        return topLevelIndices.at(-1);

    const startingIndex = targets.findIndex(target =>
        target.kind === 'direct-window' && target.window === startingWindow);
    return startingIndex === -1
        ? topLevelIndices[0]
        : moveInScope(startingIndex, 1, topLevelIndices);
}

export function getTopLevelIndices(targets) {
    return Object.freeze(targets.flatMap((target, index) =>
        target.kind === 'grouped-window' ? [] : [index]));
}

export function getGroupIndices(targets, application) {
    return Object.freeze(targets.flatMap((target, index) =>
        target.kind === 'grouped-window' && target.application === application
            ? [index]
            : []));
}

export function moveInScope(selectedIndex, direction, indices) {
    if (indices.length === 0)
        return -1;

    const position = indices.indexOf(selectedIndex);
    if (position === -1)
        return direction < 0 ? indices.at(-1) : indices[0];
    return indices[moveSelection(position, direction, indices.length)];
}

export function getScopedRemovalSelection(
    previousTargets, targets, selectedIndex, direction, previousIndices, indices) {
    if (indices.length === 0)
        return -1;

    const selectedTarget = previousTargets[selectedIndex];
    const retainedIndex = indices.find(index =>
        targetsMatch(targets[index], selectedTarget));
    if (retainedIndex !== undefined)
        return retainedIndex;

    const selectedPosition = previousIndices.indexOf(selectedIndex);
    if (selectedPosition === -1)
        return direction < 0 ? indices.at(-1) : indices[0];

    for (let offset = 1; offset < previousIndices.length; offset++) {
        const candidatePosition = moveSelection(
            selectedPosition, direction * offset, previousIndices.length);
        const candidate = previousTargets[previousIndices[candidatePosition]];
        const survivorIndex = indices.find(index =>
            targetsMatch(targets[index], candidate));
        if (survivorIndex !== undefined)
            return survivorIndex;
    }

    return direction < 0 ? indices.at(-1) : indices[0];
}

export function moveSelection(selectedIndex, direction, targetCount) {
    if (targetCount === 0)
        return -1;

    return (selectedIndex + direction + targetCount) % targetCount;
}

function targetsMatch(current, previous) {
    if (previous.kind === 'app-group' && current.kind === 'direct-window')
        return previous.windows.some(record => record.window === current.window);
    if (current.kind === 'app-group' || previous.kind === 'app-group')
        return current.kind === previous.kind && current.application === previous.application;
    return current.window === previous.window;
}

function withoutWindow(targets, removedWindow) {
    const survivors = [];
    const remainingWindows = targets.filter(target =>
        target.kind !== 'app-group' && target.window !== removedWindow);
    const applicationCounts = countApplicationWindows(remainingWindows);

    for (const target of targets) {
        if (target.kind === 'app-group') {
            const windows = target.windows.filter(record => record.window !== removedWindow);
            if (windows.length === 1 && applicationCounts.get(target.application) === 1)
                survivors.push(directTarget(windows[0]));
            else if (windows.length > 0)
                survivors.push(groupTarget(target.application, windows));
        } else if (target.window !== removedWindow) {
            if (target.kind === 'grouped-window' && applicationCounts.get(target.application) === 1)
                continue;
            survivors.push(target);
        }
    }

    return Object.freeze(survivors);
}

export function removeWindowFromTraversal(targets, selectedIndex, removedWindow, direction) {
    const survivors = withoutWindow(targets, removedWindow);
    return Object.freeze({
        targets: survivors,
        selectedIndex: getScopedRemovalSelection(
            targets, survivors, selectedIndex, direction,
            targets.map((_, index) => index),
            survivors.map((_, index) => index)),
    });
}
