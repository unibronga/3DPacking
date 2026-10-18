// Лайтбокс: фото на весь экран поверх приложения. Закрывается кликом
// по фону, крестиком или Esc; клик по самому фото — 100 % / вписать.

import { h, icon } from './dom.js';
import { t } from '../i18n.js';

export function openLightbox({ src, title, subtitle }) {
  const img = h('img', { src, alt: title || '', draggable: 'false' });
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || t('Фото') },
    h('button', { class: 'lb-close', 'aria-label': t('Закрыть'), html: icon('close', 20) }),
    h('div', { class: 'lb-stage' }, img),
    title ? h('div', { class: 'lb-caption' }, h('b', {}, title), subtitle ? h('span', {}, subtitle) : null) : null);

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    box.classList.add('out');
    setTimeout(() => box.remove(), 200);
  };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);

  box.addEventListener('click', (e) => {
    if (e.target === img) { box.classList.toggle('zoomed'); return; }
    close();
  });
  document.body.append(box);
  return close;
}
