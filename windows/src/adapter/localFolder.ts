// Local folder adapter — port of src/adapter/localFolder.ts.
// Walks a directory tree and copies a random image to the wallpaper cache.

import { copyFile, readDir, type DirEntry } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { BaseAdapter } from './baseAdapter.js';
import { Logger } from './../logger.js';
import { shuffleArray } from './../utils.js';
import { makeHistoryEntry } from './../history.js';
import type { HistoryEntryData } from './../types.js';

interface LocalFolderConfig {
    folder?: string;
    [key: string]: unknown;
}

const IMAGE_EXTENSIONS = new Set([
    'jpg',
    'jpeg',
    'png',
    'webp',
    'bmp',
    'gif',
    'tif',
    'tiff',
    'avif',
    'heic',
]);

export class LocalFolderAdapter extends BaseAdapter<LocalFolderConfig> {
    protected override _defaultName(): string {
        return 'Local Folder';
    }

    async requestRandomImage(count: number): Promise<HistoryEntryData[]> {
        const c = this._config;
        const folder = (c.folder ?? '').trim();
        const result: HistoryEntryData[] = [];
        if (!folder) {
            Logger.error('No folder configured', this);
            throw result;
        }

        const files = await this._listImages(folder);
        if (files.length === 0) {
            Logger.error('No images found in folder', this);
            throw result;
        }
        Logger.debug(`Found ${files.length} candidate images in ${folder}`, this);

        for (const fpath of shuffleArray(files)) {
            if (result.length >= count) break;
            const entry = await makeHistoryEntry(null, this._sourceName, fpath);
            entry.source.sourceUrl = fpath;
            result.push(entry);
        }

        if (result.length < count) {
            Logger.warn('Returning fewer images than requested.', this);
            throw result;
        }
        return result;
    }

    /** Local-folder fetch is just a file copy. */
    override async fetchFile(entry: HistoryEntryData): Promise<HistoryEntryData> {
        await copyFile(entry.source.imageDownloadUrl, entry.path);
        return entry;
    }

    private async _listImages(root: string): Promise<string[]> {
        const out: string[] = [];
        const walk = async (dir: string): Promise<void> => {
            let entries: DirEntry[];
            try {
                entries = await readDir(dir);
            } catch (err) {
                Logger.warn(`Cannot read ${dir}: ${String(err)}`, this);
                return;
            }
            for (const e of entries) {
                const full = await join(dir, e.name);
                if (e.isDirectory) {
                    await walk(full);
                } else if (e.isFile) {
                    const ext = e.name.split('.').pop()?.toLowerCase() ?? '';
                    if (IMAGE_EXTENSIONS.has(ext) && !this._isImageBlocked(e.name))
                        out.push(full);
                }
            }
        };
        await walk(root);
        return out;
    }
}
