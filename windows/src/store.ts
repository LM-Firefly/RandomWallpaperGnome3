// Persistent settings via tauri-plugin-store. A single JSON file under
// the OS app-data directory holds general settings, sources and history.

import { LazyStore } from '@tauri-apps/plugin-store';
import {
    DEFAULT_GENERAL,
    type GeneralSettings,
    type HistoryEntryData,
    type PersistedState,
    type SourceMeta,
} from './types.js';

const STORE_FILE = 'random-wallpaper.json';

const ROOT_KEY = 'state';

const lazyStore = new LazyStore(STORE_FILE);

let cache: PersistedState | null = null;
const listeners = new Set<(s: PersistedState) => void>();

async function read(): Promise<PersistedState> {
    if (cache) return cache;
    const raw = (await lazyStore.get<PersistedState>(ROOT_KEY)) ?? null;
    cache = raw
        ? {
              general: { ...DEFAULT_GENERAL, ...(raw.general ?? {}) },
              sources: raw.sources ?? [],
              history: raw.history ?? [],
          }
        : { general: { ...DEFAULT_GENERAL }, sources: [], history: [] };
    return cache;
}

async function flush(): Promise<void> {
    if (!cache) return;
    await lazyStore.set(ROOT_KEY, cache);
    await lazyStore.save();
    for (const fn of listeners) fn(cache);
}

export async function loadState(): Promise<PersistedState> {
    return read();
}

export function onStateChanged(fn: (s: PersistedState) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export async function getGeneral(): Promise<GeneralSettings> {
    return (await read()).general;
}

export async function updateGeneral(
    patch: Partial<GeneralSettings>,
): Promise<GeneralSettings> {
    const s = await read();
    s.general = { ...s.general, ...patch };
    await flush();
    return s.general;
}

export async function getSources(): Promise<SourceMeta[]> {
    return (await read()).sources;
}

export async function setSources(sources: SourceMeta[]): Promise<void> {
    const s = await read();
    s.sources = sources;
    await flush();
}

export async function upsertSource(src: SourceMeta): Promise<void> {
    const s = await read();
    const idx = s.sources.findIndex((x) => x.id === src.id);
    if (idx >= 0) s.sources[idx] = src;
    else s.sources.push(src);
    await flush();
}

export async function removeSource(id: string): Promise<void> {
    const s = await read();
    s.sources = s.sources.filter((x) => x.id !== id);
    await flush();
}

export async function getHistory(): Promise<HistoryEntryData[]> {
    return (await read()).history;
}

export async function setHistory(history: HistoryEntryData[]): Promise<void> {
    const s = await read();
    s.history = history;
    await flush();
}
