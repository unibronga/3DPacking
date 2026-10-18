// Данные склада: плоский список объектов, вложенность — через parentId.
// Размеры и положение — в сантиметрах. pos — ближний нижний левый угол
// объекта относительно внутреннего угла родителя; у корневых — место на полу.

import { pack } from './packing.js';
import { t } from './i18n.js';

const KEY = 'sklad3d:v1';
const EPS = 0.01;

export const BASE_PALETTE = ['#b07cff', '#ff6cab', '#6c8cff', '#44e3a0', '#ffc861', '#ff9a5c', '#ff5c7a', '#3ad6d0', '#e8e4f5', '#8e96b8'];
// Палитра для новых объектов — зависит от темы (см. themes.js).
export let PALETTE = BASE_PALETTE;
export function setPalette(p) { PALETTE = p && p.length ? p : BASE_PALETTE; }

let items = [];
let byId = new Map();
let selectedId = null;
const listeners = new Set();

const reindex = () => { byId = new Map(items.map((i) => [i.id, i])); };
const clone = (o) => JSON.parse(JSON.stringify(o));
export const uid = () => Math.random().toString(36).slice(2, 10);

// ── события ────────────────────────────────────────────────────────────
// change — изменилась сцена (detail: { id, op, source }); select — выбор.
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(type, detail = {}) { for (const fn of listeners) fn(type, detail); }
function save() { try { localStorage.setItem(KEY, JSON.stringify({ version: 1, items })); } catch {} }
function commit(detail) { record(detail); reindex(); save(); emit('change', detail); }

// ── история (отмена / повтор) ──────────────────────────────────────────
// Храним снимки списка до каждого изменения. Серия однотипных правок одного
// объекта подряд (протяжка гизмо, ползунок, числа) склеивается в один шаг.
const HISTORY_MAX = 200;
const MERGE_MS = 800;
const OP_LABEL = { add: 'создание', remove: 'удаление', move: 'перемещение', update: 'изменение', import: 'импорт', arrange: 'расстановка' };
let undoStack = [];
let redoStack = [];
let lastSnapshot = [];
let lastKey = null;
let lastTime = 0;

function record(detail) {
  const now = performance.now();
  // Жест (перетаскивание мышью, гизмо) — один шаг истории целиком.
  const gesture = detail.source?.startsWith('gesture:');
  const key = gesture ? detail.source : detail.op === 'update' ? `${detail.id}|${detail.source}|${detail.keys}` : null;
  const merge = key && key === lastKey && (gesture || now - lastTime < MERGE_MS);
  if (!merge) {
    const name = (byId.get(detail.id) || lastSnapshot.find((i) => i.id === detail.id))?.name;
    const op = t(OP_LABEL[detail.op] || 'изменение');
    const label = name ? t('{op} «{name}»', { op, name }) : op;
    undoStack.push({ items: lastSnapshot, label });
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
    redoStack = [];
  }
  lastKey = key;
  lastTime = now;
  lastSnapshot = clone(items);
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  lastSnapshot = clone(items);
  lastKey = null;
}

function restore(from, to) {
  const entry = from.pop();
  if (!entry) return null;
  to.push({ items: clone(items), label: entry.label });
  items = clone(entry.items);
  lastSnapshot = clone(items);
  lastKey = null;
  reindex();
  save();
  emit('change', { op: 'history' });
  if (selectedId && !byId.has(selectedId)) { selectedId = null; emit('select', { id: null }); }
  return entry.label;
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export const undo = () => restore(undoStack, redoStack);
export const redo = () => restore(redoStack, undoStack);

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && Array.isArray(d.items)) { items = d.items; reindex(); resetHistory(); return true; }
  } catch {}
  return false;
}

// ── чтение ──────────────────────────────────────────────────────────────
export const all = () => items;
export const get = (id) => (id ? byId.get(id) || null : null);
export const children = (id) => items.filter((i) => i.parentId === (id ?? null));
export const roots = () => children(null);
export const selected = () => get(selectedId);
export const selectedIdNow = () => selectedId;

export function ancestors(id) {
  const out = [];
  let it = get(id);
  while (it && it.parentId) { it = get(it.parentId); if (it) out.unshift(it); }
  return out;
}
export function descendants(id) {
  const out = [];
  const walk = (pid) => { for (const c of children(pid)) { out.push(c); walk(c.id); } };
  walk(id);
  return out;
}
export const isAncestor = (a, b) => ancestors(b).some((x) => x.id === a);
export const isVisible = (id) => { const it = get(id); return !!it && it.visible && ancestors(id).every((a) => a.visible); };

export const volume = (it) => it.size.x * it.size.y * it.size.z;
export function fill(id) {
  const it = get(id);
  const v = it ? volume(it) : 0;
  if (!v) return 0;
  return Math.min(1, children(id).reduce((s, c) => s + volume(c), 0) / v);
}

// ── геометрия: вписывание и пересечения ────────────────────────────────
const overlaps = (a, as, b, bs) =>
  a.x < b.x + bs.x - EPS && a.x + as.x > b.x + EPS &&
  a.y < b.y + bs.y - EPS && a.y + as.y > b.y + EPS &&
  a.z < b.z + bs.z - EPS && a.z + as.z > b.z + EPS;

export function problems(id) {
  const it = get(id);
  const p = it && get(it.parentId);
  if (!p) return { outside: false, overlaps: [] };
  const { pos, size } = it;
  const outside = pos.x < -EPS || pos.y < -EPS || pos.z < -EPS ||
    pos.x + size.x > p.size.x + EPS || pos.y + size.y > p.size.y + EPS || pos.z + size.z > p.size.z + EPS;
  const ov = children(p.id).filter((s) => s.id !== id && overlaps(pos, size, s.pos, s.size)).map((s) => s.id);
  return { outside, overlaps: ov };
}
export const hasProblem = (id) => { const p = problems(id); return p.outside || p.overlaps.length > 0; };

// Ищет свободное место внутри родителя (жадная укладка по «крайним точкам»:
// сначала пол, потом от дальней стенки к ближней, слева направо).
// Если не влезает как есть — пробует повернуть на 90°. null — места нет.
export function findSpot(parentId, size, ignoreId = null) {
  if (!parentId) {
    const rs = roots().filter((r) => r.id !== ignoreId);
    if (!rs.length) return { pos: { x: 0, y: 0, z: 0 }, size: { ...size } };
    const maxX = Math.max(...rs.map((r) => r.pos.x + r.size.x));
    return { pos: { x: maxX + 80, y: 0, z: 0 }, size: { ...size } };
  }
  const p = get(parentId);
  if (!p) return null;
  const sibs = children(parentId).filter((s) => s.id !== ignoreId);
  const pts = [{ x: 0, y: 0, z: 0 }];
  for (const s of sibs) {
    pts.push(
      { x: s.pos.x + s.size.x, y: s.pos.y, z: s.pos.z },
      { x: s.pos.x, y: s.pos.y + s.size.y, z: s.pos.z },
      { x: s.pos.x, y: s.pos.y, z: s.pos.z + s.size.z },
    );
  }
  pts.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  const tries = [size, { x: size.z, y: size.y, z: size.x }];
  for (const sz of tries) {
    for (const pt of pts) {
      if (pt.x + sz.x > p.size.x + EPS || pt.y + sz.y > p.size.y + EPS || pt.z + sz.z > p.size.z + EPS) continue;
      if (sibs.some((s) => overlaps(pt, sz, s.pos, s.size))) continue;
      return { pos: { ...pt }, size: { ...sz } };
    }
  }
  return null;
}

// ── расстановка ────────────────────────────────────────────────────────
// arrange: 'manual' (по умолчанию) — предметы стоят, где их поставили;
// 'auto' — содержимое плотно перекладывается при каждом изменении.
export const isAuto = (id) => get(id)?.arrange === 'auto';
// Класть на бок можно только «пустые» предметы: у контейнера выпадет содержимое.
export const canTilt = (it) => children(it.id).length === 0 && (it.tilt ?? it.kind === 'box');

// Поворот на 90° вокруг вертикали для контейнера с содержимым: меняем местами
// X и Z у него и у всей его ветки, чтобы вещи внутри остались на своих местах.
function swapXZ(id) {
  for (const d of descendants(id)) {
    d.pos = { x: d.pos.z, y: d.pos.y, z: d.pos.x };
    d.size = { x: d.size.z, y: d.size.y, z: d.size.x };
  }
}

let lastArrange = null;
export const lastArrangeResult = () => lastArrange;

function arrangeRaw(id, budgetMs) {
  reindex();
  const c = get(id);
  if (!c) return null;
  const kids = children(id);
  const res = pack(c.size, kids.map((k) => ({ id: k.id, size: k.size, tilt: canTilt(k) })), { budgetMs });
  let ox = c.size.x + 20; // не поместившиеся — рядом с контейнером, справа
  for (const k of kids) {
    const pl = res.placements.get(k.id);
    if (pl) {
      if (pl.size.x !== k.size.x && pl.size.y === k.size.y) swapXZ(k.id);
      k.pos = { ...pl.pos };
      k.size = { ...pl.size };
    } else {
      k.pos = { x: ox, y: 0, z: 0 };
      ox += k.size.x + 10;
    }
  }
  lastArrange = {
    id, total: kids.length, placed: res.placements.size,
    fill: volume(c) ? res.volume / volume(c) : 0,
    overflow: res.overflow.map((oid) => get(oid)?.name).filter(Boolean),
  };
  return lastArrange;
}

function autoArrange(ids, budgetMs = 80) {
  let done = false;
  for (const id of new Set(ids)) if (id && isAuto(id)) { arrangeRaw(id, budgetMs); done = true; }
  return done;
}

// Разовая плотная расстановка (кнопка «Расставить»).
export function arrange(id, { budgetMs = 400 } = {}) {
  const r = arrangeRaw(id, budgetMs);
  if (r) commit({ id, op: 'arrange', animate: true });
  return r;
}

export function setArrangeMode(id, mode) {
  const it = get(id);
  if (!it) return null;
  it.arrange = mode;
  const r = mode === 'auto' ? arrangeRaw(id, 400) : null;
  commit({ id, op: mode === 'auto' ? 'arrange' : 'update', keys: 'arrange', animate: !!r });
  return r;
}

// Конец перетаскивания: вернулся в свой контейнер — тот стал ручным;
// переехал в другой — авто-контейнеры (старый и новый) перекладываются.
export function endGesture(id, homeId, source) {
  const it = get(id);
  if (!it) return;
  const detail = { id, op: 'update', source, keys: 'pos' };
  if (it.parentId === homeId) {
    if (isAuto(homeId)) { get(homeId).arrange = 'manual'; detail.switchedManual = homeId; }
  } else if (autoArrange([homeId, it.parentId], 200)) detail.animate = true;
  commit(detail);
}

// Мировое положение угла объекта, см (родители не повёрнуты — просто сумма).
export function worldPos(id) {
  const p = { x: 0, y: 0, z: 0 };
  for (let it = get(id); it; it = get(it.parentId)) { p.x += it.pos.x; p.y += it.pos.y; p.z += it.pos.z; }
  return p;
}

// ── изменения ──────────────────────────────────────────────────────────
export function add({ name, size, parentId = null, color, opacity, notes = '', props = [], kind = 'item' }) {
  const spot = findSpot(parentId, size);
  const it = {
    id: uid(),
    name: (name || '').trim() || t('Без имени'),
    kind,
    parentId,
    size: spot ? spot.size : { ...size },
    pos: spot ? spot.pos : { x: 0, y: 0, z: 0 },
    color: color || PALETTE[items.length % PALETTE.length],
    opacity: opacity ?? (parentId ? 1 : 0.16),
    edges: true,
    visible: true,
    notes,
    props,
    created: Date.now(),
  };
  items.push(it);
  const auto = autoArrange([parentId]);
  commit({ id: it.id, op: 'add', animate: auto });
  return { item: it, fitted: auto ? !hasProblem(it.id) : !!spot };
}

export function update(id, patch, source = null) {
  const it = get(id);
  if (!it) return;
  for (const [k, v] of Object.entries(patch)) {
    it[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...it[k], ...v } : v;
  }
  const detail = { id, op: 'update', source, keys: Object.keys(patch).join() };
  if (!source?.startsWith('gesture:')) {
    // Ручная правка положения в авто-контейнере переводит его в ручной режим.
    if (patch.pos && isAuto(it.parentId)) { get(it.parentId).arrange = 'manual'; detail.switchedManual = it.parentId; }
    const re = [];
    if (patch.size || 'tilt' in patch) re.push(it.parentId);
    if (patch.size) re.push(id);
    if (autoArrange(re, 40)) detail.animate = true;
  }
  commit(detail);
}

export function remove(id) {
  const ids = new Set([id, ...descendants(id).map((d) => d.id)]);
  const parentId = get(id)?.parentId;
  items = items.filter((i) => !ids.has(i.id));
  if (ids.has(selectedId)) selectedId = null;
  const auto = autoArrange([parentId]);
  commit({ id, op: 'remove', animate: auto });
  emit('select', { id: selectedId });
}

// Переложить объект в другой контейнер (null — на пол). false — нельзя.
export function moveTo(id, parentId) {
  const it = get(id);
  if (!it || id === parentId || (parentId && isAncestor(id, parentId))) return { ok: false };
  const spot = findSpot(parentId, it.size, id);
  const from = it.parentId;
  it.parentId = parentId;
  it.pos = spot ? spot.pos : { x: 0, y: 0, z: 0 };
  if (spot) it.size = spot.size;
  const auto = autoArrange([from, parentId]);
  commit({ id, op: 'move', animate: auto });
  return { ok: true, fitted: auto ? !hasProblem(id) : !!spot };
}

export function autoPlace(id) {
  const it = get(id);
  if (!it) return false;
  if (isAuto(it.parentId)) { arrange(it.parentId); return !hasProblem(id); }
  const spot = findSpot(it.parentId, it.size, id);
  if (!spot) return false;
  it.pos = spot.pos;
  it.size = spot.size;
  commit({ id, op: 'update' });
  return true;
}

export function duplicate(id) {
  const src = get(id);
  if (!src) return null;
  const kids = descendants(id);
  const top = { ...clone(src), id: uid(), name: t('{name} — копия', { name: src.name }), created: Date.now() };
  const spot = findSpot(src.parentId, src.size);
  if (spot) { top.pos = spot.pos; top.size = spot.size; }
  items.push(top);
  // потомков копируем по исходному дереву (kids снят до вставки копий)
  const map = new Map([[src.id, top.id]]);
  for (const k of kids) {
    const c = { ...clone(k), id: uid(), parentId: map.get(k.parentId), created: Date.now() };
    map.set(k.id, c.id);
    items.push(c);
  }
  const auto = autoArrange([src.parentId]);
  commit({ id: top.id, op: 'add', animate: auto });
  return top;
}

export function select(id, opts = {}) {
  selectedId = id && get(id) ? id : null;
  emit('select', { id: selectedId, ...opts });
}

// ── импорт / экспорт ───────────────────────────────────────────────────
export const exportData = () => ({ app: 'sklad3d', version: 1, exported: new Date().toISOString(), items: clone(items) });
export function importData(data) {
  if (!data || !Array.isArray(data.items)) throw new Error(t('Неверный формат файла'));
  items = data.items;
  selectedId = null;
  commit({ op: 'import' });
  emit('select', { id: null });
}

// Демо-склад для первого запуска.
export function seed() {
  items = [];
  const room = add({ name: t('Кладовая'), kind: 'room', size: { x: 320, y: 250, z: 220 }, color: '#b07cff', opacity: 0.12 }).item;
  const rack = add({ name: t('Стеллаж'), kind: 'rack', parentId: room.id, size: { x: 120, y: 200, z: 45 }, color: '#8e96b8', opacity: 0.22 }).item;
  add({ name: t('Инструменты'), kind: 'box', parentId: rack.id, size: { x: 50, y: 30, z: 40 }, color: '#ff9a5c' });
  add({ name: t('Провода и зарядки'), kind: 'box', parentId: rack.id, size: { x: 40, y: 25, z: 35 }, color: '#6c8cff' });
  add({ name: t('Новогодние игрушки'), kind: 'box', parentId: rack.id, size: { x: 60, y: 40, z: 40 }, color: '#ff6cab' });
  add({ name: t('Чемодан'), kind: 'item', parentId: room.id, size: { x: 50, y: 75, z: 30 }, color: '#3ad6d0' });
  add({ name: t('Пылесос'), kind: 'item', parentId: room.id, size: { x: 30, y: 110, z: 30 }, color: '#e8e4f5' });

  const garage = add({ name: t('Гараж'), kind: 'room', size: { x: 600, y: 280, z: 400 }, color: '#6c8cff', opacity: 0.08 }).item;
  const cab = add({ name: t('Шкаф'), kind: 'cabinet', parentId: garage.id, size: { x: 100, y: 200, z: 60 }, color: '#ffc861', opacity: 0.25 }).item;
  add({ name: t('Набор ключей'), kind: 'box', parentId: cab.id, size: { x: 45, y: 12, z: 30 }, color: '#ff5c7a' });
  add({ name: t('Велосипед'), kind: 'item', parentId: garage.id, size: { x: 180, y: 105, z: 60 }, color: '#44e3a0' });
  add({ name: t('Зимняя резина'), kind: 'item', parentId: garage.id, size: { x: 65, y: 90, z: 65 }, color: '#8e96b8' });
  selectedId = null;
  resetHistory();
}
