// Application paths — derives wallpaper cache and favorites locations.

import { mkdir, exists } from '@tauri-apps/plugin-fs';
import { appCacheDir, pictureDir, downloadDir, join } from '@tauri-apps/api/path';

let _cachedWallpaperDir: string | null = null;

/** Directory the extension uses to cache fetched wallpapers. */
export async function wallpaperCacheDir(): Promise<string> {
    if (_cachedWallpaperDir) return _cachedWallpaperDir;
    const root = await appCacheDir();
    const dir = await join(root, 'wallpapers');
    if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
    }
    _cachedWallpaperDir = dir;
    return dir;
}

/** Default location for "Save for later" / favorites. */
export async function defaultFavoritesDir(): Promise<string> {
    try {
        const p = await pictureDir();
        return await join(p, 'RandomWallpaper');
    } catch {
        try {
            const d = await downloadDir();
            return await join(d, 'RandomWallpaper');
        } catch {
            return 'RandomWallpaper';
        }
    }
}
