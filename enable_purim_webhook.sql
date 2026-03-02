-- This SQL creates a new Webhook in Supabase that sends inbound messages
-- specifically to the new Purim Dashboard router.

-- Drop the old trigger/function if you want to replace it entirely
DROP TRIGGER IF EXISTS "purim_router_webhook" ON public.messages;
DROP FUNCTION IF EXISTS "http_request_purim_router";

-- 1. Create the function that calls the Vercel API
CREATE OR REPLACE FUNCTION "http_request_purim_router"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_body json;
BEGIN
  -- Only trigger for inbound messages
  IF NEW.direction = 'inbound' THEN
    request_body := json_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );

    -- Call the Purim Dashboards /api/router
    PERFORM net.http_post(
      url:='https://purim86.vercel.app/api/router',
      body:=request_body::jsonb,
      headers:='{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds:=5000
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach the trigger to the messages table
CREATE TRIGGER "purim_router_webhook"
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION "http_request_purim_router"();
