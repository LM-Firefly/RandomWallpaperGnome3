// Base adapter. Replaces the original libsoup-based one; subclasses
// receive a config blob from the store and a Bowl instance for HTTP.

import { writeFile } from '@tauri-apps/plugin-fs';
import { Bowl } from './../bowl.js';
import { Logger } from './../logger.js';
import { fileName } from './../utils.js';
import type { HistoryEntryData, SourceMeta } from './../types.js';

export abstract class BaseAdapter<C extends Record<string, unknown> = Record<string, unknown>> {
    protected _bowl = new Bowl();
    protected _meta: SourceMeta;
    protected _sourceName: string;

    constructor(meta: SourceMeta) {
        this._meta = meta;
        this._sourceName = meta.name || this._defaultName();
    }

    protected get _config(): C {
        return this._meta.config as C;
    }

    /** Subclasses override to provide a default display name for new sources. */
    protected abstract _defaultName(): string;

    /**
     * Retrieve a random batch of history entries.
     * MUST resolve with at least 1 entry on success; throw otherwise.
     */
    abstract requestRandomImage(count: number): Promise<HistoryEntryData[]>;

    /**
     * Default download implementation: GET the image URL and save raw bytes
     * to `historyEntry.path`. Subclasses override when extra headers or a
     * different transport are required (e.g. local folder copy, Wallhaven API key).
     */
    async fetchFile(historyEntry: HistoryEntryData): Promise<HistoryEntryData> {
        const req = this._bowl.newGetMessage(historyEntry.source.imageDownloadUrl);
        const bytes = await this._bowl.sendAndReceive(req);
        if (!bytes || bytes.length === 0) throw new Error('Empty image response');
        await writeFile(historyEntry.path, bytes);
        return historyEntry;
    }

    protected _includesWallpaper(arr: HistoryEntryData[], uri: string): boolean {
        return arr.some((e) => e.source.imageDownloadUrl === uri);
    }

    protected _isImageBlocked(filenameStr: string): boolean {
        if (this._meta.blockedImages.includes(filenameStr)) {
            Logger.info(`Image blocked: ${filenameStr}`, this);
            return true;
        }
        return false;
    }

    /** Convenience: extract base name. Re-exported so adapters need fewer imports. */
    protected _baseName(uri: string): string {
        return fileName(uri);
    }
}
