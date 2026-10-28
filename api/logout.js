import { clearSession } from '../lib/auth.js';
import { send } from '../lib/http.js';

export default function handler(req, res) {
  clearSession(res);
  return send(res, 200, { ok: true });
}
