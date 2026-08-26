// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

const GROUP_OVERLAP = 0.15;

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
