// 3DPacking — точка входа: связывает данные, вьюпорт и панели.

// Шрифт темы PixelArt — локально, с кириллицей: приложение работает без сети.
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './style.css';
import * as store from './store.js';
import { Viewport } from './viewport.js';
import { Sidebar } from './ui/sidebar.js';
import { Inspector } from './ui/inspector.js';
import { createObjectModal, confirmModal, toast } from './ui/modal.js';
import { settingsModal } from './ui/settings.js';
import * as photos from './photos.js';
import { h, icon } from './ui/dom.js';
import { loadPrefs, savePrefs, applyThemeVars, applyScale, textureOf } from './themes.js';
import { t, setLang, detectLang, getLang } from './i18n.js';
import { helpModal } from './ui/help.js';

// Оформление применяем до создания сцены, чтобы не мигала чужая тема.
const prefs = loadPrefs();
// Язык — до первой отрисовки: все тексты берутся из словаря через t().
setLang(prefs.lang || detectLang());
window.desktop?.setLang?.(getLang());
document.getElementById('hint').textContent = t('ЛКМ — вращать · ПКМ — сдвиг · колесо — масштаб · двойной клик — приблизить');
applyThemeVars(prefs.theme);
applyScale(prefs.scale);
document.documentElement.toggleAttribute('data-zen', !!prefs.zen);
document.documentElement.dataset.left = prefs.left;
document.documentElement.dataset.right = prefs.right;

if (!store.load()) store.seed();
// Фото, на которые больше не ссылается ни один объект, — убрать из хранилища.
photos.gc(new Set(store.all().map((i) => i.photo).filter(Boolean)));

const vp = new Viewport(document.getElementById('viewport'));
if (import.meta.env.DEV) window.__sklad = { vp, store };

function applyPrefs() {
  // Новый язык — перезагрузка: панели и тулбар собираются с нуля уже с ним.
  if (prefs.lang && prefs.lang !== getLang()) { savePrefs(prefs); location.reload(); return; }
  const theme = applyThemeVars(prefs.theme);
  store.setPalette(theme.palette);
  applyScale(prefs.scale);
  document.documentElement.toggleAttribute('data-zen', !!prefs.zen);
  document.documentElement.dataset.left = prefs.left;
  document.documentElement.dataset.right = prefs.right;
  vp.applyTheme(theme.scene);
  vp.setPixel(!!prefs.pixel);
  document.getElementById('stage').dataset.tex = textureOf(prefs);
  savePrefs(prefs);
}
applyPrefs();

const openHelp = () => helpModal();
const openSettings = () => settingsModal({
  prefs,
  onChange: () => { applyPrefs(); sidebar.render(); inspector.render(); sidebar.zenBtn.classList.toggle('on', !!prefs.zen); },
});
// Панели: левая сворачивается в полоску с иконками, правая прячется целиком.
const toggleLeft = () => { prefs.left = prefs.left === 'rail' ? 'open' : 'rail'; applyPrefs(); renderPanelBtns(); };
const toggleRight = () => { prefs.right = prefs.right === 'hidden' ? 'open' : 'hidden'; applyPrefs(); renderPanelBtns(); };
function renderPanelBtns() {
  leftBtn?.classList.toggle('panel-on', prefs.left === 'open');
  rightBtn?.classList.toggle('panel-on', prefs.right === 'open');
}

const toggleZen = () => {
  prefs.zen = !prefs.zen;
  applyPrefs();
  sidebar.render();
  inspector.render();
  sidebar.zenBtn.classList.toggle('on', !!prefs.zen);
sidebar.railZen.classList.toggle('on', !!prefs.zen);
  toast(prefs.zen ? t('Режим Дзен: крупно и спокойно') : t('Стандартный режим'), 'info');
};

const create = (parentId) => createObjectModal({
  parentId,
  onCreated: ({ item, fitted }) => {
    if (item.parentId) sidebar.open.add(item.parentId);
    store.select(item.id, { fly: true });
    toast(t(fitted || !item.parentId ? '«{name}» создан' : '«{name}» не помещается — отмечен красным', { name: item.name }), fitted || !item.parentId ? 'ok' : 'warn');
  },
});

const del = async (id) => {
  const it = store.get(id);
  if (!it) return;
  const n = store.descendants(id).length;
  const ok = await confirmModal({
    title: t('Удалить «{name}»?', { name: it.name }),
    text: n ? t('Вместе с ним удалятся вложенные объекты: {n}. Действие нельзя отменить.', { n }) : t('Действие нельзя отменить.'),
  });
  if (!ok) return;
  const parentId = it.parentId;
  store.remove(id);
  toast(t('«{name}» удалён', { name: it.name }), 'info');
  if (parentId) store.select(parentId, { fly: true });
  else vp.frameAll();
};

// В файл экспорта кладём и фото (data URL) — склад переносится целиком.
const exportJSON = async () => {
  const data = store.exportData();
  data.photos = await photos.exportPhotos(new Set(data.items.map((i) => i.photo).filter(Boolean)));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `3dpacking-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const importJSON = () => {
  const inp = h('input', { type: 'file', accept: 'application/json,.json' });
  inp.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await inp.files[0].text());
      await photos.importPhotos(data.photos);
      store.importData(data);
      vp.frameAll();
      toast('Склад загружен', 'ok');
    } catch (e) { toast(e.message || t('Не удалось прочитать файл'), 'warn'); }
  });
  inp.click();
};

const sidebar = new Sidebar(document.getElementById('sidebar'), { onCreate: create, onExport: exportJSON, onImport: importJSON, onSettings: () => openSettings(), onZen: () => toggleZen(), onToggle: () => toggleLeft(), onHelp: () => openHelp(), toast });
sidebar.zenBtn.classList.toggle('on', !!prefs.zen);
sidebar.railZen.classList.toggle('on', !!prefs.zen);
// ── расстановка: ручная / авто ─────────────────────────────────────────
// Контейнер для кнопок — выбранный (если в нём что-то лежит) или его родитель.
const arrangeTarget = () => {
  const it = store.selected();
  if (!it) return null;
  return store.children(it.id).length || !it.parentId ? it : store.get(it.parentId);
};
function arrangeToast(r) {
  if (!r) return;
  const pct = Math.round(r.fill * 100);
  if (!r.total) toast('Внутри пусто — нечего расставлять', 'info');
  else if (r.placed === r.total) toast(t('Расставлено: {total} · заполнено {pct}% объёма', { total: r.total, pct }), 'ok');
  else toast(t('Поместилось {placed} из {total} ({pct}%). Не влезло: {list}', { placed: r.placed, total: r.total, pct, list: r.overflow.slice(0, 3).join(', ') + (r.overflow.length > 3 ? '…' : '') }), 'warn');
}
const doArrange = (id) => arrangeToast(store.arrange(id));
const setArrangeMode = (id, mode) => {
  const r = store.setArrangeMode(id, mode);
  if (mode === 'auto') arrangeToast(r);
  else toast('Ручная расстановка: двигайте предметы мышью', 'info');
};

const inspector = new Inspector(document.getElementById('inspector'), { onCreate: create, onDelete: del, onArrange: doArrange, onArrangeMode: setArrangeMode, toast });

// ── тулбар над вьюпортом ───────────────────────────────────────────────
const tb = document.getElementById('toolbar');
const tbtn = (ico, tip, onclick, cls = '') => h('button', { class: `tb ${cls}`, 'data-tip': tip, html: icon(ico, 17), onclick });
const modeSel = tbtn('cursor', t('Выбор'), () => setMode('select'), 'on');
const modeMove = tbtn('move', t('Перемещение · G'), () => setMode('move'));
const prefBtn = (key, ico, tip) => {
  const b = tbtn(ico, tip, () => { vp.setPref(key, !vp.prefs[key]); b.classList.toggle('on', vp.prefs[key]); });
  b.classList.toggle('on', vp.prefs[key]);
  return b;
};
const viewBtn = (name, label) => h('button', { class: 'tb txt', onclick: () => vp.view(name) }, label);
const undoBtn = tbtn('undo', t('Отменить · ⌘Z'), () => history('undo'));
const redoBtn = tbtn('redo', t('Повторить · ⇧⌘Z'), () => history('redo'));
const arrangeBtn = h('button', { class: 'tb txt arrange-btn', 'data-tip': t('Плотно расставить содержимое'), onclick: () => { const tg = arrangeTarget(); if (tg) doArrange(tg.id); } },
  h('span', { class: 'i', html: icon('wand', 16) }), t('Расставить'));
const modeManual = h('button', { class: 'tb txt', 'data-tip': t('Двигать предметы мышью'), onclick: () => { const tg = arrangeTarget(); if (tg && store.isAuto(tg.id)) setArrangeMode(tg.id, 'manual'); } }, t('Ручная'));
const modeAuto = h('button', { class: 'tb txt', 'data-tip': t('Перекладывать плотно при каждом изменении'), onclick: () => { const tg = arrangeTarget(); if (tg && !store.isAuto(tg.id)) setArrangeMode(tg.id, 'auto'); } }, t('Авто'));
function renderArrange() {
  const tg = arrangeTarget();
  for (const b of [arrangeBtn, modeManual, modeAuto]) b.disabled = !tg;
  modeManual.classList.toggle('on', !!tg && !store.isAuto(tg.id));
  modeAuto.classList.toggle('on', !!tg && store.isAuto(tg.id));
  arrangeBtn.dataset.tip = tg ? t('Плотно расставить «{name}»', { name: tg.name }) : t('Выберите контейнер');
}
var leftBtn = tbtn('panelClose', t('Левая панель  ['), () => toggleLeft());
var rightBtn = tbtn('panelRight', t('Правая панель  ]'), () => toggleRight());
// Кнопки панелей — в углах сцены, отдельно от тулбара.
document.getElementById('stage').append(
  h('div', { class: 'tb-group corner left' }, leftBtn),
  h('div', { class: 'tb-group corner right' }, rightBtn));
tb.append(
  h('div', { class: 'tb-group' }, undoBtn, redoBtn),
  h('div', { class: 'tb-group' }, arrangeBtn, modeManual, modeAuto),
  h('div', { class: 'tb-group' }, modeSel, modeMove),
  h('div', { class: 'tb-group' }, prefBtn('grid', 'grid', t('Сетка')), prefBtn('focus', 'focus', t('Подсветка пути')), prefBtn('labels', 'label', t('Подписи'))),
  h('div', { class: 'tb-group' }, viewBtn('persp', '3D'), viewBtn('top', t('Сверху')), viewBtn('front', t('Спереди')), viewBtn('side', t('Сбоку'))),
  h('div', { class: 'tb-group' }, tbtn('frame', t('Показать всё · двойной клик по пустому'), () => vp.frameAll())),
);
renderPanelBtns();
function setMode(m) {
  vp.setMode(m);
  modeSel.classList.toggle('on', m === 'select');
  modeMove.classList.toggle('on', m === 'move');
  if (m === 'move' && !store.selected()) toast('Выберите объект, чтобы двигать его', 'info');
}

function history(dir) {
  const label = dir === 'undo' ? store.undo() : store.redo();
  if (label) toast(t(dir === 'undo' ? 'Отменено: {what}' : 'Повторено: {what}', { what: label }), 'info');
}
function renderHistory() {
  undoBtn.disabled = !store.canUndo();
  redoBtn.disabled = !store.canRedo();
}

// ── хлебные крошки внизу вьюпорта: где лежит выбранное ────────────────
const crumbs = document.getElementById('crumbs');
function renderCrumbs() {
  crumbs.textContent = '';
  const it = store.selected();
  crumbs.classList.toggle('show', !!it);
  if (!it) return;
  crumbs.append(h('span', { class: 'c-ico', html: icon('pin', 14) }));
  [...store.ancestors(it.id), it].forEach((a, i) => {
    if (i) crumbs.append(h('i', { html: icon('chevron', 11) }));
    crumbs.append(h('button', { class: a === it ? 'cur' : '', '--c': a.color, onclick: () => store.select(a.id, { fly: true }) }, h('em', {}), a.name));
  });
}

// ── связка ─────────────────────────────────────────────────────────────
store.on((type, d) => {
  if (type === 'change') {
    vp.sync(d);
    renderArrange();
    if (d.switchedManual) toast(t('«{name}» — теперь ручная расстановка', { name: store.get(d.switchedManual)?.name }), 'info');
    sidebar.render();
    inspector.onChange(d);
    renderCrumbs();
    renderHistory();
  }
  if (type === 'select') {
    vp.setSelected(d.id);
    renderArrange();
    sidebar.reveal(d.id);
    inspector.render();
    renderCrumbs();
    if (d.fly && d.id) vp.focus(d.id);
  }
});
vp.onPick = (id, opts) => store.select(id, opts);
vp.onNotice = (text) => toast(text, 'warn');

vp.sync();
sidebar.render();
inspector.render();
renderCrumbs();
renderHistory();
renderArrange();
vp.frameAll(true);

// ── клавиатура ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-back, .lightbox')) return;
  const sel = store.selected();
  const k = e.key.toLowerCase();
  const mod = e.metaKey || e.ctrlKey;
  // e.code — чтобы сочетания работали и в русской раскладке
  if (mod && e.code === 'KeyZ') { e.preventDefault(); history(e.shiftKey ? 'redo' : 'undo'); return; }
  if (e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); history('redo'); return; }
  if (mod && e.code === 'KeyD' && sel) { e.preventDefault(); const c = store.duplicate(sel.id); if (c) store.select(c.id, { fly: true }); return; }
  if (e.key === 'F1' || e.key === '?' || (e.shiftKey && e.code === 'Slash')) { e.preventDefault(); openHelp(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (k === 'n' || k === 'т') { e.preventDefault(); create(sel?.id ?? null); }
  else if (k === 'f' || k === 'а') sel ? vp.focus(sel.id) : vp.frameAll();
  else if (k === 'g' || k === 'п') setMode(vp.mode === 'move' ? 'select' : 'move');
  else if (e.code === 'Comma') openSettings();
  else if (e.code === 'BracketLeft') toggleLeft();
  else if (e.code === 'BracketRight') toggleRight();
  else if (e.code === 'KeyA') { const tg = arrangeTarget(); if (tg) doArrange(tg.id); }
  else if (e.code === 'KeyZ') toggleZen();
  else if ((k === 'h' || k === 'р') && sel) store.update(sel.id, { visible: !sel.visible });
  else if ((k === 'delete' || k === 'backspace') && sel) del(sel.id);
  else if (k === 'escape') { if (vp.mode === 'move') setMode('select'); else store.select(null); }
});

// ── десктоп (Electron): команды меню и окно / полный экран ─────────────
if (window.desktop) {
  window.desktop.onMenu((a) => {
    const el = document.activeElement;
    const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    if (a === 'undo' || a === 'redo') {
      // в поле ввода — отмена текста, иначе — правок склада
      if (typing) document.execCommand(a);
      else if (!document.querySelector('.modal-back')) history(a);
    } else if (a === 'settings') openSettings();
    else if (a === 'help') openHelp();
    else if (a === 'new') create(store.selected()?.id ?? null);
    else if (a === 'export') exportJSON();
    else if (a === 'import') importJSON();
    else if (a === 'left') toggleLeft();
    else if (a === 'right') toggleRight();
    else if (a === 'zen') toggleZen();
    else if (a === 'fullscreen-on' || a === 'fullscreen-off') {
      document.documentElement.toggleAttribute('data-windowed', a === 'fullscreen-off');
    }
  });
}
