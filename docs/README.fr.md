<p align="center">
  <img src="icon.png" width="128" alt="Icône de 3DPacking">
</p>

<h1 align="center">3DPacking</h1>

<p align="center">
  <b>Votre rangement, en 3D.</b><br>
  Pièces, armoires et cartons s’emboîtent. Placez vos affaires à la main — ou laissez le programme les ranger au plus serré.
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.uk.md">Українська</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.nl.md">Nederlands</a> ·
  <b>Français</b> ·
  <a href="README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://github.com/unibronga/3DPacking/releases/latest"><img src="https://img.shields.io/github/v/release/unibronga/3DPacking?style=flat-square&color=ff8f7a" alt="Version"></a>
  <img src="https://img.shields.io/badge/macOS-Apple%20Silicon-555?style=flat-square&logo=apple" alt="macOS">
  <img src="https://img.shields.io/badge/three.js-r180-6c8cff?style=flat-square" alt="three.js">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-44e3a0?style=flat-square" alt="MIT"></a>
</p>

<p align="center">
  <img src="screenshot.png" alt="3DPacking : vue d’ensemble dans le thème Graphite" width="900">
</p>

## Pourquoi

Vous savez que le carton de câbles est *quelque part* dans le débarras. 3DPacking tient à jour un modèle 3D vivant de vos pièces, armoires, étagères et cartons : ce que contient chacun, la place qui reste, et une photo de chaque objet. C’est une application de bureau — toutes les données restent sur votre ordinateur.

## Fonctionnalités

- 🧱 **Conteneurs imbriqués** — pièces, armoires, étagères, cartons et objets, imbriqués aussi profondément que vous voulez. Des anneaux de remplissage montrent la place occupée.
- 🖱️ **Placement manuel** — faites glisser les objets directement dans la scène : ils tombent au sol et les uns sur les autres, s’aimantent aux parois et aux voisins, et entrent dans une armoire ou un carton quand vous les lâchez au-dessus.
- 📦 **Rangement automatique compact** — un algorithme de bin packing 3D : points extrêmes, au moins 70 % d’appui, rotations, objets « vides » couchés sur le côté, heuristiques d’ordre et recherche locale dans un budget de temps. Passez un conteneur en **Auto** et il se re-range à chaque modification.
- 🔍 **Navigation aisée** — sélection à travers les parois transparentes, caméra qui vole vers n’importe quel objet, vues 3D / dessus / face / côté, fil d’Ariane, recherche.
- 📷 **Photos, notes et champs personnalisés** — collez ou glissez une photo sur n’importe quel objet (stockée localement, compressée en WebP), ajoutez des notes et vos propres champs.
- ↩️ **Testez sans crainte** — enregistrement automatique, annuler / rétablir pour tout (un glisser complet compte pour une étape), export et import JSON avec les photos.
- 🎨 **À votre goût** — six thèmes de Graphite à PixelArt, huit textures de fond, mode Zen, taille d’interface 80–200 %, 3D pixelisée.
- 🌍 **Sept langues** — English, Русский, Українська, Deutsch, Nederlands, Français, Español — y compris le menu et l’aide intégrée (`F1` ou `?`).

<p align="center">
  <img src="screenshot-pixelart.png" alt="3DPacking dans le thème PixelArt" width="900">
</p>

## Télécharger

Récupérez **3DPacking-mac-arm64.zip** dans la [dernière version](https://github.com/unibronga/3DPacking/releases/latest), décompressez-le et placez **3DPacking.app** dans Applications.

> L’application est signée avec un Developer ID et notariée par Apple — elle s’ouvre comme n’importe quelle app Mac.

## Compiler depuis les sources

Nécessite Node.js 20+.

```bash
npm install
npm run dev       # dans le navigateur : http://localhost:5288
npm run desktop   # fenêtre Electron
npm run app       # release/mac-arm64/3DPacking.app
npm run i18n      # vérifier que chaque langue a tous les textes
```

## Raccourcis clavier

| Touche | Action | Touche | Action |
| --- | --- | --- | --- |
| `N` | Nouvel objet | `A` | Ranger de façon compacte |
| `F` | Afficher la sélection | `Z` | Mode Zen |
| `G` | Mode déplacement | `,` | Réglages |
| `H` | Masquer / afficher | `?` / `F1` | Aide |
| `⌘D` | Dupliquer | `[` `]` | Panneau gauche / droit |
| `⌘Z` / `⇧⌘Z` | Annuler / rétablir | `⌥` + clic | Sélectionner le conteneur |
| `⌫` | Supprimer | `Esc` | Désélectionner |

## Sous le capot

Vite + JavaScript pur + [three.js](https://threejs.org) r180 + Electron — sans framework.

| Fichier | Rôle |
| --- | --- |
| `src/store.js` | Données : liste plate avec `parentId`, tailles et positions en cm, annulation par instantanés |
| `src/packing.js` | Rangement 3D compact |
| `src/viewport.js` | Scène, sélection, glisser avec gravité et aimantation, vols de caméra |
| `src/i18n.js`, `src/locales/` | Langues : la clé est le texte russe, chaque dictionnaire fournit la traduction |
| `src/ui/` | Arbre à gauche, inspecteur, fenêtres, réglages, aide |
| `electron/` | Fenêtre de l’application et menu traduit |

### Ajouter une langue

Copiez `src/locales/en.js`, traduisez les valeurs, déclarez la langue dans `LANGS` de `src/i18n.js` et dans `electron/menu-i18n.cjs`, puis lancez `npm run i18n`.

## Licence

[MIT](../LICENSE) © 2026 Kostiantyn
