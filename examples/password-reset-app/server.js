import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT ?? 3456);

/** @type {Map<string, { email: string, password: string, active: boolean, deleted: boolean }>} */
const usersByEmail = new Map();
/** @type {Map<string, { email: string, expiresAt: number, used: boolean }>} */
const tokens = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function issueToken(email) {
  const token = randomBytes(16).toString('hex');
  // MVP demo bug: we do NOT invalidate prior tokens (epistemic surprise target)
  tokens.set(token, {
    email,
    expiresAt: Date.now() + 15 * 60 * 1000,
    used: false,
  });
  return token;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/health') {
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/test/seed') {
      const body = await readBody(req);
      usersByEmail.set(body.email, {
        email: body.email,
        password: body.password,
        active: body.active !== false,
        deleted: false,
      });
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/test/delete-user') {
      const body = await readBody(req);
      const u = usersByEmail.get(body.email);
      if (!u) return json(res, 404, { error: 'not_found' });
      u.deleted = true;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/reset-request') {
      const body = await readBody(req);
      const u = usersByEmail.get(body.email);
      // Demo bug: deleted accounts still get 200 + email (should be forbidden)
      if (!u) {
        return json(res, 404, { error: 'user_not_found' });
      }
      const token = issueToken(body.email);
      return json(res, 200, { emailSent: true, token });
    }

    if (req.method === 'POST' && path === '/api/reset-complete') {
      const body = await readBody(req);
      const entry = tokens.get(body.token);
      if (!entry) return json(res, 400, { error: 'invalid_token' });
      if (entry.expiresAt < Date.now()) return json(res, 400, { error: 'expired_token' });
      if (entry.used) return json(res, 400, { error: 'used_token' });
      const user = usersByEmail.get(entry.email);
      if (!user || user.deleted) return json(res, 400, { error: 'invalid_user' });
      if (!isStrongPassword(body.password)) {
        return json(res, 400, { error: 'weak_password' });
      }
      entry.used = true;
      user.password = body.password;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Password Reset Demo</h1></body></html>');
      return;
    }

    json(res, 404, { error: 'not_found' });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
});

function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Password reset demo listening on http://127.0.0.1:${PORT}`);
});
