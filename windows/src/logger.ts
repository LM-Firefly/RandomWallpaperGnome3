// Lightweight logger replacement for the original `Logger` class.

const enum Level {
    SILENT = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
}

let currentLevel: Level = Level.INFO;

export function setLogLevel(n: number): void {
    currentLevel = Math.max(0, Math.min(4, Math.trunc(n))) as Level;
}

function tag(ctx: unknown): string {
    if (ctx && typeof ctx === 'object') {
        const ctor = (ctx as { constructor?: { name?: string } }).constructor;
        if (ctor?.name) return `[${ctor.name}]`;
    }
    return '[RW]';
}

export const Logger = {
    debug(msg: unknown, ctx?: unknown): void {
        if (currentLevel >= Level.DEBUG) console.debug(tag(ctx), msg);
    },
    info(msg: unknown, ctx?: unknown): void {
        if (currentLevel >= Level.INFO) console.info(tag(ctx), msg);
    },
    warn(msg: unknown, ctx?: unknown): void {
        if (currentLevel >= Level.WARN) console.warn(tag(ctx), msg);
    },
    error(msg: unknown, ctx?: unknown): void {
        if (currentLevel >= Level.ERROR) console.error(tag(ctx), msg);
    },
};
