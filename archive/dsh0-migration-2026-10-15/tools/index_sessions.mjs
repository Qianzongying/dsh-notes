import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SESS = 'C:/Users/qianz/.dsh/sessions/--D-~84DD~9CB8deepseek~5DE5~4F5C~533A--';
const OUT = 'D:/蓝鲸deepseek工作区/_migrate/raw';
fs.mkdirSync(OUT, { recursive: true });

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.jsonl.zstd')) acc.push(p);
  }
  return acc;
}

const files = walk(SESS);
const rows = [];
for (const f of files) {
  const id = path.basename(path.dirname(f));
  let text;
  try {
    text = zlib.zstdDecompressSync(fs.readFileSync(f)).toString('utf8');
  } catch (err) {
    rows.push({ id, error: String(err) });
    continue;
  }
  const outFile = path.join(OUT, id + '.jsonl');
  fs.writeFileSync(outFile, text, 'utf8');

  const lines = text.split('\n').filter(Boolean);
  let userMsgs = [];
  let firstTs = null, lastTs = null;
  let chars = 0;
  for (const ln of lines) {
    chars += ln.length;
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const ts = o.timestamp || o.ts || o.createdAt || (o.message && o.message.timestamp);
    if (ts) { if (!firstTs) firstTs = ts; lastTs = ts; }
    const role = o.role || (o.message && o.message.role) || o.type;
    if (role === 'user') {
      let c = o.content ?? (o.message && o.message.content);
      if (Array.isArray(c)) c = c.map(x => (typeof x === 'string' ? x : (x.text || x.type || ''))).join(' ');
      if (typeof c === 'string' && c.trim()) userMsgs.push(c.replace(/\s+/g, ' ').slice(0, 160));
    }
  }
  rows.push({
    id,
    lines: lines.length,
    chars,
    firstTs, lastTs,
    userCount: userMsgs.length,
    firstUsers: userMsgs.slice(0, 8),
  });
}
rows.sort((a, b) => String(a.firstTs || '').localeCompare(String(b.firstTs || '')));
const out = rows.map(r => JSON.stringify(r)).join('\n');
fs.writeFileSync('D:/蓝鲸deepseek工作区/_migrate/index.jsonl', out, 'utf8');
console.log('files:', files.length);
console.log(out);
