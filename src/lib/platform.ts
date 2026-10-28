export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Label for the command palette shortcut: ⌘K on Apple devices, Ctrl K elsewhere. */
export const paletteShortcut = () => (isMac() ? '⌘K' : 'Ctrl K');
