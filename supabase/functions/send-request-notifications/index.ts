import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestRecord = {
  id: string;
  request_number: string;
  supporter_nickname: string;
  contact_email: string;
  tier: string;
  category: string;
  created_at: string;
};

type Delivery = {
  id: string;
  recipient_kind: "customer" | "owner";
  attempt_count: number;
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function emailForCustomer(request: RequestRecord, customerEmail: string) {
  const requestNumber = escapeHtml(request.request_number);
  const nickname = escapeHtml(request.supporter_nickname);
  const category = escapeHtml(request.category);

  return {
    to: customerEmail,
    subject: `We received your request #${request.request_number}`,
    html: `<h1>Request received</h1><p>Hi ${nickname},</p><p>Your <strong>${category}</strong> request has been received.</p><p>Your request ID is <strong>#${requestNumber}</strong>. Keep it for your records.</p><p>Hidden Lewd Studio</p>`,
  };
}

function emailForOwner(request: RequestRecord, ownerEmail: string) {
  const requestNumber = escapeHtml(request.request_number);
  const nickname = escapeHtml(request.supporter_nickname);
  const email = escapeHtml(request.contact_email);
  const category = escapeHtml(request.category);
  const tier = escapeHtml(request.tier);

  return {
    to: ownerEmail,
    subject: `New request #${request.request_number}`,
    html: `<h1>New request received</h1><p><strong>Request:</strong> #${requestNumber}</p><p><strong>Supporter:</strong> ${nickname}</p><p><strong>Contact:</strong> ${email}</p><p><strong>Tier:</strong> ${tier}</p><p><strong>Category:</strong> ${category}</p>`,
  };
}

async function sendWithResend(
  apiKey: string,
  from: string,
  idempotencyKey: string,
  message: { to: string; subject: string; html: string },
) {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, ...message }),
  });
  const body = (await resendResponse.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };

  if (!resendResponse.ok || !body.id) {
    throw new Error(body.message || `Email provider returned HTTP ${resendResponse.status}.`);
  }
  return body.id;
}

function mailbox(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { Name: match[1], Email: match[2] } : { Email: value };
}

async function sendWithMailpit(
  mailpitUrl: string,
  from: string,
  message: { to: string; subject: string; html: string },
) {
  const mailpitResponse = await fetch(`${mailpitUrl.replace(/\/$/, "")}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: mailbox(from),
      To: [mailbox(message.to)],
      Subject: message.subject,
      HTML: message.html,
    }),
  });
  if (!mailpitResponse.ok) throw new Error(`Mailpit returned HTTP ${mailpitResponse.status}.`);
  return `mailpit-${crypto.randomUUID()}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const notificationDeliveryEnabled = Deno.env.get("NOTIFICATION_DELIVERY_ENABLED") === "true";
  const mailpitUrl = Deno.env.get("MAILPIT_URL");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const ownerEmail = Deno.env.get("OWNER_NOTIFICATION_EMAIL");
  const from = Deno.env.get("EMAIL_FROM");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "Server configuration is incomplete." }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) return response({ error: "Unauthorized." }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) return response({ error: "Unauthorized." }, 401);
  if (!user.email) return response({ error: "Your account needs a verified email address." }, 400);

  const body = (await request.json().catch(() => null)) as { requestId?: unknown } | null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    return response({ error: "A valid request ID is required." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: requestRecord, error: requestError } = await adminClient
    .from("requests")
    .select("id, request_number, supporter_nickname, contact_email, tier, category, created_at")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .single<RequestRecord>();
  if (requestError || !requestRecord) return response({ error: "Request not found." }, 404);

  if (!notificationDeliveryEnabled) {
    return response(
      {
        sent: [],
        failed: [],
        skipped: true,
        message: "Notification delivery is disabled in this environment.",
      },
      202,
    );
  }

  if ((!resendApiKey && !mailpitUrl) || !ownerEmail || !from) {
    return response(
      { error: "Request saved, but notification delivery is not configured yet." },
      503,
    );
  }

  const { data: pendingDeliveries, error: deliveryError } = await adminClient
    .from("request_notification_deliveries")
    .select("id, recipient_kind, attempt_count")
    .eq("request_id", requestId)
    .in("status", ["pending", "failed"]);
  if (deliveryError) return response({ error: "Could not load notification jobs." }, 500);

  const sent: string[] = [];
  const failed: string[] = [];
  for (const delivery of (pendingDeliveries ?? []) as Delivery[]) {
    const { data: claimed } = await adminClient
      .from("request_notification_deliveries")
      .update({
        status: "processing",
        attempt_count: delivery.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", delivery.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const message =
        delivery.recipient_kind === "customer"
          ? emailForCustomer(requestRecord, user.email)
          : emailForOwner(requestRecord, ownerEmail);
      const providerMessageId = mailpitUrl
        ? await sendWithMailpit(mailpitUrl, from, message)
        : await sendWithResend(
            resendApiKey as string,
            from,
            `${requestId}:${delivery.recipient_kind}`,
            message,
          );
      await adminClient
        .from("request_notification_deliveries")
        .update({
          status: "sent",
          provider_message_id: providerMessageId,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", delivery.id);
      sent.push(delivery.recipient_kind);
    } catch (error) {
      await adminClient
        .from("request_notification_deliveries")
        .update({
          status: "failed",
          last_error:
            error instanceof Error ? error.message.slice(0, 500) : "Unknown provider error.",
        })
        .eq("id", delivery.id);
      failed.push(delivery.recipient_kind);
    }
  }

  return response({ sent, failed });
});
