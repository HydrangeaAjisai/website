import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const source = process.argv[2];
const destination = process.argv[3];
if (!source || !destination) throw new Error('Usage: node scripts/export-photos.mjs SOURCE DESTINATION');
const inputRoot = path.resolve(source);
const outputRoot = path.resolve(destination);
if (inputRoot === outputRoot || outputRoot.startsWith(inputRoot + path.sep)) {
  throw new Error('Output must be outside the source directory.');
}
await fs.mkdir(outputRoot, { recursive: true });
const results = [];
async function convert(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const input = path.join(directory, entry.name);
    if (entry.isDirectory()) { await convert(input); continue; }
    if (!entry.isFile() || !/\.jpe?g$/i.test(entry.name)) continue;
    const relative = path.relative(inputRoot, input);
    const output = path.join(outputRoot, relative + '.webp');
    await fs.mkdir(path.dirname(output), { recursive: true });
    const buffer = await sharp(input).rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    const metadata = await sharp(buffer).metadata();
    if (metadata.format !== 'webp' || metadata.width > 2000 || metadata.height > 2000) {
      throw new Error(`Invalid output: ${relative}`);
    }
    await fs.writeFile(output, buffer, { flag: 'wx' });
    results.push({ file: relative, originalBytes: (await fs.stat(input)).size,
      outputBytes: buffer.length, width: metadata.width, height: metadata.height });
    if (results.length % 10 === 0) console.log(`Exported ${results.length} photos`);
  }
}
await convert(inputRoot);
await fs.writeFile(path.join(outputRoot, 'report.json'), JSON.stringify(results, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ count: results.length,
  originalBytes: results.reduce((sum, item) => sum + item.originalBytes, 0),
  outputBytes: results.reduce((sum, item) => sum + item.outputBytes, 0),
  largestOutputBytes: Math.max(...results.map(item => item.outputBytes)), outputRoot }));
