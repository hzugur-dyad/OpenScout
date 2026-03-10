import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

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

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?subscription=success`,
      cancel_url: `${origin}/pricing`,
      customer_email: user.email ?? undefined,
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

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (session.url) {
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
