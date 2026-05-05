// Generic JSON adapter — port of src/adapter/genericJson.ts.

import { BaseAdapter } from './baseAdapter.js';
import { Logger } from './../logger.js';
import { getTarget, replaceRandomInPath } from './../jsonPath.js';
import { makeHistoryEntry } from './../history.js';
import type { HistoryEntryData } from './../types.js';

const MAX_SERVICE_RETRIES = 5;
const MAX_ARRAY_RETRIES = 5;

interface GenericJsonConfig {
    domain?: string;
    'request-url'?: string;
    'image-path'?: string;
    'image-prefix'?: string;
    'post-path'?: string;
    'post-prefix'?: string;
    'author-name-path'?: string;
    'author-url-path'?: string;
    'author-url-prefix'?: string;
    [key: string]: unknown;
}

export class GenericJsonAdapter extends BaseAdapter<GenericJsonConfig> {
    protected override _defaultName(): string {
        return 'Generic JSON Source';
    }

    async requestRandomImage(count: number): Promise<HistoryEntryData[]> {
        const result: HistoryEntryData[] = [];

        for (let i = 0; i < MAX_SERVICE_RETRIES + count && result.length < count; i++) {
            let arr: HistoryEntryData[] = [];
            try {
                arr = await this._getBatch(count);
            } catch (err) {
                if (Array.isArray(err)) arr = err as HistoryEntryData[];
                else Logger.warn(`Generic JSON failed: ${String(err)}`, this);
            }
            for (const e of arr) {
                if (!this._includesWallpaper(result, e.source.imageDownloadUrl))
                    result.push(e);
            }
        }

        if (result.length < count) {
            Logger.warn('Returning fewer images than requested.', this);
            throw result;
        }
        return result;
    }

    private async _getBatch(count: number): Promise<HistoryEntryData[]> {
        const c = this._config;
        const result: HistoryEntryData[] = [];

        const url = encodeURI((c['request-url'] ?? '').trim());
        if (!url) throw new Error('request-url is empty');
        const req = this._bowl.newGetMessage(url);

        let body: unknown;
        try {
            body = await this._bowl.sendAndReceiveJson(req);
        } catch (err) {
            Logger.error(err, this);
            throw result;
        }

        const imagePath = c['image-path'] ?? '';
        const authorNamePath = c['author-name-path'] ?? '';

        for (let i = 0; i < MAX_ARRAY_RETRIES + count && result.length < count; i++) {
            const [target, resolvedPath] = getTarget(body, imagePath);
            if (
                !target ||
                (typeof target !== 'string' && typeof target !== 'number') ||
                target === ''
            ) {
                Logger.error('Unexpected JSON member', this);
                break;
            }
            const downloadUrl = (c['image-prefix'] ?? '') + String(target);
            const blocked = this._isImageBlocked(this._baseName(downloadUrl));
            if (blocked && !imagePath.includes('@random')) break;
            if (blocked) continue;

            let authorName: string | null = null;
            const [authorObj] = getTarget(
                body,
                replaceRandomInPath(authorNamePath, resolvedPath),
            );
            if (typeof authorObj === 'string' && authorObj !== '') authorName = authorObj;

            const entry = await makeHistoryEntry(authorName, this._sourceName, downloadUrl);
            this._fillMeta(entry, body, resolvedPath);

            if (!this._includesWallpaper(result, entry.source.imageDownloadUrl))
                result.push(entry);
        }

        if (result.length < count) {
            Logger.warn('Returning fewer images than requested.', this);
            throw result;
        }
        return result;
    }

    private _fillMeta(
        entry: HistoryEntryData,
        body: unknown,
        resolvedPath: string,
    ): void {
        const c = this._config;
        const domain = c.domain ?? '';
        const postPath = c['post-path'] ?? '';
        const authorUrlPath = c['author-url-path'] ?? '';

        let postUrl = '';
        const [postObj] = getTarget(body, replaceRandomInPath(postPath, resolvedPath));
        if (typeof postObj === 'string' || typeof postObj === 'number')
            postUrl = (c['post-prefix'] ?? '') + String(postObj);

        let authorUrl = '';
        const [authorUrlObj] = getTarget(
            body,
            replaceRandomInPath(authorUrlPath, resolvedPath),
        );
        if (typeof authorUrlObj === 'string' || typeof authorUrlObj === 'number')
            authorUrl = (c['author-url-prefix'] ?? '') + String(authorUrlObj);

        if (authorUrl) entry.source.authorUrl = authorUrl;
        if (postUrl) entry.source.imageLinkUrl = postUrl;
        if (domain) entry.source.sourceUrl = domain;
    }
}
