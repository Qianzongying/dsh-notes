import fs from 'node:fs';
const f = 'D:/蓝鲸deepseek工作区/_migrate/raw/session-22f22a78-fec7-40e9-9635-7a1b6be3b38b.jsonl';
const lines = fs.readFileSync(f, 'utf8').split('\n');
const want = ['tool/call', 'assistant/message', 'tool/result', 'user/message'];
const seen = new Set();
for (const ln of lines) {
  let o;
  try { o = JSON.parse(ln); } catch { continue; }
  const t = o.type;
  if (!want.includes(t) || seen.has(t)) continue;
  seen.add(t);
  console.log('==== ' + t + ' ====');
  console.log(JSON.stringify(o).slice(0, 2000));
  console.log();
}
