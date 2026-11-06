// API ฐานข้อมูลกลางของระบบ เก็บใน Netlify Blobs (ไม่ต้องใช้บริการภายนอก)
import { getStore } from "@netlify/blobs";

const COLS = ["requests", "teachers", "accounts", "roles"];
const ID_RE = /^[A-Za-z0-9_.\-]{1,120}$/;
const MAX_BODY = 200 * 1024;

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export default async (req) => {
  const store = getStore({ name: "mf-data", consistency: "strong" });
  const db = (await store.get("db", { type: "json" })) || { v: 1, data: {} };

  if (req.method === "GET") {
    const v = Number(new URL(req.url).searchParams.get("v")) || 0;
    if (v === db.v) return json({ v: db.v, same: true });
    return json({ v: db.v, data: db.data });
  }

  if (req.method === "POST") {
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: "too large" }, 413);
    let b;
    try { b = JSON.parse(text); } catch { return json({ error: "bad json" }, 400); }
    const { op, c, id, data } = b || {};
    if (!COLS.includes(c) || typeof id !== "string" || !ID_RE.test(id)) return json({ error: "bad target" }, 400);
    const col = (db.data[c] = db.data[c] || {});
    if (op === "set" || op === "update") {
      if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "bad data" }, 400);
      col[id] = op === "set" ? data : { ...(col[id] || {}), ...data };
    } else if (op === "delete") {
      delete col[id];
    } else {
      return json({ error: "bad op" }, 400);
    }
    db.v = Math.max(Date.now(), db.v + 1);
    await store.setJSON("db", db);
    return json({ v: db.v });
  }
  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api" };
