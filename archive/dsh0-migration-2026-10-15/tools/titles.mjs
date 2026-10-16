import fs from 'node:fs';
import path from 'node:path';

const RAW = 'D:/蓝鲸deepseek工作区/_migrate/raw';
const files = fs.readdirSync(RAW).filter(f => f.endsWith('.jsonl'));
for (const f of files) {
  const text = fs.readFileSync(path.join(RAW, f), 'utf8');
  const titles = [];
  for (const ln of text.split('\n')) {
    if (!ln.includes('"session/title"') && !ln.includes('"session"') && !ln.includes('session/title')) continue;
    try {
      const o = JSON.parse(ln);
      const t = o.type || '';
      if (t === 'session/title') titles.push(JSON.stringify(o.data ?? o));
      if (t === 'session') titles.push('META ' + JSON.stringify(o));
    } catch { /* ignore */ }
  }
  if (titles.length) console.log('\n### ' + f + '\n' + titles.join('\n'));
}
