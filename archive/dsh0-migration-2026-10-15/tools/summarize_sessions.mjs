import fs from 'node:fs';
import path from 'node:path';

const RAW = 'D:/蓝鲸deepseek工作区/_migrate/raw';
const files = fs.readdirSync(RAW).filter(f => f.endsWith('.jsonl'));

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(x => {
      if (typeof x === 'string') return x;
      if (!x || typeof x !== 'object') return '';
      if (x.type === 'text' && typeof x.text === 'string') return x.text;
      if (typeof x.text === 'string') return x.text;
      if (x.type === 'tool_use') return `[tool_use ${x.name || ''}] ${JSON.stringify(x.input || {}).slice(0, 400)}`;
      if (x.type === 'tool_result') return `[tool_result] ${JSON.stringify(x.content).slice(0, 300)}`;
      return '';
    }).filter(Boolean).join('\n');
  }
  if (content && typeof content === 'object') return JSON.stringify(content).slice(0, 2000);
  return '';
}

const out = [];
for (const f of files) {
  const full = path.join(RAW, f);
  const lines = fs.readFileSync(full, 'utf8').split('\n').filter(Boolean);
  const users = [];
  let firstTs = null, lastTs = null;
  const typeCounts = new Map();
  for (const ln of lines) {
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const t = o.type || '?';
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    if (o.time) { if (!firstTs) firstTs = o.time; lastTs = o.time; }
    if (o.type === 'user/message' || (o.type && String(o.type).startsWith('user')) || o.role === 'user') {
      const raw2 = (o.data && (o.data.content ?? o.data.text ?? o.data.message)) ?? o.content ?? o.message;
      const txt = textOf(raw2).replace(/\s+/g, ' ').trim();
      if (txt && !txt.startsWith('[tool_result]')) users.push({ seq: o.seq ?? null, time: o.time ?? null, txt: txt.slice(0, 400) });
    }
    if (Array.isArray(o.inserted)) {
      for (const it of o.inserted) {
        const txt = textOf(it && (it.content ?? it.text)).replace(/\s+/g, ' ').trim();
        if (txt) users.push({ seq: o.seq ?? null, time: o.time ?? null, txt: '(spliced) ' + txt.slice(0, 400) });
      }
    }
  }
  out.push({
    file: f,
    lines: lines.length,
    firstTs,
    lastTs,
    types: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
    userCount: users.length,
    users: users.slice(0, 40),
  });
}
out.sort((a, b) => (a.firstTs || 0) - (b.firstTs || 0));
fs.writeFileSync('D:/蓝鲸deepseek工作区/_migrate/session_summaries.json', JSON.stringify(out, null, 1), 'utf8');
for (const s of out) {
  const d1 = s.firstTs ? new Date(s.firstTs).toISOString() : '-';
  console.log(`\n=== ${s.file} | lines=${s.lines} | users=${s.userCount} | ${d1}`);
  console.log('  types: ' + s.types.map(([k, v]) => `${k}:${v}`).join(', '));
  for (const u of s.users.slice(0, 12)) console.log('   U> ' + u.txt.slice(0, 220));
}
