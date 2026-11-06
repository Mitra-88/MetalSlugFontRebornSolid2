import { loadImage } from "./render.ts";
import { getCharPath } from "./fonts.ts";
import type { ColorName, FontId } from "./fonts.ts";

export type RGB = [number, number, number];

const FALLBACK_PALETTE: RGB[] = [[128, 128, 128]];

export function rankColors(data: ArrayLike<number>, max: number): RGB[] {
    const counts = new Map<number, { count: number; rgb: RGB }>();
    for (let i = 0; i + 3 < data.length; i += 4) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        const a = data[i + 3] ?? 0;
        if (a <= 127) continue;
        const key = (r << 16) | (g << 8) | b;
        const current = counts.get(key);
        if (current) {
            current.count++;
        } else {
            counts.set(key, { count: 1, rgb: [r, g, b] });
        }
    }
    return [...counts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, max)
        .map((entry) => entry.rgb);
}

export function darken(rgb: RGB, factor: number): RGB {
    const k = 100 / factor;
    return [Math.round(rgb[0] * k), Math.round(rgb[1] * k), Math.round(rgb[2] * k)];
}

const paletteCache = new Map<string, RGB[]>();
const pendingPalettes = new Map<string, Promise<RGB[]>>();

const SAMPLE_CHARS = ["A", "M", "W"] as const;

export function paletteFor(font: FontId, color: ColorName, max = 6): Promise<RGB[]> {
    const key = `${font}|${color}`;
    const cached = paletteCache.get(key);
    if (cached) return Promise.resolve(cached);
    const inFlight = pendingPalettes.get(key);
    if (inFlight) return inFlight;

    const promise = (async (): Promise<RGB[]> => {
        try {
            const sprites = await Promise.all(
                SAMPLE_CHARS.map(async (ch) => {
                    const path = getCharPath(font, color, ch);
                    if (!path) return null;
                    return loadImage(path);
                })
            );
            const allData: number[] = [];
            for (const sprite of sprites) {
                if (!sprite || sprite.w <= 0 || sprite.h <= 0) continue;
                const canvas = document.createElement("canvas");
                canvas.width = sprite.w;
                canvas.height = sprite.h;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (!ctx) continue;
                ctx.drawImage(sprite.drawable, 0, 0);
                const data = ctx.getImageData(0, 0, sprite.w, sprite.h).data;
                for (let i = 0; i < data.length; i++) allData.push(data[i]!);
            }
            if (allData.length === 0) return FALLBACK_PALETTE;
            const palette = rankColors(allData, max);
            const result = palette.length > 0 ? palette : FALLBACK_PALETTE;
            paletteCache.set(key, result);
            return result;
        } catch {
            return FALLBACK_PALETTE;
        } finally {
            pendingPalettes.delete(key);
        }
    })();
    pendingPalettes.set(key, promise);
    return promise;
}

export function drawColorIcon(canvas: HTMLCanvasElement, palette: RGB[], margin = 1): void {
    const ctx = canvas.getContext("2d");
    if (!ctx || palette.length === 0) return;
    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - margin;
    const step = (Math.PI * 2) / palette.length;
    let start = -Math.PI / 2;
    for (const rgb of palette) {
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, start, start + step);
        ctx.closePath();
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fill();
        start += step;
    }
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    const first = palette[0] ?? [128, 128, 128];
    const [r, g, b] = darken(first, 160);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = Math.max(1, Math.round(size / 16));
    ctx.stroke();
}
