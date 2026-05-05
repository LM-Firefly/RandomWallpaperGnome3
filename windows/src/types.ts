// Source / adapter type definitions, kept structurally identical to the
// original GNOME extension so the porting effort across adapters stays
// minimal. Field names follow the original code base.

export const enum SourceType {
    UNSPLASH = 0,
    WALLHAVEN = 1,
    REDDIT = 2,
    GENERIC_JSON = 3,
    LOCAL_FOLDER = 4,
    STATIC_URL = 5,
}

export const SOURCE_TYPE_LABEL: Record<number, string> = {
    [SourceType.UNSPLASH]: 'Unsplash',
    [SourceType.WALLHAVEN]: 'Wallhaven',
    [SourceType.REDDIT]: 'Reddit',
    [SourceType.GENERIC_JSON]: 'Generic JSON',
    [SourceType.LOCAL_FOLDER]: 'Local Folder',
    [SourceType.STATIC_URL]: 'Static URL',
};

export interface SourceMeta {
    id: string;
    type: SourceType;
    name: string;
    enabled: boolean;
    /** Per-source blocked filenames. */
    blockedImages: string[];
    /** Source-type-specific configuration; opaque blob. */
    config: Record<string, unknown>;
}

export interface SourceInfo {
    author: string | null;
    authorUrl: string | null;
    source: string | null;
    sourceUrl: string | null;
    imageDownloadUrl: string;
    imageLinkUrl: string | null;
}

export interface AdapterInfoRef {
    id: string | null;
    type: number | null;
}

export interface HistoryEntryData {
    timestamp: number;
    id: string;
    name: string | null;
    path: string;
    source: SourceInfo;
    adapter: AdapterInfoRef | null;
}

/** General settings, mirroring the original gschema fields. */
export interface GeneralSettings {
    'history-length': number;
    'fetch-on-startup': boolean;
    'auto-fetch': boolean;
    minutes: number;
    hours: number;
    'timer-last-trigger': number;
    'change-type': number;
    'scaling-mode': string;
    'log-level': number;
    'show-notifications': boolean;
    'favorites-folder': string;
    'general-post-command': string;
    'multiple-displays': boolean;
    'sync-lock-screen': boolean;
    'start-with-windows': boolean;
    'start-minimized': boolean;
    language: 'auto' | 'en' | 'zh-CN' | 'de';
    'font-family': string;
    'font-size': number;
}

export const DEFAULT_GENERAL: GeneralSettings = {
    'history-length': 5,
    'fetch-on-startup': false,
    'auto-fetch': false,
    minutes: 30,
    hours: 1,
    'timer-last-trigger': 0,
    'change-type': 0,
    'scaling-mode': 'fill',
    'log-level': 2,
    'show-notifications': false,
    'favorites-folder': '',
    'general-post-command': '',
    'multiple-displays': false,
    'sync-lock-screen': false,
    'start-with-windows': false,
    'start-minimized': false,
    language: 'auto',
    'font-family': '',
    'font-size': 14,
};

export interface PersistedState {
    general: GeneralSettings;
    sources: SourceMeta[];
    history: HistoryEntryData[];
}
