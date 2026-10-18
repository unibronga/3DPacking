// Фото объектов. Картинки весят много — localStorage (~5 МБ) не подходит,
// поэтому файлы лежат в IndexedDB, а в объекте склада — только id фото.
// Так работают отмена/повтор: снимок истории хранит ссылку, сам файл
// никуда не девается. Неиспользуемые фото убираются при запуске (gc).

import { t } from './i18n.js';

const DB_NAME = 'sklad3d-photos';
const STORE = 'photos';
const MAX_SIDE = 2000; // px — больше для экрана не нужно
const urls = new Map(); // id → objectURL

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const st = t.objectStore(STORE);
    let out;
    const r = fn(st);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}

const getBlob = (id) => tx('readonly', (st) => st.get(id));
const putBlob = (id, blob) => tx('readwrite', (st) => st.put(blob, id));
const keys = () => tx('readonly', (st) => st.getAllKeys());

// Уменьшаем большие снимки с телефона до MAX_SIDE и пережимаем в WebP.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (k === 1 && file.size < 1.5e6) { bmp.close?.(); return file; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/webp', 0.88));
}

export async function addPhoto(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error(t('Это не картинка'));
  const blob = await shrink(file);
  const id = 'ph_' + Math.random().toString(36).slice(2, 10);
  await putBlob(id, blob);
  return id;
}

// Синхронно — если уже загружали (чтобы панель не мигала при перерисовке).
export const cachedUrl = (id) => urls.get(id) || null;

export async function photoUrl(id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  const blob = await getBlob(id);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}

// Удалить фото, на которые больше никто не ссылается.
export async function gc(used) {
  try {
    const all = await keys();
    const stale = all.filter((k) => !used.has(k));
    if (stale.length) await tx('readwrite', (st) => { for (const k of stale) st.delete(k); });
  } catch {}
}

const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

// Для экспорта в JSON: { id: dataURL }.
export async function exportPhotos(ids) {
  const out = {};
  for (const id of ids) {
    const b = await getBlob(id);
    if (b) out[id] = await toDataUrl(b);
  }
  return out;
}

export async function importPhotos(map = {}) {
  for (const [id, data] of Object.entries(map)) {
    const blob = await (await fetch(data)).blob();
    await putBlob(id, blob);
  }
}
