export interface PerfPhases {
    load?: number;
    layout?: number;
    draw?: number;
}

export interface PerfSample {
    total: number;
    phases: PerfPhases;
    font: string;
    color: string;
    scale: number;
    chars: number;
    sprites?: number;
    cacheHits?: number;
}

interface ActiveToken {
    start: number;
    meta: Record<string, unknown>;
    phases: Record<string, number>;
}

const RING_CAPACITY = 100;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const ring: PerfSample[] = [];
let active: ActiveToken | null = null;

function push(sample: PerfSample): void {
    if (ring.length >= RING_CAPACITY) ring.shift();
    ring.push(sample);
}

export function begin(meta: Partial<PerfSample> = {}): ActiveToken {
    active = { start: now(), meta, phases: {} };
    return active;
}

export function mark(token: ActiveToken, phase: string): void {
    if (!token || token !== active) return;
    token.phases[phase] = now();
}

export function end(token: ActiveToken, extra: Partial<PerfSample> = {}): PerfSample | null {
    if (!token || token !== active) return null;
    const finished = now();
    const phases: PerfPhases = {};
    let prev = token.start;
    for (const [name, at] of Object.entries(token.phases)) {
        phases[name as keyof PerfPhases] = at - prev;
        prev = at;
    }
    phases.draw = finished - prev;
    const sample: PerfSample = {
        total: finished - token.start,
        phases,
        font: "",
        color: "",
        scale: 1,
        chars: 0,
        ...token.meta,
        ...extra,
    } as PerfSample;
    push(sample);
    active = null;
    return sample;
}

export function cancel(token: ActiveToken): void {
    if (token && token === active) active = null;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, index)];
}

export function samples(): PerfSample[] {
    return [...ring];
}

export function last(): PerfSample | null {
    return ring.length ? ring[ring.length - 1] : null;
}

export interface PhaseStats {
    min: number;
    p50: number;
    p95: number;
    max: number;
}

export interface PerfStats {
    count: number;
    min: number;
    p50: number;
    p95: number;
    max: number;
    phases: Partial<Record<keyof PerfPhases, PhaseStats>>;
}

export function stats(): PerfStats | null {
    if (ring.length === 0) return null;
    const totals = ring.map((s) => s.total).sort((a, b) => a - b);
    const phaseStats: Record<string, number[]> = {};
    for (const sample of ring) {
        for (const [name, value] of Object.entries(sample.phases)) {
            (phaseStats[name] ??= []).push(value);
        }
    }
    const aggregate: PerfStats["phases"] = {};
    for (const [name, values] of Object.entries(phaseStats)) {
        const sorted = [...values].sort((a, b) => a - b);
        aggregate[name as keyof PerfPhases] = {
            min: sorted[0],
            p50: percentile(sorted, 50),
            p95: percentile(sorted, 95),
            max: sorted[sorted.length - 1],
        };
    }
    return {
        count: ring.length,
        min: totals[0],
        p50: percentile(totals, 50),
        p95: percentile(totals, 95),
        max: totals[totals.length - 1],
        phases: aggregate,
    };
}

export function summary(sample?: PerfSample | null): { total: number; load: number; layout: number; draw: number; sprites: number; cacheHits: number; chars: number } | null {
    const s = sample ?? last();
    if (!s) return null;
    return {
        total: s.total,
        load: s.phases.load ?? 0,
        layout: s.phases.layout ?? 0,
        draw: s.phases.draw ?? 0,
        sprites: s.sprites ?? 0,
        cacheHits: s.cacheHits ?? 0,
        chars: s.chars ?? 0,
    };
}

export function reset(): void {
    ring.length = 0;
    active = null;
}
