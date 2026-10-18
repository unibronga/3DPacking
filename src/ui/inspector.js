// Правая панель: свойства выбранного объекта, или обзор склада, если
// ничего не выбрано. Секции — аккордеон; числа можно «тянуть» за подпись.

import * as store from '../store.js';
import { h, icon, iconEl, kindIcon, dims, fmt, fmtVol, ring } from './dom.js';
import { t, tn } from '../i18n.js';
import * as photos from '../photos.js';
import { openLightbox } from './lightbox.js';
import { SHORTCUTS } from './help.js';

const isZen = () => document.documentElement.hasAttribute('data-zen');
const KIND_NAMES = { room: 'Комната', rack: 'Стеллаж', cabinet: 'Шкаф', box: 'Коробка', item: 'Предмет' };

export class Inspector {
  constructor(el, { onCreate, onDelete, onArrange, onArrangeMode, toast }) {
    this.el = el;
    this.onArrange = onArrange;
    this.onArrangeMode = onArrangeMode;
    this.onCreate = onCreate;
    this.onDelete = onDelete;
    this.toast = toast;
    this.closed = new Set(['notes']);
    this.busy = false;
    this.stale = false;
    el.addEventListener('focusout', () => setTimeout(() => { if (this.stale && !this.isEditing()) this.render(); }, 0));

    // Фото можно перетащить файлом на панель или вставить из буфера (⌘V).
    el.addEventListener('dragover', (e) => {
      if (!store.selected() || ![...e.dataTransfer.items].some((i) => i.kind === 'file')) return;
      e.preventDefault();
      el.classList.add('drop-photo');
    });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-photo'); });
    el.addEventListener('drop', (e) => {
      el.classList.remove('drop-photo');
      const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
      const it = store.selected();
      if (!file || !it) return;
      e.preventDefault();
      this.setPhoto(it.id, file);
    });
    document.addEventListener('paste', (e) => {
      const it = store.selected();
      const a = document.activeElement;
      if (!it || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) || document.querySelector('.modal-back')) return;
      const file = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
      if (!file) return;
      e.preventDefault();
      this.setPhoto(it.id, file);
    });
  }

  isEditing() {
    const a = document.activeElement;
    return this.busy || (a && this.el.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
  }

  // Перерисовка по изменению данных — но не под пальцами у пользователя.
  onChange() {
    if (this.isEditing()) { this.stale = true; return; }
    this.render();
  }

  render() {
    this.stale = false;
    const scroll = this.el.querySelector('.insp-scroll')?.scrollTop || 0;
    this.el.textContent = '';
    const it = store.selected();
    const body = it ? this.renderItem(it) : this.renderOverview();
    this.el.append(body);
    const sc = this.el.querySelector('.insp-scroll');
    if (sc) sc.scrollTop = scroll;
  }

  // ── обзор ─────────────────────────────────────────────────────────────
  renderOverview() {
    const roots = store.roots();
    const all = store.all();
    const cards = roots.map((r) => {
      const n = store.descendants(r.id).length;
      return h('button', { class: 'ov-card', '--c': r.color, onclick: () => store.select(r.id, { fly: true }) },
        h('div', { class: 'ov-ring', html: ring(store.fill(r.id), 46, 5) + `<span>${Math.round(store.fill(r.id) * 100)}%</span>` }),
        h('div', { class: 'ov-txt' },
          h('b', {}, r.name),
          h('small', {}, `${n} ${tn(n, 'объект')} · ${dims(r.size)} ${t('см')}`)),
        h('span', { class: 'ov-go', html: icon('chevron', 14) }));
    });
    return h('div', { class: 'insp-scroll' },
      h('div', { class: 'hero' },
        h('div', { class: 'hero-art', html: icon('sparkle', 30) }),
        h('h2', {}, t('Обзор склада')),
        h('p', {}, all.length
          ? t('{containers} и {nested}. Выберите объект в списке или в сцене.', { containers: `${roots.length} ${tn(roots.length, 'контейнер')}`, nested: `${all.length - roots.length} ${tn(all.length - roots.length, 'вложение')}` })
          : t('Создайте контейнер и складывайте в него вещи — всё будет видно в 3D.'))),
      roots.length ? h('div', { class: 'ov-list' }, cards) : h('button', { class: 'btn btn-primary wide', onclick: () => this.onCreate(null) }, iconEl('plus', 17), t('Создать контейнер')),
      isZen() ? null : h('div', { class: 'shortcuts' },
        h('div', { class: 'sec-label' }, t('Горячие клавиши')),
        ...SHORTCUTS.map(([k, label]) => h('div', { class: 'sc' }, h('span', {}, t(label)), h('kbd', {}, t(k))))),
    );
  }

  // ── объект ────────────────────────────────────────────────────────────
  renderItem(it) {
    const zen = isZen();
    const kids = store.children(it.id);
    const parent = store.get(it.parentId);
    const prob = store.problems(it.id);
    const up = (patch) => store.update(it.id, patch, 'inspector');

    const name = h('input', { class: 'name-input', value: it.name, spellcheck: 'false' });
    name.addEventListener('change', () => up({ name: name.value.trim() || t('Без имени') }));
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });

    const crumbs = h('div', { class: 'crumbs-mini' },
      ...store.ancestors(it.id).flatMap((a) => [h('button', { onclick: () => store.select(a.id, { fly: true }) }, a.name), h('i', { html: icon('chevron', 11) })]),
      h('span', {}, t(KIND_NAMES[it.kind] || 'Объект')));

    const head = h('div', { class: 'insp-head', '--c': it.color },
      h('div', { class: 'big-ico', html: icon(kindIcon(it, kids.length), 26) }),
      h('div', { class: 'head-txt' }, name, crumbs),
      h('button', { class: `photo-btn${it.photo ? ' has' : ''}`, 'data-tip': it.photo ? t('Заменить фото') : t('Добавить фото'), 'aria-label': it.photo ? t('Заменить фото') : t('Добавить фото'), onclick: () => this.pickPhoto(it.id), html: icon('camera', 18) }));

    const blocks = [head];
    if (it.photo) blocks.push(this.photoBlock(it));

    if (prob.outside || prob.overlaps.length) {
      const what = prob.outside
        ? t('Не помещается в «{name}»', { name: parent.name })
        : t('Пересекается: {list}', { list: prob.overlaps.map((id) => store.get(id).name).join(', ') });
      blocks.push(h('div', { class: 'alert' },
        iconEl('warn', 18),
        h('div', {}, h('b', {}, what), h('small', {}, t('Измените габариты или найдите свободное место'))),
        h('button', { class: 'btn btn-ghost sm', onclick: () => {
          if (store.autoPlace(it.id)) this.toast('Место найдено', 'ok');
          else this.toast('Свободного места не нашлось', 'warn');
        } }, iconEl('wand', 15), t('Найти место'))));
    }

    if (kids.length || !it.parentId) {
      const f = store.fill(it.id);
      const used = kids.reduce((s, c) => s + store.volume(c), 0);
      blocks.push(h('div', { class: 'fill-card' },
        h('div', { class: 'ov-ring big', html: ring(f, 72, 7) + `<span>${Math.round(f * 100)}<small>%</small></span>` }),
        h('div', { class: 'fill-txt' },
          h('b', {}, t('Занято {vol}', { vol: fmtVol(used) })),
          h('small', {}, t('из {total} · свободно {free}', { total: fmtVol(store.volume(it)), free: fmtVol(Math.max(0, store.volume(it) - used)) })),
          h('small', {}, t('{count} внутри', { count: `${kids.length} ${tn(kids.length, 'объект')}` })))));
    }

    // Расстановка: ручная (мышью) или авто (плотная укладка при каждом изменении)
    if (kids.length || !it.parentId || it.opacity < 0.999) {
      const auto = store.isAuto(it.id);
      const seg = h('div', { class: 'seg' },
        h('button', { class: auto ? '' : 'on', onclick: () => auto && this.onArrangeMode(it.id, 'manual') }, iconEl('cursor', 15), t('Ручная')),
        h('button', { class: auto ? 'on' : '', onclick: () => !auto && this.onArrangeMode(it.id, 'auto') }, iconEl('sparkle', 15), t('Авто')));
      const last = store.lastArrangeResult();
      const res = last && last.id === it.id && last.total
        ? h('small', { class: `arr-res${last.placed < last.total ? ' bad' : ''}` },
          last.placed < last.total
            ? t('Последняя расстановка: поместилось {placed} из {total}. Не влезло: {list}', { placed: last.placed, total: last.total, list: last.overflow.join(', ') })
            : t('Последняя расстановка: все {total} на местах, заполнено {pct}% объёма', { total: last.total, pct: Math.round(last.fill * 100) }))
        : null;
      blocks.push(this.section('arrange', t('Расстановка'), 'wand',
        seg,
        h('p', { class: 'muted small' }, auto
          ? t('Содержимое само плотно перекладывается, когда что-то добавляете, убираете или меняете размер.')
          : t('Перетаскивайте предметы мышью прямо в сцене — они встают на пол и друг на друга, прилипают к стенкам. Перетащите на шкаф или коробку — переложится внутрь.')),
        h('button', { class: 'btn btn-primary wide', disabled: !kids.length, onclick: () => this.onArrange(it.id) }, iconEl('wand', 16), auto ? t('Пересчитать расстановку') : t('Расставить плотно')),
        res));
    }

    // Габариты
    blocks.push(this.section('size', zen ? t('Размеры') : t('Габариты'), 'ruler',
      h('div', { class: 'num-row' },
        this.num(t('Ш'), it.size.x, (v) => up({ size: { x: v } }), { min: 1 }),
        this.num(t('В'), it.size.y, (v) => up({ size: { y: v } }), { min: 1 }),
        this.num(t('Г'), it.size.z, (v) => up({ size: { z: v } }), { min: 1 })),
      h('div', { class: 'row-between' },
        h('small', { class: 'muted' }, t('Объём {vol}', { vol: fmtVol(store.volume(it)) })),
        h('button', { class: 'btn btn-ghost sm', onclick: () => up({ size: { x: it.size.z, z: it.size.x } }) }, iconEl('rotate', 15), t('Повернуть 90°')))));

    // Положение
    const parentSel = h('select', { class: 'select' },
      h('option', { value: '' }, t('— На полу (корневой контейнер)')),
      ...this.parentOptions(it));
    parentSel.value = it.parentId || '';
    parentSel.addEventListener('change', () => {
      const res = store.moveTo(it.id, parentSel.value || null);
      if (res.ok && !res.fitted) this.toast('Не помещается — объект отмечен красным', 'warn');
    });
    blocks.push(this.section('pos', zen ? t('Где лежит') : t('Положение'), 'pin',
      h('label', { class: 'field' }, h('span', {}, t('Лежит в')), parentSel),
      zen ? null : h('div', { class: 'num-row axes' },
        this.num('X', it.pos.x, (v) => up({ pos: { x: v } }), { axis: 'x' }),
        this.num('Y', it.pos.y, (v) => up({ pos: { y: v } }), { axis: 'y', disabled: !it.parentId }),
        this.num('Z', it.pos.z, (v) => up({ pos: { z: v } }), { axis: 'z' })),
      it.parentId && !kids.length ? this.toggle(t('Можно класть на бок'), store.canTilt(it), (v) => store.update(it.id, { tilt: v })) : null,
      h('div', { class: 'row-between' },
        h('small', { class: 'muted' }, zen ? '' : it.parentId ? t('От угла контейнера, см') : t('На полу, см')),
        it.parentId ? h('button', { class: 'btn btn-ghost sm', onclick: () => {
          if (store.autoPlace(it.id)) this.toast('Объект уложен', 'ok'); else this.toast('Свободного места не нашлось', 'warn');
        } }, iconEl('wand', 15), t('Авто-укладка')) : null)));

    // Внешний вид
    const swatches = h('div', { class: 'swatches' },
      ...store.PALETTE.map((c) => h('button', { class: `sw${c.toLowerCase() === it.color.toLowerCase() ? ' on' : ''}`, '--c': c, title: c, onclick: () => store.update(it.id, { color: c }) })),
      (() => {
        const inp = h('input', { type: 'color', value: it.color });
        inp.addEventListener('input', () => up({ color: inp.value }));
        return h('label', { class: 'sw custom', title: t('Свой цвет'), html: icon('plus', 13) }, inp);
      })());
    const opVal = h('b', {}, `${Math.round(it.opacity * 100)}%`);
    const op = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(it.opacity * 100)), class: 'slider' });
    const paint = () => op.style.setProperty('--p', `${op.value}%`);
    paint();
    op.addEventListener('input', () => { paint(); opVal.textContent = `${op.value}%`; up({ opacity: op.value / 100 }); });
    blocks.push(this.section('look', zen ? t('Цвет и вид') : t('Внешний вид'), 'sparkle',
      h('div', { class: 'field' }, h('span', {}, t('Цвет')), swatches),
      h('div', { class: 'field' }, h('div', { class: 'row-between' }, h('span', {}, t('Непрозрачность')), opVal), op),
      this.toggle(t('Контуры'), it.edges, (v) => store.update(it.id, { edges: v })),
      this.toggle(t('Видимость в сцене'), it.visible, (v) => store.update(it.id, { visible: v }))));

    // Содержимое
    blocks.push(this.section('kids', `${zen ? t('Что внутри') : t('Содержимое')}${kids.length ? ` · ${kids.length}` : ''}`, 'layers',
      kids.length ? h('div', { class: 'kid-list' }, ...kids.map((k) => h('button', { class: 'kid', '--c': k.color, onclick: () => store.select(k.id, { fly: true }) },
        h('span', { class: 'ico', html: icon(kindIcon(k, store.children(k.id).length), 14) }),
        h('span', { class: 'name' }, k.name),
        h('small', {}, dims(k.size)),
        store.hasProblem(k.id) ? h('span', { class: 'warn', html: icon('warn', 13) }) : null))) : h('p', { class: 'muted small' }, t('Внутри пока пусто')),
      h('button', { class: 'btn btn-soft wide', onclick: () => this.onCreate(it.id) }, iconEl('plus', 16), t('Положить внутрь'))));

    // Пользовательские свойства — основа для будущего расширения.
    const props = it.props || [];
    const setProps = (next) => store.update(it.id, { props: next }, 'inspector');
    blocks.push(this.section('props', zen ? t('Свои поля') : t('Свойства'), 'tag',
      props.length ? h('div', { class: 'props' }, ...props.map((p, i) => {
        const k = h('input', { class: 'pk', value: p.key, placeholder: t('Название') });
        const v = h('input', { class: 'pv', value: p.value, placeholder: t('Значение') });
        const save = () => { const next = props.map((x) => ({ ...x })); next[i] = { key: k.value, value: v.value }; setProps(next); };
        k.addEventListener('change', save);
        v.addEventListener('change', save);
        return h('div', { class: 'prop' }, k, v, h('button', { class: 'mini', title: t('Удалить свойство'), html: icon('close', 14), onclick: () => store.update(it.id, { props: props.filter((_, j) => j !== i) }) }));
      })) : h('p', { class: 'muted small' }, t('Добавьте свои поля: инвентарный номер, вес, срок годности…')),
      h('button', { class: 'btn btn-soft wide', onclick: () => { store.update(it.id, { props: [...props, { key: '', value: '' }] }); requestAnimationFrame(() => [...this.el.querySelectorAll('.pk')].pop()?.focus()); } }, iconEl('plus', 16), t('Добавить свойство'))));

    // Заметки
    const notes = h('textarea', { class: 'notes', placeholder: t('Что лежит, кому принадлежит, когда проверяли…'), rows: '4' }, it.notes || '');
    notes.addEventListener('change', () => up({ notes: notes.value }));
    blocks.push(this.section('notes', t('Заметки'), 'note', notes));

    const foot = h('div', { class: 'insp-foot' },
      h('button', { class: 'btn btn-soft', onclick: () => { const c = store.duplicate(it.id); if (c) store.select(c.id, { fly: true }); } }, iconEl('copy', 16), t('Дублировать')),
      h('button', { class: 'btn btn-danger', onclick: () => this.onDelete(it.id) }, iconEl('trash', 16), t('Удалить')));

    return h('div', { class: 'insp-wrap' }, h('div', { class: 'insp-scroll' }, ...blocks), foot);
  }

  // ── фото ──────────────────────────────────────────────────────────────
  pickPhoto(id) {
    const inp = h('input', { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', () => inp.files[0] && this.setPhoto(id, inp.files[0]));
    inp.click();
  }

  async setPhoto(id, file) {
    try {
      const pid = await photos.addPhoto(file);
      await photos.photoUrl(pid); // в кэш — панель покажет фото сразу
      store.update(id, { photo: pid });
      this.toast('Фото добавлено', 'ok');
    } catch (e) {
      this.toast(e.message || t('Не удалось прочитать картинку'), 'warn');
    }
  }

  photoBlock(it) {
    const img = h('img', { alt: it.name, draggable: 'false' });
    const fig = h('figure', { class: 'photo' }, img,
      h('div', { class: 'photo-acts' },
        h('button', { 'data-tip': t('Заменить'), 'aria-label': t('Заменить фото'), html: icon('camera', 16), onclick: (e) => { e.stopPropagation(); this.pickPhoto(it.id); } }),
        h('button', { 'data-tip': t('Убрать фото'), 'aria-label': t('Убрать фото'), html: icon('trash', 16), onclick: (e) => { e.stopPropagation(); store.update(it.id, { photo: null }); this.toast('Фото убрано · ⌘Z вернёт', 'info'); } })),
      h('span', { class: 'photo-zoom', html: icon('frame', 16) }));
    const show = (u) => { if (u) img.src = u; else fig.classList.add('missing'); };
    const cached = photos.cachedUrl(it.photo);
    if (cached) show(cached);
    else { fig.classList.add('loading'); photos.photoUrl(it.photo).then((u) => { fig.classList.remove('loading'); show(u); }); }
    fig.addEventListener('click', () => {
      if (!img.src) return;
      const path = [...store.ancestors(it.id).map((a) => a.name), it.name].join(' › ');
      openLightbox({ src: img.src, title: it.name, subtitle: `${path} · ${dims(it.size)} ${t('см')}` });
    });
    return fig;
  }

  parentOptions(it) {
    const out = [];
    const walk = (pid, depth) => {
      for (const c of store.children(pid)) {
        if (c.id === it.id) continue; // себя и свою ветку не предлагаем
        out.push(h('option', { value: c.id }, `${' '.repeat(depth)}${c.name}`));
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }

  // ── компоненты ───────────────────────────────────────────────────────
  section(key, title, ico, ...content) {
    const open = !this.closed.has(key);
    const sec = h('section', { class: `sec${open ? ' open' : ''}` });
    const head = h('button', { class: 'sec-head', onclick: () => {
      const now = !sec.classList.contains('open');
      sec.classList.toggle('open', now);
      now ? this.closed.delete(key) : this.closed.add(key);
    } }, iconEl(ico, 16), h('span', {}, title), h('i', { class: 'caret', html: icon('chevron', 13) }));
    sec.append(head, h('div', { class: 'sec-body' }, h('div', { class: 'sec-inner' }, ...content)));
    return sec;
  }

  // Числовое поле: ввод с клавиатуры или протяжка по подписи (Shift — ×10).
  num(label, value, onChange, { min = 0, axis, disabled } = {}) {
    const input = h('input', { type: 'text', inputmode: 'decimal', value: fmt(value), disabled });
    const commit = (v) => {
      v = Math.max(min, Math.round(v * 10) / 10);
      input.value = fmt(v);
      onChange(v);
    };
    input.addEventListener('change', () => {
      const v = parseFloat(input.value.replace(',', '.').replace(/\s/g, ''));
      if (Number.isFinite(v)) commit(v); else input.value = fmt(value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cur = parseFloat(input.value.replace(',', '.')) || 0;
        commit(cur + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
      }
    });
    const k = h('span', { class: `k${axis ? ' ax-' + axis : ''}` }, label);
    if (!disabled) {
      k.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        k.setPointerCapture(e.pointerId);
        this.busy = true;
        const x0 = e.clientX;
        const v0 = parseFloat(input.value.replace(',', '.')) || 0;
        const move = (ev) => commit(v0 + Math.round((ev.clientX - x0) / 2) * (ev.shiftKey ? 10 : 1));
        const up = () => {
          k.removeEventListener('pointermove', move);
          k.removeEventListener('pointerup', up);
          this.busy = false;
          if (this.stale) this.render();
        };
        k.addEventListener('pointermove', move);
        k.addEventListener('pointerup', up);
      });
    }
    return h('label', { class: `num${disabled ? ' disabled' : ''}` }, k, input, h('span', { class: 'u' }, t('см')));
  }

  toggle(label, value, onChange) {
    const input = h('input', { type: 'checkbox', checked: value });
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'toggle' }, h('span', {}, label), input, h('i', { class: 'switch' }));
  }
}
