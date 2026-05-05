// High-level controller — picks adapters, downloads images, applies them
// as the desktop wallpaper through the Rust backend.

import { invoke } from '@tauri-apps/api/core';
import { copyFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { join, basename } from '@tauri-apps/api/path';
import { Command } from '@tauri-apps/plugin-shell';

import { Logger } from './logger.js';
import { createAdapter } from './adapter/index.js';
import { HistoryController } from './history.js';
import { notify } from './notifications.js';
import { getGeneral, getSources } from './store.js';
import { getRandomNumber } from './utils.js';
import { defaultFavoritesDir } from './paths.js';
import type { HistoryEntryData, SourceMeta } from './types.js';

export class WallpaperController {
    private _history = new HistoryController();
    private _busy = false;
    private _hooks: { start: Array<() => void>; stop: Array<() => void> } = {
        start: [],
        stop: [],
    };

    async init(): Promise<void> {
        await this._history.load();
    }

    get history(): HistoryController {
        return this._history;
    }

    onStart(fn: () => void): void {
        this._hooks.start.push(fn);
    }

    onStop(fn: () => void): void {
        this._hooks.stop.push(fn);
    }

    isBusy(): boolean {
        return this._busy;
    }

    /** Apply an existing history entry as the active wallpaper. */
    async setFromHistory(entryId: string): Promise<void> {
        const entry = this._history.get(entryId);
        if (!entry) throw new Error(`History entry not found: ${entryId}`);
        await this._applyWallpaper(entry);
        await this._history.promoteToActive(entryId);
    }

    /** Fetch a new wallpaper from configured sources and apply it. */
    async fetchNewWallpaper(): Promise<void> {
        if (this._busy) {
            Logger.warn('Already fetching, skipping', this);
            return;
        }
        this._busy = true;
        for (const fn of this._hooks.start) fn();

        try {
            const general = await getGeneral();
            const sources = (await getSources()).filter((s) => s.enabled);
            if (sources.length === 0) throw new Error('No enabled wallpaper sources configured');

            const monitorCount = general['multiple-displays']
                ? Math.max(1, await this._getMonitorCount())
                : 1;

            const buckets = this._distributeAcrossSources(sources, monitorCount);

            const fetched: HistoryEntryData[] = [];
            for (const [meta, count] of buckets) {
                try {
                    const adapter = createAdapter(meta);
                    let entries: HistoryEntryData[];
                    try {
                        entries = await adapter.requestRandomImage(count);
                    } catch (err) {
                        if (Array.isArray(err) && err.length > 0)
                            entries = err as HistoryEntryData[];
                        else {
                            Logger.error(err, this);
                            continue;
                        }
                    }
                    for (const e of entries) {
                        try {
                            await adapter.fetchFile(e);
                            fetched.push(e);
                        } catch (err) {
                            Logger.error(`Download failed for ${e.source.imageDownloadUrl}: ${String(err)}`, this);
                        }
                    }
                } catch (err) {
                    Logger.error(err, this);
                }
            }

            if (fetched.length === 0) throw new Error('No wallpapers were downloaded');

            await this._history.insert(fetched);

            // Apply: either the first entry on every monitor, or one per monitor.
            if (general['multiple-displays'] && fetched.length >= monitorCount) {
                for (let i = 0; i < monitorCount; i++) {
                    await this._applyWallpaperToMonitor(i, fetched[i]);
                }
                await this._applyPosition(general['scaling-mode']);
            } else {
                await this._applyWallpaper(fetched[0]);
            }

            if (general['sync-lock-screen']) {
                await this._applyLockScreen(fetched[0]);
            }

            await this._runPostCommand(fetched[0]);

            await notify('Random Wallpaper', `New wallpaper applied: ${fetched[0].name ?? ''}`);
        } finally {
            this._busy = false;
            for (const fn of this._hooks.stop) fn();
        }
    }

    /**
     * Decide how many images each enabled source should provide so that we
     * have at least `monitorCount` fetched in total. Picks sources at random.
     */
    private _distributeAcrossSources(
        sources: SourceMeta[],
        monitorCount: number,
    ): Array<[SourceMeta, number]> {
        const out: Array<[SourceMeta, number]> = [];
        for (let i = 0; i < monitorCount; i++) {
            const meta = sources[getRandomNumber(sources.length)];
            const existing = out.find((x) => x[0].id === meta.id);
            if (existing) existing[1] += 1;
            else out.push([meta, 1]);
        }
        return out;
    }

    private async _applyWallpaper(entry: HistoryEntryData): Promise<void> {
        await invoke('set_wallpaper', { path: entry.path });
        const general = await getGeneral();
        await this._applyPosition(general['scaling-mode']);
    }

    private async _applyWallpaperToMonitor(
        monitorIndex: number,
        entry: HistoryEntryData,
    ): Promise<void> {
        await invoke('set_wallpaper_per_monitor', {
            monitorIndex,
            path: entry.path,
        });
    }

    private async _applyPosition(mode: string): Promise<void> {
        if (!mode) return;
        try {
            await invoke('set_wallpaper_position', { mode });
        } catch (err) {
            Logger.warn(`set_wallpaper_position(${mode}) failed: ${String(err)}`, this);
        }
    }

    private async _applyLockScreen(entry: HistoryEntryData): Promise<void> {
        try {
            await invoke('set_lock_screen', { path: entry.path });
        } catch (err) {
            Logger.warn(`set_lock_screen failed: ${String(err)}`, this);
        }
    }

    private async _getMonitorCount(): Promise<number> {
        try {
            return await invoke<number>('get_monitor_count');
        } catch {
            return 1;
        }
    }

    private async _runPostCommand(entry: HistoryEntryData): Promise<void> {
        const general = await getGeneral();
        const cmd = (general['general-post-command'] ?? '').trim();
        if (!cmd) return;
        const expanded = cmd.replace(/%wallpaper_path%/g, entry.path);
        try {
            const proc = Command.create('powershell', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                expanded,
            ]);
            await proc.execute();
        } catch (err) {
            Logger.warn(`Post command failed: ${String(err)}`, this);
        }
    }

    /** Save an entry into the user's favorites folder. */
    async saveForLater(entry: HistoryEntryData): Promise<string> {
        const general = await getGeneral();
        let target = general['favorites-folder'];
        if (!target) target = await defaultFavoritesDir();
        if (!(await exists(target))) await mkdir(target, { recursive: true });
        const name = await basename(entry.path);
        const dest = await join(target, name);
        await copyFile(entry.path, dest);
        return dest;
    }
}

export const wallpaperController = new WallpaperController();
