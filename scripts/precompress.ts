import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { constants, gunzipSync, gzipSync, zstdCompressSync, zstdDecompressSync } from "node:zlib";

const ROOT = "dist";
const COMPRESSIBLE = /\.(?:css|html|js|json|map|svg|txt|webmanifest|xml)$/;
const ZSTD_LEVEL = 19;
const GZIP_LEVEL = 9;

const files: string[] = [];
(function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (COMPRESSIBLE.test(entry.name)) files.push(path);
    }
})(ROOT);

let written = 0;
let rawTotal = 0;
let zstdTotal = 0;
let gzipTotal = 0;

for (const path of files) {
    const data = readFileSync(path);
    const zstd = zstdCompressSync(data, { params: { [constants.ZSTD_c_compressionLevel]: ZSTD_LEVEL } });
    const gzip = gzipSync(data, { level: GZIP_LEVEL });
    if (zstd.length >= data.length || gzip.length >= data.length) continue;
    writeFileSync(`${path}.zst`, zstd);
    writeFileSync(`${path}.gz`, gzip);
    if (Buffer.compare(zstdDecompressSync(zstd), data) !== 0 || Buffer.compare(gunzipSync(gzip), data) !== 0) {
        throw new Error(`verification failed for ${path}`);
    }
    written++;
    rawTotal += data.length;
    zstdTotal += zstd.length;
    gzipTotal += gzip.length;
}

const kb = (bytes: number): string => (bytes / 1024).toFixed(1);
console.log(
    `precompressed ${written} of ${files.length} files: ${kb(rawTotal)} KB -> ${kb(zstdTotal)} KB zstd, ${kb(gzipTotal)} KB gzip`
);
