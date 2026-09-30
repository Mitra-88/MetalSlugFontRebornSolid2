import { For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { ColorDot, Page, ThemeToggle, capitalize } from "../Page.tsx";
import { FONT_SUPPORT } from "../lib/fonts.ts";
import type { ColorName, FontId } from "../lib/fonts.ts";

const FONTS: FontId[] = ["1", "2", "3", "4", "5"];
const NEVER_SUPPORTED = "è ē ì î ï ù û and uppercase accented letters (À É Ô ...)";
const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"];

interface SupportRow {
    label: string;
    value?: string;
    colors?: ColorName[];
}

function supportRows(fontId: FontId): SupportRow[] {
    const s = FONT_SUPPORT[fontId];
    return [
        { label: "Letters", value: s.lowerCase ? "Lowercase and Uppercase" : "Uppercase only" },
        { label: "Numbers", value: `${s.numbers[0]} to ${s.numbers[s.numbers.length - 1]}` },
        { label: "Symbols", value: s.symbols.join("  ") },
        { label: "Colors", colors: s.colors },
    ];
}

export default function Supported(): JSX.Element {
    return (
        <Page
            back
            actions={<ThemeToggle />}
            links={[
                { href: "./index.html", label: "Generator" },
                { href: "./examples.html", label: "Examples" },
                { href: "https://github.com/Mitra-88/MetalSlugFontRebornWeb", label: "GitHub" },
            ]}
        >
            <header class="rise-in mb-6 max-w-2xl">
                <h1 class="text-display-s">Character support</h1>
                <p class="mt-2 text-body-l text-on-surface-variant">
                    What every font variant can draw, per color. Anything outside these sets is skipped automatically while the rest still renders.
                </p>
            </header>

            <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
                <For each={FONTS}>
                    {(n, i) => (
                        <section class="rise-in card p-5" style={{ "animation-delay": `${i() * 60}ms` }}>
                            <div class="flex items-center justify-between">
                                <h2 class="text-title-m">Font {n}</h2>
                                <span class="chip-static">
                                    {FONT_SUPPORT[n].colors.length} {FONT_SUPPORT[n].colors.length === 1 ? "color" : "colors"}
                                </span>
                            </div>
                            <ul class="mt-3 flex flex-col gap-2">
                                <For each={supportRows(n)}>
                                    {(row) => (
                                        <li class="rounded-2xl bg-surface-container px-4 py-2.5">
                                            <p class="text-label-s text-on-surface-variant">{row.label}</p>
                                            <Show
                                                when={row.colors}
                                                fallback={<p class="mt-0.5 text-body-m break-words text-on-surface">{row.value}</p>}
                                            >
                                                <div class="mt-1.5 flex flex-wrap gap-1.5">
                                                    <For each={row.colors}>
                                                        {(c) => (
                                                            <span class="chip-static">
                                                                <ColorDot color={c} />
                                                                {capitalize(c)}
                                                            </span>
                                                        )}
                                                    </For>
                                                </div>
                                            </Show>
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </section>
                    )}
                </For>

                <section class="rise-in rounded-card bg-error-container p-5 text-on-error-container md:col-span-2">
                    <h2 class="text-title-m">No sprites in any font</h2>
                    <p class="mt-2 text-body-m">
                        {NEVER_SUPPORTED} have no sprites anywhere, so they are always skipped. Accented lowercase letters exist only in Font 1,
                        Roman numerals {ROMAN.join(" ")} only in Font 2. Anything a font does not list is skipped automatically while the rest of your text still renders.
                    </p>
                </section>
            </div>
        </Page>
    );
}
