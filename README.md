<p align="center">
  <img src="docs/icon.png" width="128" alt="3DPacking icon">
</p>

<h1 align="center">3DPacking</h1>

<p align="center">
  <b>Your storage, in 3D.</b><br>
  Rooms, cabinets and boxes nest inside each other. Place things by hand — or let the packer fit them tightly.
</p>

<p align="center">
  <b>English</b> ·
  <a href="docs/README.ru.md">Русский</a> ·
  <a href="docs/README.uk.md">Українська</a> ·
  <a href="docs/README.de.md">Deutsch</a> ·
  <a href="docs/README.nl.md">Nederlands</a> ·
  <a href="docs/README.fr.md">Français</a> ·
  <a href="docs/README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://github.com/unibronga/3DPacking/releases/latest"><img src="https://img.shields.io/github/v/release/unibronga/3DPacking?style=flat-square&color=ff8f7a" alt="Release"></a>
  <img src="https://img.shields.io/badge/macOS-Apple%20Silicon-555?style=flat-square&logo=apple" alt="macOS">
  <img src="https://img.shields.io/badge/three.js-r180-6c8cff?style=flat-square" alt="three.js">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-44e3a0?style=flat-square" alt="MIT"></a>
</p>

<p align="center">
  <img src="docs/screenshot.png" alt="3DPacking — storage overview in the Graphite theme" width="900">
</p>

## Why

You know there’s a box of cables *somewhere* in the storeroom. 3DPacking keeps a living 3D model of your rooms, cabinets, shelves and boxes — with what’s inside each of them, how much space is left, and a photo of every item. It’s a desktop app: everything stays on your computer.

## Features

- 🧱 **Nested containers** — rooms, cabinets, shelving units, boxes and things, nested as deep as you like. Fill rings show how much space is used.
- 🖱️ **Manual placement** — drag things right in the scene: they fall onto the floor and onto each other, snap to walls and neighbours, and drop into a cabinet or box when you release them over it.
- 📦 **Tight auto-packing** — a 3D bin packer (extreme points, at least 70 % support, rotations, tilting “empty” items on their side, ordering heuristics and local search within a time budget). Switch a container to **Auto** and it repacks on every change.
- 🔍 **Easy to navigate** — select through transparent walls, fly the camera to anything, 3D / top / front / side views, breadcrumbs, search.
- 📷 **Photos, notes and custom fields** — paste or drop a photo onto any object (stored locally, compressed to WebP), add notes and your own fields.
- ↩️ **Safe to experiment** — autosave, undo / redo for everything (a whole mouse drag is one step), JSON export / import with photos.
- 🎨 **Looks the way you like** — six themes from Graphite to PixelArt, eight background textures, Zen mode, interface size 80–200 %, optional pixel 3D.
- 🌍 **Seven languages** — English, Русский, Українська, Deutsch, Nederlands, Français, Español — including the menu and the built-in help (`F1` or `?`).

<p align="center">
  <img src="docs/screenshot-pixelart.png" alt="3DPacking in the PixelArt theme" width="900">
</p>

## Download

Grab **3DPacking-mac-arm64.zip** from the [latest release](https://github.com/unibronga/3DPacking/releases/latest), unzip it and move **3DPacking.app** to Applications.

> The app is signed with a Developer ID and notarized by Apple — it opens like any other Mac app.

## Build from source

Requires Node.js 20+.

```bash
npm install
npm run dev       # in the browser: http://localhost:5288
npm run desktop   # Electron window
npm run app       # release/mac-arm64/3DPacking.app
npm run i18n      # check that every language has every string
```

## Keyboard shortcuts

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `N` | New object | `A` | Pack tightly |
| `F` | Show selected | `Z` | Zen mode |
| `G` | Move mode | `,` | Settings |
| `H` | Hide / show | `?` / `F1` | Help |
| `⌘D` | Duplicate | `[` `]` | Left / right panel |
| `⌘Z` / `⇧⌘Z` | Undo / redo | `⌥` + click | Select the container |
| `⌫` | Delete | `Esc` | Deselect |

## Under the hood

Vite + vanilla JavaScript + [three.js](https://threejs.org) r180 + Electron — no frameworks.

| File | What it does |
| --- | --- |
| `src/store.js` | Data: a flat list with `parentId`, sizes and positions in cm, snapshot undo / redo |
| `src/packing.js` | 3D bin packing |
| `src/viewport.js` | Scene, selection, dragging with gravity and snapping, camera flights |
| `src/i18n.js`, `src/locales/` | Languages: the Russian string is the key, each locale maps it to a translation |
| `src/ui/` | Sidebar tree, inspector, dialogs, settings, help |
| `electron/` | Desktop window and translated menu |

### Adding a language

Copy `src/locales/en.js`, translate the values, register the language in `LANGS` in `src/i18n.js` and in `electron/menu-i18n.cjs`, then run `npm run i18n`.

## License

[MIT](LICENSE) © 2026 Kostiantyn
