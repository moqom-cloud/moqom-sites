// Rasterises public/og.svg to public/og.png (1200x630) for social cards,
// which do not accept SVG. Run after editing og.svg: `pnpm og`.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../public/og.svg", import.meta.url));
const png = await sharp(svg, { density: 144 }).resize(1200, 630).png({ compressionLevel: 9 }).toBuffer();
await writeFile(new URL("../public/og.png", import.meta.url), png);
console.log(`og.png written (${png.length} bytes)`);
