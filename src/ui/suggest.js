// Подсказки из каталога под полем названия: с третьей буквы — поиск, первый вариант
// выделен, ↑/↓ — выбор, Enter или клик — подставить, Esc — закрыть список.

import { h, icon, fmt } from './dom.js';
import { t } from '../i18n.js';
import { loadCatalog, searchCatalog, categoryName, tokens } from '../catalog.js';

const MIN_CHARS = 3;
let seq = 0;

// Название для поля: основа + «в коробке» с номером упаковки.
export const catalogTitle = (d) => (d.boxed ? `${d.base} — ${t('в коробке')}${d.pack ? ` ${d.pack.i}/${d.pack.n}` : ''}` : d.base);

export function catalogSuggest(input, onPick) {
  const id = `ac-${++seq}`;
  const pop = h('div', { class: 'ac-pop', id, role: 'listbox' });
  const box = h('div', { class: 'ac' }, input, pop);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', id);
  input.setAttribute('aria-expanded', 'false');
  input.autocomplete = 'off';

  let items = [];
  let active = 0;
  let picked = null; // значение поля после выбора — пока его не меняют, список не открываем
  let timer = 0;

  const close = () => {
    pop.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  // Совпавшие слова — в <mark>.
  const marked = (text, hits) => {
    const out = [];
    let at = 0;
    for (const m of text.matchAll(/\p{L}+|\p{N}+/gu)) {
      if (!hits.has(tokens(m[0])[0])) continue;
      if (m.index > at) out.push(text.slice(at, m.index));
      out.push(h('mark', {}, m[0]));
      at = m.index + m[0].length;
    }
    out.push(text.slice(at));
    return out;
  };

  const setActive = (i) => {
    active = i;
    [...pop.querySelectorAll('.ac-row')].forEach((r, j) => { r.classList.toggle('on', j === i); r.setAttribute('aria-selected', j === i); });
    const row = pop.querySelector(`#${id}-${i}`);
    if (row) { input.setAttribute('aria-activedescendant', row.id); row.scrollIntoView({ block: 'nearest' }); }
  };

  const pick = (i) => {
    const r = items[i];
    if (!r) return;
    close();
    picked = catalogTitle(r.doc);
    onPick(r.doc, picked);
  };

  const render = (res) => {
    items = res.items;
    pop.textContent = '';
    if (!items.length) { close(); return; }
    const list = h('div', { class: 'ac-list' });
    items.forEach(({ doc: d, hits }, i) => {
      const meta = [d.brand, t(categoryName(d.category))];
      // Бренд уже есть во второй строке — в первой его не повторяем.
      const lead = d.base.toLowerCase().startsWith(`${d.brand.toLowerCase()} `) ? d.brand.length + 1 : 0;
      if (d.boxed) meta.push(t('в коробке') + (d.pack ? ` ${d.pack.i}/${d.pack.n}` : '') + (d.copies > 1 ? ` ×${d.copies}` : ''));
      const row = h('div', { class: 'ac-row', id: `${id}-${i}`, role: 'option', title: d.base },
        h('span', { class: 'ac-ico', html: icon(d.boxed || d.container ? 'box' : 'item', 17) }),
        h('span', { class: 'ac-txt' }, h('b', {}, marked(d.base.slice(lead), hits)), h('small', {}, meta.filter(Boolean).join(' · '))),
        h('span', { class: 'ac-size' }, `${fmt(d.size.x)}×${fmt(d.size.y)}×${fmt(d.size.z)} ${t('см')}`),
        h('span', { class: 'ac-add', html: `${icon('plus', 13)}<span>${t('Добавить')}</span>` }));
      // pointerdown, а не click: фокус остаётся в поле.
      row.addEventListener('pointerdown', (e) => { e.preventDefault(); pick(i); });
      row.addEventListener('pointermove', () => { if (active !== i) setActive(i); });
      list.append(row);
    });
    pop.append(
      h('div', { class: 'ac-head' }, h('span', {}, t('Найдено в каталоге')), h('b', {}, String(res.total))),
      list,
      h('div', { class: 'ac-foot' }, t('↑↓ выбор · Enter — подставить габариты · Esc — закрыть')));
    pop.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
    setActive(0);
  };

  const update = () => {
    const q = input.value.trim();
    if (q.length < MIN_CHARS || q === picked) { close(); return; }
    loadCatalog().then(() => { if (input.value.trim() === q) render(searchCatalog(q)); });
  };

  input.addEventListener('input', () => { picked = null; clearTimeout(timer); timer = setTimeout(update, 60); });
  input.addEventListener('focus', update);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (e) => {
    if (!pop.classList.contains('open')) {
      if (e.key === 'ArrowDown' && input.value.trim().length >= MIN_CHARS) { e.preventDefault(); picked = null; update(); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation(); // не создавать объект, а подставить вариант
      pick(active);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // окно не закрываем — только список
      close();
      picked = input.value.trim();
    }
  });

  return box;
}
