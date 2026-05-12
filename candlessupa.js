/**
 * Deriv → Supabase Candle Sync
 * ─────────────────────────────────────────────────────────────────
 * Fetches 1000 x 30-min candles for all Volatility Indices from
 * the Deriv WebSocket API and upserts them into Supabase.
 *
 * Each symbol gets its own table (e.g. r_100, r_75, r_50 …).
 * Tables are auto-created if they don't exist.
 *
 * Setup:
 *   1.  npm install ws @supabase/supabase-js dotenv
 *   2.  Create a .env file (see bottom of this file for template)
 *   3.  node deriv_supabase_sync.js
 * ─────────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");

// ─── Config ───────────────────────────────────────────────────────
const DERIV_APP_ID = process.env.DERIV_APP_ID || 1089; // public demo app_id
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const GRANULARITY = 1800; // 30 minutes in seconds
const COUNT = 1000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role key (bypasses RLS)

// All Volatility Indices  →  { symbol, tableName }
const SYMBOLS = [
  { symbol: "R_100", table: "r_100" },
  { symbol: "R_75",  table: "r_75"  },
  { symbol: "R_50",  table: "r_50"  },
  { symbol: "R_25",  table: "r_25"  },
  { symbol: "R_10",  table: "r_10"  },
];
// ──────────────────────────────────────────────────────────────────

// ─── Validate env ─────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────
function formatDate(epoch) {
  return new Date(epoch * 1000).toISOString().replace("T", " ").replace("Z", "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(symbol, msg) {
  console.log(`[${symbol.padEnd(5)}] ${msg}`);
}

// ─── Supabase: ensure table exists ────────────────────────────────
async function ensureTable(table) {
  // Use Supabase's rpc to run raw SQL (requires execute_sql function,
  // OR we use the REST approach below which is simpler)
  //
  // Supabase doesn't expose raw DDL via the JS client directly,
  // so we call the SQL Editor REST endpoint with the service role key.
  const sql = `
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
  `;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    // Fallback: try the /sql endpoint (Supabase Management API, requires project ref)
    // If this also fails, guide user to create tables manually via Supabase SQL editor
    const err = await res.text();
    throw new Error(`Table creation failed for "${table}": ${err}`);
  }
}

// ─── Supabase: upsert candles ──────────────────────────────────────
async function upsertCandles(table, candles) {
  const rows = candles.map((c) => ({
    granularity: GRANULARITY,
    epoch: c.epoch,
    datetime: new Date(c.epoch * 1000).toISOString(),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
  }));

  const { error, count } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "granularity,epoch", ignoreDuplicates: false })
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(`Upsert error on "${table}": ${error.message}`);
  return rows.length;
}

// ─── Deriv: fetch candles via WebSocket ───────────────────────────
function fetchCandles(symbol) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
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
        resolved = true;
        ws.close();
        return reject(new Error(res.error.message));
      }

      if (res.msg_type === "candles") {
        clearTimeout(timeout);
        resolved = true;
        ws.close();
        resolve(res.candles);
      }
    });

    ws.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║       Deriv → Supabase  |  Volatility Indices        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  let totalInserted = 0;
  const results = [];

  for (const { symbol, table } of SYMBOLS) {
    console.log(`\n▶  Processing ${symbol}  (table: ${table})`);

    // 1. Ensure table exists
    try {
      log(symbol, "Ensuring table exists...");
      await ensureTable(table);
      log(symbol, "✅ Table ready");
    } catch (err) {
      log(symbol, `⚠️  ${err.message}`);
      log(symbol, "   → Create the table manually in Supabase SQL Editor (see README below)");
      results.push({ symbol, status: "table_error", inserted: 0 });
      continue;
    }

    // 2. Fetch candles from Deriv
    let candles;
    try {
      log(symbol, `Fetching ${COUNT} candles from Deriv...`);
      candles = await fetchCandles(symbol);
      log(symbol, `✅ Received ${candles.length} candles  (${formatDate(candles[0].epoch)} → ${formatDate(candles[candles.length - 1].epoch)})`);
    } catch (err) {
      log(symbol, `❌ Fetch failed: ${err.message}`);
      results.push({ symbol, status: "fetch_error", inserted: 0 });
      continue;
    }

    // 3. Upsert into Supabase
    try {
      log(symbol, "Upserting into Supabase...");
      const inserted = await upsertCandles(table, candles);
      log(symbol, `✅ Upserted ${inserted} rows`);
      totalInserted += inserted;
      results.push({ symbol, status: "ok", inserted });
    } catch (err) {
      log(symbol, `❌ Upsert failed: ${err.message}`);
      results.push({ symbol, status: "upsert_error", inserted: 0 });
    }

    // small delay between symbols to be nice to the Deriv API
    await sleep(1500);
  }

  // ─── Summary ────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                      SUMMARY                         ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  for (const r of results) {
    const icon = r.status === "ok" ? "✅" : "❌";
    console.log(`  ${icon}  ${r.symbol.padEnd(6)} → ${r.status}  (${r.inserted} rows)`);
  }
  console.log(`\n  Total rows upserted: ${totalInserted}`);
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

/*
 * ═══════════════════════════════════════════════════════════════════
 *  .env template  –  create this file in the same folder
 * ═══════════════════════════════════════════════════════════════════
 *
 *  SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
 *  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *  DERIV_APP_ID=1089
 *
 * ═══════════════════════════════════════════════════════════════════
 *  Manual table creation (if auto-create fails)
 *  Run this in Supabase → SQL Editor for each symbol
 * ═══════════════════════════════════════════════════════════════════
 *
 *  CREATE TABLE IF NOT EXISTS r_100 (
 *    id          BIGSERIAL   PRIMARY KEY,
 *    granularity INT         NOT NULL,
 *    epoch       BIGINT      NOT NULL,
 *    datetime    TIMESTAMPTZ NOT NULL,
 *    open        NUMERIC     NOT NULL,
 *    high        NUMERIC     NOT NULL,
 *    low         NUMERIC     NOT NULL,
 *    close       NUMERIC     NOT NULL,
 *    UNIQUE (granularity, epoch)
 *  );
 *  CREATE INDEX IF NOT EXISTS idx_r_100_epoch ON r_100 (epoch DESC);
 *
 *  -- Repeat for r_75, r_50, r_25, r_10
 *
 * ═══════════════════════════════════════════════════════════════════
 *  Supabase: enable execute_sql RPC (needed for auto table creation)
 *  Run once in Supabase → SQL Editor:
 * ═══════════════════════════════════════════════════════════════════
 *
 *  CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
 *  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
 *  BEGIN
 *    EXECUTE sql;
 *  END;
 *  $$;
 *
 * ═══════════════════════════════════════════════════════════════════
 */