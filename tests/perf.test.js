import assert from "node:assert/strict";
import * as perf from "../src/lib/perf.ts";
import { computeLayout } from "../src/lib/render.ts";

perf.reset();

const clock = { t: 0 };
const originalNow = globalThis.performance.now.bind(globalThis.performance);
globalThis.performance.now = () => clock.t;

const token = perf.begin({ font: "1", color: "blue", scale: 2, chars: 11 });
clock.t = 5;
perf.mark(token, "layout");
clock.t = 9;
const sample = perf.end(token, { sprites: 11, cacheHits: 9 });

assert.deepEqual(sample.phases, { layout: 5, draw: 4 });
assert.equal(sample.total, 9);
assert.equal(sample.font, "1");
assert.equal(sample.sprites, 11);
assert.equal(sample.cacheHits, 9);

const sums = { total: 0, layout: 0, draw: 0 };
for (let i = 1; i <= 10; i++) {
    const t = perf.begin({});
    clock.t += i;
    perf.mark(t, "layout");
    clock.t += i * 2;
    perf.end(t);
    sums.total += i * 3;
    sums.layout += i;
    sums.draw += i * 2;
}

const stats = perf.stats();
assert.equal(stats.count, 11);
assert.equal(stats.min, 3);
assert.equal(stats.max, 30);
assert.equal(stats.p50, 15);
assert.equal(stats.p95, 30);
assert.equal(stats.phases.layout.p50, 5);
assert.equal(stats.phases.draw.p50, 10);

assert.equal(perf.summary().total, stats.max, "summary defaults to the last sample");
assert.equal(perf.summary(sample).load, 0);
assert.equal(perf.summary(sample).layout, 5);

const dropped = perf.begin({});
clock.t += 1;
perf.end(dropped);
const stale = perf.begin({});
clock.t += 1;
perf.end(dropped);
assert.equal(perf.stats().count, 12, "ending a stale token is a no-op");
assert.equal(perf.last().total, 1);

for (let i = 0; i < 200; i++) {
    const t = perf.begin({});
    clock.t += 1;
    perf.end(t);
}
assert.equal(perf.stats().count, 100, "ring buffer caps at 100 samples");

globalThis.performance.now = originalNow;
perf.reset();
assert.equal(perf.stats(), null);
assert.equal(perf.last(), null);

const sprite = { drawable: "sprite", w: 10, h: 20 };
const bigText = Array.from({ length: 400 }, (_, i) =>
    Array.from({ length: 60 }, () => "ABCDEFGH abcdefgh 0123456789!?"[i % 31]).join("")
).join("\n");
const lines = bigText.split("\n");
const measure = () => sprite;

const runs = [];
for (let i = 0; i < 30; i++) {
    const start = originalNow();
    computeLayout(lines, measure, "1", "blue");
    runs.push(originalNow() - start);
}
runs.sort((a, b) => a - b);
const perOp = runs[Math.floor(runs.length / 2)];
const chars = 400 * 60;
console.log(`layout benchmark: ${perOp.toFixed(3)} ms/op median for ${chars} chars in 400 lines`);

assert.ok(perOp < 50, `layout must stay far under a frame budget, was ${perOp.toFixed(3)} ms/op`);

console.log("perf self-check passed");
