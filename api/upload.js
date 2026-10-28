// Issues short-lived upload tokens so the browser can upload files straight to Vercel Blob.
// GET /api/upload = setup check (tells you what is missing).
import { isAdmin } from '../lib/auth.js';
import { send, body } from '../lib/http.js';

const NOT_CONNECTED = 'File storage is not connected: BLOB_READ_WRITE_TOKEN is missing. In Vercel: Storage → Create Database → Blob (Public), connect it to this project, then Redeploy.';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const status = { admin: isAdmin(req), blobToken: !!process.env.BLOB_READ_WRITE_TOKEN, blobPackage: false };
    try { await import('@vercel/blob/client'); status.blobPackage = true; } catch (e) { status.packageError = e.message; }
    status.ok = status.admin && status.blobToken && status.blobPackage;
    status.error = !status.admin ? 'You are not logged in as admin (or your session expired). Log out and log in again.'
      : !status.blobToken ? NOT_CONNECTED
      : !status.blobPackage ? 'The @vercel/blob package is not installed. Make sure package.json is in the project root on GitHub, then Redeploy.'
      : null;
    return send(res, 200, status);
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 500, { error: NOT_CONNECTED });
  try {
    const { handleUpload } = await import('@vercel/blob/client');
    const json = await handleUpload({
      body: await body(req),
      request: req,
      onBeforeGenerateToken: async () => {
        if (!isAdmin(req)) throw new Error('Admin login required');
        return { addRandomSuffix: true, maximumSizeInBytes: 500 * 1024 * 1024 };
      },
    });
    return send(res, 200, json);
  } catch (e) {
    console.error('upload token error:', e);
    return send(res, 400, { error: e.message });
  }
}
