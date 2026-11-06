import assert from "node:assert/strict";
import * as perf from "../src/lib/perf.ts";
import { computeLayout } from "../src/lib/render.ts";
import type { SpriteEntry } from "../src/lib/render.ts";

perf.reset();

const clock: { t: number } = { t: 0 };
const originalNow: () => number = globalThis.performance.now.bind(globalThis.performance);
globalThis.performance.now = () => clock.t;

const token = perf.begin({ font: "1", color: "blue", scale: 2, chars: 11 });
clock.t = 5;
perf.mark(token, "layout");
clock.t = 9;
const sample = perf.end(token, { sprites: 11, cacheHits: 9 });

assert.ok(sample !== null);
assert.deepEqual(sample!.phases, { layout: 5, draw: 4 });
assert.equal(sample!.total, 9);
assert.equal(sample!.font, "1");
assert.equal(sample!.sprites, 11);
assert.equal(sample!.cacheHits, 9);
const sumSample = perf.summary(sample!);
assert.ok(sumSample !== null);
assert.equal(sumSample!.load ?? -1, 0);
assert.equal(sumSample!.layout ?? -1, 5);
assert.equal(perf.summary()?.total ?? -1, sample!.total);

const sums: Record<string, number> = { total: 0, layout: 0, draw: 0 };
for (let i = 1; i <= 10; i++) {
    const t = perf.begin({});
    clock.t += i;
    perf.mark(t, "layout");
    clock.t += i * 2;
    perf.end(t);
    sums["total"] = (sums["total"] ?? 0) + i * 3;
    sums["layout"] = (sums["layout"] ?? 0) + i;
    sums["draw"] = (sums["draw"] ?? 0) + i * 2;
}

const stats = perf.stats();
assert.ok(stats !== null);
assert.equal(stats!.count, 11);
assert.equal(stats!.min, 3);
assert.equal(stats!.max, 30);
assert.equal(stats!.p50, 15);
assert.equal(stats!.p95, 30);
assert.equal(stats!.phases.layout!.p50, 5);
assert.equal(stats!.phases.draw!.p50, 10);

assert.equal(perf.summary()?.total ?? -1, stats!.max, "summary defaults to the last sample");

const dropped = perf.begin({});
clock.t += 1;
perf.end(dropped);
perf.begin({});
clock.t += 1;
perf.end(dropped);
assert.equal(perf.stats()!.count, 12, "ending a stale token is a no-op");
assert.equal(perf.last()!.total, 1);

const cancelled = perf.begin({});
perf.cancel(cancelled);
assert.equal(perf.end(cancelled, {}), null, "cancelled token cannot end");
assert.equal(perf.stats()!.count, 12, "cancelled token adds no sample");

for (let i = 0; i < 200; i++) {
    const t = perf.begin({});
    clock.t += 1;
    perf.end(t);
}
assert.equal(perf.stats()!.count, 100, "ring buffer caps at 100 samples");

assert.ok(perf.summary(null) !== null, "summary of null falls back to the last sample");
assert.equal(perf.summary(null)?.total ?? -1, perf.last()?.total ?? 0);
perf.reset();
assert.equal(perf.stats(), null);
assert.equal(perf.last(), null);
assert.equal(perf.summary(null), null);

globalThis.performance.now = originalNow;

const sprite: SpriteEntry = { drawable: "sprite" as unknown as HTMLCanvasElement as never, w: 10, h: 20 };
const bigText: string = Array.from({ length: 400 }, (_, i) =>
    Array.from({ length: 60 }, () => "ABCDEFGH abcdefgh [PHONE]!?"[i % 31] ?? "a").join("")
).join("\n");
const lines: string[] = bigText.split("\n");
const measure = (): SpriteEntry => sprite;

const runs: number[] = [];
for (let i = 0; i < 30; i++) {
    const start: number = originalNow();
    computeLayout(lines, measure, "1", "blue");
    runs.push(originalNow() - start);
}
runs.sort((a, b) => a - b);
const perOp: number = runs[Math.floor(runs.length / 2)] ?? 0;
const chars: number = 400 * 60;
console.log(`layout benchmark: ${perOp.toFixed(3)} ms/op median for ${chars} chars in 400 lines`);

assert.ok(perOp < 50, `layout must stay far under a frame budget, was ${perOp.toFixed(3)} ms/op`);

console.log("perf self-check passed");
