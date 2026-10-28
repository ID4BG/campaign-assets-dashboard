// Issues short-lived upload tokens so the browser can upload files straight to Vercel Blob (no size limit from the function).
import { isAdmin } from '../lib/auth.js';
import { send, body } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return send(res, 500, { error: 'File storage is not connected. In Vercel: Storage → Create → Blob, connect it to this project, then redeploy.' });
  }
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
    return send(res, 400, { error: e.message });
  }
}
