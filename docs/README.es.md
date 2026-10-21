<p align="center">
  <img src="icon.png" width="128" alt="Icono de 3DPacking">
</p>

<h1 align="center">3DPacking</h1>

<p align="center">
  <b>Tu almacén, en 3D.</b><br>
  Habitaciones, armarios y cajas van unos dentro de otros. Coloca las cosas a mano — o deja que el programa las encaje al máximo.
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.uk.md">Українська</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.nl.md">Nederlands</a> ·
  <a href="README.fr.md">Français</a> ·
  <b>Español</b>
</p>

<p align="center">
  <a href="https://github.com/unibronga/3DPacking/releases/latest"><img src="https://img.shields.io/github/v/release/unibronga/3DPacking?style=flat-square&color=ff8f7a" alt="Versión"></a>
  <img src="https://img.shields.io/badge/macOS-Apple%20Silicon-555?style=flat-square&logo=apple" alt="macOS">
  <img src="https://img.shields.io/badge/three.js-r180-6c8cff?style=flat-square" alt="three.js">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-44e3a0?style=flat-square" alt="MIT"></a>
</p>

<p align="center">
  <img src="hero.png" alt="3DPacking con el tema PixelArt: un trastero con estantería, cajas y maleta" width="900">
</p>

## Para qué

Sabes que la caja de cables está *en algún sitio* del trastero. 3DPacking mantiene un modelo 3D vivo de tus habitaciones, armarios, estanterías y cajas: qué hay en cada una, cuánto espacio queda y una foto de cada cosa. Es una aplicación de escritorio — todos los datos se quedan en tu ordenador.

## Funciones

- 🧱 **Contenedores anidados** — habitaciones, armarios, estanterías, cajas y cosas, anidados tan hondo como quieras. Los anillos de llenado muestran cuánto espacio está ocupado.
- 📚 **Catálogo de productos reales** — empieza a escribir un nombre y elige entre más de 1600 cosas reales y sus cajas de fábrica (IKEA, Samsung, LG, Bosch, Philips, cajas de mudanza, palés…): las medidas reales se rellenan solas. La búsqueda perdona erratas y una distribución de teclado equivocada. Cada medida viene de una fuente oficial.
- 🖱️ **Colocación manual** — arrastra las cosas directamente en la escena: caen al suelo y unas sobre otras, se ajustan a paredes y vecinos, y entran en un armario o una caja si las sueltas encima. **Girar 90°** y **De lado** ponen una cosa en cualquiera de sus seis posiciones.
- 📦 **Empaquetado automático compacto** — bin packing 3D: puntos extremos, al menos un 70 % de apoyo, giros, objetos «vacíos» tumbados de lado, heurísticas de orden y búsqueda local dentro de un tiempo límite. Pon un contenedor en **Auto** y se recolocará con cada cambio.
- 🔍 **Navegación sencilla** — selección a través de paredes transparentes, cámara que vuela a cualquier objeto, vistas 3D / arriba / frente / lado, ruta de navegación, búsqueda.
- 📷 **Fotos, notas y campos propios** — pega o arrastra una foto a cualquier objeto (se guarda en local, comprimida a WebP), añade notas y tus propios campos.
- ↩️ **Experimenta sin miedo** — guardado automático, deshacer y rehacer para todo (un arrastre completo es un paso), exportación e importación JSON con fotos.
- 🎨 **A tu gusto** — seis temas de Grafito a PixelArt, ocho texturas de fondo, modo Zen, tamaño de interfaz 80–200 %, 3D pixelado.
- 🌍 **Siete idiomas** — English, Русский, Українська, Deutsch, Nederlands, Français, Español — incluidos el menú y la ayuda integrada (`F1` o `?`).

<p align="center">
  <img src="screenshot.png" alt="3DPacking: resumen del almacén con el tema Grafito" width="900">
</p>

## Descargar

Descarga **3DPacking-mac-arm64.zip** de la [última versión](https://github.com/unibronga/3DPacking/releases/latest), descomprímelo y mueve **3DPacking.app** a Aplicaciones.

> La app está firmada con un Developer ID y notarizada por Apple — se abre como cualquier otra app de Mac.

## Compilar desde el código

Requiere Node.js 20+.

```bash
npm install
npm run dev       # en el navegador: http://localhost:5288
npm run desktop   # ventana de Electron
npm run app       # release/mac-arm64/3DPacking.app
npm run i18n      # comprobar que cada idioma tiene todos los textos
```

## Atajos de teclado

| Tecla | Acción | Tecla | Acción |
| --- | --- | --- | --- |
| `N` | Nuevo objeto | `A` | Colocar compacto |
| `F` | Mostrar selección | `Z` | Modo Zen |
| `G` | Modo mover | `,` | Ajustes |
| `H` | Ocultar / mostrar | `?` / `F1` | Ayuda |
| `⌘D` | Duplicar | `[` `]` | Panel izquierdo / derecho |
| `⌘Z` / `⇧⌘Z` | Deshacer / rehacer | `⌥` + clic | Seleccionar contenedor |
| `⌫` | Eliminar | `Esc` | Quitar selección |

## Por dentro

Vite + JavaScript puro + [three.js](https://threejs.org) r180 + Electron — sin frameworks.

| Archivo | Qué hace |
| --- | --- |
| `src/store.js` | Datos: lista plana con `parentId`, tamaños y posiciones en cm, deshacer con instantáneas |
| `src/packing.js` | Empaquetado 3D compacto |
| `src/viewport.js` | Escena, selección, arrastre con gravedad y ajuste, vuelos de cámara |
| `src/i18n.js`, `src/locales/` | Idiomas: la clave es el texto ruso, cada diccionario da la traducción |
| `src/ui/` | Árbol a la izquierda, inspector, ventanas, ajustes, ayuda |
| `electron/` | Ventana de la app y menú traducido |

### Añadir un idioma

Copia `src/locales/en.js`, traduce los valores, añade el idioma a `LANGS` en `src/i18n.js` y a `electron/menu-i18n.cjs`, y ejecuta `npm run i18n`.

## Licencia

[MIT](../LICENSE) © 2026 Kostiantyn
