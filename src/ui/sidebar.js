// Левая панель: бренд, «Новый объект», поиск и дерево-аккордеон склада.
// Перетаскивание строки на другую — переложить внутрь, на пустое место — на пол.
// Свёрнутая — узкая полоска с квадратными иконками (комнаты, создание, настройки).

import * as store from '../store.js';
import { h, icon, iconEl, kindIcon, dims, fmtVol } from './dom.js';
import { t, tn } from '../i18n.js';

export class Sidebar {
  constructor(el, { onCreate, onExport, onImport, onSettings, onZen, onToggle, onHelp, toast }) {
    this.el = el;
    this.open = new Set();
    this.query = '';
    this.toast = toast;
    this.rows = new Map();

    const search = h('input', { type: 'search', placeholder: t('Поиск по складу'), spellcheck: 'false' });
    search.addEventListener('input', () => { this.query = search.value.trim().toLowerCase(); this.render(); });
    this.searchInput = search;

    this.treeEl = h('div', { class: 'tree', role: 'tree' });
    this.treeEl.addEventListener('dragover', (e) => { if (e.target === this.treeEl) { e.preventDefault(); this.treeEl.classList.add('drop-root'); } });
    this.treeEl.addEventListener('dragleave', (e) => { if (e.target === this.treeEl) this.treeEl.classList.remove('drop-root'); });
    this.treeEl.addEventListener('drop', (e) => {
      this.treeEl.classList.remove('drop-root');
      if (e.target !== this.treeEl) return;
      e.preventDefault();
      this.drop(this.dragId, null);
    });

    this.countEl = h('span', { class: 'count' });
    this.statsEl = h('div', { class: 'stats' });

    // Полоска (свёрнутая панель)
    this.railRooms = h('div', { class: 'rail-rooms' });
    this.railZen = h('button', { class: 'rail-btn', 'data-tip': t('Режим Дзен'), onclick: onZen, html: icon('leaf', 19) });
    const rail = h('div', { class: 'rail' },
      h('button', { class: 'rail-logo', 'data-tip': t('Развернуть панель  ['), onclick: onToggle, html: icon('layers', 20) }),
      h('button', { class: 'rail-btn rail-new', 'data-tip': t('Новый объект  N'), onclick: () => onCreate(null), html: icon('plus', 20) }),
      h('button', { class: 'rail-btn', 'data-tip': t('Поиск'), onclick: () => { onToggle(); requestAnimationFrame(() => search.focus()); }, html: icon('search', 19) }),
      h('i', { class: 'rail-sep' }),
      this.railRooms,
      h('i', { class: 'rail-sep' }),
      this.railZen,
      h('button', { class: 'rail-btn', 'data-tip': t('Справка  ?'), onclick: onHelp, html: icon('help', 19) }),
      h('button', { class: 'rail-btn', 'data-tip': t('Настройки  ,'), onclick: onSettings, html: icon('gear', 19) }),
      h('button', { class: 'rail-btn', 'data-tip': t('Развернуть панель  ['), onclick: onToggle, html: icon('panelOpen', 19) }));

    const full = h('div', { class: 'side-full' });
    el.append(full, rail);
    full.append(
      h('div', { class: 'brand' },
        h('div', { class: 'logo', html: icon('layers', 20) }),
        h('div', { class: 'brand-txt' }, h('b', {}, '3DPacking'), h('small', {}, t('Пространство хранения'))),
        h('button', { class: 'icon-btn collapse-btn', 'data-tip': t('Свернуть панель  ['), onclick: onToggle, html: icon('panelClose', 18) })),
      h('button', { class: 'btn btn-primary btn-new', onclick: () => onCreate(null) }, iconEl('plus', 18), t('Новый объект'), h('kbd', {}, 'N')),
      h('label', { class: 'search' }, iconEl('search', 16), search),
      h('div', { class: 'sec-title' }, h('span', {}, t('Объекты')), this.countEl),
      this.treeEl,
      h('div', { class: 'side-foot' },
        this.statsEl,
        h('div', { class: 'foot-acts' },
          h('button', { class: 'icon-btn', 'data-tip': t('Экспорт в JSON'), onclick: onExport, html: icon('download', 17) }),
          h('button', { class: 'icon-btn', 'data-tip': t('Импорт из JSON'), onclick: onImport, html: icon('upload', 17) }),
          (this.zenBtn = h('button', { class: 'icon-btn zen-btn', 'data-tip': t('Режим Дзен'), onclick: onZen, html: icon('leaf', 17) })),
          h('button', { class: 'icon-btn', 'data-tip': t('Справка'), onclick: onHelp, html: icon('help', 17) }),
          h('button', { class: 'icon-btn', 'data-tip': t('Настройки'), onclick: onSettings, html: icon('gear', 17) }))),
    );
  }

  // Совпадает ли объект или кто-то из потомков с поиском.
  matches(it) {
    if (!this.query) return true;
    if (it.name.toLowerCase().includes(this.query)) return true;
    return store.descendants(it.id).some((d) => d.name.toLowerCase().includes(this.query));
  }

  render() {
    const scroll = this.treeEl.scrollTop;
    this.treeEl.textContent = '';
    this.rows.clear();
    const sel = store.selectedIdNow();
    const build = (pid, depth) => {
      const frag = document.createDocumentFragment();
      for (const it of store.children(pid)) {
        if (!this.matches(it)) continue;
        const kids = store.children(it.id);
        const isOpen = this.query ? true : this.open.has(it.id);
        const bad = store.hasProblem(it.id);
        const row = h('div', {
          class: `row${it.id === sel ? ' selected' : ''}${it.visible ? '' : ' hidden-item'}`,
          role: 'treeitem', draggable: 'true', 'data-id': it.id, '--depth': depth, '--c': it.color, title: `${it.name} · ${dims(it.size)} ${t('см')}`,
        },
          h('button', { class: `caret${isOpen ? ' open' : ''}${kids.length ? '' : ' empty'}`, html: icon('chevron', 14), onclick: (e) => { e.stopPropagation(); this.toggle(it.id); } }),
          h('span', { class: 'ico', html: icon(kindIcon(it, kids.length), 15) }),
          h('span', { class: 'name' }, it.name),
          bad ? h('span', { class: 'warn', html: icon('warn', 14), title: t('Не помещается или пересекается') }) : null,
          kids.length ? h('span', { class: 'badge' }, String(kids.length)) : null,
          h('span', { class: 'acts' },
            h('button', { class: 'mini', title: t('Показать в 3D'), html: icon('target', 15), onclick: (e) => { e.stopPropagation(); store.select(it.id, { fly: true }); } }),
            h('button', { class: `mini${it.visible ? '' : ' on'}`, title: it.visible ? t('Скрыть') : t('Показать'), html: icon(it.visible ? 'eye' : 'eyeOff', 15), onclick: (e) => { e.stopPropagation(); store.update(it.id, { visible: !it.visible }); } })),
        );
        row.addEventListener('click', () => {
          if (kids.length && !this.open.has(it.id)) this.toggle(it.id);
          store.select(it.id, { fly: true });
        });
        row.addEventListener('dblclick', () => this.toggle(it.id));
        this.bindDrag(row, it.id);
        this.rows.set(it.id, row);
        frag.append(row);
        if (kids.length) {
          const box = h('div', { class: `kids${isOpen ? ' open' : ''}`, 'data-for': it.id, '--depth': depth, inert: !isOpen },
            h('div', { class: 'kids-inner' }, build(it.id, depth + 1)));
          frag.append(box);
        }
      }
      return frag;
    };
    const tree = build(null, 0);
    if (!tree.childNodes.length) {
      this.treeEl.append(h('div', { class: 'tree-empty' },
        h('div', { class: 'empty-ico', html: icon(this.query ? 'search' : 'box', 26) }),
        h('b', {}, this.query ? t('Ничего не найдено') : t('Склад пуст')),
        h('span', {}, this.query ? t('Попробуйте другое название') : t('Создайте первый контейнер — комнату, шкаф или коробку'))));
    } else this.treeEl.append(tree);
    this.treeEl.scrollTop = scroll;

    const all = store.all();
    const roots = store.roots().length;
    this.countEl.textContent = String(all.length);
    this.renderRail();
    const vol = store.roots().reduce((s, r) => s + store.volume(r), 0);
    this.statsEl.innerHTML = `<b>${roots}</b> ${tn(roots, 'контейнер')} · <b>${all.length - roots}</b> ${tn(all.length - roots, 'вложение')}<small>${t('Общий объём {vol}', { vol: fmtVol(vol) })}</small>`;
  }

  // Комнаты и корневые контейнеры — квадратными иконками своего цвета.
  renderRail() {
    const sel = store.selectedIdNow();
    const path = new Set(sel ? [sel, ...store.ancestors(sel).map((a) => a.id)] : []);
    this.railRooms.textContent = '';
    for (const r of store.roots()) {
      const n = store.descendants(r.id).length;
      this.railRooms.append(h('button', {
        class: `rail-room${path.has(r.id) ? ' on' : ''}`, '--c': r.color, 'data-tip': `${r.name} · ${n} ${tn(n, 'вещь')}`,
        onclick: () => store.select(r.id, { fly: true }),
        html: icon(kindIcon(r, n), 19),
      }));
    }
  }

  toggle(id) {
    const open = !this.open.has(id);
    open ? this.open.add(id) : this.open.delete(id);
    const kids = this.treeEl.querySelector(`.kids[data-for="${id}"]`);
    if (kids) { kids.classList.toggle('open', open); kids.inert = !open; }
    this.rows.get(id)?.querySelector('.caret')?.classList.toggle('open', open);
  }

  // Раскрыть путь к выбранному и прокрутить к строке.
  reveal(id) {
    if (!id) { this.render(); return; }
    let changed = false;
    for (const a of store.ancestors(id)) if (!this.open.has(a.id)) { this.open.add(a.id); changed = true; }
    if (changed || !this.rows.has(id)) this.render();
    else { for (const [rid, row] of this.rows) row.classList.toggle('selected', rid === id); this.renderRail(); }
    requestAnimationFrame(() => this.rows.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  bindDrag(row, id) {
    row.addEventListener('dragstart', (e) => {
      this.dragId = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); this.dragId = null; this.treeEl.querySelectorAll('.drop-into').forEach((r) => r.classList.remove('drop-into')); });
    row.addEventListener('dragover', (e) => {
      const ok = this.dragId && this.dragId !== id && !store.isAncestor(this.dragId, id);
      if (!ok) return;
      e.preventDefault();
      row.classList.add('drop-into');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-into'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drop-into');
      this.drop(this.dragId, id);
    });
  }

  drop(dragId, targetId) {
    const it = store.get(dragId);
    if (!it || it.parentId === targetId) return;
    const res = store.moveTo(dragId, targetId);
    if (!res.ok) return;
    if (targetId) this.open.add(targetId);
    const p = { name: it.name, target: store.get(targetId)?.name };
    const msg = targetId
      ? (res.fitted ? '«{name}» перемещён в «{target}»' : '«{name}» не помещается в «{target}» — отмечен красным')
      : (res.fitted ? '«{name}» перемещён на пол' : '«{name}» не помещается на пол — отмечен красным');
    this.toast(t(msg, p), res.fitted ? 'ok' : 'warn');
    store.select(dragId);
  }
}
