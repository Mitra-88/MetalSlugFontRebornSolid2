import assert from "node:assert/strict";
import {
    FONT_SUPPORT,
    collectUnsupported,
    getAssetsToPreload,
    getCharPath,
    getTextCharPaths,
    isCharSupported,
} from "../src/lib/fonts.ts";
import { computeLayout, getLayout } from "../src/lib/render.ts";
import type { SpriteEntry } from "../src/lib/render.ts";

assert.equal(getCharPath("1", "blue", "a"), "./assets/fonts/font-1/ms-blue/letters/lower-case/a.png");
assert.equal(getCharPath("1", "blue", "Z"), "./assets/fonts/font-1/ms-blue/letters/upper-case/Z.png");
assert.equal(getCharPath("2", "gold", "7"), "./assets/fonts/font-2/ms-gold/numbers/7.png");
assert.equal(getCharPath("1", "blue", "!"), "./assets/fonts/font-1/ms-blue/symbols/Exclamation.png");
assert.equal(getCharPath("1", "blue", "@"), null);
assert.equal(getCharPath("1", "blue", " "), null);
assert.equal(getCharPath("1", "blue", "é"), null);
assert.equal(getCharPath("2", "blue", "é"), null);
assert.equal(getCharPath("1", "blue", "Ⅳ"), null);
assert.equal(getCharPath("2", "blue", "Ⅳ"), null);
assert.equal(getCharPath("1", "blue", "ā"), null);
assert.equal(getCharPath("1", "blue", "😀"), null);

assert.equal(isCharSupported("5", "a"), false);
assert.equal(isCharSupported("5", "A"), true);
assert.equal(isCharSupported("5", "0"), false);
assert.equal(isCharSupported("5", "9"), true);
assert.equal(isCharSupported("5", "!"), true);
assert.equal(isCharSupported("5", "?"), true);
assert.equal(isCharSupported("5", ","), false);
assert.equal(isCharSupported("1", "♥"), true);
assert.equal(isCharSupported("1", "é"), false);
assert.equal(isCharSupported("2", "é"), false);
assert.equal(isCharSupported("3", "é"), false);
assert.equal(isCharSupported("2", "ā"), false);
assert.equal(isCharSupported("2", "Ⅳ"), false);
assert.equal(isCharSupported("1", "Ⅳ"), false);
assert.equal(isCharSupported("1", "@"), false);
assert.equal(isCharSupported("1", "😀"), false);
assert.equal(isCharSupported("1", ""), false);

assert.deepEqual(collectUnsupported("5", "hello!"), ["h", "e", "l", "o"]);
assert.deepEqual(collectUnsupported("5", "HELLO!"), []);
assert.deepEqual(collectUnsupported("1", "ok @ß@"), ["@", "ß"]);
assert.deepEqual(collectUnsupported("1", "café"), ["é"]);
assert.deepEqual(collectUnsupported("2", "café"), ["é"]);
assert.deepEqual(collectUnsupported("3", "café"), ["é"]);
assert.deepEqual(collectUnsupported("1", "ok"), []);
assert.deepEqual(collectUnsupported("1", "aa@@"), ["@"]);
assert.deepEqual(collectUnsupported("1", " \t\n"), []);

assert.equal(getAssetsToPreload("1", "blue").length, 26 + 26 + 10 + FONT_SUPPORT["1"].symbols.length);
assert.equal(getAssetsToPreload("5", "orange").length, 26 + 9 + 2);
assert.equal(getAssetsToPreload("5", "blue").length, 0);
assert.ok(getAssetsToPreload("3", "gold").length === 0);
assert.equal(new Set(getAssetsToPreload("1", "blue")).size, getAssetsToPreload("1", "blue").length);
assert.deepEqual(getTextCharPaths("1", "blue", "aaa"), getTextCharPaths("1", "blue", "a"));
assert.deepEqual(getTextCharPaths("1", "blue", " @ "), []);

const sprite: SpriteEntry = { drawable: "sprite" as unknown as HTMLCanvasElement as never, w: 10, h: 20 };
const measure = (): SpriteEntry => sprite;
const layout = computeLayout(["ab", "", "c d"], measure, "1", "blue");
assert.ok(layout !== null);
assert.equal(layout!.lines.length, 3);
const firstLine = layout!.lines[0]!;
assert.equal(firstLine.empty, false);
if (!firstLine.empty) {
    assert.deepEqual(firstLine.chars, [{ sprite, width: 10, height: 20 }, { sprite, width: 10, height: 20 }]);
    assert.equal(firstLine.lineWidth, 20);
    assert.equal(firstLine.lineHeight, 20);
}
assert.deepEqual(layout!.lines[1], { empty: true, height: 50 });
const third = layout!.lines[2]!;
assert.equal(third.empty, false);
if (!third.empty) {
    assert.deepEqual(third.chars, [
        { sprite, width: 10, height: 20 },
        { space: true, width: 25, height: 0 },
        { sprite, width: 10, height: 20 },
    ]);
}
assert.equal(layout!.width, 45);
assert.equal(layout!.height, 20 + 15 + 50 + 15 + 20);

const trailing = computeLayout(["a", ""], measure, "1", "blue");
assert.ok(trailing !== null);
assert.equal(trailing!.height, 20 + 15 + 50);
assert.equal(computeLayout([""], measure, "1", "blue")!.height, 50);

const indented = computeLayout(["  hi"], measure, "1", "blue");
assert.ok(indented !== null);
assert.equal(indented!.width, 25 + 25 + 20, "leading spaces render as advances");
const crlf = computeLayout(["a\r", "b"], measure, "1", "blue");
assert.ok(crlf !== null);
const crlfFirst = crlf!.lines[0]!;
assert.equal(crlfFirst.empty, false);
if (!crlfFirst.empty) assert.equal(crlfFirst.chars.length, 1, "trailing CR from CRLF is stripped, not an advance");
assert.deepEqual(computeLayout(["   "], measure, "1", "blue"), { lines: [{ empty: true, height: 50 }], width: 0, height: 50 }, "whitespace-only lines stay empty");

const skippedLayout = computeLayout(["a@b"], measure, "1", "blue");
assert.ok(skippedLayout !== null);
assert.equal(skippedLayout!.width, 20, "unsupported characters are skipped, not fatal");
const skippedFirst = skippedLayout!.lines[0]!;
assert.equal(skippedFirst.empty, false);
if (!skippedFirst.empty) assert.equal(skippedFirst.chars.length, 2);

const crossFont = computeLayout(["♪a"], measure, "1", "blue");
assert.ok(crossFont !== null);
assert.equal(crossFont!.width, 10, "characters from another font's set are skipped, never loaded cross-font");
assert.deepEqual(collectUnsupported("1", "♪a"), ["♪"]);

assert.equal(computeLayout(["hi", "x"], () => null, "1", "blue"), null, "supported but missing sprites still abort the layout");

assert.equal(getLayout("1", "blue", "ab"), null, "missing sprites must not crash or cache");
assert.equal(getLayout("1", "blue", "ab"), null);

const spritePaths: (string | null)[] = "abcd".split("").map((c) => getCharPath("1", "blue", c));
const cacheGetImage = (path: string): SpriteEntry | null => (spritePaths.includes(path) ? sprite : null);

const first = getLayout("1", "blue", "abcd", cacheGetImage);
assert.ok(first, "layout computed when sprites exist");
assert.equal(getLayout("1", "blue", "abcd", cacheGetImage), first, "memoized layout is the same object");
assert.notEqual(getLayout("1", "blue", "abc", cacheGetImage), first, "different text gets a different layout");

for (let i = 0; i < 100; i++) {
    getLayout("1", "blue", "abcd" + i, cacheGetImage);
    getLayout("1", "blue", "abcd", cacheGetImage);
}
assert.equal(getLayout("1", "blue", "abcd", cacheGetImage), first, "recently used key survives eviction churn");

console.log("layout self-check passed");
