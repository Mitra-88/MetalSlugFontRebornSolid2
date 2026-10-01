import { For } from "solid-js";
import type { JSX } from "@solidjs/web";
import { ColorDot, Page, ThemeToggle, capitalize } from "../Page.tsx";
import { FONT_SUPPORT } from "../lib/fonts.ts";
import type { FontId } from "../lib/fonts.ts";

const EXAMPLES: { font: FontId; width: number; height: number }[] = [
    { font: "1", width: 348, height: 32 },
    { font: "2", width: 316, height: 32 },
    { font: "3", width: 352, height: 64 },
    { font: "4", width: 328, height: 32 },
    { font: "5", width: 380, height: 38 },
];

export default function Examples(): JSX.Element {
    return (
        <Page
            back
            actions={<ThemeToggle />}
            links={[
                { href: "./index.html", label: "Generator" },
                { href: "./supported.html", label: "Supported characters" },
                { href: "https://github.com/Mitra-88/MetalSlugFontRebornSolid2", label: "GitHub" },
            ]}
        >
            <header class="rise-in mb-6 max-w-2xl">
                <h1 class="text-display-s">Examples</h1>
                <p class="mt-2 text-body-l text-on-surface-variant">
                    Every font variant in its available colors, straight from the sprite sheets.
                </p>
            </header>

            <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
                <For each={EXAMPLES}>
                    {(ex, i) => (
                        <section class="rise-in card overflow-hidden" style={{ "animation-delay": `${i() * 60}ms` }}>
                            <div class="flex items-center justify-between px-5 pb-1 pt-4">
                                <h2 class="text-title-m">Font {ex.font}</h2>
                                <span class="chip-static">
                                    {FONT_SUPPORT[ex.font].colors.length} {FONT_SUPPORT[ex.font].colors.length === 1 ? "color" : "colors"}
                                </span>
                            </div>
                            <ul class="flex flex-col gap-2 p-4">
                                <For each={FONT_SUPPORT[ex.font].colors}>
                                    {(color) => (
                                        <li class="flex items-center gap-3 rounded-2xl bg-surface-container px-3 py-2">
                                            <span class="flex w-16 shrink-0 items-center gap-2 text-label-m text-on-surface-variant">
                                                <ColorDot color={color} />
                                                {capitalize(color)}
                                            </span>
                                            <img
                                                src={`./assets/examples/ms-font-${ex.font}/${capitalize(color)}.png`}
                                                width={ex.width}
                                                height={ex.height}
                                                alt={`Font ${ex.font} ${color}`}
                                                loading="lazy"
                                                decoding="async"
                                                class="pixelated h-auto min-w-0 max-w-full flex-1"
                                            />
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </section>
                    )}
                </For>
            </div>
        </Page>
    );
}
