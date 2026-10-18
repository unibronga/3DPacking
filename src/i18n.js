// Языки интерфейса. Ключ перевода — сама русская строка (как в gettext):
// код остаётся читаемым, русский работает без словаря, а в словарях других
// языков лежит «русский текст → перевод». Подстановки — {имя}.
// Множественное число — tn(n, 'слово'): формы по Intl.PluralRules.
// Справка — у каждого языка своя, в поле help словаря.

import ru from './locales/ru.js';
import en from './locales/en.js';
import uk from './locales/uk.js';
import de from './locales/de.js';
import nl from './locales/nl.js';
import fr from './locales/fr.js';
import es from './locales/es.js';

// Порядок — как в настройках; название языка — на нём самом.
export const LANGS = [
  ['ru', 'Русский'], ['en', 'English'], ['uk', 'Українська'], ['de', 'Deutsch'],
  ['nl', 'Nederlands'], ['fr', 'Français'], ['es', 'Español'],
];
const DICTS = { ru, en, uk, de, nl, fr, es };
const NUM_LOCALE = { ru: 'ru-RU', en: 'en-US', uk: 'uk-UA', de: 'de-DE', nl: 'nl-NL', fr: 'fr-FR', es: 'es-ES' };

let lang = 'ru';
let dict = ru;
let rules = new Intl.PluralRules('ru');

// Язык системы, если он есть среди наших; иначе — английский.
export function detectLang() {
  for (const l of navigator.languages || [navigator.language]) {
    const code = String(l || '').slice(0, 2).toLowerCase();
    if (DICTS[code]) return code;
  }
  return 'en';
}

export function setLang(code) {
  lang = DICTS[code] ? code : 'en';
  dict = DICTS[lang];
  rules = new Intl.PluralRules(lang);
  document.documentElement.lang = lang;
}

export const getLang = () => lang;
export const numLocale = () => NUM_LOCALE[lang];
export const helpContent = () => dict.help;

export function t(key, params) {
  let s = dict.strings?.[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}

export function tn(n, key) {
  const forms = dict.plurals[key] || ru.plurals[key];
  return forms[rules.select(n)] ?? forms.other;
}
