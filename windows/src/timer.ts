// Auto-fetch timer — JS-side ticker. Cleaner than a Rust scheduler since
// adapters live in TS already and the hidden window is kept loaded by the
// tray.

import { Logger } from './logger.js';
import { getGeneral, updateGeneral } from './store.js';

type Callback = () => Promise<void>;

export class AfTimer {
    private static _instance: AfTimer | null = null;

    static getInstance(): AfTimer {
        return (this._instance ??= new AfTimer());
    }

    private _timeoutId: number | undefined;
    private _callback: Callback | null = null;
    private _minutes = 30;
    private _paused = false;

    registerCallback(cb: Callback): void {
        this._callback = cb;
    }

    setMinutes(m: number): void {
        this._minutes = Math.max(1, Math.trunc(m));
    }

    isPaused(): boolean {
        return this._paused;
    }

    pause(): void {
        Logger.debug('Timer paused', this);
        this._paused = true;
        this._clear();
    }

    resume(): void {
        if (!this._paused) return;
        Logger.debug('Timer resumed', this);
        this._paused = false;
        void this.start(false);
    }

    async start(forceTrigger = false): Promise<void> {
        if (this._paused) return;
        this._clear();

        const general = await getGeneral();
        let last = general['timer-last-trigger'];
        if (last === 0) {
            last = Date.now();
            await updateGeneral({ 'timer-last-trigger': last });
        }

        const intervalMs = this._minutes * 60 * 1000;
        const elapsed = Date.now() - last;
        const remaining = Math.max(intervalMs - (elapsed % intervalMs), 0);
        const surpassed = elapsed >= intervalMs;

        if (forceTrigger || surpassed) {
            if (this._callback) {
                try {
                    await this._callback();
                } catch (err) {
                    Logger.error(err, this);
                }
            }
        }

        if (surpassed) {
            const overdue = intervalMs - remaining;
            await updateGeneral({ 'timer-last-trigger': Date.now() - overdue });
        }

        Logger.debug(`Next tick in ${remaining}ms`, this);
        this._timeoutId = window.setTimeout(() => {
            void updateGeneral({ 'timer-last-trigger': Date.now() }).then(() =>
                this.start(true),
            );
        }, remaining);
    }

    async stop(): Promise<void> {
        await updateGeneral({ 'timer-last-trigger': 0 });
        this._clear();
    }

    remainingMinutes(): number {
        if (!this._timeoutId) return 0;
        return this._minutes; // best-effort estimate
    }

    private _clear(): void {
        if (this._timeoutId !== undefined) {
            clearTimeout(this._timeoutId);
            this._timeoutId = undefined;
        }
    }
}
