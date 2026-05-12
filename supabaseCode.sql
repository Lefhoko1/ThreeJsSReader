CREATE OR REPLACE FUNCTION trigger_candle_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url     := 'https://three-js-s-reader.vercel.app/api/sync-candles',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer some-long-random-secret-string'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  INTO request_id;

  RETURN jsonb_build_object(
    'request_id', request_id,
    'triggered_at', now(),
    'endpoint', 'sync-candles'
  );
END;
$$;



//==============================================================================

CREATE OR REPLACE FUNCTION trigger_trading_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url     := 'https://three-js-s-reader.vercel.app/api/trading-bot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer some-long-random-secret-string'
    ),
    body    := jsonb_build_object(
      'trigger_source', 'postgres_cron',
      'triggered_by', current_user,
      'trigger_time', now()
    ),
    timeout_milliseconds := 120000  -- 2 minutes for trading cycle
  )
  INTO request_id;

  RETURN jsonb_build_object(
    'request_id', request_id,
    'triggered_at', now(),
    'endpoint', 'trading-cycle'
  );
END;
$$;

//=========================================================================================

CREATE OR REPLACE FUNCTION trigger_update_latest_candles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url     := 'https://three-js-s-reader.vercel.app/api/update-candles',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer some-long-random-secret-string'
    ),
    body    := jsonb_build_object(
      'candle_count', 1,
      'granularity', 1800
    ),
    timeout_milliseconds := 60000
  )
  INTO request_id;

  RETURN jsonb_build_object(
    'request_id', request_id,
    'triggered_at', now(),
    'endpoint', 'update-latest-candles'
  );
END;
$$;

//===================================================================================
CREATE OR REPLACE FUNCTION trigger_initialize_candles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url     := 'https://three-js-s-reader.vercel.app/api/init-candles',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer some-long-random-secret-string'
    ),
    body    := jsonb_build_object(
      'force_refresh', false,
      'trigger_reason', 'scheduled_maintenance'
    ),
    timeout_milliseconds := 180000  -- 3 minutes for full initialization
  )
  INTO request_id;

  RETURN jsonb_build_object(
    'request_id', request_id,
    'triggered_at', now(),
    'endpoint', 'initialize-candles'
  );
END;
$$;


//========================================================================================

//drop all tables

do $$ declare
    r record;
begin
    for r in (select tablename from pg_tables where schemaname = 'public') loop
        execute 'drop table if exists ' || quote_ident(r.tablename) || ' cascade';
    end loop;
end $$;


//triigger
-- Sync candles
SELECT trigger_candle_sync();

-- Run trading cycle
SELECT trigger_trading_cycle();

-- Update latest candles only
SELECT trigger_update_latest_candles();

-- Full initialization
SELECT trigger_initialize_candles();


//schedule with cron job
-- Sync candles every hour
SELECT cron.schedule(
  'sync-candles-hourly',
  '0 * * * *',  -- Every hour at minute 0
  'SELECT trigger_candle_sync();'
);

-- Run trading cycle every 30 minutes
SELECT cron.schedule(
  'trading-cycle-30min',
  '*/30 * * * *',  -- Every 30 minutes
  'SELECT trigger_trading_cycle();'
);

-- Update latest candles every 5 minutes (lightweight)
SELECT cron.schedule(
  'update-latest-candles-5min',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT trigger_update_latest_candles();'
);

-- Full initialization once a day at midnight
SELECT cron.schedule(
  'initialize-candles-daily',
  '0 0 * * *',  -- Midnight every day
  'SELECT trigger_initialize_candles();'
);