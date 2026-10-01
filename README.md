# MetalSlugFontRebornSolid2

Web app version of [MetalSlugFontReborn](https://github.com/Mitra-88/MetalSlugFontReborn): a standalone client-side reimplementation running on Solid 2 (TypeScript), Vite and Tailwind CSS, styled after Material Design 3

## 🚀 Demo

Visit the live instance: [https://metalslugfontrebornsolid2.mitra88dev.workers.dev](https://metalslugfontrebornsolid2.mitra88dev.workers.dev)

## ✨ Highlights

- Live canvas rendering: type text, pick a font variant, color and scale, download the PNG. Characters a font cannot draw are skipped automatically with a clear notice, and the rest still renders.
- Reliable by design: sprite loads have timeouts and automatic retries, failures offer a one-click retry, and the character support lists are machine-verified against the sprite files on every test run.
- Material 3 design system hand-rolled with Tailwind tokens: three seed palettes (Amber Forge, Verdant, Azure) each with full light and dark schemes, M3 color roles, type scale, shape and expressive spring motion.
- Fast by construction: sprites decode once into GPU bitmaps via `createImageBitmap`, layouts are memoized per text, the rest of the font warms up during idle time, and a built-in sampling profiler shows render phase timings (load, layout, draw) with p50/p95 stats right in the preview panel.
- Adaptive layout for desktop and mobile, no router, no server.

## 🖥️ Desktop edition

The same app wrapped in a [Neutralino.js](https://neutralino.js.org) desktop shell for Windows, macOS and Linux lives in the sibling repository: [MetalSlugFontRebornDesktop](https://github.com/Mitra-88/MetalSlugFontRebornDesktop).

## 📁 Project Structure

```
├── index.html            # Main generator page
├── examples.html         # Font examples gallery
├── supported.html        # Character support reference
├── public/
│   └── assets/
│       ├── examples/     # Example images
│       ├── fonts/        # Character sprite assets (5 fonts, various colors)
│       └── icons/        # App icons and favicon
├── src/
│   ├── lib/
│   │   ├── fonts.ts      # Font metadata, character mapping, path builder
│   │   ├── render.ts     # Bitmap cache, idle preloading, layout memo, canvas drawing
│   │   ├── perf.ts       # Sampling profiler for the render pipeline
│   │   └── icons.tsx     # Locally defined lucide icon glyphs
│   ├── pages/
│   │   ├── Generator.tsx # Controls, live preview, profiler panel, download
│   │   ├── Examples.tsx
│   │   └── Supported.tsx
│   ├── Page.tsx          # App bar, page shell, theme toggle
│   ├── index.css         # Material 3 design system (Tailwind v4 tokens)
│   └── *.tsx             # Entry points per page
└── tests/
    ├── layout.test.js    # Self-check for layout and character logic
    ├── perf.test.js      # Profiler math + layout benchmark
    └── sprites.test.js   # Verifies support lists against sprite files
```

## 🔧 Installation

### Prerequisites

- Node.js 24.21.0 or newer

### Setup

```
git clone https://github.com/Mitra-88/MetalSlugFontRebornSolid2.git
cd MetalSlugFontRebornSolid2
npm install
```

### Develop

```
npm run dev
```

### Build and preview

```
npm run build
npm run preview
```

The build outputs static HTML/JS/CSS into `dist/` with relative paths, ready to drop onto GitHub Pages, Netlify, Cloudflare Workers or any static host (or bundle into a Tauri shell).

### Type check and self-checks

```
npm run typecheck
npm test
```

## 📄 License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
