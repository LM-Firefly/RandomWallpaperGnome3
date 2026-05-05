// Misc helpers ported from the original `utils.ts` (omits anything that
// only made sense in the GJS context).

export function getRandomNumber(size: number): number {
    return Math.floor(Math.random() * size);
}

export function shuffleArray<T>(array: T[]): T[] {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function isUriEncoded(uri: string): boolean {
    return uri !== decodeURIComponent(uri);
}

/** Extract the file-name portion of an URL, dropping any query string. */
export function fileName(uri: string): string {
    let s = uri;
    while (isUriEncoded(s)) s = decodeURIComponent(s);

    let base = s.substring(s.lastIndexOf('/') + 1);
    if (base.indexOf('?') >= 0) base = base.substring(0, base.indexOf('?'));
    if (base.indexOf('#') >= 0) base = base.substring(0, base.indexOf('#'));
    return base;
}

let _idCounter = 0;
export function newId(): string {
    _idCounter += 1;
    return `${Date.now().toString(36)}-${_idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
