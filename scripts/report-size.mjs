import { gzipSync, brotliCompressSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";

const TARGETS = [
  { file: "build/index.umd.js", label: "UMD (minified)", limit: 3072 },
  { file: "build/index.mjs", label: "ESM (unminified)" },
  { file: "build/index.cjs", label: "CJS (unminified)" },
];

const format = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;

let failed = false;

console.log("\nBundle size\n");
for (const { file, label, limit } of TARGETS) {
  let contents;
  try {
    contents = readFileSync(file);
  } catch {
    console.error(`  ✗ ${file} is missing — run "npm run build" first`);
    failed = true;
    continue;
  }

  const raw = statSync(file).size;
  const gzip = gzipSync(contents).length;
  const brotli = brotliCompressSync(contents).length;

  console.log(
    `  ${label.padEnd(18)} raw ${format(raw).padStart(9)}` +
      `   gzip ${format(gzip).padStart(9)}` +
      `   brotli ${format(brotli).padStart(9)}`
  );

  if (limit !== undefined && gzip > limit) {
    console.error(
      `    ✗ gzip size ${format(gzip)} exceeds the ${format(limit)} budget`
    );
    failed = true;
  }
}

console.log("");
process.exit(failed ? 1 : 0);
