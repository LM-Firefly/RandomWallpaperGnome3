// Notification helpers via tauri-plugin-notification, gated on the
// "show-notifications" general setting.

import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
} from '@tauri-apps/plugin-notification';
import { getGeneral } from './store.js';

let _granted: boolean | null = null;

async function ensurePermission(): Promise<boolean> {
    if (_granted !== null) return _granted;
    let granted = await isPermissionGranted();
    if (!granted) {
        const r = await requestPermission();
        granted = r === 'granted';
    }
    _granted = granted;
    return granted;
}

export async function notify(title: string, body: string): Promise<void> {
    const general = await getGeneral();
    if (!general['show-notifications']) return;
    if (!(await ensurePermission())) return;
    sendNotification({ title, body });
}
