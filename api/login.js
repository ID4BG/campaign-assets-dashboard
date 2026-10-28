import { checkLogin, setSession } from '../lib/auth.js';
import { send, body } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!process.env.ADMIN_PASSWORD) return send(res, 500, { error: 'ADMIN_PASSWORD is not set on the server.' });
  const { username, password } = await body(req);
  if (!checkLogin(username, password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return send(res, 401, { error: 'Wrong username or password' });
  }
  setSession(res);
  return send(res, 200, { ok: true });
}
