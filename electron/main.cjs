/**
 * 3DPacking для десктопа: окно Electron со сборкой страницы (dist/).
 *
 * Запускается сразу на весь экран (отдельное пространство macOS).
 * Страница — обычная веб-страница без доступа к Node; из окна ей нужны
 * только команды меню и состояние «полный экран / окно» (preload.cjs).
 * Данные склада и настройки — в localStorage страницы, то есть в
 * ~/Library/Application Support/3DPacking.
 */

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const MENU = require('./menu-i18n.cjs');

app.setName('3DPacking');
let win = null;

function send(action) {
  win?.webContents.send('menu', action);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1000,
    minHeight: 640,
    title: '3DPacking',
    fullscreen: !process.env.PACKING_WINDOWED,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#141418',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => win.show());

  const fs = () => send(win.isFullScreen() ? 'fullscreen-on' : 'fullscreen-off');
  win.on('enter-full-screen', fs);
  win.on('leave-full-screen', fs);
  win.webContents.on('did-finish-load', fs);

  // Внешние ссылки — в браузер, не в окне программы.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });

  // Самопроверка сборки: PACKING_SELFTEST=1 — открыть, проверить страницу, выйти.
  if (process.env.PACKING_SELFTEST) {
    win.webContents.on('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const report = await win.webContents.executeJavaScript(`JSON.stringify({
        заголовок: document.title,
        объектов: document.querySelectorAll('.row').length,
        холст: !!document.querySelector('#viewport canvas'),
        тема: document.documentElement.dataset.theme,
        язык: document.documentElement.lang,
        мостик: typeof window.desktop?.onMenu,
        полныйЭкран: document.documentElement.hasAttribute('data-windowed') ? 'нет' : 'да',
      })`);
      console.log('[3DPacking] самопроверка:', report);
      if (process.env.PACKING_SCREENSHOT) {
        const img = await win.webContents.capturePage();
        require('node:fs').writeFileSync(process.env.PACKING_SCREENSHOT, img.toPNG());
      }
      app.quit();
    });
  }
}

// Меню: ⌘Z / ⇧⌘Z отдаём странице — она сама решает, отменить правку
// склада или текста в поле (роль undo съела бы клавишу раньше страницы).
function buildMenu(lang = 'ru') {
  const L = MENU[lang] || MENU.en;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: '3DPacking',
      submenu: [
        { role: 'about', label: L.about },
        { type: 'separator' },
        { label: L.settings, accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { role: 'hide', label: L.hide },
        { role: 'hideOthers', label: L.hideOthers },
        { role: 'unhide', label: L.unhide },
        { type: 'separator' },
        { role: 'quit', label: L.quit },
      ],
    },
    {
      label: L.file,
      submenu: [
        { label: L.newObject, accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { type: 'separator' },
        { label: L.exportJson, accelerator: 'CmdOrCtrl+E', click: () => send('export') },
        { label: L.importJson, accelerator: 'CmdOrCtrl+O', click: () => send('import') },
      ],
    },
    {
      label: L.edit,
      submenu: [
        { label: L.undo, accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: L.redo, accelerator: 'Shift+CmdOrCtrl+Z', click: () => send('redo') },
        { type: 'separator' },
        { role: 'cut', label: L.cut },
        { role: 'copy', label: L.copy },
        { role: 'paste', label: L.paste },
        { role: 'selectAll', label: L.selectAll },
      ],
    },
    {
      label: L.view,
      submenu: [
        { label: L.leftPanel, accelerator: 'CmdOrCtrl+[', click: () => send('left') },
        { label: L.rightPanel, accelerator: 'CmdOrCtrl+]', click: () => send('right') },
        { label: L.zen, accelerator: 'CmdOrCtrl+Shift+D', click: () => send('zen') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: L.fullscreen },
        { type: 'separator' },
        { role: 'reload', label: L.reload },
        { role: 'toggleDevTools', label: L.devtools },
      ],
    },
    { role: 'windowMenu', label: L.window },
    {
      role: 'help',
      label: L.help,
      submenu: [{ label: L.helpItem, accelerator: 'F1', click: () => send('help') }],
    },
  ]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  // Страница сообщает язык интерфейса — меню переводим вслед за ней.
  ipcMain.on('lang', (_e, lang) => buildMenu(String(lang)));
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => { if (!win) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
