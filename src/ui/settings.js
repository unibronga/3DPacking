// Окно настроек: режим интерфейса (стандарт / Дзен), тема, размер, пиксели.
// Всё применяется сразу — видно вживую за полупрозрачной подложкой.

import { THEMES, TEXTURES, textureOf, SCALE_MIN, SCALE_MAX, clampScale } from '../themes.js';
import { openModal } from './modal.js';
import { t, LANGS, getLang } from '../i18n.js';
import { h, icon, iconEl } from './dom.js';

export function settingsModal({ prefs, onChange }) {
  const body = h('div', { class: 'settings' });

  const render = () => {
    body.textContent = '';

    const modes = h('div', { class: 'modes' },
      ...[
        { zen: false, ico: 'layers', title: t('Стандарт'), text: t('Плотно, все детали и цифры под рукой') },
        { zen: true, ico: 'leaf', title: t('Дзен'), text: t('Крупно и спокойно — только главное') },
      ].map((m) => h('button', { class: `mode-card${!!prefs.zen === m.zen ? ' on' : ''}`, onclick: () => set({ zen: m.zen }) },
        h('span', { class: 'mode-ico', html: icon(m.ico, 22) }),
        h('b', {}, m.title),
        h('small', {}, m.text))));

    const themes = h('div', { class: 'themes' }, ...Object.entries(THEMES).map(([id, theme]) => {
      const [bg, panel, c1, c2] = theme.preview;
      return h('button', { class: `theme-card${prefs.theme === id ? ' on' : ''}`, onclick: () => set({ theme: id, pixel: !!theme.pixel }) },
        h('div', { class: 'tc-prev', style: { background: bg } },
          h('div', { class: 'tc-side', style: { background: panel } },
            h('i', { style: { background: `linear-gradient(90deg, ${c1}, ${c2})` } }),
            h('i', { style: { background: c2 } }), h('i', { style: { background: c1, width: '70%' } })),
          h('div', { class: 'tc-main', style: { background: `linear-gradient(180deg, ${panel}55, transparent)` } },
            h('em', { style: { background: c1, left: '10px' } }),
            h('em', { style: { background: c2, left: '28px', height: '20px' } }))),
        h('b', {}, t(theme.name), prefs.theme === id ? h('span', { class: 'i', html: icon('check', 14) }) : null));
    }));

    // Ползунок 80–200 %: тянем — интерфейс меняется сразу; окно не перерисовываем,
    // чтобы ползунок не терял палец.
    const pct = (v) => `${Math.round(v * 100)}%`;
    const val = h('b', { class: 'scale-val' }, pct(prefs.scale));
    const range = h('input', { type: 'range', class: 'slider', min: String(SCALE_MIN * 100), max: String(SCALE_MAX * 100), step: '5', value: String(Math.round(prefs.scale * 100)) });
    const paintRange = () => range.style.setProperty('--p', `${((range.value - SCALE_MIN * 100) / ((SCALE_MAX - SCALE_MIN) * 100)) * 100}%`);
    paintRange();
    const chips = [];
    range.addEventListener('input', () => {
      paintRange();
      prefs.scale = clampScale(range.value / 100);
      val.textContent = pct(prefs.scale);
      for (const c of chips) c.classList.toggle('on', Math.abs(prefs.scale - c._v) < 0.001);
      onChange(prefs);
    });
    const preset = (v, label) => {
      const c = h('button', { class: `pchip${Math.abs(prefs.scale - v) < 0.001 ? ' on' : ''}`, onclick: () => set({ scale: v }) }, label);
      c._v = v;
      chips.push(c);
      return c;
    };
    const sizes = h('div', { class: 'scale-box' },
      h('div', { class: 'scale-row' }, h('span', { class: 'aa sm' }, 'Аа'), range, h('span', { class: 'aa lg' }, 'Аа'), val),
      h('div', { class: 'scale-presets' }, preset(1, '100%'), preset(1.15, '115%'), preset(1.3, '130%'), preset(1.5, '150%'), preset(2, '200%')));

    const tex = textureOf(prefs);
    const textures = h('div', { class: 'texs' }, ...TEXTURES.map(([id, name]) =>
      h('button', { class: `tex-card${tex === id ? ' on' : ''}`, onclick: () => set({ tex: id }) },
        h('div', { class: 'tex-prev', 'data-tex': id }), t(name))));

    // Язык: смена перезагружает страницу (см. applyPrefs в main.js).
    const langs = h('div', { class: 'langs' }, ...LANGS.map(([id, name]) =>
      h('button', { class: `pchip${getLang() === id ? ' on' : ''}`, lang: id, onclick: () => getLang() !== id && set({ lang: id }) }, name)));

    const pixel = h('input', { type: 'checkbox', checked: !!prefs.pixel });
    pixel.addEventListener('change', () => set({ pixel: pixel.checked }));

    body.append(
      h('section', {}, h('h4', { class: 'set-title' }, t('Язык')), langs),
      h('section', {}, h('h4', { class: 'set-title' }, t('Режим интерфейса')), modes),
      h('section', {}, h('h4', { class: 'set-title' }, t('Тема')), themes),
      h('section', {}, h('h4', { class: 'set-title' }, t('Текстура фона')), textures),
      h('section', {}, h('h4', { class: 'set-title' }, t('Размер интерфейса')), sizes),
      h('section', {},
        h('label', { class: 'toggle' },
          h('span', {}, h('b', { class: 'set-title', style: { display: 'block', margin: 0 } }, t('Пиксельный 3D')), h('small', { class: 'muted' }, t('3D-сцена рисуется крупными пикселями'))),
          pixel, h('i', { class: 'switch' }))),
    );
  };

  const set = (patch) => {
    Object.assign(prefs, patch);
    onChange(prefs);
    render();
  };

  render();
  const m = openModal({
    title: t('Настройки'),
    subtitle: t('Оформление сохраняется на этом устройстве'),
    icon: 'gear',
    width: 620,
    body,
    actions: (close) => [h('button', { class: 'btn btn-primary', onclick: close }, iconEl('check', 17), t('Готово'))],
  });
  // Само окно настроек не масштабируем — иначе ползунок размера уезжает из-под курсора.
  m.card.classList.add('no-zoom');
}
