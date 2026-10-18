// Мостик страницы к окну: команды меню, «полный экран / окно» и язык меню.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  onMenu: (cb) => ipcRenderer.on('menu', (_e, action) => cb(action)),
  setLang: (lang) => ipcRenderer.send('lang', lang),
});
