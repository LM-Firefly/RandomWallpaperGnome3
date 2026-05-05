// Sources tab — list of configured sources, add/edit/delete.

import {
    checkbox,
    clear,
    el,
    fieldRow,
    input,
    select,
} from './dom.js';
import {
    SOURCE_TYPE_LABEL,
    SourceType,
    type SourceMeta,
} from './../types.js';
import { newId } from './../utils.js';
import { getSources, removeSource, upsertSource } from './../store.js';
import { t } from './../i18n.js';
import { buildForm } from './sourceForms.js';

const NEW_TYPES: Array<{ value: SourceType; label: string }> = [
    { value: SourceType.WALLHAVEN, label: 'Wallhaven' },
    { value: SourceType.REDDIT, label: 'Reddit' },
    { value: SourceType.UNSPLASH, label: 'Unsplash' },
    { value: SourceType.GENERIC_JSON, label: 'Generic JSON' },
    { value: SourceType.STATIC_URL, label: 'Static URL' },
    { value: SourceType.LOCAL_FOLDER, label: 'Local Folder' },
];

export async function renderSourcesTab(host: HTMLElement): Promise<void> {
    clear(host);
    const sources = await getSources();

    const addSelect = select<SourceType>(NEW_TYPES, SourceType.WALLHAVEN, () => {});
    const addBtn = el('button', { class: 'primary' }, t('Add Source'));
    addBtn.addEventListener('click', async () => {
        const type = Number(addSelect.value) as SourceType;
        const meta: SourceMeta = {
            id: newId(),
            type,
            name: SOURCE_TYPE_LABEL[type] ?? 'Source',
            enabled: true,
            blockedImages: [],
            config: {},
        };
        await upsertSource(meta);
        await renderSourcesTab(host);
    });

    host.append(
        el('div', { class: 'toolbar' }, addSelect, addBtn),
    );

    if (sources.length === 0) {
        host.append(
            el('div', { class: 'section' }, el('p', {}, t('No sources configured yet. Add one above to start.'))),
        );
        return;
    }

    for (const meta of sources) {
        host.append(renderSourceCard(meta, () => renderSourcesTab(host)));
    }
}

function renderSourceCard(meta: SourceMeta, refresh: () => void): HTMLElement {
    const card = el('div', { class: 'section' });

    const enabledBox = checkbox(meta.enabled, async (v) => {
        meta.enabled = v;
        await upsertSource(meta);
    });

    const nameInput = input('text', meta.name, async (v) => {
        meta.name = v.trim() || (SOURCE_TYPE_LABEL[meta.type] ?? 'Source');
        await upsertSource(meta);
        // Update the visible header without rerendering everything.
        header.querySelector<HTMLSpanElement>('.name')!.textContent = meta.name;
    });

    const typeLabel = SOURCE_TYPE_LABEL[meta.type] ?? 'Unknown';

    const header = el(
        'div',
        { class: 'source-card' },
        enabledBox,
        el(
            'div',
            { class: 'meta' },
            el('span', { class: 'name' }, meta.name),
            el('span', { class: 'type' }, typeLabel),
        ),
        (() => {
            const wrap = el('div', { class: 'toolbar', style: 'margin:0;gap:6px;' });
            const editToggle = el('button', {}, t('Edit'));
            const del = el('button', { class: 'danger' }, t('Delete'));
            del.addEventListener('click', async () => {
                if (!confirm(`${t('Delete')} "${meta.name}"?`)) return;
                await removeSource(meta.id);
                refresh();
            });
            editToggle.addEventListener('click', () => {
                form.toggleAttribute('hidden');
            });
            wrap.append(editToggle, del);
            return wrap;
        })(),
    );

    const form = el(
        'div',
        { class: 'source-form', hidden: true },
        fieldRow(t('Display name'), nameInput),
        buildForm(meta),
        (() => {
            const save = el('button', { class: 'primary' }, t('Save'));
            save.addEventListener('click', async () => {
                await upsertSource(meta);
                form.setAttribute('hidden', '');
            });
            const blocked = el(
                'textarea',
                { placeholder: t('One blocked filename per line') },
            ) as HTMLTextAreaElement;
            blocked.value = meta.blockedImages.join('\n');
            blocked.addEventListener('change', () => {
                meta.blockedImages = blocked.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
            });
            return el(
                'div',
                {},
                fieldRow(t('Blocked filenames'), blocked),
                el('div', { class: 'toolbar right' }, save),
            );
        })(),
    );

    card.append(header, form);
    return card;
}
