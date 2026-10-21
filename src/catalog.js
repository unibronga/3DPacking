// Каталог реальных предметов с габаритами (src/data/catalog.csv, обновление — npm run catalog)
// и полнотекстовый поиск по нему в духе Elasticsearch: слова, префикс, опечатки
// (fuzziness AUTO, с перестановкой букв), IDF, русские синонимы к английским названиям
// и запрос, набранный не в той раскладке. Каталог грузится лениво — отдельным чанком.

let ready = null;
export const loadCatalog = () => (ready ??= import('./data/catalog.csv?raw').then((m) => build(parseCsv(m.default))));

// Синонимы: английское слово из названия → русские слова, по которым его можно найти.
const SYN = `
desk: стол письменный | table: стол | chair armchair: кресло стул | sofa: диван | ottoman: пуф
bed: кровать | mattress: матрас | wardrobe: шкаф гардероб | cabinet: шкаф тумба шкафчик | bookcase: книжный шкаф стеллаж
shelving shelf shelves: стеллаж полка | drawer drawers: ящик комод | chest: комод ларь сундук | sideboard: буфет комод
bench: скамья лавка | mirror: зеркало | storage: хранение | box boxes: коробка ящик | container: контейнер
palett pallet: паллета поддон | moving: переезд | wardrobe-box: гардеробная | basin: раковина | children: детский
monitor: монитор | tv oled qled uhd: телевизор тв | printer laserjet: принтер | scanner: сканер | copier: копир ксерокс
laptop macbook: ноутбук | computer imac: компьютер | router: роутер маршрутизатор | speaker: колонка | soundbar: саундбар
receiver: ресивер усилитель | playstation: приставка консоль плейстейшен ps5 | iphone: телефон смартфон | ipad: планшет
fridge refrigerator: холодильник | freezer: морозильник морозилка | washing washer: стиральная стиралка машина
dryer: сушильная сушилка машина | dishwasher: посудомойка посудомоечная | microwave: микроволновка микроволновая печь свч
oven: духовка печь | cooker hob: плита | kettle: чайник | toaster: тостер | coffee espresso senseo tassimo: кофеварка кофемашина кофе
blender: блендер | fryer: аэрогриль фритюрница | iron: утюг | steam: отпариватель пар | vacuum: пылесос
purifier: очиститель воздуха | shaver: бритва | grill: гриль | processor: комбайн | ironing: гладильная доска
ikea: икеа икея | samsung: самсунг | philips: филипс | bosch: бош | apple: эпл эппл | sony: сони | lg: элджи лджи
dell: делл | asus: асус | tefal: тефаль | maersk: маерск | u-haul: юхол
`;
const CAT = {
  Furniture: ['Мебель', `мебель`],
  Electronics: ['Электроника', `электроника техника`],
  'Large Appliances': ['Крупная техника', `крупная бытовая техника`],
  'Small Appliances': ['Мелкая техника', `мелкая бытовая техника`],
  'Transport Packaging': ['Тара и упаковка', `тара упаковка`],
};
// Подпись категории (переводится при показе через t()).
export const categoryName = (cat) => CAT[cat]?.[0] || cat;

const synonyms = new Map();
for (const group of SYN.split(/[|\n]/)) {
  const [en, ru] = group.split(':');
  if (!ru) continue;
  for (const w of en.trim().split(/\s+/)) synonyms.set(w, ru.trim());
}

// Раскладка: «шлуф» → «ikea» и обратно.
const EN = `qwertyuiop[]asdfghjkl;'zxcvbnm,.\``;
const RU = `йцукенгшщзхъфывапролджэячсмитьбюё`;
const swapLayout = (s) => [...s.toLowerCase()].map((c) => {
  const i = EN.indexOf(c);
  if (i >= 0) return RU[i];
  const j = RU.indexOf(c);
  return j >= 0 ? EN[j] : c;
}).join('');

// Транслит: «калакс» → «kalax» (≈ KALLAX), «алекс» → «alex».
const TR = Object.fromEntries(`а a|б b|в v|г g|д d|е e|ё e|ж zh|з z|и i|й i|к k|л l|м m|н n|о o|п p|р r|с s|т t|у u|ф f|х h|ц c|ч ch|ш sh|щ sch|ъ |ы y|ь |э e|ю yu|я ya`.split('|').map((p) => p.split(' ')));
const translit = (s) => s.toLowerCase().replace(/кс/g, 'x').replace(/[а-яё]/g, (c) => TR[c] ?? c);

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').normalize('NFD').replace(/[̀-ͯ]/g, '');
// Слова и числа отдельно: «100x48» → 100, x, 48; «rtx4090» → rtx, 4090.
export const tokens = (s) => norm(s).match(/\p{L}+|\p{N}+/gu) || [];

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  head[0] = head[0].replace(/^\uFEFF/, ''); // BOM, если файл сохраняли из Excel
  return body.filter((r) => r.length >= head.length).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i].trim()])));
}

// «… в коробке (упаковка 1 из 2) ×2» → основа названия + сведения об упаковке.
const BOXED = /\s+в коробке(?:\s+\(упаковка (\d+) из (\d+)\))?(?:\s+×(\d+))?\s*$/;

let docs = [];
let vocab = new Map(); // слово → { idf, post: Map(индекс документа → вес поля) }

function build(rows) {
  docs = [];
  vocab = new Map();
  const df = new Map();
  for (const r of rows) {
    const size = { x: +r.W, y: +r.H, z: +r.D };
    if (!(size.x > 0 && size.y > 0 && size.z > 0)) continue;
    const model = r.Model.replace(/\s*[™®]/g, '').replace(/\s{2,}/g, ' ') // «InstaView ™ ThinQ™» → «InstaView ThinQ»
      .replace(/^Sony Interactive Entertainment\b/, 'Sony');
    const m = model.match(BOXED);
    const doc = {
      base: m ? model.slice(0, m.index) : model,
      boxed: !!m,
      pack: m?.[1] ? { i: +m[1], n: +m[2] } : null,
      copies: m?.[3] ? +m[3] : 1,
      brand: r.Brand,
      category: r.Category,
      url: r.Source_URL,
      size,
      container: r.Category === 'Transport Packaging',
    };
    // Вес поля: само название — 1, бренд — 0.9, синонимы и категория — 0.7.
    const terms = new Map();
    const put = (list, w) => { for (const tk of list) if (w > (terms.get(tk) || 0)) terms.set(tk, w); };
    const own = tokens(doc.base);
    put(own, 1);
    put(tokens(r.Brand), 0.9);
    const extra = [CAT[r.Category]?.[1] || '', synonyms.get(norm(r.Brand)) || ''];
    for (const tk of own) if (synonyms.has(tk)) extra.push(synonyms.get(tk));
    put(tokens(extra.join(' ')), 0.7);
    // Предмет в упаковке находится по «коробка», но ниже настоящих коробок и тары.
    if (doc.boxed) put(tokens(`коробка коробке упаковка box`), 0.35);
    doc.len = own.length;
    doc.flat = own.join(' ');
    doc.id = docs.length;
    docs.push(doc);
    for (const [tk, w] of terms) {
      if (!vocab.has(tk)) vocab.set(tk, { idf: 0, post: new Map() });
      vocab.get(tk).post.set(doc.id, w);
      df.set(tk, (df.get(tk) || 0) + 1);
    }
  }
  for (const [tk, v] of vocab) v.idf = Math.log(1 + (docs.length - df.get(tk) + 0.5) / (df.get(tk) + 0.5));
  return docs.length;
}

// Расстояние Дамерау — Левенштейна (с перестановкой соседних букв), с отсечкой по max.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let pp = null, p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c[j] = Math.min(c[j], pp[j - 2] + 1);
      if (c[j] < low) low = c[j];
    }
    if (low > max) return max + 1;
    pp = p; p = c;
  }
  return p[b.length];
}

// Насколько слово каталога подходит к слову запроса (0 — никак).
function termMatch(q, term, last) {
  if (term === q) return 1;
  if (term.startsWith(q)) return last ? 0.8 : 0.6;
  if (/^\d+$/.test(q)) return 0; // числа — только точно или префиксом
  if (term.length >= 4 && q.startsWith(term) && q.length - term.length <= 3) return 0.6; // «холодильники» → «холодильник»
  const fuzz = q.length <= 2 ? 0 : q.length <= 5 ? 1 : 2; // fuzziness: AUTO
  if (!fuzz) return 0;
  const d = editDistance(q, term, fuzz);
  if (d <= fuzz) return d === 1 ? 0.5 : 0.35;
  if (last && q.length >= 4 && term.length > q.length && editDistance(q, term.slice(0, q.length), 1) <= 1) return 0.4;
  return 0;
}

function run(query, factor) {
  const qs = [...new Set(tokens(query))].filter((q) => q.length > 1 || /\d/.test(q));
  if (!qs.length) return new Map();
  let acc = null; // документ → { score, hits, exact } — exact: все слова совпали без исправления опечаток
  qs.forEach((q, qi) => {
    const last = qi === qs.length - 1;
    const best = new Map();
    for (const [term, v] of vocab) {
      const m = termMatch(q, term, last);
      if (!m) continue;
      const exact = m >= 0.6;
      for (const [id, w] of v.post) {
        const s = m * v.idf * w;
        const cur = best.get(id);
        // Точное совпадение вытесняет опечаточное, даже если у того вес больше.
        if (!cur || exact > cur.exact || (exact === cur.exact && s > cur.s)) best.set(id, { s, exact, term: w >= 0.9 ? term : null });
      }
    }
    // Все слова запроса обязательны (operator: and).
    const next = new Map();
    for (const [id, b] of best) {
      const prev = acc ? acc.get(id) : { score: 0, hits: new Set(), exact: true };
      if (!prev) continue;
      if (b.term) prev.hits.add(b.term);
      next.set(id, { score: prev.score + b.s, hits: prev.hits, exact: prev.exact && b.exact });
    }
    acc = next;
  });
  const phrase = qs.join(' ');
  for (const [id, r] of acc) {
    const d = docs[id];
    r.score *= factor / (1 + 0.03 * d.len); // короткое название — ближе к запросу
    if (d.flat.includes(phrase)) r.score *= 1.3;
    if (d.boxed) r.score *= 0.97; // сам предмет — выше своей коробки
  }
  return acc;
}

// Поиск: [{ doc, score, hits }] по убыванию, total — сколько всего нашлось.
export function searchCatalog(query, limit = 8) {
  const res = run(query, 1);
  const alt = [[swapLayout(query), 0.85]];
  if (/[а-яё]/i.test(query)) alt.push([translit(query), 0.9]);
  const better = (r, o) => !o || r.exact > o.exact || (r.exact === o.exact && r.score > o.score);
  for (const [q, f] of alt) for (const [id, r] of run(q, f)) if (better(r, res.get(id))) res.set(id, r);
  // Сначала точные и префиксные совпадения, потом найденные с исправлением опечаток.
  const list = [...res].map(([id, r]) => ({ doc: docs[id], ...r })).sort((a, b) => b.exact - a.exact || b.score - a.score || a.doc.len - b.doc.len);
  return { total: list.length, items: list.slice(0, limit) };
}
