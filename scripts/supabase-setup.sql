-- Run this in Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE IF NOT EXISTS trading_executions (
    id SERIAL PRIMARY KEY,
    triggered_at timestamptz DEFAULT now(),
    status text,
    response text
);

CREATE OR REPLACE FUNCTION trigger_trading_api()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
    request_id bigint;
BEGIN
    SELECT net.http_post(
        url := 'https://your-app.vercel.app/api/trading-bot',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', 'your-super-secret-key-here'
        ),
        body := jsonb_build_object('triggered_at', now())
    ) INTO request_id;
    
    INSERT INTO trading_executions (status) VALUES ('triggered');
END;
\$\$;

SELECT cron.schedule('trading-trigger-29', '29 * * * *', 'SELECT trigger_trading_api();');
SELECT cron.schedule('trading-trigger-59', '59 * * * *', 'SELECT trigger_trading_api();');
