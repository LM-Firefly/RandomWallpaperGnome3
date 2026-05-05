// Applies user-customizable typography to the document via CSS variables.

import { getGeneral } from './store.js';

const DEFAULT_FAMILY =
    "'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei UI', 'PingFang SC', 'Inter', system-ui, sans-serif";

export const FONT_PRESETS: Array<{ value: string; label: string }> = [
    { value: '', label: 'System default' },
    { value: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif", label: 'Segoe UI' },
    { value: "'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif", label: '微软雅黑 (Microsoft YaHei)' },
    { value: "'Source Han Sans SC', 'Noto Sans SC', sans-serif", label: '思源黑体 (Source Han Sans)' },
    { value: "'HarmonyOS Sans SC', sans-serif", label: 'HarmonyOS Sans SC' },
    { value: "'LXGW WenKai', 'LXGW WenKai Screen', serif", label: '霞鹜文楷 (LXGW WenKai)' },
    { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
    { value: "'JetBrains Mono', 'Cascadia Mono', Consolas, monospace", label: 'JetBrains Mono' },
];

export function applyTypography(family: string, size: number): void {
    const root = document.documentElement;
    const fam = family && family.trim() ? family.trim() : DEFAULT_FAMILY;
    const sz = clampSize(size);
    root.style.setProperty('--font-family', fam);
    root.style.setProperty('--font-size', `${sz}px`);
}

export function clampSize(size: number | undefined): number {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return 14;
    return Math.max(10, Math.min(24, Math.round(n)));
}

export async function applyTypographyFromSettings(): Promise<void> {
    const g = await getGeneral();
    applyTypography(g['font-family'] ?? '', g['font-size'] ?? 14);
}
