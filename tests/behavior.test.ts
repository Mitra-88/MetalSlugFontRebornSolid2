import assert from "node:assert/strict";
import {
    FONT_SUPPORT,
    SAFE_LIMIT,
    HARD_LIMIT,
    SPACE_WIDTH,
    EMPTY_LINE_HEIGHT,
    LINE_SPACING,
    UNUSED_SYMBOLS,
    getCharPath,
    isCharSupported,
    collectUnsupported,
    getTextCharPaths,
    getAssetsToPreload,
} from "../src/lib/fonts.ts";
import type { ColorName, FontId } from "../src/lib/fonts.ts";

const FONTS: FontId[] = ["1", "2", "3", "4", "5"] as FontId[];

assert.deepEqual(Object.keys(FONT_SUPPORT).sort(), ["1", "2", "3", "4", "5"]);
assert.ok(SAFE_LIMIT < HARD_LIMIT, "safe limit must sit below hard limit");
assert.ok(SPACE_WIDTH > 0 && EMPTY_LINE_HEIGHT > 0 && LINE_SPACING >= 0);

const ALL_COLORS: ColorName[] = ["blue", "orange", "gold", "yellow"];

for (const font of FONTS) {
    const support = FONT_SUPPORT[font];
    assert.ok(support.colors.length >= 1, `font ${font} needs at least one color`);
    for (const color of support.colors) {
        assert.ok(ALL_COLORS.includes(color), `font ${font} declares unknown color ${color}`);
    }
    assert.equal(new Set(support.colors).size, support.colors.length, `font ${font} duplicate colors`);
    assert.equal(new Set(support.numbers).size, support.numbers.length, `font ${font} duplicate numbers`);
    assert.equal(new Set(support.symbols).size, support.symbols.length, `font ${font} duplicate symbols`);
    const sortedNumbers = [...support.numbers].sort((a, b) => a - b);
    assert.deepEqual(support.numbers, sortedNumbers, `font ${font} numbers must be sorted`);
    for (const n of support.numbers) assert.ok(n >= 0 && n <= 9, `font ${font} number ${n} out of range`);
    for (const sym of support.symbols) {
        assert.equal(sym.length, 1, `font ${font} symbol ${JSON.stringify(sym)} must be one code unit`);
        assert.ok(!/\s/.test(sym), `font ${font} symbol whitespace`);
        assert.ok(isCharSupported(font, sym), `font ${font} symbol ${sym} must be supported`);
        for (const color of support.colors) {
            assert.ok(getCharPath(font, color, sym) !== null, `font ${font} ${color} ${sym} must resolve`);
        }
    }
    const preload = getAssetsToPreload(font, support.colors[0]!);
    assert.equal(new Set(preload).size, preload.length, `font ${font} preload dedupes`);
    for (const wrong of ALL_COLORS) {
        if (!support.colors.includes(wrong)) {
            assert.deepEqual(getAssetsToPreload(font, wrong), [], `font ${font} preload for undeclared color ${wrong}`);
        }
    }
    const unused = UNUSED_SYMBOLS[font] ?? {};
    for (const ch of Object.keys(unused)) {
        assert.ok(!isCharSupported(font, ch), `unused ${ch} must not be supported in font ${font}`);
        for (const color of support.colors) {
            assert.equal(getCharPath(font, color, ch), null, `unused ${ch} must never resolve`);
        }
    }
    const supportedFiles = new Set(support.symbols.map((s) => getCharPath(font, support.colors[0]!, s)));
    assert.equal(supportedFiles.size, support.symbols.length, `font ${font} symbol files must be unique`);
}

assert.equal(isCharSupported("1", "a"), true);
assert.equal(isCharSupported("1", "Z"), true);
assert.equal(isCharSupported("1", "0"), true);
assert.equal(isCharSupported("1", "9"), true);
assert.equal(isCharSupported("5", "0"), false, "font 5 has no zero");
assert.equal(isCharSupported("5", "9"), true);
assert.equal(isCharSupported("5", "a"), false);
assert.equal(isCharSupported("5", "A"), true);
assert.equal(isCharSupported("1", " "), false, "space is not a supported glyph");
assert.equal(isCharSupported("1", "\t"), false);
assert.equal(isCharSupported("1", ""), false, "empty string is never supported");

assert.deepEqual(collectUnsupported("1", "aa@@bb@@"), ["@"], "collectUnsupported dedupes");
assert.deepEqual(collectUnsupported("1", " \t\n\r"), [], "collectUnsupported ignores whitespace");
assert.deepEqual(collectUnsupported("1", "a@b#c").filter((c: string) => c === "@"), ["@"], "collectUnsupported finds missing chars");
assert.deepEqual(collectUnsupported("1", "😀a"), ["😀"], "collectUnsupported handles astral codepoints");
assert.deepEqual(collectUnsupported("5", "ABab"), ["a", "b"], "font 5 lowercases are unsupported");

const paths = getTextCharPaths("1", "blue", "aaa bbb");
assert.deepEqual(paths, [...new Set(paths)], "getTextCharPaths dedupes");
assert.equal(paths.length, 2, "repeated a and b collapse to two paths");
assert.deepEqual(getTextCharPaths("1", "blue", " @ "), [], "no drawable paths for unsupported only");
assert.ok(getTextCharPaths("1", "blue", "a@b").length === 2, "unsupported skipped in paths");

import { computeLayout } from "../src/lib/render.ts";
import type { SpriteEntry } from "../src/lib/render.ts";

function fakeEntry(w: number, h: number): SpriteEntry {
    return { drawable: "sprite" as unknown as HTMLCanvasElement as never, w, h };
}
const flat = () => false;
void flat;

const emptyLayout = computeLayout([], () => null, "1", "blue");
assert.ok(emptyLayout !== null);
assert.equal(emptyLayout!.width, 0);
assert.equal(emptyLayout!.height, 0);
assert.equal(emptyLayout!.lines.length, 0);

const sprite = fakeEntry(10, 20);
const measure = () => sprite;
const onlySpaces = computeLayout(["   "], measure, "1", "blue");
assert.equal(onlySpaces!.lines[0]?.empty, true);

import { rankColors, darken } from "../src/lib/palette.ts";
assert.deepEqual(rankColors([], 6), []);
assert.deepEqual(rankColors([255, 0, 0, 0, 0, 255, 0, 100], 6), [], "fully translucent pixels yield empty palette");
assert.deepEqual(rankColors([10, 20, 30, 255], 0), [], "max zero yields empty palette");
assert.deepEqual(darken([10, 20, 30], 100), [10, 20, 30]);
const clipped = rankColors([255, 255, 255, 255], 6);
assert.deepEqual(clipped, [[255, 255, 255]]);

import * as perf from "../src/lib/perf.ts";
perf.reset();
assert.equal(perf.stats(), null);
assert.equal(perf.last(), null);
assert.equal(perf.samples().length, 0);
assert.equal(perf.summary(null), null);

const t0 = perf.begin({ font: "1", color: "blue", scale: 1, chars: 3 });
const t1 = perf.begin({ font: "2", color: "gold", scale: 1, chars: 1 });
assert.equal(perf.end(t0, {}), null, "superseded token cannot end");
const done = perf.end(t1, { sprites: 1, cacheHits: 0 });
assert.ok(done !== null);
assert.equal(perf.samples().length, 1);

const t2 = perf.begin({});
perf.cancel(t2);
assert.equal(perf.end(t2, {}), null, "cancelled token cannot end");
assert.equal(perf.samples().length, 1);
perf.reset();
assert.equal(perf.samples().length, 0);

console.log("behavior self-check passed");
