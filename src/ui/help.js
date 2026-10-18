// Справка: разделы слева, текст справа. Текст — из словаря текущего языка
// (поле help), горячие клавиши — общий список с переводом подписей.
// Разметка в тексте справки: **жирный**, `клавиша`.

import { openModal } from './modal.js';
import { h, icon, iconEl } from './dom.js';
import { t, helpContent } from '../i18n.js';

export const SHORTCUTS = [
  ['N', 'Новый объект'], ['F', 'Показать выбранное'], ['G', 'Режим перемещения'], ['H', 'Скрыть / показать'],
  ['⌘D', 'Дублировать'], ['⌘Z', 'Отменить'], ['⇧⌘Z', 'Повторить'], ['A', 'Расставить плотно'],
  ['Z', 'Режим Дзен'], [',', 'Настройки'], ['?', 'Справка'], ['[ ]', 'Левая / правая панель'],
  ['⌫', 'Удалить'], ['Esc', 'Снять выбор'], ['⌥ + клик', 'Выбрать контейнер'],
];

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<kbd>$1</kbd>');

let lastTab = 0;

export function helpModal() {
  const help = helpContent();
  const sections = [...help.sections, { icon: 'keyboard', title: t('Горячие клавиши'), keys: true }];
  const nav = h('nav', { class: 'help-nav' });
  const page = h('div', { class: 'help-page' });

  const show = (i) => {
    lastTab = i;
    const s = sections[i];
    for (const [j, b] of [...nav.children].entries()) b.classList.toggle('on', j === i);
    page.textContent = '';
    page.scrollTop = 0;
    page.append(h('h4', { class: 'help-h' }, iconEl(s.icon, 18), s.title));
    if (s.keys) {
      page.append(h('div', { class: 'help-keys' }, ...SHORTCUTS.map(([k, label]) =>
        h('div', { class: 'sc' }, h('span', {}, t(label)), h('kbd', {}, t(k))))),
      h('p', { class: 'muted small' }, t('ЛКМ — вращать · ПКМ — сдвиг · колесо — масштаб · двойной клик — приблизить')));
    } else {
      for (const p of s.items) page.append(h('p', { html: rich(p) }));
    }
  };

  sections.forEach((s, i) => nav.append(h('button', { onclick: () => show(i) }, h('span', { class: 'i', html: icon(s.icon, 16) }), s.title)));
  show(Math.min(lastTab, sections.length - 1));

  openModal({
    title: help.title,
    subtitle: help.subtitle,
    icon: 'help',
    width: 780,
    body: h('div', { class: 'help' }, nav, page),
    actions: (close) => [h('button', { class: 'btn btn-primary', onclick: close }, iconEl('check', 17), t('Готово'))],
  });
}
