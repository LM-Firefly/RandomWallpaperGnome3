// History controller — equivalent of the original `HistoryController` but
// backed by the Tauri store and tied to a configurable cache directory.

import { exists, remove } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { Logger } from './logger.js';
import { fileName, getRandomNumber, newId } from './utils.js';
import * as store from './store.js';
import { wallpaperCacheDir } from './paths.js';
import type { HistoryEntryData, SourceInfo, AdapterInfoRef } from './types.js';

export class HistoryEntry implements HistoryEntryData {
    timestamp = Date.now();
    id: string;
    name: string | null;
    path: string;
    source: SourceInfo;
    adapter: AdapterInfoRef | null = { id: null, type: null };

    constructor(
        author: string | null,
        sourceName: string | null,
        url: string,
        cacheDir: string,
    ) {
        this.source = {
            author,
            authorUrl: null,
            source: sourceName,
            sourceUrl: null,
            imageDownloadUrl: url,
            imageLinkUrl: url,
        };
        this.name = fileName(url) || newId();
        this.id = `${this.timestamp}_${this.name}`;
        // Strip path-unsafe characters in the name to keep filenames Windows-safe.
        const safeName = this.name.replace(/[<>:"/\\|?*]/g, '_');
        this.path = `${cacheDir}\\${this.timestamp}_${safeName}`;
    }
}

export class HistoryController {
    history: HistoryEntryData[] = [];
    size = 5;

    async load(): Promise<void> {
        const general = await store.getGeneral();
        this.size = general['history-length'];
        this.history = (await store.getHistory()).slice();
    }

    async save(): Promise<void> {
        await store.setHistory(this.history);
    }

    async insert(entries: HistoryEntryData[]): Promise<void> {
        for (const e of entries) this.history.unshift(e);
        await this._deleteOldPictures();
        await this.save();
    }

    get(id: string): HistoryEntryData | null {
        return this.history.find((h) => h.id === id) ?? null;
    }

    getCurrentEntry(): HistoryEntryData | undefined {
        return this.history[0];
    }

    getRandom(): HistoryEntryData | undefined {
        if (this.history.length === 0) return undefined;
        return this.history[getRandomNumber(this.history.length)];
    }

    async promoteToActive(id: string): Promise<boolean> {
        const e = this.get(id);
        if (!e) return false;
        e.timestamp = Date.now();
        this.history = this.history.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
        await this.save();
        return true;
    }

    async clear(): Promise<void> {
        for (const entry of this.history) {
            try {
                if (await exists(entry.path)) await remove(entry.path);
            } catch (err) {
                Logger.warn(`Failed deleting ${entry.path}: ${String(err)}`, this);
            }
        }
        this.history = [];
        await this.save();
    }

    private async _deleteOldPictures(): Promise<void> {
        const general = await store.getGeneral();
        this.size = general['history-length'];
        while (this.history.length > this.size) {
            const old = this.history.pop();
            if (!old) break;
            try {
                if (await exists(old.path)) await remove(old.path);
            } catch (err) {
                Logger.warn(`Failed deleting ${old.path}: ${String(err)}`, this);
            }
        }
    }
}

/** Convenience: build a fresh `HistoryEntry` with the active cache dir. */
export async function makeHistoryEntry(
    author: string | null,
    sourceName: string | null,
    url: string,
): Promise<HistoryEntry> {
    const cache = await wallpaperCacheDir();
    return new HistoryEntry(author, sourceName, url, cache);
}

/** Resolve the cache path for a freshly built historyEntry (helper). */
export async function ensureHistoryPath(entry: HistoryEntryData): Promise<string> {
    const cache = await wallpaperCacheDir();
    if (!entry.path) {
        const safe = (entry.name ?? newId()).replace(/[<>:"/\\|?*]/g, '_');
        entry.path = await join(cache, `${entry.timestamp}_${safe}`);
    }
    return entry.path;
}
