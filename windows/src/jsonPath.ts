// JSONPath helpers — copied verbatim from the original GNOME extension
// (see src/jsonPath.ts in the upstream GNOME 3 codebase). Logic is
// identical; only the import path of `getRandomNumber` differs.

import { getRandomNumber } from './utils.js';

export function getTarget(
    inputObject: unknown,
    inputString: string,
): [unknown, string] {
    if (!inputObject) return [null, ''];

    if (inputString.length === 0) return [inputObject, inputString];

    let startDot = inputString.indexOf('.');
    if (startDot === -1) startDot = inputString.length;

    let keyString = inputString.slice(0, startDot);
    const inputStringTail = inputString.slice(startDot + 1);

    const startParentheses = keyString.indexOf('[');

    if (startParentheses === -1) {
        const targetObject = _getObjectMember(inputObject, keyString);
        if (targetObject === null || targetObject === undefined) return [null, ''];

        const [object, path] = getTarget(targetObject, inputStringTail);
        return [
            object,
            inputString.slice(0, inputString.length - inputStringTail.length) + path,
        ];
    } else {
        const indexString = keyString.slice(startParentheses + 1, keyString.length - 1);
        keyString = keyString.slice(0, startParentheses);

        const targetObject = _getObjectMember(inputObject, keyString);
        if (!targetObject || !Array.isArray(targetObject)) return [null, ''];

        switch (indexString) {
            case '@random': {
                const [chosen, idx] = _randomElement<unknown>(targetObject);
                const [object, path] = getTarget(chosen, inputStringTail);
                return [
                    object,
                    inputString
                        .slice(0, inputString.length - inputStringTail.length)
                        .replace('@random', String(idx)) + path,
                ];
            }
            default: {
                const [object, path] = getTarget(
                    targetObject[parseInt(indexString, 10)],
                    inputStringTail,
                );
                return [
                    object,
                    inputString.slice(0, inputString.length - inputStringTail.length) + path,
                ];
            }
        }
    }
}

function _getObjectMember(inputObject: unknown, keyString: string): unknown {
    if (keyString === '$') return inputObject;
    if (typeof inputObject !== 'object' || inputObject === null) return null;
    for (const [k, v] of Object.entries(inputObject as Record<string, unknown>)) {
        if (k === keyString) return v;
    }
    return null;
}

function _randomElement<T>(array: T[]): [T, number] {
    const i = getRandomNumber(array.length);
    return [array[i], i];
}

export function replaceRandomInPath(randomPath: string, resolvedPath: string): string {
    if (!randomPath.includes('@random')) return randomPath;

    let newPath = randomPath;
    while (newPath.includes('@random')) {
        const startRandom = newPath.indexOf('@random');
        if (newPath.substring(0, startRandom) !== resolvedPath.substring(0, startRandom))
            break;

        const endParenthesis = resolvedPath.indexOf(']', startRandom);
        newPath = newPath.replace(
            '@random',
            resolvedPath.substring(startRandom, endParenthesis),
        );
    }
    return newPath;
}
