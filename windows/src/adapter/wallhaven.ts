// Wallhaven adapter — port of src/adapter/wallhaven.ts.

import { writeFile } from '@tauri-apps/plugin-fs';
import { BaseAdapter } from './baseAdapter.js';
import { Logger } from './../logger.js';
import { getRandomNumber } from './../utils.js';
import { makeHistoryEntry } from './../history.js';
import type { HistoryEntryData } from './../types.js';

interface WallhavenConfig {
    'api-key'?: string;
    keyword?: string;
    'minimal-resolution'?: string;
    'aspect-ratios'?: string;
    'category-general'?: boolean;
    'category-anime'?: boolean;
    'category-people'?: boolean;
    'allow-sfw'?: boolean;
    'allow-sketchy'?: boolean;
    'allow-nsfw'?: boolean;
    'ai-art'?: boolean;
    color?: string;
    [key: string]: unknown;
}

interface QueryOptions {
    ai_art_filter: string;
    atleast: string;
    categories: string;
    colors: string;
    purity: string;
    q: string;
    ratios: string[];
    sorting: string;
}

interface WallhavenSearchResponse {
    data: { path: string; url: string }[];
}

export class WallhavenAdapter extends BaseAdapter<WallhavenConfig> {
    protected override _defaultName(): string {
        return 'Wallhaven';
    }

    async requestRandomImage(count: number): Promise<HistoryEntryData[]> {
        const wallpaperResult: HistoryEntryData[] = [];

        const options = this._readOptions();
        const optionsString = this._encodeOptions(options);

        const url = `https://wallhaven.cc/api/v1/search?${encodeURI(optionsString)}`;
        const headers: Record<string, string> = {};
        if (options._apiKey) headers['X-API-Key'] = options._apiKey;
        const req = this._bowl.newGetMessage(url, headers);

        Logger.debug(`Search URL: ${url}`, this);

        let resp: WallhavenSearchResponse;
        try {
            resp = (await this._bowl.sendAndReceiveJson(req)) as WallhavenSearchResponse;
        } catch (err) {
            Logger.error(err, this);
            throw wallpaperResult;
        }

        const data = resp?.data;
        if (!Array.isArray(data) || data.length === 0) {
            Logger.error('Empty/invalid Wallhaven response', this);
            throw wallpaperResult;
        }

        for (let i = 0; i < data.length && wallpaperResult.length < count; i++) {
            const item = data[i];
            if (this._isImageBlocked(this._baseName(item.path))) continue;
            const entry = await makeHistoryEntry(null, this._sourceName, item.path);
            entry.source.sourceUrl = 'https://wallhaven.cc/';
            entry.source.imageLinkUrl = item.url;
            if (!this._includesWallpaper(wallpaperResult, entry.source.imageDownloadUrl))
                wallpaperResult.push(entry);
        }

        if (wallpaperResult.length < count) {
            Logger.warn('Returning fewer images than requested.', this);
            throw wallpaperResult;
        }
        return wallpaperResult;
    }

    override async fetchFile(historyEntry: HistoryEntryData): Promise<HistoryEntryData> {
        const headers: Record<string, string> = {};
        const apiKey = (this._config['api-key'] ?? '').trim();
        if (apiKey) headers['X-API-Key'] = apiKey;
        const req = this._bowl.newGetMessage(
            historyEntry.source.imageDownloadUrl,
            headers,
        );
        const bytes = await this._bowl.sendAndReceive(req);
        if (!bytes || bytes.length === 0) throw new Error('Empty image response');
        await writeFile(historyEntry.path, bytes);
        return historyEntry;
    }

    private _readOptions(): QueryOptions & { _apiKey: string } {
        const c = this._config;
        const options: QueryOptions & { _apiKey: string } = {
            ai_art_filter: c['ai-art'] ? '0' : '1',
            atleast: c['minimal-resolution'] ?? '',
            categories: '',
            colors: c.color ?? '',
            purity: '',
            q: '',
            ratios: [],
            sorting: 'random',
            _apiKey: (c['api-key'] ?? '').trim(),
        };

        const keywords = (c.keyword ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        options.q = keywords.length ? keywords[getRandomNumber(keywords.length)] : '';

        if (!options.atleast) {
            // Fallback to the user's primary screen resolution.
            options.atleast = `${window.screen.width}x${window.screen.height}`;
        }

        const aspect = (c['aspect-ratios'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        options.ratios = aspect.length ? aspect : ['16x9'];

        options.categories = [
            Number(c['category-general'] ?? true),
            Number(c['category-anime'] ?? false),
            Number(c['category-people'] ?? false),
        ].join('');

        options.purity = [
            Number(c['allow-sfw'] ?? true),
            Number(c['allow-sketchy'] ?? false),
            Number(c['allow-nsfw'] ?? false),
        ].join('');

        return options;
    }

    private _encodeOptions(opts: QueryOptions): string {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(opts)) {
            if (Array.isArray(v)) {
                if (v.length) parts.push(`${k}=${v.join(',')}`);
            } else if (typeof v === 'string' && v !== '') {
                parts.push(`${k}=${v}`);
            }
        }
        return parts.join('&');
    }
}
