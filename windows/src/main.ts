// Application entry point.

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { exists, mkdir } from '@tauri-apps/plugin-fs';

import { Logger, setLogLevel } from './logger.js';
import { defaultFavoritesDir, wallpaperCacheDir } from './paths.js';
import { getGeneral, loadState, updateGeneral } from './store.js';
import { wallpaperController } from './wallpaperController.js';
import { AfTimer } from './timer.js';
import { onLocaleChange, resolveLocale, setLocale, t } from './i18n.js';
import { applyTypographyFromSettings } from './theme.js';
import { pushTrayLabels } from './tray.js';
import { renderGeneralTab, applyTimerFromSettings } from './ui/generalTab.js';
import { renderSourcesTab } from './ui/sourcesTab.js';
import { renderHistoryTab } from './ui/historyTab.js';

async function bootstrap(): Promise<void> {
    await loadState();
    const general = await getGeneral();
    setLogLevel(general['log-level']);
    setLocale(resolveLocale(general.language));
    await applyTypographyFromSettings();
    void pushTrayLabels();
    onLocaleChange(() => void pushTrayLabels());

    await wallpaperController.init();
    setupTabs();
    setupStatusHooks();
    await registerEventListeners();
    await applyTimerFromSettings();

    if (general['fetch-on-startup']) {
        // Don't block UI bootstrap.
        void wallpaperController
            .fetchNewWallpaper()
            .catch((err) => Logger.error(err));
    }
}

function setupTabs(): void {
    const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
    const panels = document.querySelectorAll<HTMLElement>('.panel');

    const renderers: Record<string, (host: HTMLElement) => Promise<void>> = {
        general: renderGeneralTab,
        sources: renderSourcesTab,
        history: renderHistoryTab,
    };

    const labelFor: Record<string, string> = {
        general: 'General',
        sources: 'Wallpaper Sources',
        history: 'History',
    };

    const refreshLabels = () => {
        tabs.forEach((tab) => {
            const k = tab.dataset.tab ?? 'general';
            tab.textContent = t(labelFor[k] ?? k);
        });
    };
    refreshLabels();
    onLocaleChange(refreshLabels);

    const activate = async (key: string) => {
        tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === key));
        panels.forEach((p) => p.classList.toggle('active', p.id === `tab-${key}`));
        const host = document.getElementById(`tab-${key}`);
        if (host && renderers[key]) await renderers[key](host);
    };

    tabs.forEach((tab) =>
        tab.addEventListener('click', () => {
            const k = tab.dataset.tab ?? 'general';
            void activate(k);
        }),
    );

    void activate('general');
}

function setupStatusHooks(): void {
    const status = document.getElementById('status-bar');
    if (!status) return;
    const setIdle = () => {
        status.textContent = t('Idle');
    };
    wallpaperController.onStart(() => {
        status.textContent = t('Fetching…');
    });
    wallpaperController.onStop(setIdle);
    setIdle();
    onLocaleChange(setIdle);
}

async function registerEventListeners(): Promise<void> {
    await listen('tray:request-new-wallpaper', async () => {
        try {
            await wallpaperController.fetchNewWallpaper();
        } catch (err) {
            Logger.error(err);
        }
    });

    await listen('tray:toggle-pause', async () => {
        const timer = AfTimer.getInstance();
        if (timer.isPaused()) timer.resume();
        else timer.pause();
    });

    await listen('tray:open-folder', async () => {
        try {
            const cfg = (await getGeneral())['favorites-folder'];
            const dir = cfg && cfg.trim() ? cfg : await wallpaperCacheDir();
            if (!(await exists(dir))) await mkdir(dir, { recursive: true });
            await invoke('open_path', { path: dir });
        } catch (err) {
            Logger.error(err);
        }
    });

    // First-launch convenience: stash the default favorites folder
    const general = await getGeneral();
    if (!general['favorites-folder']) {
        await updateGeneral({ 'favorites-folder': await defaultFavoritesDir() });
    }
}

bootstrap().catch((err) => {
    console.error(err);
    document.body.append(
        Object.assign(document.createElement('pre'), {
            textContent: `Bootstrap failed: ${String(err)}`,
            style: 'color:#f88;padding:24px;',
        }),
    );
});
