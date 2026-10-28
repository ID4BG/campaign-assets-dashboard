// Minimal admin auth: password from env var, HMAC-signed HttpOnly cookie.
import crypto from 'node:crypto';

const COOKIE = 'sb_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = (v) => crypto.createHmac('sha256', secret()).update(v).digest('base64url');

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkLogin(username, pw) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const user = process.env.ADMIN_USERNAME || 'admin';
  const okUser = safeEqual(String(username || '').trim().toLowerCase(), user.toLowerCase());
  const okPw = safeEqual(pw || '', expected);
  return okUser && okPw;
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function isAdmin(req) {
  if (!secret()) return false;
  const token = parseCookies(req)[COOKIE];
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch { return false; }
}

const secureFlag = () => (process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '');

export function setSession(res) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  res.setHeader('Set-Cookie',
    `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secureFlag()}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag()}`);
}

export const publicView = () => String(process.env.PUBLIC_VIEW ?? 'true').toLowerCase() !== 'false';
