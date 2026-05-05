// Push translated labels to the Rust tray menu.

import { invoke } from '@tauri-apps/api/core';
import { t } from './i18n.js';

export async function pushTrayLabels(): Promise<void> {
    try {
        await invoke('set_tray_labels', {
            labels: {
                request: t('Request New Wallpaper'),
                pause: t('Pause Auto-Fetch'),
                open_folder: t('Open Save Folder'),
                settings: t('Settings'),
                quit: t('Quit'),
                tooltip: t('Random Wallpaper'),
            },
        });
    } catch (err) {
        // Tray might not be ready yet during very early boot; safe to ignore.
        console.warn('set_tray_labels failed:', err);
    }
}
