import assert from "node:assert/strict";
import { darken, rankColors } from "../src/lib/palette.ts";

assert.deepEqual(rankColors([], 6), [], "empty pixel data yields an empty palette");

const twoColors = [
    255, 0, 0, 255,
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 120,
];
assert.deepEqual(
    rankColors(twoColors, 6),
    [[255, 0, 0], [0, 255, 0]],
    "ranks by frequency and drops translucent pixels"
);

assert.equal(rankColors(twoColors, 1).length, 1, "caps at the requested maximum");

const seven = [];
for (let i = 0; i < 7; i++) {
    for (let repeat = 0; repeat <= 6 - i; repeat++) {
        seven.push(i * 30, i * 30, i * 30, 255);
    }
}
const ranked = rankColors(seven, 6);
assert.equal(ranked.length, 6, "caps at six entries like the desktop palette sampler");
assert.deepEqual(ranked[0], [0, 0, 0], "most frequent color comes first");
assert.deepEqual(ranked[5], [150, 150, 150], "sixth most frequent color comes last");

assert.deepEqual(darken([255, 255, 255], 160), [159, 159, 159], "darken matches Qt factor math");
assert.deepEqual(darken([200, 100, 50], 100), [200, 100, 50], "darken at factor 100 is a no-op");

console.log("palette self-check passed");
