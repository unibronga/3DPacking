// Плотная укладка коробок в один контейнер (3D bin packing).
//
// Жадная укладка по «крайним точкам» (extreme points) с проекциями точек
// к стенкам и с проверкой опоры (ничего не висит в воздухе). Одна укладка —
// это порядок предметов + правило выбора места. Перебираем несколько
// продуманных порядков и правил, потом случайные варианты, пока есть время,
// и оставляем лучший: больше объёма внутри, ниже стопки, компактнее.

const EPS = 0.01;
const SUPPORT = 0.7; // минимальная доля опоры под дном

const overlap = (a, as, b, bs) =>
  a.x < b.x + bs.x - EPS && a.x + as.x > b.x + EPS &&
  a.y < b.y + bs.y - EPS && a.y + as.y > b.y + EPS &&
  a.z < b.z + bs.z - EPS && a.z + as.z > b.z + EPS;

// Варианты поворота: всегда можно крутить вокруг вертикали,
// а если разрешено класть на бок — все шесть.
export function orientations(s, tilt) {
  const list = tilt
    ? [[s.x, s.y, s.z], [s.z, s.y, s.x], [s.x, s.z, s.y], [s.y, s.z, s.x], [s.y, s.x, s.z], [s.z, s.x, s.y]]
    : [[s.x, s.y, s.z], [s.z, s.y, s.x]];
  const seen = new Set();
  const out = [];
  for (const [x, y, z] of list) {
    const k = `${x}|${y}|${z}`;
    if (!seen.has(k)) { seen.add(k); out.push({ x, y, z }); }
  }
  return out;
}

function supportRatio(p, o, placed) {
  if (p.y < EPS) return 1;
  let area = 0;
  for (const b of placed) {
    if (Math.abs(b.p.y + b.o.y - p.y) > 0.5) continue;
    const w = Math.min(p.x + o.x, b.p.x + b.o.x) - Math.max(p.x, b.p.x);
    const d = Math.min(p.z + o.z, b.p.z + b.o.z) - Math.max(p.z, b.p.z);
    if (w > 0 && d > 0) area += w * d;
  }
  return area / (o.x * o.z);
}

// Сдвиг точки вдоль оси назад, пока не упрётся в стенку или коробку.
function project(pt, axis, placed) {
  const [a, b] = axis === 'x' ? ['y', 'z'] : axis === 'z' ? ['x', 'y'] : ['x', 'z'];
  let lim = 0;
  for (const q of placed) {
    const end = q.p[axis] + q.o[axis];
    if (end > pt[axis] + EPS) continue;
    if (pt[a] < q.p[a] - EPS || pt[a] >= q.p[a] + q.o[a] - EPS) continue;
    if (pt[b] < q.p[b] - EPS || pt[b] >= q.p[b] + q.o[b] - EPS) continue;
    if (end > lim) lim = end;
  }
  return { ...pt, [axis]: lim };
}

// Правила выбора места: «глубже-ниже-левее» и «плотнее к соседям».
const SCORERS = {
  dblf: (p, o) => p.y * 1e8 + p.z * 1e4 + p.x + o.y * 1e-3,
  // то же место, но поворот выбираем так, чтобы до стенок оставалось
  // кратное размеру место (меньше «огрызков»)
  fit: (p, o, placed, C) => {
    const waste = ((C.x - p.x) % o.x) / C.x + ((C.z - p.z) % o.z) / C.z + ((C.y - p.y) % o.y) / C.y;
    return p.y * 1e8 + p.z * 1e4 + p.x + waste * 0.5;
  },
  contact: (p, o, placed, C) => {
    // чем больше площадь касания со стенками и соседями, тем лучше
    let c = 0;
    if (p.x < EPS) c += o.y * o.z;
    if (p.z < EPS) c += o.x * o.y;
    if (p.y < EPS) c += o.x * o.z;
    if (Math.abs(p.x + o.x - C.x) < EPS) c += o.y * o.z;
    if (Math.abs(p.z + o.z - C.z) < EPS) c += o.x * o.y;
    for (const b of placed) {
      const ox = Math.min(p.x + o.x, b.p.x + b.o.x) - Math.max(p.x, b.p.x);
      const oy = Math.min(p.y + o.y, b.p.y + b.o.y) - Math.max(p.y, b.p.y);
      const oz = Math.min(p.z + o.z, b.p.z + b.o.z) - Math.max(p.z, b.p.z);
      if (Math.abs(p.x - (b.p.x + b.o.x)) < EPS || Math.abs(p.x + o.x - b.p.x) < EPS) { if (oy > 0 && oz > 0) c += oy * oz; }
      if (Math.abs(p.z - (b.p.z + b.o.z)) < EPS || Math.abs(p.z + o.z - b.p.z) < EPS) { if (ox > 0 && oy > 0) c += ox * oy; }
      if (Math.abs(p.y - (b.p.y + b.o.y)) < EPS) { if (ox > 0 && oz > 0) c += ox * oz; }
    }
    return -c + p.y * 50 + (p.y + o.y) * 5;
  },
};

function run(C, order, scorer) {
  const placed = [];
  const overflow = [];
  let points = [{ x: 0, y: 0, z: 0 }];
  for (const it of order) {
    let best = null;
    for (const p of points) {
      for (const o of it.orients) {
        if (p.x + o.x > C.x + EPS || p.y + o.y > C.y + EPS || p.z + o.z > C.z + EPS) continue;
        let hit = false;
        for (const b of placed) if (overlap(p, o, b.p, b.o)) { hit = true; break; }
        if (hit) continue;
        if (supportRatio(p, o, placed) < SUPPORT) continue;
        const s = scorer(p, o, placed, C);
        if (!best || s < best.s) best = { p, o, s };
      }
    }
    if (!best) { overflow.push(it.id); continue; }
    const { p, o } = best;
    placed.push({ id: it.id, p: { ...p }, o });
    // новые крайние точки + их проекции к стенкам
    const fresh = [
      { x: p.x + o.x, y: p.y, z: p.z },
      { x: p.x, y: p.y + o.y, z: p.z },
      { x: p.x, y: p.y, z: p.z + o.z },
    ];
    for (const f of fresh.slice()) {
      fresh.push(project(f, 'x', placed), project(f, 'z', placed), project(f, 'y', placed));
    }
    const all = points.concat(fresh);
    const seen = new Set();
    points = [];
    for (const q of all) {
      if (q.x > C.x - EPS || q.y > C.y - EPS || q.z > C.z - EPS) continue;
      const k = `${Math.round(q.x * 10)}|${Math.round(q.y * 10)}|${Math.round(q.z * 10)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      // точка внутри уже поставленной коробки бесполезна
      if (placed.some((b) => q.x >= b.p.x - EPS && q.x < b.p.x + b.o.x - EPS && q.y >= b.p.y - EPS && q.y < b.p.y + b.o.y - EPS && q.z >= b.p.z - EPS && q.z < b.p.z + b.o.z - EPS)) continue;
      points.push(q);
    }
    points.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  }
  const volume = placed.reduce((s, b) => s + b.o.x * b.o.y * b.o.z, 0);
  const height = placed.reduce((m, b) => Math.max(m, b.p.y + b.o.y), 0);
  const ySum = placed.reduce((s, b) => s + b.p.y, 0);
  return { placed, overflow, volume, height, ySum };
}

const better = (a, b) =>
  !b || a.volume > b.volume + EPS ||
  (Math.abs(a.volume - b.volume) <= EPS && (a.height < b.height - EPS || (Math.abs(a.height - b.height) <= EPS && a.ySum < b.ySum)));

// Детерминированный генератор — одинаковый результат при одинаковых данных.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// items: [{ id, size: {x,y,z}, tilt }]; container: {x,y,z}.
// Возвращает места для поместившихся и список не поместившихся.
export function pack(container, items, { budgetMs = 300 } = {}) {
  const C = container;
  const base = items.map((it) => ({ id: it.id, size: it.size, vol: it.size.x * it.size.y * it.size.z, orients: orientations(it.size, it.tilt) }));
  const maxDim = (it) => Math.max(it.size.x, it.size.y, it.size.z);
  const foot = (it) => it.size.x * it.size.z;
  const orders = [
    [...base].sort((a, b) => b.vol - a.vol),
    [...base].sort((a, b) => maxDim(b) - maxDim(a) || b.vol - a.vol),
    [...base].sort((a, b) => foot(b) - foot(a) || b.vol - a.vol),
    [...base].sort((a, b) => b.size.y - a.size.y || b.vol - a.vol),
    [...base].sort((a, b) => a.size.y - b.size.y || b.vol - a.vol),
  ];
  const t0 = performance.now();
  let best = null;
  let runs = 0;
  for (const order of orders) {
    for (const sc of Object.values(SCORERS)) {
      const r = run(C, order, sc);
      runs++;
      if (better(r, best)) best = { ...r, order, sc };
      if (performance.now() - t0 > budgetMs) break;
    }
    if (performance.now() - t0 > budgetMs) break;
  }
  // Случайные «встряски» порядка: по объёму с шумом.
  const rand = rng(items.length * 7919 + Math.round(C.x * C.y * C.z) % 100000);
  const scorers = Object.values(SCORERS);
  while (performance.now() - t0 < budgetMs && base.length > 1) {
    // шум в порядке и в предпочтении поворотов (при равных местах)
    const noisy = base
      .map((it) => ({ it: { ...it, orients: [...it.orients].sort(() => rand() - 0.5) }, k: it.vol * (0.55 + rand() * 0.9) }))
      .sort((a, b) => b.k - a.k).map((x) => x.it);
    const sc = scorers[runs % scorers.length];
    const r = run(C, noisy, sc);
    runs++;
    if (better(r, best)) best = { ...r, order: noisy, sc };
    // локальный поиск от лучшего: переставить пару предметов местами
    for (let k = 0; k < 3 && performance.now() - t0 < budgetMs; k++) {
      const order = best.order.slice();
      const i = Math.floor(rand() * order.length), j = Math.floor(rand() * order.length);
      [order[i], order[j]] = [order[j], order[i]];
      const r2 = run(C, order, best.sc);
      runs++;
      if (better(r2, best)) best = { ...r2, order, sc: best.sc };
    }
  }
  return {
    placements: new Map(best.placed.map((b) => [b.id, { pos: b.p, size: b.o }])),
    overflow: best.overflow,
    volume: best.volume,
    runs,
  };
}
