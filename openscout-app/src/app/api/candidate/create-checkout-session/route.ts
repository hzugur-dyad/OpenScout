import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const priceIds: Record<string, string | undefined> = {
  plus: process.env.STRIPE_CANDIDATE_PLUS_PRICE_ID,
  pro: process.env.STRIPE_CANDIDATE_PRO_PRICE_ID,
};

export async function POST(request: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, user.id, {
      namespace: "candidate-checkout",
      preset: "strict",
    });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const plan = (body as { plan?: string }).plan;
    if (plan !== "plus" && plan !== "pro") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = priceIds[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for ${plan} plan. Set STRIPE_CANDIDATE_${plan.toUpperCase()}_PRICE_ID.` },
        { status: 503 }
      );
    }

    const origin = request.nextUrl.origin;
    const stripe = new Stripe(stripeSecretKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const stripeCustomerId =
      typeof (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id === "string"
        ? (profile as { stripe_customer_id: string }).stripe_customer_id
        : null;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?subscription=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        user_id: user.id,
        plan_type: plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: plan,
        },
      },
    };
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email ?? undefined;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (session.url) {
      await captureServer(user.id, ANALYTICS_EVENTS.checkout_started, {
        scope: "candidate",
        plan,
        checkout_session_id: session.id,
      });
      await captureServer(user.id, ANALYTICS_EVENTS.subscription_started, {
        scope: "candidate",
        plan,
        checkout_session_id: session.id,
      });
      return NextResponse.json({ url: session.url });
    }
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  } catch (e) {
    console.error("candidate create-checkout-session error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
