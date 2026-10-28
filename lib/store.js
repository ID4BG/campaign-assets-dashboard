// Storage: Upstash Redis (REST) in production, local JSON files in development.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const KEYS = { items: 'sb:campaign-assets', meta: 'sb:campaign-meta' };
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const localFile = (name) => path.join(process.cwd(), '.data', `${name}.json`);
const NOT_CONFIGURED = 'Storage not configured. Connect Upstash Redis in Vercel → Storage, then redeploy.';

async function redis(command) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || `Redis error ${r.status}`);
  return data.result;
}

export function storageMode() {
  return URL_ && TOKEN ? 'redis' : 'local-file';
}

async function read(name, fallback) {
  if (storageMode() === 'redis') {
    const raw = await redis(['GET', KEYS[name]]);
    return raw ? JSON.parse(raw) : fallback;
  }
  if (process.env.VERCEL) throw new Error(NOT_CONFIGURED);
  const file = localFile(name === 'items' ? 'assets' : name);
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function write(name, value) {
  if (storageMode() === 'redis') { await redis(['SET', KEYS[name], JSON.stringify(value)]); return; }
  if (process.env.VERCEL) throw new Error(NOT_CONFIGURED);
  const file = localFile(name === 'items' ? 'assets' : name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

export const readAll = () => read('items', []);
export const writeAll = (items) => write('items', items);
// meta = { [campaignName]: { sections: ['Production phases', 'Public links', ...] } }
export const readMeta = () => read('meta', {});
export const writeMeta = (meta) => write('meta', meta);
