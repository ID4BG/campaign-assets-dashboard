// Section order per campaign (admin only). Body: { campaign, sections: [...], renameFrom? }
import { isAdmin } from '../lib/auth.js';
import { readMeta, writeMeta } from '../lib/store.js';
import { send, body } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') return send(res, 405, { error: 'Method not allowed' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Admin login required' });
  const { campaign, sections, renameFrom } = await body(req);
  const name = String(campaign || '').trim().slice(0, 120);
  if (!name || !Array.isArray(sections)) return send(res, 400, { error: 'campaign and sections are required' });
  try {
    const meta = await readMeta();
    if (renameFrom && renameFrom !== name) delete meta[renameFrom];
    meta[name] = { sections: [...new Set(sections.map((s) => String(s).trim().slice(0, 80)).filter(Boolean))] };
    await writeMeta(meta);
    return send(res, 200, { ok: true });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
