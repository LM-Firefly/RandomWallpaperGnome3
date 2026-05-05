// Adapter factory — instantiate the right adapter for a given source meta.

import { BaseAdapter } from './baseAdapter.js';
import { GenericJsonAdapter } from './genericJson.js';
import { LocalFolderAdapter } from './localFolder.js';
import { RedditAdapter } from './reddit.js';
import { UnsplashAdapter } from './unsplash.js';
import { UrlSourceAdapter } from './urlSource.js';
import { WallhavenAdapter } from './wallhaven.js';
import { SourceType, type SourceMeta } from './../types.js';

export function createAdapter(meta: SourceMeta): BaseAdapter {
    switch (meta.type) {
        case SourceType.WALLHAVEN:
            return new WallhavenAdapter(meta);
        case SourceType.REDDIT:
            return new RedditAdapter(meta);
        case SourceType.UNSPLASH:
            return new UnsplashAdapter(meta);
        case SourceType.GENERIC_JSON:
            return new GenericJsonAdapter(meta);
        case SourceType.STATIC_URL:
            return new UrlSourceAdapter(meta);
        case SourceType.LOCAL_FOLDER:
            return new LocalFolderAdapter(meta);
        default:
            // Sensible fallback: unknown type → empty Wallhaven query.
            return new WallhavenAdapter({ ...meta, type: SourceType.WALLHAVEN });
    }
}
