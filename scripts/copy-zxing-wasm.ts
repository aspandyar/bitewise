// Copies the barcode decoder's WebAssembly into public/ so the site serves it itself: the
// library would fetch it from a CDN, which the CSP blocks. Runs before `next dev` and `next build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { SCANNER } from "@/lib/config";

const WASM = "zxing_reader.wasm";

// zxing-wasm comes with barcode-detector; pnpm only lets its dependent resolve it.
const fromDetector = createRequire(createRequire(import.meta.url).resolve("barcode-detector"));
const source = fromDetector.resolve(`zxing-wasm/reader/${WASM}`);
const targetDir = join(process.cwd(), "public", SCANNER.wasmPath);

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, WASM));
