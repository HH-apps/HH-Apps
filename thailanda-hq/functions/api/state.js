// Thailanda HQ – datele comune (bife, note, starea rezervărilor).
// Rulează ca Cloudflare Pages Function la adresa /api/state.
// Are nevoie de un KV namespace legat cu numele TRIP_KV.
// Opțional: variabila ALLOWED_EMAILS = "a@x.com,b@y.com" (aceleași e-mailuri ca în Cloudflare Access).

const KEY = "state";
const MAX_BODY = 64 * 1024;

function who(request) {
  return (request.headers.get("cf-access-authenticated-user-email") || "").toLowerCase();
}

function allowed(env, email) {
  const list = (env.ALLOWED_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (!list.length) return true; // fără listă: protecția o face doar Cloudflare Access
  return list.includes(email);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function load(env) {
  const raw = await env.TRIP_KV.get(KEY);
  if (!raw) return { v: 0, data: {} };
  try { return JSON.parse(raw); } catch { return { v: 0, data: {} }; }
}

// path = ["checks","acte","tdac"]; value null = șterge
function applySet(data, path, value) {
  if (!Array.isArray(path) || !path.length || path.length > 6) return;
  if (path.some(p => typeof p !== "string" || !p || p.length > 80 || p === "__proto__" || p === "constructor" || p === "prototype")) return;
  let node = data;
  for (let i = 0; i < path.length - 1; i++) {
    if (typeof node[path[i]] !== "object" || node[path[i]] === null) node[path[i]] = {};
    node = node[path[i]];
  }
  const last = path[path.length - 1];
  if (value === null || value === undefined) delete node[last];
  else node[last] = value;
}

export async function onRequestGet({ request, env }) {
  const me = who(request);
  if (!allowed(env, me)) return json({ error: "forbidden" }, 403);
  if (!env.TRIP_KV) return json({ error: "TRIP_KV lipsește" }, 500);
  const st = await load(env);
  return json({ ...st, me });
}

export async function onRequestPost({ request, env }) {
  const me = who(request);
  if (!allowed(env, me)) return json({ error: "forbidden" }, 403);
  if (!env.TRIP_KV) return json({ error: "TRIP_KV lipsește" }, 500);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "prea mare" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "JSON invalid" }, 400); }
  const ops = Array.isArray(body.ops) ? body.ops.slice(0, 200) : [];
  const st = await load(env);
  for (const op of ops) {
    if (op && op.op === "set") applySet(st.data, op.path, op.value);
  }
  st.v = (st.v || 0) + 1;
  st.at = new Date().toISOString();
  await env.TRIP_KV.put(KEY, JSON.stringify(st));
  return json({ ...st, me });
}
