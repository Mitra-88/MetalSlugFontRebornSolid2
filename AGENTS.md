# AGENTS.md

## What this is

A client-side tool that renders text as PNGs from per-character Metal Slug sprite PNGs. Five font variants, a color, a scale, a canvas preview with a sampling profiler, an examples gallery, and a character support table.

Stack: Solid 2.0 RC, TypeScript, Vite 8 MPA with three HTML entries, Tailwind CSS 4 with a hand-rolled Material 3 system. No router, no SSR, no server. `bun run build` emits static files with relative paths for any host or the sibling Neutralino desktop repo.

## Commands

- Bun 1.4.4. `bun install` once. `bun.lock` is committed. `node_modules/` is required but disposable: `bun install --frozen-lockfile` restores it.
- `bun run dev` on port 5173, `bun run build`, `bun run preview`, `bun run typecheck`, `bun run test`, `bun outdated`, `bunx wrangler deploy --dry-run`.
- `bun run test` runs five assert-based self-checks with no test framework: `layout`, `perf`, `sprites`, `palette`, `behavior`. Run one with `bun tests/sprites.test.ts`. Never use `bun test`.
- Gate is `typecheck` plus `test` plus `build`. Run in that order before committing.
- TypeScript 7 is the compiler behind `tsc`. `@types/node` stays because `vite.config.ts` and the tests use `node:` builtins. `tsconfig.json` is strict and covers `src`, `tests`, and `vite.config.ts`.

## How to test

```bash
bun run typecheck
bun run test
bun tests/layout.test.ts
bun run build
```

For a phone on the same Wi-Fi: `bun run preview --host [IP_ADDRESS] --port 5174`, then open `http://[IP_ADDRESS]:5174/`. In automation, set `.value` on the textarea and dispatch an `input` event. Do not use simulated typing or `fill("")`.

## Coding rules

- Smallest clean solution. No speculative abstraction, options, wrappers, factories, or future-proofing.
- No comments in code. Rationale, invariants, and gotchas live here. No JSDoc.
- No em dashes in code, docs, or config. Use commas, colons, or plain hyphens.
- Refactor only for readability, duplication, or a necessary fix.
- Touch only what the task needs. Match the surrounding style. Clean up only dead code your change created.

## Rendering pipeline

`src/lib/fonts.ts` owns `FONT_SUPPORT`, `SPECIAL_CHARACTERS`, and `UNUSED_SYMBOLS`. `getCharPath` is the only gatekeeper and returns null for unsupported characters, so a font can never borrow another font's sprite. Font 5 is uppercase-only with digits 1 to 9. The generator uppercases input for Font 5 and keeps case for the others. Unsupported characters are skipped and reported. Only zero drawable characters is an error.

`src/lib/render.ts` caches decoded sprites. It loads lazy with an 8s timeout, one retry, then marks the path failed until `resetFailures()`. `preloadIdle` warms the current font and color in batches of 10. `getLayout` memoizes by `font|color|text` with a cap of 48 and only caches when every sprite exists. `drawLayout` draws bottom-aligned glyphs with smoothing off. Layout constants live in `fonts.ts`: 25px space advance, 50px empty line, 15px between lines. Output above 8192px warns, above 16384px is refused.

`src/lib/perf.ts` keeps one sample per render in a 100-slot ring. Phases are load, layout, and draw. Failed renders cancel so errors do not pollute stats. The preview shows chips for the last sample, and on desktop a Timing details panel with a bar per run and a table of the last five runs plus p95. Timing details are hidden on mobile and tablet, and the open or closed choice persists in `localStorage` under `msfb-perf`.

Download uses `canvas.toBlob` with a synthetic anchor click. Every async path is guarded by `genId`, bumped on any input. Font, color, and scale changes go through `revalidate` only. Status is one signal: `idle`, `loading`, `success`, or `error`. The canvas is always mounted and overlays are siblings. Never wrap it in `<Show>`, that desynced the ref in the past. Error states clear warning, image metadata, sample, and error kind so stale values do not survive. Only `failed` errors get a retry button.

## Solid 2.0 RC

DOM APIs come from `@solidjs/web`. JSX types come via `jsxImportSource`. `onMount` is `onSettled`. `classList` is gone, use the object and array `class` forms. `createEffect` is two-arg only: compute tracks, apply is untracked and may return cleanup. Setters do not update reads until the microtask flush, so read-after-write needs a local or `flush()`. Before non-trivial Solid work, read `node_modules/solid-js/CHEATSHEET.md`. That file is the authoritative reference.

## Material 3

`src/index.css` defines color roles as `--m3-*` variables exposed to Tailwind via `@theme inline`. There are six seed palettes, amber default plus verdant, azure, violet, rose, and teal, each in light and dark. Error tokens are shared. Keep the selector order: palette plus dark outranks plain dark, palette light beats `:root`.

Theme and palette persist as `msfb-theme` and `msfb-palette`. Each HTML head has an inline boot script that sets `data-theme` and `data-palette` before paint. Adding a palette means updating the inline script, `PALETTES`, and `SCHEME_TINTS` in `Page.tsx` together. Typography is fluid with `clamp()`. Touch targets grow to 48px on coarse pointers. `Page.tsx` adds a bottom navigation bar under `sm` with safe-area padding and a current-page pill. Viewport uses `viewport-fit=cover`.

All fonts are self-hosted in `src/fonts/` with `font-display: swap`. Do not reintroduce third-party font links or preconnects. Never hardcode a theme hex in JSX. `COLOR_HEX` in `Page.tsx` holds sprite swatches, not theme colors.

## Edit rules

- Entries stay in `src/`, pages in `src/pages/`. Never let an entry and a page share a name. On case-insensitive filesystems `examples.tsx` and `Examples.tsx` collide.
- Asset URLs stay relative, `./assets/...`. That lets one build work at a domain root and under a subpath.
- A literal `src` on `<img>` in JSX becomes an asset import. That path must resolve inside `src/`. A file in `public/` is written as `/assets/...`.
- `Supported.tsx` derives its table from `FONT_SUPPORT` and its unsupported list from `UNUSED_SYMBOLS`. Only the no-sprites sentence is hardcoded. Update it when support changes.
- Sprites live in `public/assets/fonts/font-<n>/ms-<color>/{letters,numbers,symbols}`. Colors vary per font. `tests/sprites.test.ts` compares support and unused lists against the files in both directions. Run it after any asset change. Accented and Roman-numeral sprites ship but are unused, matching the Python app. They stay in `UNUSED_SYMBOLS` and are never drawn.
- Adding or renaming a perf phase means updating `perf.ts`, the Timing details table and bars, and `tests/perf.test.ts` together.
- Icons are 11 Material Symbols ligatures in `src/lib/icons.tsx`, served from `src/fonts/icons.woff2`. To rebuild, temporarily add `material-icons@1.13.14`, prune the `rlig` tables to the wanted names, then subset with an explicit glyph list. No subset script is checked in. Verify each icon renders as one glyph.
- Deploy is a Cloudflare Worker with static assets. `wrangler.jsonc` points at `dist`. `public/_headers` sets caching and security headers. Workers Builds ships Bun 1.2.15 by default, so set `BUN_VERSION=1.4.4`. Answer Cloudflare questions from the Cloudflare docs.
- `.tmp/`, `dist/`, and `.wrangler/` are disposable and gitignored. Remove with `Remove-Item -Recurse -Force .tmp,dist,.wrangler` and rebuild. Do not keep local venvs or font subset artifacts in the repo.

## Gotchas

- The textarea is uncontrolled on purpose and has IME guards. Do not bind `value`.
- A sprite load failure is recoverable. Do not turn it into a dead end. Only `failed` offers retry.
- The floating field label needs an opaque background or the border shows through.
- `src/css.d.ts` exists because TypeScript rejects undeclared side-effect imports. Extend it for any new non-TS import.
- Text input has no length cap. The 16384px limit is enough until abusive giant input becomes real.

## Reference

Dependency APIs: read the package in `node_modules`. Offline mirrors for TypeScript, Solid, Vite, and runner images are listed in the global `AGENTS.md`.
