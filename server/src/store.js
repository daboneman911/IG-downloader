import crypto from 'node:crypto';

// In-memory map of info-id -> resolved metadata. The download endpoint takes an id rather than a
// raw URL so clients can only download what /api/info already validated. Single-instance only;
// swap for Redis if you ever run more than one server replica.
const entries = new Map();

export function put(info, ttlMs) {
  const id = crypto.randomBytes(12).toString('base64url');
  entries.set(id, { info, expires: Date.now() + ttlMs });
  return id;
}

export function get(id) {
  const e = entries.get(id);
  if (!e) return null;
  if (e.expires < Date.now()) {
    entries.delete(id);
    return null;
  }
  return e.info;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, e] of entries) if (e.expires < now) entries.delete(id);
}, 60_000).unref();
