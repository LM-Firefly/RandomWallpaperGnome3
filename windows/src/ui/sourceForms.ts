// Per-source-type configuration forms. Each form returns the same DOM
// fragment style (a sequence of field-rows) and binds each input to the
// corresponding `meta.config[key]`.

import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { SourceType, type SourceMeta } from './../types.js';
import { checkbox, el, fieldRow, input, select } from './dom.js';

type Config = SourceMeta['config'];

function bindString(
    cfg: Config,
    key: string,
    initial = '',
): HTMLInputElement {
    const inp = input('text', String(cfg[key] ?? initial), (v) => {
        cfg[key] = v;
    });
    return inp;
}

function bindNumber(cfg: Config, key: string, initial = 0): HTMLInputElement {
    const inp = input('number', Number(cfg[key] ?? initial), (v) => {
        const n = Number(v);
        cfg[key] = Number.isFinite(n) ? n : initial;
    });
    return inp;
}

function bindBool(cfg: Config, key: string, initial = false): HTMLLabelElement {
    return checkbox(Boolean(cfg[key] ?? initial), (v) => {
        cfg[key] = v;
    });
}

export function buildForm(meta: SourceMeta): HTMLElement {
    switch (meta.type) {
        case SourceType.WALLHAVEN:
            return wallhavenForm(meta);
        case SourceType.REDDIT:
            return redditForm(meta);
        case SourceType.UNSPLASH:
            return unsplashForm(meta);
        case SourceType.GENERIC_JSON:
            return genericJsonForm(meta);
        case SourceType.STATIC_URL:
            return urlSourceForm(meta);
        case SourceType.LOCAL_FOLDER:
            return localFolderForm(meta);
        default:
            return el('div', {}, 'Unknown source type');
    }
}

function wallhavenForm(meta: SourceMeta): HTMLElement {
    const c = meta.config;
    return el(
        'div',
        {},
        fieldRow('API Key (optional)', bindString(c, 'api-key')),
        fieldRow('Keywords (comma-separated)', bindString(c, 'keyword')),
        fieldRow('Minimum resolution (e.g. 1920x1080)', bindString(c, 'minimal-resolution')),
        fieldRow('Aspect ratios (e.g. 16x9,16x10)', bindString(c, 'aspect-ratios', '16x9')),
        fieldRow('Color (hex, no #)', bindString(c, 'color')),
        fieldRow('Category: General', bindBool(c, 'category-general', true)),
        fieldRow('Category: Anime', bindBool(c, 'category-anime')),
        fieldRow('Category: People', bindBool(c, 'category-people')),
        fieldRow('Allow SFW', bindBool(c, 'allow-sfw', true)),
        fieldRow('Allow Sketchy', bindBool(c, 'allow-sketchy')),
        fieldRow('Allow NSFW (requires API key)', bindBool(c, 'allow-nsfw')),
        fieldRow('Include AI-generated', bindBool(c, 'ai-art')),
    );
}

function redditForm(meta: SourceMeta): HTMLElement {
    const c = meta.config;
    return el(
        'div',
        {},
        fieldRow('Subreddits (comma-separated)', bindString(c, 'subreddits', 'wallpaper,wallpapers')),
        fieldRow('Allow SFW only', bindBool(c, 'allow-sfw', true)),
        fieldRow('Min width (px)', bindNumber(c, 'min-width', 1920)),
        fieldRow('Min height (px)', bindNumber(c, 'min-height', 1080)),
        fieldRow('Min ratio width', bindNumber(c, 'image-ratio1', 16)),
        fieldRow('Min ratio height', bindNumber(c, 'image-ratio2', 10)),
    );
}

function unsplashForm(meta: SourceMeta): HTMLElement {
    const c = meta.config;
    return el(
        'div',
        {},
        fieldRow('API Key (Access Key)', bindString(c, 'api-key')),
        fieldRow('Search query', bindString(c, 'query')),
        fieldRow('Username', bindString(c, 'username')),
        fieldRow('Topics (comma-separated)', bindString(c, 'topics')),
        fieldRow('Collections (comma-separated)', bindString(c, 'collections')),
        fieldRow(
            'Orientation',
            select(
                [
                    { value: '', label: 'Any' },
                    { value: 'landscape', label: 'Landscape' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'squarish', label: 'Squarish' },
                ],
                String(c.orientation ?? ''),
                (v) => {
                    c.orientation = v;
                },
            ),
        ),
        fieldRow(
            'Content filter',
            select(
                [
                    { value: '', label: 'Default' },
                    { value: 'low', label: 'Low' },
                    { value: 'high', label: 'High' },
                ],
                String(c['content-filter'] ?? ''),
                (v) => {
                    c['content-filter'] = v;
                },
            ),
        ),
    );
}

function genericJsonForm(meta: SourceMeta): HTMLElement {
    const c = meta.config;
    return el(
        'div',
        {},
        fieldRow('Domain', bindString(c, 'domain')),
        fieldRow('Request URL', bindString(c, 'request-url')),
        fieldRow('Image JSON path', bindString(c, 'image-path')),
        fieldRow('Image URL prefix', bindString(c, 'image-prefix')),
        fieldRow('Post JSON path', bindString(c, 'post-path')),
        fieldRow('Post URL prefix', bindString(c, 'post-prefix')),
        fieldRow('Author name JSON path', bindString(c, 'author-name-path')),
        fieldRow('Author URL JSON path', bindString(c, 'author-url-path')),
        fieldRow('Author URL prefix', bindString(c, 'author-url-prefix')),
    );
}

function urlSourceForm(meta: SourceMeta): HTMLElement {
    const c = meta.config;
    return el(
        'div',
        {},
        fieldRow('Image URL', bindString(c, 'image-url')),
        fieldRow('Different images per request', bindBool(c, 'different-images')),
        fieldRow('Domain (link)', bindString(c, 'domain')),
        fieldRow('Author name', bindString(c, 'author-name')),
        fieldRow('Author URL', bindString(c, 'author-url')),
        fieldRow('Post URL', bindString(c, 'post-url')),
    );
}

function localFolderForm(meta: SourceMeta): HTMLElement {
    const c = meta.config;
    const inp = bindString(c, 'folder');
    const browse = el('button', {}, 'Browse');
    browse.addEventListener('click', async () => {
        const r = await openDialog({ directory: true, defaultPath: String(c.folder ?? '') });
        if (typeof r === 'string') {
            inp.value = r;
            c.folder = r;
        }
    });
    return el(
        'div',
        {},
        fieldRow('Folder', el('div', { style: 'display:flex;gap:8px;' }, inp, browse)),
    );
}
