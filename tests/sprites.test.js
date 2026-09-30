import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { FONT_SUPPORT, getCharPath } from "../src/lib/fonts.ts";

const ROOT = join(import.meta.dirname, "..");
const FONTS_DIR = join(ROOT, "public", "assets", "fonts");
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function dirNames(path) {
    try {
        return readdirSync(path, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
        return [];
    }
}

function fileStems(path) {
    try {
        return new Set(readdirSync(path, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name.replace(/\.png$/, "")));
    } catch {
        return new Set();
    }
}

const problems = [];
const report = [];

for (const fontId of Object.keys(FONT_SUPPORT)) {
    const support = FONT_SUPPORT[fontId];
    const fontDir = join(FONTS_DIR, `font-${fontId}`);
    const colorDirs = dirNames(fontDir).filter((d) => d.startsWith("ms-"));
    const expectedColors = support.colors.map((c) => `ms-${c}`);

    for (const wanted of expectedColors) {
        if (!colorDirs.includes(wanted)) problems.push(`font ${fontId}: declared color ${wanted} has no directory`);
    }
    for (const found of colorDirs) {
        if (!expectedColors.includes(found)) problems.push(`font ${fontId}: directory ${found} is not a declared color`);
    }

    for (const colorDir of colorDirs) {
        const label = `font ${fontId} ${colorDir}`;
        const symbols = fileStems(join(fontDir, colorDir, "symbols"));
        const lower = fileStems(join(fontDir, colorDir, "letters", "lower-case"));
        const upper = fileStems(join(fontDir, colorDir, "letters", "upper-case"));
        const numbers = fileStems(join(fontDir, colorDir, "numbers"));

        if (support.lowerCase) {
            for (const c of LOWER) if (!lower.has(c)) problems.push(`${label}: lowercase '${c}' declared but no sprite`);
        }
        if (support.upperCase) {
            for (const c of UPPER) if (!upper.has(c)) problems.push(`${label}: uppercase '${c}' declared but no sprite`);
        }
        for (const n of support.numbers) {
            if (!numbers.has(String(n))) problems.push(`${label}: number '${n}' declared but no sprite`);
        }

        const expectedSymbolFiles = new Set();
        for (const sym of support.symbols) {
            const path = getCharPath(fontId, colorDir.replace(/^ms-/, ""), sym);
            if (!path) {
                problems.push(`${label}: symbol ${JSON.stringify(sym)} has no filename mapping in SPECIAL_CHARACTERS`);
                continue;
            }
            const file = path.split("/").pop().replace(/\.png$/, "");
            expectedSymbolFiles.add(file);
            if (!symbols.has(file)) problems.push(`${label}: symbol '${sym}' (${file}.png) declared but no sprite`);
        }
        for (const file of symbols) {
            if (!expectedSymbolFiles.has(file)) problems.push(`${label}: sprite ${file}.png exists but is NOT declared as supported`);
        }
        for (const file of lower) if (!support.lowerCase) problems.push(`${label}: lowercase sprite ${file}.png exists but lowercase is not declared`);
        for (const file of upper) if (!support.upperCase) problems.push(`${label}: uppercase sprite ${file}.png exists but uppercase is not declared`);
        for (const file of numbers) {
            if (!support.numbers.includes(parseInt(file, 10))) problems.push(`${label}: number sprite ${file}.png exists but is not declared`);
        }

        report.push(`${label}: ${lower.size} lower, ${upper.size} upper, ${numbers.size} numbers, ${symbols.size} symbols`);
    }
}

console.log(report.join("\n"));
if (problems.length) {
    console.error("\nSPRITE AUDIT PROBLEMS:");
    for (const p of problems) console.error(" - " + p);
}
assert.equal(problems.length, 0, "declared character support must match the sprite files exactly");
console.log("sprite audit passed");
