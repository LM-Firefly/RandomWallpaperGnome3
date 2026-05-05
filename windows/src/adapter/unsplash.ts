// Unsplash adapter — port of src/adapter/unsplash.ts.

import { BaseAdapter } from './baseAdapter.js';
import { Logger } from './../logger.js';
import { makeHistoryEntry } from './../history.js';
import type { HistoryEntryData } from './../types.js';

const MAX_SERVICE_RETRIES = 5;

interface UnsplashConfig {
    'api-key'?: string;
    query?: string;
    username?: string;
    topics?: string;
    collections?: string;
    orientation?: string;
    'content-filter'?: string;
    [key: string]: unknown;
}

type UnsplashItem = {
    urls: { raw: string };
    links: { html: string };
    user: { name: string; links: { html: string } };
};

export class UnsplashAdapter extends BaseAdapter<UnsplashConfig> {
    protected override _defaultName(): string {
        return 'Unsplash';
    }

    async requestRandomImage(count: number): Promise<HistoryEntryData[]> {
        const result: HistoryEntryData[] = [];
        for (let i = 0; i < MAX_SERVICE_RETRIES + count && result.length < count; i++) {
            try {
                const e = await this._getOne();
                if (!this._includesWallpaper(result, e.source.imageDownloadUrl)) result.push(e);
            } catch (err) {
                Logger.warn(`Unsplash fetch failed: ${String(err)}`, this);
            }
        }
        if (result.length < count) {
            Logger.warn('Returning fewer images than requested.', this);
            throw result;
        }
        return result;
    }

    private async _getOne(): Promise<HistoryEntryData> {
        const optStr = this._optionsString();
        const url = encodeURI(
            `https://api.unsplash.com/photos/random?count=1${optStr}`,
        );
        const req = this._bowl.newGetMessage(url);
        const body = (await this._bowl.sendAndReceiveJson(req)) as UnsplashItem[];
        const item = body[0];
        const downloadUrl = item?.urls?.raw;
        if (!downloadUrl) throw new Error('No image link in response');
        if (this._isImageBlocked(this._baseName(downloadUrl)))
            throw new Error('Image blocked');

        const entry = await makeHistoryEntry(null, this._sourceName, downloadUrl);
        entry.source.sourceUrl = 'https://unsplash.com';
        entry.source.author = item.user?.name ?? null;
        entry.source.authorUrl = item.user?.links?.html ?? null;
        entry.source.imageLinkUrl = item.links?.html ?? downloadUrl;
        return entry;
    }

    private _optionsString(): string {
        const o = this._config;
        let s = '';
        if (o['api-key']) s += `&client_id=${encodeURIComponent(o['api-key'])}`;
        if (o.username) s += `&username=${encodeURIComponent(o.username)}`;
        if (o.orientation) s += `&orientation=${encodeURIComponent(o.orientation)}`;
        if (o['content-filter'])
            s += `&content_filter=${encodeURIComponent(o['content-filter'])}`;
        if (o.collections) s += `&collections=${encodeURIComponent(o.collections)}`;
        if (o.topics) s += `&topics=${encodeURIComponent(o.topics)}`;
        if (o.query) s += `&query=${encodeURIComponent(o.query)}`;
        return s;
    }
}
