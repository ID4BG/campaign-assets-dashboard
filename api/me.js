import { isAdmin, publicView } from '../lib/auth.js';
import { storageMode } from '../lib/store.js';
import { send } from '../lib/http.js';

export default function handler(req, res) {
  return send(res, 200, { admin: isAdmin(req), publicView: publicView(), storage: storageMode() });
}
