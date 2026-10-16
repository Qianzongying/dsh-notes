import fs from 'node:fs';
import path from 'node:path';

const RAW = 'D:/蓝鲸deepseek工作区/_migrate/raw';
const OUT = 'D:/蓝鲸deepseek工作区/_migrate/extract';
fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(RAW).filter(f => f.endsWith('.jsonl'));

const NOISE_PREFIX = [
  'Current runtime context. This snapshot',
  'A skill is a reusable set of task-specific instructions',
  'MNEMON RUNTIME MEMORY SNAPSHOT',
  '[MNEMON] Search Documents',
  'The approval policy changed',
  'The available skill catalog changed',
  '<hindsight_knowledge',
];
function isNoise(s) {
  if (!s) return true;
  const t = s.trim();
  if (NOISE_PREFIX.some(n => t.startsWith(n))) return true;
  // skill-catalog dumps inside user messages
  if (t.includes('<available_skills>')) return true;
  return false;
}

function blocks(content) {
  const out = { text: [], reasoning: [], tools: [] };
  if (typeof content === 'string') { out.text.push(content); return out; }
  if (!Array.isArray(content)) return out;
  for (const b of content) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && typeof b.text === 'string') out.text.push(b.text);
    else if (b.type === 'reasoning' && typeof b.text === 'string') out.reasoning.push(b.text);
    else if (b.type === 'tool-call' || b.type === 'tool_use') {
      let args = b.arguments ?? b.input ?? '';
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch { /* keep string */ }
      }
      out.tools.push({ name: b.name || b.tool || '?', args });
    }
  }
  return out;
}

function argLine(o) {
  if (typeof o === 'string') return o.replace(/\s+/g, ' ').slice(0, 500);
  if (!o || typeof o !== 'object') return '';
  const order = ['description', 'command', 'file_path', 'filePath', 'path', 'pattern', 'glob', 'url', 'query', 'queries', 'prompt', 'old_string', 'new_string', 'content', 'name', 'source', 'topic', 'skill', 'key', 'value'];
  const parts = [];
  for (const k of order) {
    if (o[k] != null) {
      const v = (typeof o[k] === 'string' ? o[k] : JSON.stringify(o[k])).replace(/\s+/g, ' ');
      parts.push(`${k}=${v.slice(0, k === 'old_string' || k === 'new_string' || k === 'content' ? 120 : 400)}`);
    }
  }
  for (const k of Object.keys(o)) {
    if (order.includes(k)) continue;
    const v = (typeof o[k] === 'string' ? o[k] : JSON.stringify(o[k])).replace(/\s+/g, ' ');
    parts.push(`${k}=${v.slice(0, 200)}`);
  }
  return parts.join(' | ').slice(0, 1200);
}

for (const f of files) {
  const lines = fs.readFileSync(path.join(RAW, f), 'utf8').split('\n').filter(Boolean);
  const out = [];
  for (const ln of lines) {
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const t = o.type || '';
    if (t === 'user/message') {
      const b = blocks(o.data && o.data.content);
      const txt = b.text.join('\n').trim();
      if (txt && !isNoise(txt)) out.push(`\n=== [${o.seq}] USER ===\n${txt.slice(0, 8000)}`);
    } else if (t === 'assistant/message') {
      const b = blocks(o.data && o.data.message && o.data.message.content);
      const txt = b.text.join('\n').trim();
      if (txt && !isNoise(txt)) out.push(`\n=== [${o.seq}] ASSISTANT ===\n${txt.slice(0, 5000)}`);
      for (const tc of b.tools) out.push(`  [${o.seq}] tool:${tc.name} ${argLine(tc.args)}`);
    } else if (t === 'tool/call') {
      const d = o.data || {};
      let args = d.arguments ?? d.input ?? '';
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch { /* keep */ } }
      out.push(`  [${o.seq}] tool:${d.name || '?'} ${argLine(args)}`);
    } else if (t === 'tool/result') {
      const msg = (o.data && o.data.message) || {};
      const b = blocks(msg.content);
      let txt = b.text.join('\n').trim();
      if (!txt) continue;
      const err = msg.isError ? 'ERROR ' : '';
      out.push(`  [${o.seq}] result ${err}${txt.slice(0, 1000).replace(/\n{2,}/g, '\n')}`);
    }
  }
  const dest = path.join(OUT, f.replace(/\.jsonl$/, '.txt'));
  fs.writeFileSync(dest, out.join('\n'), 'utf8');
  console.log(`${f}\t${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
}
