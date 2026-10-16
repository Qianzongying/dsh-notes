import fs from 'node:fs';
const f = 'D:/蓝鲸deepseek工作区/_migrate/raw/session-22f22a78-fec7-40e9-9635-7a1b6be3b38b.jsonl';
const out = [];
for (const ln of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!ln.includes('compress')) continue;
  let o;
  try { o = JSON.parse(ln); } catch { continue; }
  if (o.type !== 'assistant/message' && o.type !== 'tool/call') continue;
  const msg = o.data && (o.data.message || o.data);
  const content = msg && msg.content;
  if (!Array.isArray(content)) continue;
  for (const b of content) {
    if (b && (b.type === 'tool-call') && (b.name === 'compress' || b.name === 'bili_compress')) {
      let a = b.arguments;
      if (typeof a === 'string') { try { a = JSON.parse(a); } catch { /* keep */ } }
      let c = a && a.content;
      if (typeof c === 'string') {
        try { c = JSON.parse(c); } catch { /* keep as string */ }
      }
      if (Array.isArray(c)) {
        for (const item of c) {
          if (typeof item === 'string') out.push(item);
          else if (item && item.summary) out.push(`### ${item.startId || item.startRef}–${item.endId || item.endRef} ${item.topic || ''}\n${item.summary}`);
        }
      } else if (a && a.summary) {
        out.push(`### ${a.startId}–${a.endId} ${a.topic || ''}\n${a.summary}`);
      }
    }
  }
}
fs.writeFileSync('D:/蓝鲸deepseek工作区/_migrate/findings/compression-summaries-session22f22a78.md', out.join('\n\n---\n\n'), 'utf8');
console.log('blocks:', out.length, 'chars:', out.join('').length);
