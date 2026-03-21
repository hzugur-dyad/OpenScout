import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics-server";

const stripeHoisted = vi.hoisted(() => ({
  constructEvent: vi.fn(),
}));

const webhookRlHoisted = vi.hoisted(() => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => webhookRlHoisted.enforceRateLimit(...args),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    webhooks = {
      constructEvent: (...args: unknown[]) => stripeHoisted.constructEvent(...args),
    };
    subscriptions = {
      retrieve: vi.fn().mockResolvedValue({ metadata: {} }),
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

type WebhookOp = { table: string; payload: Record<string, unknown>; col: string; val: unknown };

function buildWebhookSupabase() {
  const ops: WebhookOp[] = [];
  const client = {
    from(table: string) {
      return {
        select: (cols: string) => ({
          eq: (c: string, v: unknown) => ({
            maybeSingle: async () => {
              if (table === "companies" && cols.includes("user_id")) {
                return { data: { user_id: "owner-emp" }, error: null };
              }
              if (table === "companies" && cols === "id" && c === "stripe_subscription_id") {
                return { data: { id: "co-resolved" }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async (col: string, val: unknown) => {
            ops.push({ table, payload, col, val });
            return { error: null };
          },
        }),
      };
    },
  };
  return { client, ops };
}

describe("POST /api/stripe-webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    stripeHoisted.constructEvent.mockReset();
    vi.mocked(createAdminClient).mockReset();
    vi.mocked(captureServer).mockClear();
    webhookRlHoisted.enforceRateLimit.mockReset();
    webhookRlHoisted.enforceRateLimit.mockResolvedValue(null);
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
  });

  it("returns 429 when IP rate limit is exceeded", async () => {
    webhookRlHoisted.enforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const { POST } = await import("@/app/api/stripe-webhook/route");
    const req = new NextRequest("http://localhost/api/stripe-webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "v1=abc" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(webhookRlHoisted.enforceRateLimit).toHaveBeenCalledWith(
      req,
      null,
      expect.objectContaining({ namespace: "stripe-webhook", preset: "lenient" })
    );
    expect(stripeHoisted.constructEvent).not.toHaveBeenCalled();
  });

  it("returns 503 when Stripe keys are not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/stripe-webhook/route");
    const req = new NextRequest("http://localhost/api/stripe-webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "v1=abc" },
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const { POST } = await import("@/app/api/stripe-webhook/route");
    const req = new NextRequest("http://localhost/api/stripe-webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    stripeHoisted.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found");
    });
    const { POST } = await import("@/app/api/stripe-webhook/route");
    const req = new NextRequest("http://localhost/api/stripe-webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "bad" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(String(json.error)).toMatch(/verification failed/i);
  });

  it("checkout.session.completed (employer) updates company subscription fields", async () => {
    const { client, ops } = buildWebhookSupabase();
    vi.mocked(createAdminClient).mockReturnValue(client as never);
    stripeHoisted.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          mode: "subscription",
          metadata: { company_id: "co-42", plan_type: "scale" },
          subscription: "sub_new",
          customer: "cus_xyz",
        },
      },
    } as never);

    const { POST } = await import("@/app/api/stripe-webhook/route");
    const req = new NextRequest("http://localhost/api/stripe-webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });

    const companyUpdate = ops.find((o) => o.table === "companies" && o.col === "id" && o.val === "co-42");
    expect(companyUpdate).toBeDefined();
    expect(companyUpdate!.payload.stripe_subscription_status).toBe("active");
    expect(companyUpdate!.payload.stripe_subscription_id).toBe("sub_new");
    expect(companyUpdate!.payload.plan).toBe("scale");
    expect(companyUpdate!.payload.total_application_limit).toBe(100);
    expect(companyUpdate!.payload.stripe_customer_id).toBe("cus_xyz");
    expect(vi.mocked(captureServer)).toHaveBeenCalled();
  });

  it("checkout.session.completed (candidate) updates profile plan", async () => {
    const { client, ops } = buildWebhookSupabase();
    vi.mocked(createAdminClient).mockReturnValue(client as never);
    stripeHoisted.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_cand",
          mode: "subscription",
          metadata: { user_id: "cand-99", plan_type: "plus" },
          subscription: "sub_c",
          customer: "cus_c",
        },
      },
    } as never);

    const { POST } = await import("@/app/api/stripe-webhook/route");
    const res = await POST(
      new NextRequest("http://localhost/api/stripe-webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig" },
      })
    );
    expect(res.status).toBe(200);

    const profileUpdate = ops.find((o) => o.table === "profiles");
    expect(profileUpdate).toBeDefined();
    expect(profileUpdate!.payload.plan).toBe("plus");
    expect(profileUpdate!.val).toBe("cand-99");
    expect(vi.mocked(captureServer)).toHaveBeenCalled();
  });

  it("customer.subscription.updated maps Stripe status for employer subscription", async () => {
    const { client, ops } = buildWebhookSupabase();
    vi.mocked(createAdminClient).mockReturnValue(client as never);
    stripeHoisted.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_x",
          status: "past_due",
          metadata: { company_id: "co-7", plan_type: "growth" },
          customer: "cus_1",
        },
      },
    } as never);

    const { POST } = await import("@/app/api/stripe-webhook/route");
    const res = await POST(
      new NextRequest("http://localhost/api/stripe-webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig" },
      })
    );
    expect(res.status).toBe(200);

    const u = ops.find((o) => o.table === "companies" && o.val === "co-7");
    expect(u?.payload.stripe_subscription_status).toBe("past_due");
    expect(u?.payload.plan).toBe("trial");
  });

  it("customer.subscription.deleted downgrades employer company to trial", async () => {
    const { client, ops } = buildWebhookSupabase();
    vi.mocked(createAdminClient).mockReturnValue(client as never);
    stripeHoisted.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_end",
          metadata: { company_id: "co-7" },
        },
      },
    } as never);

    const { POST } = await import("@/app/api/stripe-webhook/route");
    const res = await POST(
      new NextRequest("http://localhost/api/stripe-webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig" },
      })
    );
    expect(res.status).toBe(200);

    const u = ops.find((o) => o.table === "companies" && o.val === "co-7");
    expect(u?.payload.stripe_subscription_status).toBe("canceled");
    expect(u?.payload.plan).toBe("trial");
    expect(u?.payload.stripe_subscription_id).toBeNull();
    expect(u?.payload.total_application_limit).toBe(50);
  });

  it("duplicate delivery is handled without throwing (analytics mocked)", async () => {
    const { client, ops } = buildWebhookSupabase();
    vi.mocked(createAdminClient).mockReturnValue(client as never);
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_dup",
          mode: "subscription",
          metadata: { company_id: "co-dup", plan_type: "growth" },
          subscription: "sub_dup",
          customer: "cus_dup",
        },
      },
    };
    stripeHoisted.constructEvent.mockReturnValue(event as never);

    const { POST } = await import("@/app/api/stripe-webhook/route");
    const req = new NextRequest("http://localhost/api/stripe-webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });
    const r1 = await POST(req);
    const r2 = await POST(
      new NextRequest("http://localhost/api/stripe-webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig" },
      })
    );
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(ops.filter((o) => o.table === "companies" && o.val === "co-dup").length).toBe(2);
  });
});
