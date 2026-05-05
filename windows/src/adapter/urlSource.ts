// Static URL adapter — port of src/adapter/urlSource.ts.

import { BaseAdapter } from './baseAdapter.js';
import { Logger } from './../logger.js';
import { makeHistoryEntry } from './../history.js';
import type { HistoryEntryData } from './../types.js';

interface UrlSourceConfig {
    'image-url'?: string;
    'different-images'?: boolean;
    domain?: string;
    'author-name'?: string;
    'author-url'?: string;
    'post-url'?: string;
    [key: string]: unknown;
}

export class UrlSourceAdapter extends BaseAdapter<UrlSourceConfig> {
    protected override _defaultName(): string {
        return 'Static URL';
    }

    async requestRandomImage(count: number): Promise<HistoryEntryData[]> {
        const c = this._config;
        const url = (c['image-url'] ?? '').trim();
        if (!url) {
            Logger.error('Missing download URL', this);
            throw [] as HistoryEntryData[];
        }

        const requested = c['different-images'] ? count : 1;
        const result: HistoryEntryData[] = [];

        for (let i = 0; i < requested; i++) {
            const author = (c['author-name'] ?? '').trim() || null;
            const entry = await makeHistoryEntry(author, this._sourceName, url);
            if (c['author-url']) entry.source.authorUrl = c['author-url']!;
            if (c['post-url']) entry.source.imageLinkUrl = c['post-url']!;
            if (c.domain) entry.source.sourceUrl = c.domain!;
            // Ensure the id is unique even when called multiple times in the
            // same millisecond with the same URL.
            entry.id = `${entry.timestamp}_${i}_${entry.name ?? 'image'}`;
            result.push(entry);
        }
        return result;
    }
}
