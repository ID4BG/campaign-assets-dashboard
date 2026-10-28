import crypto from 'node:crypto';
import { isAdmin, publicView } from '../lib/auth.js';
import { readAll, writeAll, readMeta } from '../lib/store.js';
import { deleteBlob } from '../lib/files.js';
import { send, body } from '../lib/http.js';

// Order here = order of items inside each section.
const TYPES = ['Brief', 'Final copy', 'Design', 'Document',
  'Landing page', 'Article', 'Social post', 'Press release', 'Banner', 'Video', 'Email', 'Other'];
export const DEFAULT_SECTION = 'Public links';
const SECTIONS = ['Production phases', 'Public links'];
const CHANNELS = ['Website', 'Landing page', 'Facebook', 'Instagram', 'LinkedIn', 'PR', 'Stand banner'];

function cleanChannels(input) {
  const raw = Array.isArray(input.channels) ? input.channels : String(input.channel || '').split(',');
  return [...new Set(raw.map((c) => String(c).trim().slice(0, 60)).filter(Boolean))].slice(0, 15);
}
const withDefaults = ({ channel, ...i }) => ({
  section: DEFAULT_SECTION, visibility: 'everyone', ...i,
  channels: Array.isArray(i.channels) ? i.channels : cleanChannels({ channel }),
});

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);

function clean(input) {
  const url = str(input.url, 2000);
  let ok = false;
  try { ok = ['http:', 'https:'].includes(new URL(url).protocol); } catch {}
  if (!ok) throw new Error('Please add a public link (http:// or https://) or upload a file');
  const campaign = str(input.campaign, 120);
  if (!campaign) throw new Error('Campaign is required');
  return {
    campaign,
    section: str(input.section, 80) || DEFAULT_SECTION,
    visibility: input.visibility === 'admin' ? 'admin' : 'everyone',
    type: TYPES.includes(input.type) ? input.type : 'Other',
    title: str(input.title, 200),
    url,
    fileName: str(input.fileName, 200),
    fileSize: Number.isFinite(+input.fileSize) && input.fileName ? +input.fileSize : 0,
    channels: cleanChannels(input),
    publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(input.publishedAt || '') ? input.publishedAt : '',
  };
}

export default async function handler(req, res) {
  const admin = isAdmin(req);
  try {
    if (req.method === 'GET') {
      if (!admin && !publicView()) return send(res, 401, { error: 'Login required' });
      let items = (await readAll()).map(withDefaults);
      if (!admin) items = items.filter((i) => i.visibility !== 'admin');
      return send(res, 200, { items, types: TYPES, sections: SECTIONS, channels: CHANNELS, meta: await readMeta(), defaultSection: DEFAULT_SECTION });
    }

    if (!admin) return send(res, 401, { error: 'Admin login required' });
    const data = await body(req);
    const items = await readAll();
    const now = new Date().toISOString();

    if (req.method === 'POST') {
      const item = { id: crypto.randomUUID(), ...clean(data), createdAt: now, updatedAt: now };
      items.push(item);
      await writeAll(items);
      return send(res, 201, { item });
    }

    if (req.method === 'PUT') {
      const i = items.findIndex((x) => x.id === data.id);
      if (i < 0) return send(res, 404, { error: 'Not found' });
      const { channel, ...prev } = items[i]; // drop legacy single-channel field
      const next = { ...prev, ...clean(data), updatedAt: now };
      if (items[i].url !== next.url) await deleteBlob(items[i].url); // file replaced
      items[i] = next;
      await writeAll(items);
      return send(res, 200, { item: next });
    }

    if (req.method === 'DELETE') {
      const id = data.id || new URL(req.url, 'http://x').searchParams.get('id');
      const item = items.find((x) => x.id === id);
      if (!item) return send(res, 404, { error: 'Not found' });
      await writeAll(items.filter((x) => x.id !== id));
      await deleteBlob(item.url);
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    const status = /valid|required|Please/i.test(e.message) ? 400 : 500;
    return send(res, status, { error: e.message });
  }
}
