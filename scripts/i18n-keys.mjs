// Ключи перевода из исходников: строки в t('…') и русские строки в кавычках
// (названия тем, пресетов, текстур). Проверка словарей: node scripts/i18n-keys.mjs --check
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
  const p = join(d, f.name);
  if (f.isDirectory()) { if (f.name !== 'locales') walk(p); } else if (p.endsWith('.js') && !p.endsWith('i18n.js')) files.push(p);
} };
walk('src');

const keys = new Set();
const plurals = new Set();
const SKIP = new Set(['Аа']);
for (const f of files) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const s = line.trim();
    if (s.startsWith('//') || s.startsWith('*')) continue;
    for (const m of line.matchAll(/\btn\([^,]+,\s*'([^']+)'\)/g)) plurals.add(m[1]);
    for (const m of line.matchAll(/\bt\('([^']+)'/g)) keys.add(m[1]);
    for (const m of line.matchAll(/(?<!tn\([^,]+,\s*)'([^'\n]*[А-Яа-яЁёІіЇїЄє]{2}[^'\n]*)'/g)) if (!SKIP.has(m[1]) && !plurals.has(m[1])) keys.add(m[1]);
  }
}
for (const p of plurals) keys.delete(p);

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const lang of ['ru', 'en', 'uk', 'de', 'nl', 'fr', 'es']) {
    const d = (await import(`../src/locales/${lang}.js`)).default;
    const missing = lang === 'ru' ? [] : [...keys].filter((k) => !(k in d.strings) && !/^[A-Z⌘⇧⌫⌥,?\[\] ]+$|^Esc$|^3D$/.test(k));
    const extra = lang === 'ru' ? [] : Object.keys(d.strings).filter((k) => !keys.has(k));
    const pm = [...plurals].filter((k) => !d.plurals?.[k]);
    const ph = lang === 'ru' ? [] : Object.entries(d.strings).filter(([k, v]) => (k.match(/\{\w+\}/g) || []).sort().join() !== (v.match(/\{\w+\}/g) || []).sort().join()).map(([k]) => k);
    const help = d.help?.sections?.length;
    console.log(`${lang}: нет ${missing.length}, лишних ${extra.length}, множ. ${pm.length}, подстановки ${ph.length}, разделов справки ${help}`);
    for (const k of [...missing, ...pm]) console.log('   − ' + k);
    for (const k of extra) console.log('   + ' + k);
    for (const k of ph) console.log('   {} ' + k);
    bad += missing.length + pm.length + ph.length + (help ? 0 : 1);
  }
  process.exit(bad ? 1 : 0);
} else {
  console.log(JSON.stringify({ keys: [...keys], plurals: [...plurals] }, null, 1));
}
