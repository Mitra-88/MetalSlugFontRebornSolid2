# MetalSlugFontRebornSolid2

Metal Slug text to PNG renderer in Solid 2 and Vite. Type text, pick one of five Metal Slug fonts, a color, and a scale, then download a PNG. Everything runs in the browser, no server.

Live site: https://metalslugfontrebornsolid2.mitra88dev.workers.dev

## What it does

- Renders typed text live on a canvas from per-character sprite PNGs, then downloads the result as a PNG. Characters the selected font cannot draw are skipped and listed, the rest still renders.
- Solid 2 with TypeScript, Vite 8, Tailwind CSS 4, and a hand-rolled Material 3 system with six palettes and light and dark themes.
- Sprite loading has timeouts and one automatic retry. Load failures offer a retry button and do not block the rest of the page.
- A sampling profiler times each render in three phases, load, layout, and draw, with p50 and p95 stats. On desktop, the Timing details panel also shows a short bar per run and a table of the last five runs. On phones and tablets it stays hidden.
- Character support lists are machine-verified against the sprite files on every test run. The palette dot for each color is sampled once per color from the first font that has it, the same rule the Python app uses, so a color looks the same everywhere.
- Adaptive layout for desktop and mobile, with a bottom navigation bar under `sm` and safe-area padding. No router, no server.

Desktop shell: the Neutralino.js version for Windows, macOS, and Linux lives in [MetalSlugFontRebornDesktop](https://github.com/Mitra-88/MetalSlugFontRebornDesktop).

## Structure

| What | Where | Notes |
| --- | --- | --- |
| Entry pages | `index.html`, `examples.html`, `supported.html`, `license.html` | Four MPA entries, built to `dist/` |
| Core logic | `src/lib/` | Font data, rendering, profiler, palettes, icons |
| Pages | `src/pages/` | Generator, Examples, Supported, License |
| Shell | `src/Page.tsx` | App bar, footer with help, info, and commit icons, theme and palette menus, bottom nav |
| Styles | `src/index.css` | Material 3 tokens via Tailwind v4 |
| Assets | `public/assets/` | Fonts, examples, icons, `license.txt` |
| Tests | `tests/` | Five TypeScript self-checks run with Bun |

## Setup

Requires Bun 1.4.4 or newer.

```
bun install
bun run dev
```

Runs on http://localhost:5173.

## Build and preview

```
bun run build
bun run preview
```

The build writes static files to `dist/` with relative paths. You can drop `dist/` on GitHub Pages, Netlify, Cloudflare Workers, or any static host.

To test on a phone on the same Wi-Fi:

```
bun run preview --host [IP_ADDRESS] --port 5174
```

Find your PC address with `ipconfig`, then open `http://[IP_ADDRESS]:5174/` on the phone.

## Deploy to Cloudflare

The site runs as a Worker with static assets. Connect the repo in Workers Builds and run `bun run build` then `bunx wrangler deploy`. Settings live in `wrangler.jsonc`. Caching and security headers live in `public/_headers`. Hashed bundles and fonts are cached forever, sprites and example images keep their stable names and are cached for 30 days. Set `BUN_VERSION=1.4.4` in build settings.

## Checks

```
bun run typecheck
bun run test
```

The gate is `typecheck` plus `test` plus `build`. Run them in that order before committing.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
