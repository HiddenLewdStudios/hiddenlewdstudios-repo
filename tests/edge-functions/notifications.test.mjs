import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../../supabase/functions/send-request-notifications/index.ts", import.meta.url),
  "utf8",
);

async function createHandler(envOverrides = {}, dbOverrides = {}, fetchHandler) {
  let handler;
  const env = {
    SUPABASE_URL: "https://mock.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    NOTIFICATION_DELIVERY_ENABLED: "true",
    RESEND_API_KEY: "resend_test_key",
    OWNER_NOTIFICATION_EMAIL: "owner@example.test",
    EMAIL_FROM: "Studio <studio@example.test>",
    ...envOverrides,
  };

  const dbState = {
    user: {
      id: "user-123",
      email: "customer@example.test",
      app_metadata: { role: "customer" },
    },
    templates: {
      customer_request_received: {
        id: "tpl-v1",
        subject: "Request {{request_number}} confirmed",
        html_body: "<p>Hello {{supporter_nickname}}, tier {{tier}} received!</p>",
      },
      owner_new_request: {
        id: "tpl-v2",
        subject: "New request {{request_number}}",
        html_body: "<p>New order from {{supporter_nickname}} ({{contact_email}})</p>",
      },
    },
    requests: {
      "a0000000-0000-4000-8000-000000000001": {
        id: "a0000000-0000-4000-8000-000000000001",
        request_number: "HLS-REQ-000001",
        supporter_nickname: "NarutoFan",
        contact_email: "customer@example.test",
        tier: "Chunin",
        category: "Illustration",
        created_at: "2026-11-24T12:00:00Z",
      },
    },
    deliveries: [
      { id: "del-1", recipient_kind: "customer", attempt_count: 0, status: "pending" },
      { id: "del-2", recipient_kind: "owner", attempt_count: 0, status: "pending" },
    ],
    updates: [],
    ...dbOverrides,
  };

  const createMockDb = (_isServiceRole = false) => {
    return {
      auth: {
        async getUser() {
          if (dbState.authError) return { data: { user: null }, error: new Error("Unauthorized") };
          return { data: { user: dbState.user }, error: null };
        },
      },
      from(table) {
        if (table === "email_templates") {
          return {
            select() {
              return this;
            },
            eq(_field, key) {
              const tpl = dbState.templates[key];
              return {
                async single() {
                  if (!tpl) return { data: null, error: new Error("Template not found") };
                  return { data: { current_version_id: tpl.id }, error: null };
                },
              };
            },
          };
        }

        if (table === "email_template_versions") {
          return {
            select() {
              return this;
            },
            eq(_field, id) {
              const tpl = Object.values(dbState.templates).find((t) => t.id === id);
              return {
                async single() {
                  if (!tpl) return { data: null, error: new Error("Version not found") };
                  return { data: { subject: tpl.subject, html_body: tpl.html_body }, error: null };
                },
              };
            },
          };
        }

        if (table === "requests") {
          return {
            select() {
              return this;
            },
            eq(field, value) {
              this[field] = value;
              return this;
            },
            async single() {
              const req = dbState.requests[this.id];
              if (!req) return { data: null, error: new Error("Not found") };
              return { data: req, error: null };
            },
          };
        }

        if (table === "request_notification_deliveries") {
          return {
            select() {
              return this;
            },
            eq(_field, _val) {
              return this;
            },
            in(_field, _statuses) {
              return Promise.resolve({ data: dbState.deliveries, error: null });
            },
            update(fields) {
              dbState.updates.push(fields);
              return {
                eq(_f, _id) {
                  return this;
                },
                in() {
                  return this;
                },
                select() {
                  return this;
                },
                async maybeSingle() {
                  return { data: { id: "del-claimed" }, error: null };
                },
                then(resolve) {
                  return Promise.resolve({ data: null, error: null }).then(resolve);
                },
              };
            },
          };
        }

        throw new Error("Unhandled mock table: " + table);
      },
    };
  };

  const defaultFetch = async (url) => {
    if (url.includes("api.resend.com")) {
      return Response.json({ id: "resend-mock-id" }, { status: 200 });
    }
    if (url.includes("/api/v1/send")) {
      return new Response("ok", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const transport = fetchHandler || defaultFetch;

  const context = vm.createContext({
    URL,
    AbortSignal,
    Response,
    Request,
    Headers,
    TextEncoder,
    crypto: webcrypto,
    fetch: transport,
    Deno: {
      env: { get: (key) => env[key] },
      serve: (callback) => {
        handler = callback;
      },
    },
  });

  const imports = {
    "npm:@supabase/supabase-js@2.119.0": {
      createClient: (_url, key) => createMockDb(key === env.SUPABASE_SERVICE_ROLE_KEY),
    },
  };

  const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
  await module.link((name) => {
    assert.ok(Object.hasOwn(imports, name), "Unreviewed dependency: " + name);
    const exports = imports[name];
    return new vm.SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      },
      { context },
    );
  });

  await module.evaluate();
  return { handler, dbState };
}

test("OPTIONS returns 200 with CORS headers", async () => {
  const { handler } = await createHandler();
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "OPTIONS",
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});

test("Non-POST request returns 405 Method Not Allowed", async () => {
  const { handler } = await createHandler();
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "GET",
    }),
  );
  assert.equal(res.status, 405);
  const json = await res.json();
  assert.equal(json.error, "Method not allowed.");
});

test("Incomplete server configuration returns 500", async () => {
  const { handler } = await createHandler({ SUPABASE_URL: "" });
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer test" },
    }),
  );
  assert.equal(res.status, 500);
});

test("Missing or malformed Authorization header returns 401", async () => {
  const { handler } = await createHandler();
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Basic 123" },
    }),
  );
  assert.equal(res.status, 401);
});

test("Caller without verified email returns 400", async () => {
  const { handler } = await createHandler({}, { user: { id: "no-email", app_metadata: {} } });
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
    }),
  );
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.ok(json.error.includes("verified email"));
});

test("action: test_template by non-owner returns 403", async () => {
  const { handler } = await createHandler();
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_template", templateKey: "customer_request_received" }),
    }),
  );
  assert.equal(res.status, 403);
});

test("action: test_template by owner when delivery is disabled returns 202 skipped", async () => {
  const { handler } = await createHandler(
    { NOTIFICATION_DELIVERY_ENABLED: "false" },
    { user: { id: "owner-1", email: "owner@test.com", app_metadata: { role: "owner" } } },
  );
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_template", templateKey: "customer_request_received" }),
    }),
  );
  assert.equal(res.status, 202);
  const json = await res.json();
  assert.equal(json.skipped, true);
});

test("action: test_template by owner dispatches email and returns 200", async () => {
  let fetchedUrl = "";
  const { handler } = await createHandler(
    {},
    { user: { id: "owner-1", email: "owner@test.com", app_metadata: { role: "owner" } } },
    async (url) => {
      fetchedUrl = url;
      return Response.json({ id: "resend-test-msg" }, { status: 200 });
    },
  );
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_template", templateKey: "customer_request_received" }),
    }),
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.sent, true);
  assert.equal(json.providerMessageId, "resend-test-msg");
  assert.ok(fetchedUrl.includes("api.resend.com"));
});

test("action: deliver_request with invalid UUID returns 400", async () => {
  const { handler } = await createHandler();
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "not-a-uuid" }),
    }),
  );
  assert.equal(res.status, 400);
});

test("action: deliver_request with missing request returns 404", async () => {
  const { handler } = await createHandler();
  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "b0000000-0000-4000-8000-000000000002" }),
    }),
  );
  assert.equal(res.status, 404);
});

test("action: deliver_request successfully sends customer and owner emails", async () => {
  const sentRequests = [];
  const { handler } = await createHandler({}, {}, async (url, opts) => {
    sentRequests.push({ url, body: JSON.parse(opts.body) });
    return Response.json({ id: `msg-${sentRequests.length}` }, { status: 200 });
  });

  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "a0000000-0000-4000-8000-000000000001" }),
    }),
  );

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.sent, ["customer", "owner"]);
  assert.deepEqual(json.failed, []);
  assert.equal(sentRequests.length, 2);
  assert.equal(sentRequests[0].body.to, "customer@example.test");
  assert.equal(sentRequests[1].body.to, "owner@example.test");
});

test("action: deliver_request handles provider failure gracefully", async () => {
  const { handler, dbState } = await createHandler(
    {},
    {
      deliveries: [
        { id: "del-fail", recipient_kind: "customer", attempt_count: 0, status: "pending" },
      ],
    },
    async () => {
      return Response.json({ message: "Rate limit exceeded" }, { status: 429 });
    },
  );

  const res = await handler(
    new Request("https://edge.supabase.test/send-request-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "a0000000-0000-4000-8000-000000000001" }),
    }),
  );

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.sent, []);
  assert.deepEqual(json.failed, ["customer"]);

  const failedUpdate = dbState.updates.find((u) => u.status === "failed");
  assert.ok(failedUpdate);
  assert.equal(failedUpdate.last_error, "Rate limit exceeded");
});
