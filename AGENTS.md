# AGENTS.md

## What this is

MetalSlugFontRebornSolid2: a client-side tool that renders text as PNGs from per-character Metal Slug sprite PNGs. Five font variants, a color, a scale; a canvas preview with a built-in sampling profiler; an examples gallery and a character support table.

Stack: Solid 2.0 RC (`solid-js` + `@solidjs/web`, TypeScript) + Vite 8 (MPA, three HTML entries) + Tailwind CSS 4 with a hand-rolled Material 3 system. No router, no SSR, no server. `bun run build` emits static files with relative paths for any host or the sibling Neutralino desktop repo (MetalSlugFontRebornDesktop).

## Commands

- Bun 1.4.4. `bun install` once; `bun.lock` is committed. `node_modules/` is required (Bun resolves through it) and disposable: `bun install --frozen-lockfile` restores it.
- `bun run dev` (port 5173), `bun run build`, `bun run preview`, `bun run typecheck`, `bun run test`, `bun outdated`, `bunx wrangler deploy --dry-run`.
- `bun run test` runs five assert-based self-checks, no test framework: `layout`, `perf`, `sprites`, `palette`, `behavior`. One check alone: `bun tests/sprites.test.ts`. Never use `bun test`: that is Bun's built-in runner with different semantics.
- The gate is `typecheck` + `test` + `build`. Run them in that order before committing.
- TypeScript 7 is the native compiler behind `tsc`. `@types/node` stays because `vite.config.ts` and the tests use `node:` builtins. `tsconfig.json` is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUncheckedSideEffectImports`, `forceConsistentCasingInFileNames`, `useUnknownInCatchVariables`) and covers `src`, `tests`, and `vite.config.ts`. Tests are TypeScript and import src with `allowImportingTsExtensions`.

## How to test

```bash
bun run typecheck          # strict TS, catches indexed access and exact optional types
bun run test               # all five self-checks in order
bun tests/layout.test.ts   # one check alone, same for the other four names
bun run build              # check dist emits index/examples/supported.html
bun outdated               # direct deps only; empty means caught up
```

Manual tab check: `bun run preview --port 5174` then open `http://localhost:5174/`. Do not use `fill("")` on the textarea, set `.value` and dispatch an `input` event. In Solid 2 test code, reads after a setter need a local or `flush()`.

## Coding rules

- Smallest clean solution. No speculative abstraction, options, wrappers, factories, or future-proofing.
- No comments in code. Rationale, invariants, and gotchas live in this file, one home. No JSDoc.
- No em dashes in code, docs, or config. Use commas, colons, or plain hyphens.
- Refactor only for a real benefit (readability, duplication, a necessary fix), never for style.
- Touch only what the task needs. Match the surrounding style, clean up only dead code your change created.

## Rendering pipeline

Order in which `Generator.tsx` drives it:

1. `src/lib/fonts.ts` owns `FONT_SUPPORT` (per font: colors, case, digits, symbols), `SPECIAL_CHARACTERS`, and `UNUSED_SYMBOLS` (sprites that ship but are never drawn). `getCharPath` is the only gatekeeper and returns null for unsupported characters, so a character can never borrow another font's sprite. Font 5 is uppercase-only, digits 1 to 9; the generator uppercases its input, fonts 1 to 4 keep lowercase. Unsupported characters are skipped and reported, never an error; only zero drawable characters fails (`empty`).
2. `src/lib/render.ts` keeps `imgCache` and `failedLoads`. Sprites decode once via `createImageBitmap`, falling back to `HTMLImageElement`; 8s timeout per attempt, one retry after 50ms, then the path lands in `failedLoads` until `resetFailures()`. Loading is lazy: `preloadIdle` warms the current font/color in batches of 10 during idle, cancelling and deduping per `font|color`; generation awaits only `getMissingPaths`.
3. `getLayout` is an LRU memo keyed `font|color|text`, cap 48, cached only when every sprite exists. `drawLayout` draws bottom-aligned glyphs with `imageSmoothingEnabled = false`; scale is canvas size plus `ctx.scale`.
4. Layout metrics live only in `fonts.ts`: whitespace 25px advance, empty line 50px, 15px between lines. Output above `SAFE_LIMIT` 8192 warns, above `HARD_LIMIT` 16384 is refused (`too-large`).
5. `src/lib/perf.ts` records one sample per render (phases `load`, `layout`, residual `draw`, plus sprites/cacheHits/chars) in a 100-slot ring; `stats()` gives min/p50/p95/max. Failed renders call `perf.cancel` so error attempts never pollute stats. The preview shows chips for the last sample, a stacked run list on small screens, and a Details table with a p95 row on larger screens.
6. Download: `canvas.toBlob` + object URL + synthetic anchor click.

Invariants:

- Every async path is guarded by the monotonic `genId`, incremented by any input; stale generates discard their result.
- Font, color, and scale changes all funnel through `revalidate` (clear debounce, bump `genId`, apply, `flush()`, save, generate). Do not add a path around it.
- `status` is one signal: `idle | loading | success | error`. The preview canvas is always mounted, overlays are absolutely positioned siblings. Never wrap it in `<Show>`: that desynced the ref and drew into a detached canvas.
- Error and empty transitions must clear `warning`, `imgMeta`, `sample`, and `errorKind`, otherwise stale dimensions and profiler numbers survive. The chips row renders only while `imgMeta` is non-empty.
- `failed` errors grow a Try again button and are retryable; `empty` and `too-large` are not.
- `ColorDot` cancels pending draws when `font` or `color` changes. Palette colors are sampled once per color name from the first font that has it (`A` only), matching the Python app, so the same color shows the same pie everywhere.

## Solid 2.0 RC

- DOM APIs come from `@solidjs/web` (`render`, `Dynamic`, JSX types via `jsxImportSource`). `onMount` is `onSettled`; `classList` is gone, use the object/array `class` forms.
- `createEffect` is two-arg only: compute tracks, apply is untracked and may return cleanup. Effects never compare, so derived equality belongs in a memo.
- Setters do not update reads until the microtask flush: read-after-write needs a local variable or `flush()` (see `revalidate`).
- Before non-trivial Solid work, read `node_modules/solid-js/CHEATSHEET.md` from the installed RC. It is the authoritative reference.

## Material 3

- `src/index.css` hand-rolls M3: color roles as `--m3-*` CSS variables exposed to Tailwind via `@theme inline`. Six seed palettes (amber default, verdant, azure, violet, rose, teal), each light and dark; error tokens are shared.
- Keep the CSS ordering: the palette+dark selector outranks the plain dark block, and palette-light beats `:root` by source order.
- Theme and palette persist as `msfb-theme` and `msfb-palette`. Each HTML head has an inline pre-paint boot script that sets `data-theme`/`data-palette` and the `theme-color` meta; `ThemeToggle`/`PaletteMenu` reuse `SCHEME_TINTS` from `Page.tsx`. Adding a palette means updating the inline script, `PALETTES`, and `SCHEME_TINTS` together.
- Typography is fluid (`clamp()` on display/headline/title), touch targets grow on coarse pointers (buttons and chips 48px), and `Page.tsx` adds a fixed bottom navigation bar under `sm` with safe-area padding and a current-page pill. Viewport meta uses `viewport-fit=cover`.
- All fonts are self-hosted in `src/fonts/` (Roboto Flex latin variable, icons subset), `font-display: swap`. Never reintroduce third-party font links or preconnects; that was a Lighthouse finding.
- Never hardcode a theme hex in JSX. `COLOR_HEX` in `Page.tsx` holds sprite swatch colors, not theme colors.

## Edit rules

- Entry files stay in `src/`, page components in `src/pages/`. On this case-insensitive filesystem `examples.tsx` and `Examples.tsx` collide, so entry and page names must never match; the `pages/` split is the guard.
- Asset URLs stay relative (`./assets/...`): that is what makes one build work at a domain root and under a subpath.
- A literal `src`/`srcset`/`poster` on `<img>`, `<source>`, or `<video>` in JSX is rewritten to an asset import by the vite plugin, so a relative path there must resolve inside `src/`. A file in `public/` is written `/assets/...`, which the plugin turns back into a chunk-relative import.
- `Supported.tsx` derives its table from `FONT_SUPPORT` and its unsupported list from `UNUSED_SYMBOLS`. Only the "have no sprites in any font" sentence is hardcoded and must be updated when support changes.
- Sprites live in `public/assets/fonts/font-<n>/ms-<color>/{letters,numbers,symbols}`; colors are blue, orange, gold, yellow and vary per font. `tests/sprites.test.ts` checks `FONT_SUPPORT` and `UNUSED_SYMBOLS` against the files in both directions, so run it after any asset change. The accented and Roman-numeral sprites that ship in the assets are unused on purpose, matching the Python MetalSlugFontReborn app: they live in `UNUSED_SYMBOLS`, never in `FONT_SUPPORT`, and are never drawn.
- Adding or renaming a perf phase means updating `perf.ts`, the Details row or table, and `tests/perf.test.ts` together.
- Icons are 11 Material Symbols ligatures aliased in `src/lib/icons.tsx` and served from the ~1.7KB `src/fonts/icons.woff2`. The source font is the `material-icons` package, which is not a dependency because nothing imports it: add it temporarily (`bun add -d material-icons@1.13.14`) if the subset must be rebuilt. Regeneration is a fontTools job with two traps: the font uses `rlig`, not `liga`, and the icon names share component letters, so feature closure pulls in over a thousand glyphs. Prune the `rlig` LigatureSubst tables to the wanted names, then subset with an explicit glyph list (21 component letters plus the 11 icon glyphs). No subset script is checked in. Verify each icon renders as one glyph, not as letters.
- The Cloudflare deploy is a Worker with static assets: `wrangler.jsonc` points at `dist`, keeps `workers_dev` and `preview_urls` on, and `public/_headers` sets caching (hashed bundles and fonts immutable, stable-named sprites/examples/icons 30 days) and security headers. Deploy with `bun run build` then `bunx wrangler deploy`; Workers Builds ships Bun 1.2.15 by default, so set `BUN_VERSION=1.4.4`. Answer Cloudflare questions from the Cloudflare docs, not memory.
- `.tmp/`, `dist/`, and `.wrangler/` are disposable and gitignored. Remove them with `Remove-Item -Recurse -Force .tmp,dist,.wrangler` and rebuild. Do not keep local venvs or font subset artifacts in the repo.

## Gotchas

- The textarea is uncontrolled on purpose and has IME guards (`compositionstart`/`compositionend`). Do not bind `value`. In automation, set `.value` and dispatch an `input` event; simulated typing and `fill("")` can silently do nothing.
- A sprite load failure is recoverable; do not turn it into a dead end. Error kinds exist so only `failed` offers retry.
- The floating field label needs its opaque background, or the border shows through the text.
- `src/css.d.ts` exists because TypeScript 7 rejects side-effect imports of undeclared files; extend it for any new non-TS import.
- Text input has no length cap. Oversized outputs are caught by the 16384px hard limit, which is enough until abusive giant texts become real; then cap the textarea.

## Reference

- Dependency APIs: read the package in `node_modules`.
- Global `AGENTS.md` lists the offline documentation mirrors (TypeScript, Solid, Vite, Cloudflare runner images) and the `uv`/RTK rules.
