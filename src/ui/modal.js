// Модальные окна: создание объекта и подтверждение. Плюс тосты.

import * as store from '../store.js';
import { h, icon, iconEl, fmt, fmtVol } from './dom.js';
import { t } from '../i18n.js';

const root = () => document.getElementById('modal-root');

export function openModal({ title, subtitle, icon: ico, body, actions, width = 540, onClose }) {
  const back = h('div', { class: 'modal-back' });
  const close = () => {
    back.classList.add('out');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => back.remove(), 180);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  const card = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', style: { width: `min(${width}px, calc((100vw - 32px) / var(--ui)))` } },
    h('div', { class: 'modal-head' },
      ico ? h('div', { class: 'modal-ico', html: icon(ico, 22) }) : null,
      h('div', {}, h('h3', {}, title), subtitle ? h('p', {}, subtitle) : null),
      h('button', { class: 'icon-btn close', 'aria-label': t('Закрыть'), html: icon('close', 16), onclick: close })),
    h('div', { class: 'modal-body' }, body),
    actions ? h('div', { class: 'modal-foot' }, actions(close)) : null);
  back.append(card);
  root().append(back);
  return { close, card };
}

export function confirmModal({ title, text, ok = t('Удалить'), danger = true }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title, icon: danger ? 'trash' : 'check', width: 420,
      body: h('p', { class: 'confirm-text' }, text),
      onClose: () => { if (!done) resolve(false); },
      actions: (close) => [
        h('button', { class: 'btn btn-soft', onclick: close }, t('Отмена')),
        h('button', { class: `btn ${danger ? 'btn-danger solid' : 'btn-primary'}`, onclick: () => { done = true; resolve(true); close(); } }, ok),
      ],
    });
    requestAnimationFrame(() => m.card.querySelector('.modal-foot .btn:last-child')?.focus());
  });
}

const PRESETS = [
  { kind: 'room', name: 'Комната', icon: 'room', size: { x: 400, y: 270, z: 300 }, opacity: 0.12 },
  { kind: 'cabinet', name: 'Шкаф', icon: 'cabinet', size: { x: 100, y: 200, z: 60 }, opacity: 0.25 },
  { kind: 'rack', name: 'Стеллаж', icon: 'rack', size: { x: 90, y: 180, z: 40 }, opacity: 0.22 },
  { kind: 'box', name: 'Коробка', icon: 'box', size: { x: 40, y: 30, z: 30 }, opacity: 1 },
  { kind: 'box', name: 'Ящик', icon: 'box', size: { x: 60, y: 40, z: 40 }, opacity: 1 },
  { kind: 'item', name: 'Предмет', icon: 'item', size: { x: 20, y: 15, z: 15 }, opacity: 1 },
];

// Создание объекта: пресет → имя → габариты → куда положить → цвет.
export function createObjectModal({ parentId = null, onCreated }) {
  const st = {
    preset: parentId ? PRESETS[3] : PRESETS[0],
    parentId,
    color: store.PALETTE[store.all().length % store.PALETTE.length],
    size: null,
    opacity: null,
    nameTouched: false,
  };
  st.size = { ...st.preset.size };
  st.opacity = st.preset.opacity;

  const name = h('input', { class: 'input big', placeholder: t('Например, «Коробка с книгами»'), spellcheck: 'false' });
  name.addEventListener('input', () => { st.nameTouched = !!name.value; });

  const dimIn = (k, label) => {
    const i = h('input', { class: 'input', inputmode: 'decimal', value: fmt(st.size[k]) });
    i.addEventListener('input', () => { const v = parseFloat(i.value.replace(',', '.')); if (v > 0) { st.size[k] = v; refresh(); } });
    return h('label', { class: 'dim' }, h('span', {}, label), i, h('em', {}, t('см')));
  };
  const dimsBox = h('div', { class: 'dims' });
  const renderDims = () => {
    dimsBox.textContent = '';
    dimsBox.append(dimIn('x', t('Ширина')), h('i', { class: 'x', html: icon('close', 12) }), dimIn('y', t('Высота')), h('i', { class: 'x', html: icon('close', 12) }), dimIn('z', t('Глубина')));
  };

  const presetBox = h('div', { class: 'presets' }, ...PRESETS.map((p) => {
    const b = h('button', { class: 'preset', type: 'button' },
      h('span', { class: 'p-ico', html: icon(p.icon, 20) }),
      h('b', {}, t(p.name)),
      h('small', {}, `${p.size.x}×${p.size.y}×${p.size.z}`));
    b.addEventListener('click', () => {
      st.preset = p;
      st.size = { ...p.size };
      st.opacity = p.opacity;
      transp.checked = p.opacity < 1;
      if (!st.nameTouched) name.placeholder = t('Например, «{name}»', { name: t(p.name) });
      renderDims();
      refresh();
    });
    b._p = p;
    return b;
  }));

  const parentSel = h('select', { class: 'select' }, h('option', { value: '' }, t('— На пол, как отдельный контейнер')));
  const walk = (pid, depth) => { for (const c of store.children(pid)) { parentSel.append(h('option', { value: c.id }, `${' '.repeat(depth)}${c.name}`)); walk(c.id, depth + 1); } };
  walk(null, 0);
  parentSel.value = parentId || '';
  parentSel.addEventListener('change', () => { st.parentId = parentSel.value || null; refresh(); });

  const swatches = h('div', { class: 'swatches' });
  const renderSw = () => {
    swatches.textContent = '';
    for (const c of store.PALETTE) swatches.append(h('button', { type: 'button', class: `sw${c === st.color ? ' on' : ''}`, '--c': c, onclick: () => { st.color = c; renderSw(); } }));
  };

  const transp = h('input', { type: 'checkbox', checked: st.opacity < 1 });
  transp.addEventListener('change', () => { st.opacity = transp.checked ? 0.18 : 1; });

  const fitLine = h('div', { class: 'fit' });
  const refresh = () => {
    for (const b of presetBox.children) b.classList.toggle('on', b._p === st.preset);
    const vol = st.size.x * st.size.y * st.size.z;
    if (!st.parentId) {
      fitLine.className = 'fit neutral';
      fitLine.innerHTML = `${icon('room', 16)}<span>${t('Встанет на пол рядом с остальными · {vol}', { vol: fmtVol(vol) })}</span>`;
      return;
    }
    const p = store.get(st.parentId);
    const spot = store.findSpot(st.parentId, st.size);
    if (spot) {
      fitLine.className = 'fit ok';
      const msg = spot.size.x !== st.size.x ? 'Поместится в «{name}» (с поворотом на 90°) · {vol}' : 'Поместится в «{name}» · {vol}';
      fitLine.innerHTML = `${icon('check', 16)}<span>${t(msg, { name: p.name, vol: fmtVol(vol) })}</span>`;
    } else {
      fitLine.className = 'fit warn';
      fitLine.innerHTML = `${icon('warn', 16)}<span>${t('Не помещается в «{name}» — объект будет отмечен красным', { name: p.name })}</span>`;
    }
  };

  renderDims();
  renderSw();
  refresh();

  const submit = (close) => {
    const res = store.add({
      name: name.value || t(st.preset.name),
      kind: st.preset.kind,
      size: { ...st.size },
      parentId: st.parentId,
      color: st.color,
      opacity: st.opacity,
    });
    close();
    onCreated?.(res);
  };

  const body = h('div', { class: 'create' },
    h('div', { class: 'field' }, h('span', {}, t('Тип')), presetBox),
    h('label', { class: 'field' }, h('span', {}, t('Название')), name),
    h('div', { class: 'field' }, h('span', {}, t('Габариты')), dimsBox),
    h('label', { class: 'field' }, h('span', {}, t('Положить в')), parentSel),
    h('div', { class: 'field two' },
      h('div', {}, h('span', {}, t('Цвет')), swatches),
      h('label', { class: 'toggle' }, h('span', {}, t('Прозрачный')), transp, h('i', { class: 'switch' }))),
    fitLine);

  const m = openModal({
    title: parentId ? t('Положить в «{name}»', { name: store.get(parentId)?.name }) : t('Новый объект'),
    subtitle: t('Задайте имя, габариты и место хранения'),
    icon: 'plus',
    body,
    actions: (close) => [
      h('button', { class: 'btn btn-soft', onclick: close }, t('Отмена')),
      h('button', { class: 'btn btn-primary', onclick: () => submit(close) }, iconEl('check', 17), t('Создать')),
    ],
  });
  m.card.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(m.close); } });
  requestAnimationFrame(() => name.focus());
}

export function toast(text, kind = 'info') {
  const box = document.getElementById('toasts');
  const ico = { ok: 'check', warn: 'warn', info: 'sparkle' }[kind] || 'sparkle';
  const t = h('div', { class: `toast ${kind}` }, h('span', { class: 't-ico', html: icon(ico, 16) }), h('span', {}, text));
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 2800);
}
