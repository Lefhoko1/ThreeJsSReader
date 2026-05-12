/**
 * Next.js API Route: POST /api/sync-candles
 * ─────────────────────────────────────────────────────────────────
 * Fetches 1000 x 30-min candles for all Volatility Indices from
 * Deriv WebSocket API and upserts them into Supabase.
 *
 * Protected by a secret key passed in the Authorization header.
 *
 * Trigger manually or via Supabase pg_net stored procedure.
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// ─── Config ───────────────────────────────────────────────────────
const DERIV_APP_ID = process.env.DERIV_APP_ID || 1089;
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const GRANULARITY = 1800; // 30 minutes
const COUNT = 1000;
const SYNC_SECRET = process.env.SYNC_SECRET; // shared secret for auth

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SYMBOLS = [
  { symbol: "R_100", table: "r_100" },
  { symbol: "R_75",  table: "r_75"  },
  { symbol: "R_50",  table: "r_50"  },
  { symbol: "R_25",  table: "r_25"  },
  { symbol: "R_10",  table: "r_10"  },
];
// ──────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Deriv: fetch candles via WebSocket ───────────────────────────
function fetchCandles(symbol) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let done = false;

    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        ws.terminate();
        reject(new Error(`Timeout fetching ${symbol}`));
      }
    }, 30_000);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          style: "candles",
          granularity: GRANULARITY,
          count: COUNT,
          end: "latest",
          adjust_start_time: 1,
        })
      );
    });

    ws.on("message", (data) => {
      let res;
      try { res = JSON.parse(data); } catch { return; }

      if (res.error) {
        clearTimeout(timeout);
        done = true;
        ws.close();
        return reject(new Error(res.error.message));
      }

      if (res.msg_type === "candles") {
        clearTimeout(timeout);
        done = true;
        ws.close();
        resolve(res.candles);
      }
    });

    ws.on("error", (err) => {
      if (!done) {
        done = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

// ─── Supabase: ensure table exists ────────────────────────────────
async function ensureTable(supabase, table) {
  const { error } = await supabase.rpc("execute_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS ${table} (
        id          BIGSERIAL   PRIMARY KEY,
        granularity INT         NOT NULL,
        epoch       BIGINT      NOT NULL,
        datetime    TIMESTAMPTZ NOT NULL,
        open        NUMERIC     NOT NULL,
        high        NUMERIC     NOT NULL,
        low         NUMERIC     NOT NULL,
        close       NUMERIC     NOT NULL,
        UNIQUE (granularity, epoch)
      );
      CREATE INDEX IF NOT EXISTS idx_${table}_epoch ON ${table} (epoch DESC);
    `,
  });
  if (error) throw new Error(`Table creation failed for "${table}": ${error.message}`);
}

// ─── Supabase: upsert candles ──────────────────────────────────────
async function upsertCandles(supabase, table, candles) {
  const rows = candles.map((c) => ({
    granularity: GRANULARITY,
    epoch: c.epoch,
    datetime: new Date(c.epoch * 1000).toISOString(),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
  }));

  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "granularity,epoch", ignoreDuplicates: false });

  if (error) throw new Error(`Upsert failed on "${table}": ${error.message}`);
  return rows.length;
}

// ─── Route handler ────────────────────────────────────────────────
export async function POST(req) {
  // ── Auth check ──
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!SYNC_SECRET || token !== SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Validate env ──
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const results = [];
  let totalInserted = 0;

  for (const { symbol, table } of SYMBOLS) {
    try {
      // 1. Ensure table exists
      await ensureTable(supabase, table);

      // 2. Fetch candles from Deriv
      const candles = await fetchCandles(symbol);

      // 3. Upsert into Supabase
      const inserted = await upsertCandles(supabase, table, candles);
      totalInserted += inserted;

      results.push({ symbol, table, status: "ok", inserted });
    } catch (err) {
      results.push({ symbol, table, status: "error", error: err.message });
    }

    await sleep(1500); // be nice to Deriv API between symbols
  }

  const hasErrors = results.some((r) => r.status === "error");

  return Response.json(
    {
      success: !hasErrors,
      totalInserted,
      results,
      syncedAt: new Date().toISOString(),
    },
    { status: hasErrors ? 207 : 200 } // 207 = partial success
  );
}