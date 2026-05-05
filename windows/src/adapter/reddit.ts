// Reddit adapter — port of src/adapter/reddit.ts.

import { BaseAdapter } from './baseAdapter.js';
import { Logger } from './../logger.js';
import { getRandomNumber } from './../utils.js';
import { makeHistoryEntry } from './../history.js';
import type { HistoryEntryData } from './../types.js';

interface RedditConfig {
    subreddits?: string;
    'allow-sfw'?: boolean;
    'min-width'?: number;
    'min-height'?: number;
    'image-ratio1'?: number;
    'image-ratio2'?: number;
    [key: string]: unknown;
}

interface RedditResponse {
    data: { children: RedditSubmission[] };
}

interface RedditSubmission {
    data: {
        post_hint: string;
        over_18: boolean;
        subreddit_name_prefixed: string;
        permalink: string;
        preview: {
            images: { source: { width: number; height: number; url: string } }[];
        };
    };
}

export class RedditAdapter extends BaseAdapter<RedditConfig> {
    protected override _defaultName(): string {
        return 'Reddit';
    }

    async requestRandomImage(count: number): Promise<HistoryEntryData[]> {
        const result: HistoryEntryData[] = [];
        const c = this._config;
        const subs = (c.subreddits ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .join('+');
        if (!subs) {
            Logger.error('No subreddits configured', this);
            throw result;
        }
        const sfw = c['allow-sfw'] ?? false;
        const url = encodeURI(`https://www.reddit.com/r/${subs}.json`);
        const req = this._bowl.newGetMessage(url);

        let body: RedditResponse;
        try {
            body = (await this._bowl.sendAndReceiveJson(req)) as RedditResponse;
        } catch (err) {
            Logger.error(`Reddit fetch failed: ${String(err)}`, this);
            throw result;
        }

        if (!body?.data?.children || !Array.isArray(body.data.children)) {
            Logger.error('Unexpected Reddit response', this);
            throw result;
        }

        const minW = c['min-width'] ?? 1920;
        const minH = c['min-height'] ?? 1080;
        const r1 = c['image-ratio1'] ?? 16;
        const r2 = c['image-ratio2'] ?? 10;

        const filtered = body.data.children.filter((child) => {
            const d = child.data;
            if (d.post_hint !== 'image') return false;
            if (sfw && d.over_18) return false;
            const src = d.preview?.images?.[0]?.source;
            if (!src) return false;
            if (src.width < minW) return false;
            if (src.height < minH) return false;
            // ratio check: width/r1*r2 < height ⇒ image too tall
            if ((src.width / r1) * r2 < src.height) return false;
            return true;
        });

        if (filtered.length === 0) {
            Logger.error('No suitable Reddit submissions found', this);
            throw result;
        }

        for (let i = 0; i < filtered.length && result.length < count; i++) {
            const sub = filtered[getRandomNumber(filtered.length)].data;
            const downloadUrl = sub.preview.images[0].source.url.replace(/&amp;/g, '&');
            if (this._isImageBlocked(this._baseName(downloadUrl))) continue;

            const entry = await makeHistoryEntry(null, this._sourceName, downloadUrl);
            entry.source.sourceUrl = `https://www.reddit.com/${sub.subreddit_name_prefixed}`;
            entry.source.imageLinkUrl = `https://www.reddit.com${sub.permalink}`;
            if (!this._includesWallpaper(result, entry.source.imageDownloadUrl))
                result.push(entry);
        }

        if (result.length < count) {
            Logger.warn('Returning fewer images than requested.', this);
            throw result;
        }
        return result;
    }
}
