// General settings tab.

import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import {
    enable as enableAutostart,
    disable as disableAutostart,
    isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';

import { wallpaperCacheDir, defaultFavoritesDir } from './../paths.js';
import { getGeneral, updateGeneral } from './../store.js';
import { wallpaperController } from './../wallpaperController.js';
import { AfTimer } from './../timer.js';
import {
    type LocalePref,
    resolveLocale,
    setLocale,
    t,
} from './../i18n.js';
import { FONT_PRESETS, applyTypography, clampSize } from './../theme.js';
import { checkbox, clear, el, fieldRow, input, select } from './dom.js';

export async function renderGeneralTab(host: HTMLElement): Promise<void> {
    clear(host);
    const general = await getGeneral();

    const requestBtn = el('button', {}, t('Request New Wallpaper'));
    requestBtn.addEventListener('click', async () => {
        requestBtn.setAttribute('disabled', '');
        try {
            await wallpaperController.fetchNewWallpaper();
        } catch (err) {
            alert(`${t('Failed')}: ${String(err)}`);
        } finally {
            requestBtn.removeAttribute('disabled');
        }
    });

    // ─── Wallpaper section ──────────────────────────────────────────────
    const wallpaperSection = el(
        'div',
        { class: 'section' },
        el('h2', {}, t('Wallpaper')),
        fieldRow(
            t('Scaling mode'),
            select(
                [
                    { value: 'fill', label: t('Fill') },
                    { value: 'fit', label: t('Fit') },
                    { value: 'stretch', label: t('Stretch') },
                    { value: 'tile', label: t('Tile') },
                    { value: 'center', label: t('Center') },
                    { value: 'span', label: t('Span across monitors') },
                ],
                general['scaling-mode'] || 'fill',
                (v) => void updateGeneral({ 'scaling-mode': v }),
            ),
        ),
        fieldRow(
            t('Different wallpaper per monitor'),
            checkbox(general['multiple-displays'], (v) =>
                void updateGeneral({ 'multiple-displays': v }),
            ),
        ),
        fieldRow(
            t('Also set as lock screen wallpaper'),
            checkbox(general['sync-lock-screen'], (v) =>
                void updateGeneral({ 'sync-lock-screen': v }),
            ),
        ),
        fieldRow(
            t('Post-apply command (PowerShell)'),
            input('text', general['general-post-command'], (v) =>
                void updateGeneral({ 'general-post-command': v }),
            ),
        ),
    );

    // ─── History section ────────────────────────────────────────────────
    const cacheBtn = el('button', {}, t('Open Save Folder'));
    cacheBtn.addEventListener('click', async () => {
        try {
            const cfg = (await getGeneral())['favorites-folder'];
            const dir = cfg && cfg.trim() ? cfg : await wallpaperCacheDir();
            if (!(await exists(dir))) {
                await mkdir(dir, { recursive: true });
            }
            await invoke('open_path', { path: dir });
        } catch (err) {
            console.error('Open save folder failed:', err);
            alert(`${t('Failed')}:\n${err}`);
        }
    });
    const clearBtn = el('button', { class: 'danger' }, t('Clear History'));
    clearBtn.addEventListener('click', async () => {
        if (!confirm(t('Delete all cached wallpapers?'))) return;
        await wallpaperController.history.clear();
        alert(t('History cleared.'));
    });

    const favoritesValue = general['favorites-folder'] || (await defaultFavoritesDir());
    const favInput = input('text', favoritesValue, (v) =>
        void updateGeneral({ 'favorites-folder': v }),
    );
    const favBrowse = el('button', {}, t('Browse'));
    favBrowse.addEventListener('click', async () => {
        const r = await openDialog({ directory: true, defaultPath: favoritesValue });
        if (typeof r === 'string') {
            favInput.value = r;
            await updateGeneral({ 'favorites-folder': r });
        }
    });

    const historySection = el(
        'div',
        { class: 'section' },
        el('h2', {}, t('History')),
        fieldRow(
            t('History length'),
            input('number', general['history-length'], (v) =>
                void updateGeneral({ 'history-length': Math.max(2, Number(v) || 5) }),
            ),
        ),
        fieldRow(
            t('Save-for-later folder'),
            el('div', { style: 'display:flex;gap:8px;' }, favInput, favBrowse),
        ),
        el(
            'div',
            { class: 'field-row full' },
            el('div', { class: 'row-actions' }, cacheBtn, clearBtn),
        ),
    );

    // ─── Auto-fetch section ─────────────────────────────────────────────
    const autoFetchSection = el(
        'div',
        { class: 'section' },
        el('h2', {}, t('Auto-Fetching')),
        fieldRow(
            t('Auto-fetch enabled'),
            checkbox(general['auto-fetch'], async (v) => {
                await updateGeneral({ 'auto-fetch': v });
                applyTimerFromSettings();
            }),
        ),
        fieldRow(
            t('Hours'),
            input('number', general.hours, async (v) => {
                await updateGeneral({ hours: Math.max(0, Math.min(23, Number(v) || 0)) });
                applyTimerFromSettings();
            }),
        ),
        fieldRow(
            t('Minutes'),
            input('number', general.minutes, async (v) => {
                await updateGeneral({ minutes: Math.max(1, Math.min(59, Number(v) || 1)) });
                applyTimerFromSettings();
            }),
        ),
        fieldRow(
            t('Fetch on startup'),
            checkbox(general['fetch-on-startup'], (v) =>
                void updateGeneral({ 'fetch-on-startup': v }),
            ),
        ),
    );

    // ─── Startup section ────────────────────────────────────────────────
    const autostartCurrent = await safeIsAutostart();
    const startupSection = el(
        'div',
        { class: 'section' },
        el('h2', {}, t('Startup')),
        fieldRow(
            t('Start with Windows'),
            checkbox(autostartCurrent, async (v) => {
                try {
                    if (v) await enableAutostart();
                    else await disableAutostart();
                    await updateGeneral({ 'start-with-windows': v });
                } catch (err) {
                    alert(`${t('Failed')}: ${String(err)}`);
                }
            }),
        ),
        fieldRow(
            t('Start minimized to tray'),
            checkbox(general['start-minimized'], (v) =>
                void updateGeneral({ 'start-minimized': v }),
            ),
        ),
    );

    // ─── Notifications section ──────────────────────────────────────────
    const notificationsSection = el(
        'div',
        { class: 'section' },
        el('h2', {}, t('Notifications & Logs')),
        fieldRow(
            t('Show notifications'),
            checkbox(general['show-notifications'], (v) =>
                void updateGeneral({ 'show-notifications': v }),
            ),
        ),
        fieldRow(
            t('Log level'),
            select(
                [
                    { value: 0, label: t('Silent') },
                    { value: 1, label: t('Error') },
                    { value: 2, label: t('Warn') },
                    { value: 3, label: t('Info') },
                    { value: 4, label: t('Debug') },
                ],
                general['log-level'],
                (v) => void updateGeneral({ 'log-level': v }),
            ),
        ),
        fieldRow(
            t('Language'),
            select<LocalePref>(
                [
                    { value: 'auto', label: t('Auto (system)') },
                    { value: 'en', label: 'English' },
                    { value: 'zh-CN', label: '简体中文' },
                    { value: 'de', label: 'Deutsch' },
                ],
                general.language ?? 'auto',
                async (v) => {
                    await updateGeneral({ language: v });
                    setLocale(resolveLocale(v));
                    // Re-render the tab so the new translations take effect.
                    void renderGeneralTab(host);
                },
            ),
        ),
    );

    // ─── Appearance section ─────────────────────────────────
    const currentFamily = general['font-family'] ?? '';
    const isPreset = FONT_PRESETS.some((p) => p.value === currentFamily);
    const customFamilyInput = input('text', isPreset ? '' : currentFamily, async (v) => {
        await updateGeneral({ 'font-family': v });
        applyTypography(v, (await getGeneral())['font-size']);
    });
    customFamilyInput.placeholder = "'Segoe UI', system-ui, sans-serif";
    if (isPreset) customFamilyInput.setAttribute('disabled', '');

    const familySelect = select<string>(
        FONT_PRESETS.map((p) => ({
            value: p.value,
            label: p.value === '' ? t('System default') : p.label,
        })),
        isPreset ? currentFamily : '__custom__',
        async (v) => {
            if (v === '__custom__') {
                customFamilyInput.removeAttribute('disabled');
                return;
            }
            customFamilyInput.value = '';
            customFamilyInput.setAttribute('disabled', '');
            await updateGeneral({ 'font-family': v });
            applyTypography(v, (await getGeneral())['font-size']);
        },
    );
    // Append a Custom entry to the select.
    familySelect.append(
        Object.assign(document.createElement('option'), {
            value: '__custom__',
            textContent: t('Custom font family'),
        }),
    );
    if (!isPreset && currentFamily) familySelect.value = '__custom__';
    if (!isPreset && currentFamily) customFamilyInput.removeAttribute('disabled');

    const sizeInput = input('number', general['font-size'] ?? 14, async (v) => {
        const n = clampSize(Number(v));
        await updateGeneral({ 'font-size': n });
        applyTypography((await getGeneral())['font-family'], n);
    });
    sizeInput.setAttribute('min', '10');
    sizeInput.setAttribute('max', '24');

    const appearanceSection = el(
        'div',
        { class: 'section' },
        el('h2', {}, t('Appearance')),
        fieldRow(t('Font family'), familySelect),
        fieldRow(t('Custom font family'), customFamilyInput),
        fieldRow(t('Font size'), sizeInput),
    );

    host.append(
        el('div', { class: 'hero-action' }, requestBtn),
        wallpaperSection,
        historySection,
        autoFetchSection,
        startupSection,
        appearanceSection,
        notificationsSection,
    );
}

async function safeIsAutostart(): Promise<boolean> {
    try {
        return await isAutostartEnabled();
    } catch {
        return false;
    }
}

export async function applyTimerFromSettings(): Promise<void> {
    const general = await getGeneral();
    const timer = AfTimer.getInstance();
    const minutes = (general.hours || 0) * 60 + (general.minutes || 0);
    timer.setMinutes(Math.max(1, minutes));
    if (general['auto-fetch']) {
        timer.registerCallback(() => wallpaperController.fetchNewWallpaper());
        await timer.start();
    } else {
        await timer.stop();
    }
}
