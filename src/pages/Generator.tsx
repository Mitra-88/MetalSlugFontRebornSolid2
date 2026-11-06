import { For, Show, createMemo, createSignal, flush, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import device from "current-device";
import { Activity, AutoAwesome, Check, ChevronDown, Image, Info, TriangleAlert } from "../lib/icons.tsx";
import { ColorDot, Page, PaletteMenu, ThemeToggle } from "../Page.tsx";
import { FONT_SUPPORT, HARD_LIMIT, collectUnsupported } from "../lib/fonts.ts";
import type { ColorName, FontId } from "../lib/fonts.ts";
import {
    getMissingPaths,
    loadImage,
    preloadIdle,
    renderToCanvas,
    resetFailures,
} from "../lib/render.ts";
import * as perf from "../lib/perf.ts";
import type { PerfSample } from "../lib/perf.ts";

const FONTS: FontId[] = ["1", "2", "3", "4", "5"];
const SCALES: { value: number; label: string }[] = [
    { value: 1, label: "1×" },
    { value: 2, label: "2×" },
    { value: 3, label: "3×" },
    { value: 4, label: "4×" },
];

interface SegmentedProps<T extends string | number> {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}

function radioNav(e: KeyboardEvent, count: number, current: number, select: (i: number) => void): void {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? count - 1 : Math.max(0, Math.min(count - 1, current + delta));
    if (next === current) return;
    select(next);
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
}

function Segmented<T extends string | number>(props: SegmentedProps<T>): JSX.Element {
    const index = () => Math.max(0, props.options.findIndex((o) => o.value === props.value));
    return (
        <div
            class="m3-seg bg-surface-highest"
            role="radiogroup"
            aria-label={props.label}
            onKeyDown={(e) => radioNav(e, props.options.length, index(), (i) => { const opt = props.options[i]; if (opt) props.onChange(opt.value); })}
        >
            <div
                class="m3-seg-thumb"
                style={{ width: `${100 / props.options.length}%`, transform: `translateX(${index() * 100}%)` }}
            />
            <For each={props.options}>
                {(o) => (
                    <button
                        type="button"
                        role="radio"
                        aria-checked={o.value === props.value ? "true" : "false"}
                        tabindex={o.value === props.value ? 0 : -1}
                        class={{ "m3-seg-btn": true, selected: o.value === props.value }}
                        onClick={() => props.onChange(o.value)}
                    >
                        <Show when={o.value === props.value}>
                            <Check size={15} class="pop-in" />
                        </Show>
                        <span class="truncate" title={o.label}>{o.label}</span>
                    </button>
                )}
            </For>
        </div>
    );
}

function ColorChips(props: { options: ColorName[]; value: ColorName; font: FontId; onChange: (c: ColorName) => void }): JSX.Element {
    return (
        <div
            class="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Color"
            onKeyDown={(e) => radioNav(e, props.options.length, props.options.indexOf(props.value), (i) => { const c = props.options[i]; if (c) props.onChange(c); })}
        >
            <For each={props.options}>
                {(c) => (
                    <button
                        type="button"
                        role="radio"
                        aria-checked={c === props.value ? "true" : "false"}
                        tabindex={c === props.value ? 0 : -1}
                        class={{ "m3-chip": true, selected: c === props.value }}
                        onClick={() => props.onChange(c)}
                    >
                        <ColorDot font={props.font} color={c} />
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                        <Show when={c === props.value}>
                            <Check size={14} class="pop-in" />
                        </Show>
                    </button>
                )}
            </For>
        </div>
    );
}

function FieldLabel(props: { children: JSX.Element }): JSX.Element {
    return <p class="mb-2 text-label-m text-on-surface-variant">{props.children}</p>;
}

const INVISIBLE = /[\u0300-\u036f\u200b-\u200f\u2060-\u2064\ufeff]/;

function skipLabel(c: string): string {
    return INVISIBLE.test(c) ? "U+" + (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0") : c;
}

const SETTINGS_KEY = "msfb-settings";

interface StoredSettings {
    font?: unknown;
    color?: unknown;
    scale?: unknown;
}

function loadSettings(): { font: FontId; color: ColorName; scale: number } {
    let parsed: StoredSettings | null = null;
    try {
        parsed = (JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null")) as StoredSettings | null;
    } catch {
        parsed = null;
    }
    if (!parsed || typeof parsed !== "object") return { font: "1", color: "blue", scale: 1 };
    const font: FontId = FONTS.includes(parsed.font as FontId) ? (parsed.font as FontId) : "1";
    const colors = FONT_SUPPORT[font].colors;
    const fallbackColor: ColorName = colors[0] ?? "blue";
    const color: ColorName = colors.includes(parsed.color as ColorName) ? (parsed.color as ColorName) : fallbackColor;
    const scale = [1, 2, 3, 4].includes(parsed.scale as number) ? (parsed.scale as number) : 1;
    return { font, color, scale };
}

export default function Generator(): JSX.Element {
    const saved = loadSettings();
    const [text, setText] = createSignal("");
    const [font, setFont] = createSignal<FontId>(saved.font);
    const [color, setColor] = createSignal<ColorName>(saved.color);
    const [scale, setScale] = createSignal(saved.scale);
    const [status, setStatus] = createSignal<"idle" | "loading" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = createSignal("");
    const [errorLink, setErrorLink] = createSignal(false);
    const [errorKind, setErrorKind] = createSignal<"failed" | "empty" | "too-large" | "">("");
    const [warning, setWarning] = createSignal("");
    const [imgMeta, setImgMeta] = createSignal("");
    const [sample, setSample] = createSignal<PerfSample | null>(null);
    const PERF_KEY = "msfb-perf";
    function loadPerfVisible(): boolean {
        try {
            return localStorage.getItem(PERF_KEY) === "1";
        } catch {
            return false;
        }
    }
    const [showPerf, setShowPerf] = createSignal(loadPerfVisible());
    const isDesktop = (): boolean => device.desktop();
    const [loadingCount, setLoadingCount] = createSignal(0);
    const [skipped, setSkipped] = createSignal<string[]>([]);

    let canvas!: HTMLCanvasElement;
    let genId = 0;
    let debounceId = 0;
    let lastVisualKey = "";
    let composing = false;

    const fontColors = createMemo((): ColorName[] => FONT_SUPPORT[font()].colors);
    const perfStats = createMemo(() => (sample() ? perf.stats() : null));
    const recentSamples = createMemo(() => (sample() ? perf.samples().slice(-5) : []));

    const fail = (msg: string, link: boolean, kind: "failed" | "empty" | "too-large" | "" = ""): void => {
        setErrorMsg(msg);
        setErrorLink(link);
        setErrorKind(kind);
        setWarning("");
        setSkipped([]);
        setImgMeta("");
        setSample(null);
        setStatus("error");
    };

    const clearCanvas = (): void => {
        canvas.width = 0;
        canvas.height = 0;
        lastVisualKey = "";
    };

    function resetToIdle(): void {
        genId++;
        setStatus("idle");
        setErrorMsg("");
        setErrorKind("");
        setWarning("");
        setImgMeta("");
        setSkipped([]);
        setSample(null);
        clearCanvas();
    }

    async function generate(loadBefore = 0): Promise<void> {
        const id = ++genId;
        const raw = text();
        if (!raw.trim()) {
            resetToIdle();
            return;
        }

        const f = font();
        const processed = (f === "5" ? raw.toUpperCase() : raw).normalize("NFC");
        const started = performance.now();
        const visualKey = `${f}|${color()}|${scale()}`;

        const missing = getMissingPaths(f, color(), processed);
        if (missing.length > 0) {
            if (id !== genId) return;
            setLoadingCount(missing.length);
            setStatus("loading");
            await Promise.all(missing.map((p) => loadImage(p)));
            if (id !== genId) return;
            return generate(loadBefore + (performance.now() - started));
        }

        const res = renderToCanvas(canvas, { font: f, color: color(), text: processed, scale: scale() });
        if (id !== genId) return;

        if (res.error === "failed") {
            fail(`The character '${res.char}' failed to load, so it cannot be drawn. `, true, "failed");
        } else if (res.error === "empty") {
            fail("None of these characters can be drawn with this font. ", true, "empty");
        } else if (res.error === "too-large") {
            fail(`Output ${res.width}×${res.height}px exceeds the absolute browser limit of ${HARD_LIMIT}px. Please reduce text length or scale.`, false, "too-large");
        } else {
            setErrorKind("");
            setImgMeta(`${res.width} × ${res.height} px`);
            setWarning(res.warning);
            setSkipped(collectUnsupported(f, processed));
            setStatus("success");
            if (res.sample) {
                res.sample.phases.load = loadBefore;
                setSample({ ...res.sample, phases: { ...res.sample.phases } });
            }
            preloadIdle(f, color());
            if (visualKey !== lastVisualKey) {
                lastVisualKey = visualKey;
                if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    canvas.animate?.(
                        [{ opacity: 0.35, transform: "scale(0.985)" }, { opacity: 1, transform: "scale(1)" }],
                        { duration: 200, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" }
                    );
                }
            }
        }
    }

    function onTextInput(e: Event): void {
        if (composing) return;
        const value = (e.currentTarget as HTMLTextAreaElement).value;
        setText(value);
        window.clearTimeout(debounceId);
        if (!value.trim()) {
            resetToIdle();
            return;
        }
        debounceId = window.setTimeout(() => generate(), 50);
    }

    function saveSettings(): void {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({ font: font(), color: color(), scale: scale() }));
        } catch {}
    }

    function togglePerf(): void {
        const next = !showPerf();
        setShowPerf(next);
        try {
            localStorage.setItem(PERF_KEY, next ? "1" : "0");
        } catch {}
    }

    const revalidate = (apply: () => void): void => {
        clearTimeout(debounceId);
        genId++;
        apply();
        flush();
        saveSettings();
        generate();
    };

    function onFontChange(f: FontId): void {
        revalidate(() => {
            setFont(f);
            const colors = FONT_SUPPORT[f].colors;
            const fallback: ColorName = colors[0] ?? "blue";
            const nextColor: ColorName = colors.includes(color()) ? color() : fallback;
            setColor(nextColor);
            preloadIdle(f, nextColor);
        });
    }

    function onColorChange(c: ColorName): void {
        revalidate(() => {
            setColor(c);
            preloadIdle(font(), c);
        });
    }

    function onScaleChange(s: number): void {
        revalidate(() => setScale(s));
    }

    onSettled(() => {
        preloadIdle(font(), color());
    });

    function download(): void {
        if (!canvas.width || !canvas.height) return;
        canvas.toBlob((blob) => {
            if (!blob) {
                fail("Download failed. The image might be too large for the browser to process. Try reducing the scale.", false, "");
                return;
            }
            const url = URL.createObjectURL(blob);
            const slug = text()
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]+/g, "")
                .replace(/^-+|-+$/g, "")
                .slice(0, 24);
            const a = Object.assign(document.createElement("a"), {
                href: url,
                download: `metal-slug-${slug || "text"}.png`,
            });
            a.click();
            URL.revokeObjectURL(url);
        }, "image/png");
    }

    function retryFailed(): void {
        resetFailures();
        generate();
    }

    const cacheHitPct = (): number => {
        const s = sample();
        if (!s || !s.sprites) return 100;
        return Math.round((s.cacheHits ?? 0) / Math.max(1, s.sprites) * 100);
    };

    return (
        <Page
            actions={
                <>
                    <PaletteMenu />
                    <ThemeToggle />
                </>
            }
            links={[
                { href: "./supported.html", label: "Supported characters", icon: "help" },
                { href: "./examples.html", label: "Browse examples", icon: "image" },
                { href: "https://github.com/Mitra-88/MetalSlugFontRebornSolid2", label: "GitHub", icon: "github" },
                { href: "./license.html", label: "License", icon: "info" },
            ]}
        >
            <div class="grid grid-cols-1 items-start gap-4 sm:gap-6 md:grid-cols-[minmax(280px,360px)_1fr] lg:grid-cols-[400px_1fr]">
                <section class="rise-in card p-5 sm:p-6">
                    <h1 class="text-headline-s">Pixel text</h1>
                    <p class="mt-1 text-body-m text-on-surface-variant">
                        Type anything and watch it render live with the classic Metal Slug arcade sprites.
                    </p>

                    <div class="mt-5 flex flex-col gap-5">
                        <div class="m3-field" data-empty={text() === ""}>
                            <textarea
                                id="text-input"
                                placeholder=" "
                                required
                                onInput={onTextInput}
                                onCompositionStart={() => (composing = true)}
                                onCompositionEnd={(e) => {
                                    composing = false;
                                    onTextInput(e);
                                }}
                            />
                            <label for="text-input">Your text</label>
                            <span class="char-count">{text().length} characters</span>
                        </div>

                        <div>
                            <FieldLabel>Font variant</FieldLabel>
                            <Segmented
                                label="Font variant"
                                options={FONTS.map((n) => ({ value: n, label: `Font ${n}` }))}
                                value={font()}
                                onChange={onFontChange}
                            />
                        </div>

                        <div>
                            <FieldLabel>Color</FieldLabel>
                            <ColorChips options={fontColors()} value={color()} font={font()} onChange={onColorChange} />
                        </div>

                        <div>
                            <FieldLabel>Output scale</FieldLabel>
                            <Segmented label="Output scale" options={SCALES} value={scale()} onChange={onScaleChange} />
                        </div>
                    </div>
                </section>

                <section class="rise-in card p-5 sm:p-6" style={{ "animation-delay": "80ms" }}>
                    <div class="flex items-center justify-between gap-3">
                        <h2 class="text-title-m">Preview</h2>
                        <span
                            class={{
                                "state-chip": true,
                                success: status() === "success",
                                loading: status() === "loading",
                                error: status() === "error",
                                idle: status() === "idle",
                            }}
                            aria-live="polite"
                        >
                            {status() === "success" && "Ready"}
                            {status() === "loading" && "Rendering"}
                            {status() === "error" && "Error"}
                            {status() === "idle" && "Waiting"}
                        </span>
                    </div>

                    <div class="stage relative mt-4 grid min-h-[220px] place-items-center overflow-hidden p-4 sm:min-h-[300px]" aria-busy={status() === "loading" ? "true" : "false"}>
                        <canvas
                            ref={canvas}
                            class={[
                                "pixelated relative z-10 max-h-[360px] max-w-full object-contain",
                                { invisible: status() === "error" },
                            ]}
                            role="img"
                            aria-label={`Rendered preview: ${text() || "nothing yet"}`}
                        />
                        <div class={["stage-overlay absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface-lowest/85 text-on-surface-variant", { visible: status() === "loading" }]}>
                            <div class="m3-progress" />
                            <p class="text-body-m">
                                Fetching {loadingCount()} sprite{loadingCount() === 1 ? "" : "s"}
                            </p>
                        </div>
                        <div class={["stage-overlay absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-center text-on-surface-variant", { visible: status() === "idle" }]}>
                            <div class="flex size-14 items-center justify-center rounded-2xl bg-surface-container">
                                <Image size={24} />
                            </div>
                            <p class="text-body-m">
                                Nothing here yet
                                <br />
                                <span class="text-body-s">Type on the left and the preview paints itself.</span>
                            </p>
                        </div>
                        <div class={["stage-overlay absolute inset-0 z-20 flex items-center justify-center bg-surface-lowest/85 p-4", { visible: status() === "error" }]}>
                            <div class="error-box max-w-md" role="alert">
                                <span class="mr-1 inline-flex align-[-3px]">
                                    <TriangleAlert size={18} />
                                </span>
                                {errorMsg()}
                                <Show when={errorLink()}>
                                    <a href="./supported.html">See supported characters</a>
                                </Show>
                                <Show when={errorKind() === "failed"}>
                                    {" "}
                                    <button
                                        type="button"
                                        class="cursor-pointer border-none bg-transparent p-0 font-semibold text-inherit underline underline-offset-2"
                                        onClick={retryFailed}
                                    >
                                        Try again
                                    </button>
                                </Show>
                            </div>
                        </div>
                    </div>

                    <Show when={warning()}>
                        <p class="rise-in mt-3 rounded-lg bg-primary-container px-3 py-2 text-body-s text-on-primary-container">{warning()}</p>
                    </Show>

                    <Show when={skipped().length > 0}>
                        <p class="rise-in mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-secondary-container px-3 py-2 text-body-s text-on-secondary-container">
                            <Info size={14} class="shrink-0" />
                            <span>
                                Skipped {skipped().length} unsupported {skipped().length === 1 ? "character" : "characters"}:
                                <span class="mono font-semibold"> {skipped().map(skipLabel).join("  ")}</span>
                            </span>
                            <a href="./supported.html" class="ml-auto font-semibold underline underline-offset-2">
                                See what is supported
                            </a>
                        </p>
                    </Show>

                    <Show when={imgMeta()}>
                        <div class="rise-in mt-4 flex flex-wrap items-center gap-2">
                            <span class="chip-static mono">{imgMeta()}</span>
                            <Show when={sample()}>
                                <span class="chip-static mono">
                                    <Activity size={13} />
                                    {sample()!.total.toFixed(1)} ms
                                </span>
                                <span class="chip-static mono">{sample()!.sprites} {sample()!.sprites === 1 ? "sprite" : "sprites"}</span>
                                <span class="chip-static mono">{cacheHitPct()}% cached</span>
                                <Show when={isDesktop()}>
                                    <button type="button" class="m3-chip" onClick={togglePerf} aria-expanded={showPerf() ? "true" : "false"}>
                                        Timing details
                                        <ChevronDown size={14} class={["transition-transform duration-300", { "rotate-180": showPerf() }]} />
                                    </button>
                                </Show>
                            </Show>
                        </div>
                    </Show>

                    <Show when={showPerf() && perfStats() && isDesktop()}>
                        <div class="rise-in mt-3 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low">
                            <div class="grid grid-cols-2 gap-0 border-b border-outline-variant sm:grid-cols-4">
                                <div class="border-r border-outline-variant p-3">
                                    <p class="text-label-s text-on-surface-variant">Last render</p>
                                    <p class="mono mt-1 text-body-m font-semibold text-on-surface">{sample()!.total.toFixed(2)} ms</p>
                                </div>
                                <div class="p-3 sm:border-r sm:border-outline-variant">
                                    <p class="text-label-s text-on-surface-variant">p95</p>
                                    <p class="mono mt-1 text-body-m font-semibold text-on-surface">{perfStats()!.p95.toFixed(2)} ms</p>
                                </div>
                                <div class="border-r border-t border-outline-variant p-3 sm:border-t-0">
                                    <p class="text-label-s text-on-surface-variant">Sprites</p>
                                    <p class="mono mt-1 text-body-m font-semibold text-on-surface">{sample()!.sprites ?? 0} ({cacheHitPct()}% cached)</p>
                                </div>
                                <div class="border-t border-outline-variant p-3 sm:border-t-0">
                                    <p class="text-label-s text-on-surface-variant">Runs measured</p>
                                    <p class="mono mt-1 text-body-m font-semibold text-on-surface">{perfStats()!.count}</p>
                                </div>
                            </div>
                            <div class="flex flex-col gap-2 p-3">
                                <For each={recentSamples()}>
                                    {(s, i) => {
                                        const maxTotal = Math.max(0.01, ...recentSamples().map((r) => r.total));
                                        const totalWidth = Math.min(100, (s.total / maxTotal) * 100);
                                        const loadWidth = totalWidth > 0 ? ((s.phases.load ?? 0) / Math.max(0.01, s.total)) * totalWidth : 0;
                                        const layoutWidth = totalWidth > 0 ? ((s.phases.layout ?? 0) / Math.max(0.01, s.total)) * totalWidth : 0;
                                        const drawWidth = Math.max(0, totalWidth - loadWidth - layoutWidth);
                                        return (
                                            <div class="flex items-center gap-3">
                                                <span class="mono w-8 shrink-0 text-body-s text-on-surface-variant">
                                                    {Math.max(1, (perfStats()?.count ?? 0) - recentSamples().length + i() + 1)}
                                                </span>
                                                <div class="flex h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                                                    <div class="h-full bg-primary" style={{ width: `${loadWidth.toFixed(1)}%` }} />
                                                    <div class="h-full bg-tertiary" style={{ width: `${layoutWidth.toFixed(1)}%` }} />
                                                    <div class="h-full bg-secondary" style={{ width: `${drawWidth.toFixed(1)}%` }} />
                                                </div>
                                                <span class="mono w-20 shrink-0 text-right text-body-s text-on-surface">{s.total.toFixed(2)} ms</span>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-outline-variant px-3 py-2 text-body-s text-on-surface-variant">
                                <span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-full bg-primary" /> load</span>
                                <span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-full bg-tertiary" /> layout</span>
                                <span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-full bg-secondary" /> draw</span>
                                <span class="ml-auto mono">{perfStats()!.p95.toFixed(2)} ms p95</span>
                            </div>
                        </div>
                        <div class="rise-in mt-3 overflow-x-auto rounded-xl border border-outline-variant">
                            <table class="mono w-full min-w-[340px] text-left text-body-s text-on-surface-variant">
                                <thead class="bg-surface-container text-label-s">
                                    <tr>
                                        <th scope="col" class="px-3 py-2 font-semibold">run</th>
                                        <th scope="col" class="px-3 py-2 font-semibold">load</th>
                                        <th scope="col" class="px-3 py-2 font-semibold">layout</th>
                                        <th scope="col" class="px-3 py-2 font-semibold">draw</th>
                                        <th scope="col" class="px-3 py-2 font-semibold">total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={recentSamples()}>
                                        {(s, i) => (
                                            <tr class={{ "bg-surface-container-low": i() % 2 === 0 }}>
                                                <td class="px-3 py-1.5">{Math.max(1, (perfStats()?.count ?? 0) - recentSamples().length + i() + 1)}</td>
                                                <td class="px-3 py-1.5">{(s.phases.load ?? 0).toFixed(1)}</td>
                                                <td class="px-3 py-1.5">{(s.phases.layout ?? 0).toFixed(2)}</td>
                                                <td class="px-3 py-1.5">{(s.phases.draw ?? 0).toFixed(2)}</td>
                                                <td class="px-3 py-1.5 text-on-surface">{s.total.toFixed(2)}</td>
                                            </tr>
                                        )}
                                    </For>
                                    <tr class="bg-surface-high text-on-surface">
                                        <td class="px-3 py-1.5 font-semibold">p95</td>
                                        <td class="px-3 py-1.5">{(perfStats()!.phases.load?.p95 ?? 0).toFixed(1)}</td>
                                        <td class="px-3 py-1.5">{(perfStats()!.phases.layout?.p95 ?? 0).toFixed(2)}</td>
                                        <td class="px-3 py-1.5">{(perfStats()!.phases.draw?.p95 ?? 0).toFixed(2)}</td>
                                        <td class="px-3 py-1.5">{perfStats()!.p95.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p class="mt-2 text-body-s leading-relaxed text-on-surface-variant">
                            Times are in ms. Load is sprite loading, layout is arranging characters, draw is painting the canvas. Each row is one render, newest at the bottom. The p95 row is the slow end of the last {perfStats()!.count} runs, so 19 out of 20 runs are this fast or faster. Sprites load once and stay cached, so later runs save load time.
                        </p>
                    </Show>

                    <button type="button" class="btn btn-filled mt-4 w-full" onClick={download} disabled={status() !== "success"}>
                        <AutoAwesome size={18} />
                        Download PNG
                    </button>
                </section>
            </div>
        </Page>
    );
}
