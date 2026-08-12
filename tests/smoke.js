// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import {ExtensionState} from 'resource:///org/gnome/shell/misc/extensionUtils.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export async function run() {
    await Main.extensionManager._initializationPromise;
    const extension = Main.extensionManager.lookup(
        'window-switching-redux@razzeee.github.io');
    if (extension === null)
        throw new Error('Window Switching Redux did not load');
    if (extension.state !== ExtensionState.ACTIVE)
        throw new Error(`Window Switching Redux state is ${extension.state}`);
}
