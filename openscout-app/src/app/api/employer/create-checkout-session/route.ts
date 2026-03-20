import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const growthPriceId = process.env.STRIPE_EMPLOYER_GROWTH_PRICE_ID || process.env.STRIPE_PRICE_ID;
const scalePriceId = process.env.STRIPE_EMPLOYER_SCALE_PRICE_ID;

const PLAN_CONFIG: Record<string, { priceId: string | undefined; limit: number }> = {
  growth: { priceId: growthPriceId, limit: 50 },
  scale: { priceId: scalePriceId, limit: 100 },
};

export async function POST(request: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, user.id, {
      namespace: "employer-checkout",
      preset: "strict",
    });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const planParam = typeof (body as { plan?: string }).plan === "string"
      ? (body as { plan: string }).plan.trim().toLowerCase()
      : "growth";
    const companyIdParam = typeof (body as { company_id?: string }).company_id === "string"
      ? (body as { company_id: string }).company_id.trim()
      : undefined;

    const config = PLAN_CONFIG[planParam];
    if (!config || !config.priceId) {
      return NextResponse.json(
        { error: `Invalid plan "${planParam}" or price not configured. Set STRIPE_EMPLOYER_GROWTH_PRICE_ID and STRIPE_EMPLOYER_SCALE_PRICE_ID.` },
        { status: 400 }
      );
    }

    let company: { id: string; stripe_customer_id?: string } | null;
    if (companyIdParam) {
      const { data } = await supabase
        .from("companies")
        .select("id, stripe_customer_id")
        .eq("id", companyIdParam)
        .eq("user_id", user.id)
        .maybeSingle();
      company = data;
      if (!company) {
        return NextResponse.json({ error: "Company not found or access denied" }, { status: 403 });
      }
    } else {
      const { data } = await supabase
        .from("companies")
        .select("id, stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      company = data;
    }

    if (!company) {
      return NextResponse.json({ error: "Create a company first" }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const successUrl = `${origin}/employer?session_id={CHECKOUT_SESSION_ID}&subscription=success`;
    const cancelUrl = `${origin}/employer/pricing`;

    const stripe = new Stripe(stripeSecretKey);
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: config.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { company_id: company.id, plan_type: planParam },
      subscription_data: {
        metadata: { company_id: company.id, plan_type: planParam },
      },
    };
    if (company.stripe_customer_id) {
      sessionParams.customer = company.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email ?? undefined;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (session.url) {
      await captureServer(user.id, ANALYTICS_EVENTS.subscription_started, {
        scope: "employer",
        plan: planParam,
        company_id: company.id,
        checkout_session_id: session.id,
      });
      return NextResponse.json({ url: session.url });
    }
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
