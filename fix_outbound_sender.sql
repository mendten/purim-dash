-- This SQL script creates/repairs the webhook that sends outbound messages via Twilio.
-- When an outbound message is inserted to the messages table with status 'queued',
-- the txtSystem /api/send-outbound endpoint is called to deliver it.

-- First, let's check what the existing inbound_message_webhook function looks like:
-- Navigate to Database > Webhooks and look at https://txt-sys.vercel.app/api/inbound
-- The send-outbound (outbound) webhook should go to https://txt-sys.vercel.app/api/send-outbound

-- If the outbound sender was a Supabase webhook (not a trigger), re-create it here:
DROP TRIGGER IF EXISTS "outbound_message_sender" ON public.messages;
DROP FUNCTION IF EXISTS "http_request_outbound_sender";

CREATE OR REPLACE FUNCTION "http_request_outbound_sender"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_body json;
BEGIN
  -- Only trigger for outbound queued messages
  IF NEW.direction = 'outbound' AND NEW.status = 'queued' THEN
    request_body := json_build_object(
      'type', TG_OP,
      'record', row_to_json(NEW)
    );

    PERFORM net.http_post(
      url:='https://txt-sys.vercel.app/api/send-outbound',
      body:=request_body::jsonb,
      headers:='{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds:=10000
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "outbound_message_sender"
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION "http_request_outbound_sender"();
