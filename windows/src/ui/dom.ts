// Tiny DOM helpers — the UI deliberately avoids any framework.

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string | boolean | number> = {},
    ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === false || v === undefined || v === null) continue;
        if (k === 'class') node.className = String(v);
        else if (k === 'html') (node as HTMLElement).innerHTML = String(v);
        else if (k.startsWith('on') && typeof v === 'function')
            (node as unknown as Record<string, unknown>)[k] = v;
        else if (typeof v === 'boolean') {
            if (v) node.setAttribute(k, '');
        } else node.setAttribute(k, String(v));
    }
    for (const c of children) node.append(c);
    return node;
}

export function clear(node: HTMLElement): void {
    while (node.firstChild) node.removeChild(node.firstChild);
}

export function fieldRow(labelText: string, control: HTMLElement): HTMLElement {
    return el('div', { class: 'field-row' }, el('label', {}, labelText), control);
}

export function input(
    type: 'text' | 'number',
    value: string | number,
    onChange: (v: string) => void,
): HTMLInputElement {
    const i = document.createElement('input');
    i.type = type;
    i.value = String(value ?? '');
    i.addEventListener('change', () => onChange(i.value));
    return i;
}

export function checkbox(checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
    const lab = document.createElement('label');
    lab.className = 'checkbox';
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = checked;
    i.addEventListener('change', () => onChange(i.checked));
    lab.append(i);
    return lab;
}

export function select<T extends string | number>(
    options: Array<{ value: T; label: string }>,
    current: T,
    onChange: (v: T) => void,
): HTMLSelectElement {
    const s = document.createElement('select');
    for (const o of options) {
        const opt = document.createElement('option');
        opt.value = String(o.value);
        opt.textContent = o.label;
        if (o.value === current) opt.selected = true;
        s.append(opt);
    }
    s.addEventListener('change', () => {
        const raw = s.value;
        // numeric coercion for numeric option types
        const v = options[0] && typeof options[0].value === 'number' ? Number(raw) : raw;
        onChange(v as T);
    });
    return s;
}
