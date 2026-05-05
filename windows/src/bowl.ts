// HTTP wrapper replacing libsoup. Uses tauri-plugin-http's `fetch` so
// requests bypass the WebView CORS / mixed-content policies.

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export interface BowlRequest {
    url: string;
    headers: Record<string, string>;
    method: 'GET';
}

export class Bowl {
    /** Build a GET request with the same User-Agent as the original extension. */
    newGetMessage(url: string, extraHeaders: Record<string, string> = {}): BowlRequest {
        return {
            url,
            method: 'GET',
            headers: {
                'User-Agent': 'RandomWallpaperWindows/0.1',
                ...extraHeaders,
            },
        };
    }

    async sendAndReceive(req: BowlRequest): Promise<Uint8Array> {
        const res = await tauriFetch(req.url, {
            method: req.method,
            headers: req.headers,
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} for ${req.url}`);
        }
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
    }

    async sendAndReceiveText(req: BowlRequest): Promise<string> {
        const bytes = await this.sendAndReceive(req);
        return new TextDecoder().decode(bytes);
    }

    async sendAndReceiveJson<T = unknown>(req: BowlRequest): Promise<T> {
        return JSON.parse(await this.sendAndReceiveText(req)) as T;
    }
}
