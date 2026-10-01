import * as perf from "./perf.ts";
import type { PerfSample } from "./perf.ts";
import {
    EMPTY_LINE_HEIGHT,
    HARD_LIMIT,
    LINE_SPACING,
    SAFE_LIMIT,
    SPACE_WIDTH,
    getAssetsToPreload,
    getCharPath,
    getTextCharPaths,
} from "./fonts.ts";
import type { ColorName, FontId } from "./fonts.ts";

export interface SpriteEntry {
    drawable: ImageBitmap | HTMLImageElement;
    w: number;
    h: number;
}

export interface CharData {
    space?: boolean;
    sprite?: SpriteEntry;
    width: number;
    height: number;
}

export type LayoutLine =
    | { empty: true; height: number }
    | { empty: false; chars: CharData[]; lineWidth: number; lineHeight: number };

export interface ComputedLayout {
    lines: LayoutLine[];
    width: number;
    height: number;
}

const imgCache = new Map<string, SpriteEntry>();
const failedLoads = new Set<string>();
const layoutMemo = new Map<string, ComputedLayout>();
const LAYOUT_MEMO_CAP = 48;

async function decode(img: HTMLImageElement): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === "function") {
        try {
            return await createImageBitmap(img);
        } catch {
            return img;
        }
    }
    return img;
}

function getImage(path: string): SpriteEntry | null {
    return imgCache.get(path) ?? null;
}

export function loadImage(path: string, retries = 1): Promise<SpriteEntry | null> {
    if (imgCache.has(path)) return Promise.resolve(imgCache.get(path)!);
    if (failedLoads.has(path)) return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        let settled = false;
        const timer = setTimeout(() => settle(false), LOAD_TIMEOUT);
        const settle = async (ok: boolean): Promise<void> => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (!ok) {
                if (retries > 0) setTimeout(() => resolve(loadImage(path, retries - 1)), 50);
                else {
                    failedLoads.add(path);
                    resolve(null);
                }
                return;
            }
            failedLoads.delete(path);
            const drawable = await decode(img);
            const entry: SpriteEntry = { drawable, w: drawable.width, h: drawable.height };
            imgCache.set(path, entry);
            resolve(entry);
        };
        img.onload = () => settle(true);
        img.onerror = () => settle(false);
        img.src = path;
    });
}

const LOAD_TIMEOUT = 8000;

export function resetFailures(): void {
    failedLoads.clear();
}

export function getMissingPaths(font: FontId, color: ColorName, text: string): string[] {
    return getTextCharPaths(font, color, text).filter(
        (path) => !imgCache.has(path) && !failedLoads.has(path)
    );
}

const idleTarget = { id: "" };
const activeChains = new Set<string>();

export function preloadIdle(fontId: FontId, color: ColorName, batch = 10): void {
    const paths = getAssetsToPreload(fontId, color).filter((p) => !imgCache.has(p));
    if (paths.length === 0) return;

    const target = `${fontId}|${color}`;
    idleTarget.id = target;
    if (activeChains.has(target)) return;
    activeChains.add(target);

    let cursor = 0;
    const idle = (callback: () => void): void => {
        if (typeof requestIdleCallback === "function") requestIdleCallback(callback, { timeout: 1200 });
        else setTimeout(callback, 32);
    };

    const step = (): void => {
        if (idleTarget.id !== target) {
            activeChains.delete(target);
            return;
        }
        let loaded = 0;
        while (cursor < paths.length && loaded < batch) {
            loadImage(paths[cursor++]);
            loaded++;
        }
        if (cursor < paths.length) idle(step);
        else activeChains.delete(target);
    };
    idle(step);
}

export function computeLayout(
    lines: string[],
    getImage: (path: string) => SpriteEntry | null,
    font: FontId,
    color: ColorName
): ComputedLayout | null {
    const lineData: LayoutLine[] = [];
    let maxWidth = 0;
    let totalHeight = 0;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i].replace(/\r$/, "");
        if (!rawLine.trim()) {
            lineData.push({ empty: true, height: EMPTY_LINE_HEIGHT });
            totalHeight += EMPTY_LINE_HEIGHT;
            if (i < lines.length - 1) totalHeight += LINE_SPACING;
            continue;
        }

        let lineWidth = 0;
        let lineHeight = 0;
        const charData: CharData[] = [];

        for (const c of [...rawLine]) {
            if (/\s/.test(c)) {
                charData.push({ space: true, width: SPACE_WIDTH, height: 0 });
                lineWidth += SPACE_WIDTH;
                continue;
            }
            const path = getCharPath(font, color, c);
            if (!path) continue;
            const entry = getImage(path);
            if (!entry) return null;
            charData.push({ sprite: entry, width: entry.w, height: entry.h });
            lineWidth += entry.w;
            lineHeight = Math.max(lineHeight, entry.h);
        }

        lineData.push({ empty: false, chars: charData, lineWidth, lineHeight });
        maxWidth = Math.max(maxWidth, lineWidth);
        totalHeight += lineHeight;
        if (i < lines.length - 1) totalHeight += LINE_SPACING;
    }

    return { lines: lineData, width: maxWidth, height: totalHeight };
}

export function getLayout(
    font: FontId,
    color: ColorName,
    text: string,
    getImageFn: (path: string) => SpriteEntry | null = getImage
): ComputedLayout | null {
    const key = `${font}|${color}|${text}`;
    if (layoutMemo.has(key)) {
        const cached = layoutMemo.get(key)!;
        layoutMemo.delete(key);
        layoutMemo.set(key, cached);
        return cached;
    }
    const layout = computeLayout(text.split("\n"), getImageFn, font, color);
    if (layout === null) return null;
    if (layoutMemo.size >= LAYOUT_MEMO_CAP) {
        layoutMemo.delete(layoutMemo.keys().next().value!);
    }
    layoutMemo.set(key, layout);
    return layout;
}

function drawLayout(canvas: HTMLCanvasElement, layout: ComputedLayout, scale: number): void {
    const w = Math.max(1, layout.width);
    const h = Math.max(1, layout.height);

    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    if (scale !== 1) ctx.scale(scale, scale);

    let y = 0;
    for (let i = 0; i < layout.lines.length; i++) {
        const ld = layout.lines[i];
        if (ld.empty) {
            y += ld.height;
        } else {
            let x = 0;
            for (const c of ld.chars) {
                if (!c.space && c.sprite) ctx.drawImage(c.sprite.drawable, x, y + ld.lineHeight - c.height);
                x += c.width;
            }
            y += ld.lineHeight;
        }
        if (i < layout.lines.length - 1) y += LINE_SPACING;
    }
}

export type RenderResult =
    | { error: "failed"; char: string }
    | { error: "empty" }
    | { error: "too-large"; width: number; height: number }
    | { error?: undefined; width: number; height: number; warning: string; sample: PerfSample };

export interface RenderOptions {
    font: FontId;
    color: ColorName;
    text: string;
    scale: number;
}

export function renderToCanvas(canvas: HTMLCanvasElement, { font, color, text, scale }: RenderOptions): RenderResult {
    const token = perf.begin({ font, color, scale, chars: [...text].length });

    const lines = text.split("\n");

    let failedChar = "";
    outer: for (const line of lines) {
        for (const c of [...line]) {
            if (/\s/.test(c)) continue;
            const path = getCharPath(font, color, c);
            if (path && !imgCache.has(path) && failedLoads.has(path)) {
                failedChar = c;
                break outer;
            }
        }
    }
    if (failedChar) {
        perf.cancel(token);
        return { error: "failed", char: failedChar };
    }

    const layout = getLayout(font, color, text);
    if (layout === null) {
        perf.cancel(token);
        return { error: "failed", char: text[0] ?? "" };
    }
    if (layout.width === 0) {
        perf.cancel(token);
        return { error: "empty" };
    }
    perf.mark(token, "layout");

    const finalW = Math.max(1, layout.width) * scale;
    const finalH = Math.max(1, layout.height) * scale;

    if (finalW > HARD_LIMIT || finalH > HARD_LIMIT) {
        perf.cancel(token);
        return { error: "too-large", width: finalW, height: finalH };
    }

    drawLayout(canvas, layout, scale);

    let warning = "";
    if (finalW > SAFE_LIMIT || finalH > SAFE_LIMIT) {
        warning = `Warning: Large image (${finalW}×${finalH}px). Rendering may lag or crash on lower-end devices.`;
    }

    const usedPaths = getTextCharPaths(font, color, text);
    const sample = perf.end(token, {
        sprites: usedPaths.length,
        cacheHits: usedPaths.filter((p) => imgCache.has(p)).length,
    })!;
    return { width: finalW, height: finalH, warning, sample };
}
