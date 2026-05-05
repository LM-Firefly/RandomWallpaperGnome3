// History tab — grid of cached wallpapers.

import { convertFileSrc } from '@tauri-apps/api/core';
import { open as openShell } from '@tauri-apps/plugin-shell';
import { clear, el } from './dom.js';
import { wallpaperController } from './../wallpaperController.js';
import { t } from './../i18n.js';
import type { HistoryEntryData } from './../types.js';

export async function renderHistoryTab(host: HTMLElement): Promise<void> {
    clear(host);
    await wallpaperController.history.load();
    const entries = wallpaperController.history.history;

    if (entries.length === 0) {
        host.append(
            el(
                'div',
                { class: 'section' },
                el('p', {}, t('No wallpapers in the history yet. Click "Request New Wallpaper" on the General tab.')),
            ),
        );
        return;
    }

    const grid = el('div', { class: 'history-grid' });
    for (const entry of entries) grid.append(renderCard(entry, () => renderHistoryTab(host)));
    host.append(grid);
}

function renderCard(entry: HistoryEntryData, refresh: () => void): HTMLElement {
    const setBtn = el('button', { class: 'primary' }, t('Set'));
    setBtn.addEventListener('click', async () => {
        try {
            await wallpaperController.setFromHistory(entry.id);
            refresh();
        } catch (err) {
            alert(`${t('Failed')}: ${String(err)}`);
        }
    });

    const saveBtn = el('button', {}, t('Save'));
    saveBtn.addEventListener('click', async () => {
        try {
            const dest = await wallpaperController.saveForLater(entry);
            alert(`${t('Save')}: ${dest}`);
        } catch (err) {
            alert(`${t('Failed')}: ${String(err)}`);
        }
    });

    const linkBtn = el('button', {}, t('Open Link'));
    linkBtn.addEventListener('click', async () => {
        const url = entry.source.imageLinkUrl ?? entry.source.imageDownloadUrl;
        if (url) await openShell(url);
    });

    return el(
        'div',
        { class: 'history-card' },
        el('img', {
            src: convertFileSrc(entry.path),
            alt: entry.name ?? '',
            loading: 'lazy',
            decoding: 'async',
            fetchpriority: 'low',
            width: '220',
            height: '130',
        }),
        el(
            'div',
            { class: 'body' },
            el('strong', {}, entry.source.source ?? 'Wallpaper'),
            el('small', {}, new Date(entry.timestamp).toLocaleString()),
            entry.source.author ? el('small', {}, `by ${entry.source.author}`) : el('span', {}),
        ),
        el('div', { class: 'actions' }, setBtn, saveBtn, linkBtn),
    );
}
