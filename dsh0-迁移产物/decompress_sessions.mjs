import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MAGIC = 0xfd2fb528;
const MAGIC_BUF = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

// Frame boundaries are found by scanning for the next zstd magic; a true
// frame start decodes cleanly on its own, so the candidate is validated.
function decompress(buf) {
  const magics = [];
  let p = 0;
  for (;;) {
    const i = buf.indexOf(MAGIC_BUF, p);
    if (i === -1) break;
    magics.push(i);
    p = i + 4;
  }
  const valid = [];
  for (const m of magics) {
    try {
      zlib.zstdDecompressSync(buf.subarray(m, buf.length));
      valid.push(m);
    } catch { /* not a real frame start */ }
  }
  const parts = [];
  for (let k = 0; k < valid.length; k++) {
    const start = valid[k];
    const end = k + 1 < valid.length ? valid[k + 1] : buf.length;
    parts.push(zlib.zstdDecompressSync(buf.subarray(start, end)));
  }
  return Buffer.concat(parts);
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.jsonl.zstd')) acc.push(p);
  }
  return acc;
}

const SESS = process.argv[2] || 'C:/Users/qianz/.dsh/sessions/--D-~84DD~9CB8deepseek~5DE5~4F5C~533A--';
const OUT = process.argv[3] || 'D:/蓝鲸deepseek工作区/_migrate/raw';
fs.mkdirSync(OUT, { recursive: true });

const files = walk(SESS);
const summary = [];
for (const f of files) {
  const id = path.basename(path.dirname(f));
  const dest = path.join(OUT, id + '.jsonl');
  const raw = fs.readFileSync(f);
  try {
    const text = decompress(raw).toString('utf8');
    fs.writeFileSync(dest, text, 'utf8');
    summary.push({ id, compressed: raw.length, chars: text.length });
  } catch (err) {
    summary.push({ id, compressed: raw.length, error: String((err && err.message) || err) });
  }
}
summary.sort((a, b) => (b.chars || 0) - (a.chars || 0));
fs.writeFileSync('D:/蓝鲸deepseek工作区/_migrate/index2.json', JSON.stringify(summary, null, 1), 'utf8');
console.log(summary.map(s => `${s.id}\tcompressed=${s.compressed}\tchars=${s.chars ?? '-'}\t${s.error || ''}`).join('\n'));
