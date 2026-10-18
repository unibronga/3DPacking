// Темы оформления: CSS-переменные интерфейса, цвета 3D-сцены и палитра
// для новых объектов. Плюс настройки (тема, размер интерфейса, пиксели, текстура фона).

const PREFS_KEY = 'sklad3d:prefs';

const DARK_SCENE = {
  grid: '#a9a9b8', hemiSky: '#e6e3f5', hemiGround: '#1b1820', hemi: 0.75, sun: '#ffffff', sunPower: 1.7,
  shadow: '#05030c', shadowOpacity: 0.32, sel: '#d7b4ff', hover: '#ffffff',
  edgeMix: '#ffffff', edgeAmount: 0.45, edgeSolid: 0.35, exposure: 1.05, env: 0.55,
};

export const THEMES = {
  graphite: {
    name: 'Графит',
    vars: {},
    preview: ['#1d1d22', '#2a2a31', '#ff6cab', '#b07cff'],
    scene: { ...DARK_SCENE },
  },

  amethyst: {
    name: 'Аметист',
    vars: {
      '--glass': '40 20 56', '--acc': '190 120 255', '--acc2': '255 108 171', '--acc3': '255 140 200',
      '--a1': '#ff6cab', '--a2': '#c07cff', '--a3': '#ff9ad5',
      '--bg': 'radial-gradient(1100px 760px at 8% -12%, rgb(170 70 220 / 0.5), transparent 62%), radial-gradient(900px 700px at 105% 112%, rgb(255 90 170 / 0.28), transparent 58%), linear-gradient(160deg, #24103a 0%, #170b26 55%, #10081a 100%)',
      '--stage-bg': 'radial-gradient(120% 90% at 50% 0%, rgb(200 120 255 / 0.14), transparent 60%), linear-gradient(180deg, rgb(40 20 56 / 0.35), rgb(14 6 22 / 0.6))',
      '--text': '#f8f2ff', '--text-2': 'rgb(240 228 255 / 0.64)', '--text-3': 'rgb(240 228 255 / 0.4)',
      '--opt-bg': '#2a1640', '--deep': '#2a1040',
    },
    preview: ['#24103a', '#3a1d55', '#ff6cab', '#c07cff'],
    scene: { ...DARK_SCENE, grid: '#c9b0e6', hemiSky: '#f0dcff', hemiGround: '#21102e', sel: '#ffb0e0' },
  },

  emerald: {
    name: 'Изумруд',
    vars: {
      '--glass': '14 40 36', '--acc': '62 224 160', '--acc2': '120 230 120', '--acc3': '43 196 180',
      '--a1': '#a3e66b', '--a2': '#3ee0a0', '--a3': '#2bc4b4',
      '--bg': 'radial-gradient(1100px 760px at 8% -12%, rgb(40 190 140 / 0.35), transparent 62%), radial-gradient(900px 700px at 105% 112%, rgb(160 220 80 / 0.14), transparent 58%), linear-gradient(160deg, #0f2a25 0%, #0a1d19 55%, #07130f 100%)',
      '--stage-bg': 'radial-gradient(120% 90% at 50% 0%, rgb(62 224 160 / 0.1), transparent 60%), linear-gradient(180deg, rgb(14 40 36 / 0.3), rgb(4 14 11 / 0.6))',
      '--text': '#f0fff8', '--text-2': 'rgb(220 245 235 / 0.66)', '--text-3': 'rgb(220 245 235 / 0.42)',
      '--opt-bg': '#123029', '--deep': '#0b2a22',
    },
    preview: ['#0f2a25', '#174238', '#a3e66b', '#3ee0a0'],
    scene: { ...DARK_SCENE, grid: '#93d9c0', hemiSky: '#e0fff2', hemiGround: '#0b1f1a', shadow: '#020a07', sel: '#8dffcf' },
  },

  sunset: {
    name: 'Закат',
    vars: {
      '--glass': '48 20 26', '--acc': '255 122 89', '--acc2': '255 79 139', '--acc3': '255 195 92',
      '--a1': '#ff4f8b', '--a2': '#ff7a59', '--a3': '#ffc35c',
      '--bg': 'radial-gradient(1100px 760px at 8% -12%, rgb(255 90 90 / 0.32), transparent 62%), radial-gradient(900px 700px at 105% 112%, rgb(255 170 70 / 0.2), transparent 58%), linear-gradient(160deg, #2c1219 0%, #1e0c11 55%, #14080b 100%)',
      '--stage-bg': 'radial-gradient(120% 90% at 50% 0%, rgb(255 122 89 / 0.1), transparent 60%), linear-gradient(180deg, rgb(48 20 26 / 0.3), rgb(16 6 8 / 0.6))',
      '--text': '#fff5f0', '--text-2': 'rgb(255 232 222 / 0.66)', '--text-3': 'rgb(255 232 222 / 0.42)',
      '--opt-bg': '#3a1820', '--deep': '#3a1018',
    },
    preview: ['#2c1219', '#45202a', '#ff4f8b', '#ffc35c'],
    scene: { ...DARK_SCENE, grid: '#e6b3a3', hemiSky: '#fff0e6', hemiGround: '#24100f', shadow: '#0c0304', sel: '#ffc08f' },
  },

  light: {
    name: 'Светлая',
    light: true,
    vars: {
      '--ink': '40 30 70', '--glass': '255 255 255', '--shade': '60 40 110',
      '--acc': '150 90 240', '--acc2': '240 80 150', '--acc3': '255 140 90',
      '--a1': '#f0508f', '--a2': '#9b5cf0', '--a3': '#ff8c5a',
      '--bg': 'radial-gradient(1100px 760px at 8% -12%, rgb(200 170 255 / 0.55), transparent 62%), radial-gradient(900px 700px at 105% 112%, rgb(255 190 210 / 0.5), transparent 58%), linear-gradient(160deg, #f7f4fc 0%, #efebf7 55%, #ebe6f3 100%)',
      '--stage-bg': 'linear-gradient(180deg, rgb(255 255 255 / 0.55), rgb(236 230 248 / 0.75))',
      '--panel': 'rgb(255 255 255 / 0.68)',
      '--text': '#1e1730', '--text-2': 'rgb(30 23 48 / 0.66)', '--text-3': 'rgb(30 23 48 / 0.42)',
      '--opt-bg': '#ffffff', '--deep': '#5a2fa0',
      '--bad-text': '#c2284a', '--bad-rgb': '160 40 70', '--ok-text': '#127a52',
      '--shadow': '0 24px 60px -24px rgb(60 40 110 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.8)',
    },
    preview: ['#f3eff9', '#ffffff', '#f0508f', '#9b5cf0'],
    scene: {
      grid: '#7c70a8', hemiSky: '#ffffff', hemiGround: '#d8d0ea', hemi: 1.0, sun: '#ffffff', sunPower: 1.6,
      shadow: '#3c2a6e', shadowOpacity: 0.18, sel: '#9b5cf0', hover: '#3c2a6e',
      edgeMix: '#2a1f48', edgeAmount: 0.35, edgeSolid: 0.4, exposure: 1.0, env: 0.7,
    },
  },

  // Тёплая пастель, кремовый фон, деревянные тона, мягкие контуры и пиксельная сцена.
  pixelart: {
    name: 'PixelArt',
    light: true,
    pixel: true,
    tex: 'stripes',
    vars: {
      '--ink': '92 64 51', '--glass': '255 249 240', '--shade': '120 80 50',
      '--acc': '242 120 100', '--acc2': '246 184 92', '--acc3': '108 190 170',
      '--a1': '#ff8f7a', '--a2': '#f7a86b', '--a3': '#f6c85f',
      '--bg': 'radial-gradient(900px 640px at 6% -8%, rgb(255 205 190 / 0.75), transparent 62%), radial-gradient(900px 700px at 104% 110%, rgb(180 225 205 / 0.7), transparent 58%), linear-gradient(160deg, #fbf3e6 0%, #f5e8d4 55%, #f1e1c9 100%)',
      '--stage-bg': 'linear-gradient(180deg, #fbf1e1 0%, #f0dcc0 100%)',
      '--panel': 'rgb(255 250 242 / 0.86)',
      '--text': '#4b3b34', '--text-2': 'rgb(75 59 52 / 0.7)', '--text-3': 'rgb(75 59 52 / 0.46)',
      '--opt-bg': '#fffaf2', '--deep': '#a8553f',
      '--bad-text': '#c0392b', '--bad-rgb': '170 60 40', '--ok-text': '#2e7d5b',
      '--font': "'Nunito', -apple-system, system-ui, sans-serif",
      '--font-display': "'Nunito', -apple-system, system-ui, sans-serif",
      '--r-xl': '26px', '--r-lg': '18px', '--r-md': '14px',
      '--shadow': '0 18px 40px -20px rgb(120 80 50 / 0.45), 0 2px 0 rgb(120 80 50 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.9)',
    },
    preview: ['#f7ead6', '#fffaf2', '#ff8f7a', '#7cc6b6'],
    palette: ['#f7a8a8', '#ffd28a', '#a8d8b9', '#9cc9e8', '#c7b3e6', '#f4c095', '#e8a0bf', '#b5d99c', '#fff1d6', '#c9a27e'],
    scene: {
      grid: '#b08a64', hemiSky: '#fff6e8', hemiGround: '#e2c39f', hemi: 1.05, sun: '#fff0d8', sunPower: 1.5,
      shadow: '#7a5236', shadowOpacity: 0.22, sel: '#ff6f5a', hover: '#7a5236',
      edgeMix: '#4b3b34', edgeAmount: 0.55, edgeSolid: 0.85, exposure: 1.0, env: 0.45,
    },
  },
};

// Размер интерфейса — от 80 до 200 %.
export const SCALE_MIN = 0.8;
export const SCALE_MAX = 2;
export const clampScale = (v) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(Number(v) * 20) / 20 || 1));

// Текстуры фона сцены (рисунок — в style.css, `#stage[data-tex]`).
// В настройках `tex: null` — текстура, которую задаёт тема.
export const TEXTURES = [
  ['none', 'Нет'], ['stripes', 'Полосы'], ['dots', 'Точки'], ['plaid', 'Клетка'],
  ['hatch', 'Штрих'], ['honeycomb', 'Соты'], ['waves', 'Волны'], ['paper', 'Бумага'],
];
export const textureOf = (prefs) => prefs.tex ?? THEMES[prefs.theme]?.tex ?? 'none';

const DEFAULTS = { theme: 'graphite', scale: 1.15, pixel: false, tex: null, zen: false, left: 'open', right: 'open' };

export function loadPrefs() {
  let p;
  try { p = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { p = { ...DEFAULTS }; }
  if (p.theme === 'unpacking') p.theme = 'pixelart'; // старое имя темы
  if (!THEMES[p.theme]) p.theme = DEFAULTS.theme;
  p.scale = clampScale(p.scale);
  return p;
}
export function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
}

// Переменные, которые задают темы, — чтобы при смене темы сбросить чужие.
const ALL_VARS = new Set(Object.values(THEMES).flatMap((t) => Object.keys(t.vars)));

export function applyThemeVars(id) {
  const t = THEMES[id] || THEMES.graphite;
  const root = document.documentElement;
  for (const k of ALL_VARS) root.style.removeProperty(k);
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
  root.dataset.theme = id;
  root.dataset.mode = t.light ? 'light' : 'dark';
  return t;
}

export function applyScale(scale) {
  document.documentElement.style.setProperty('--ui', String(scale));
}
