import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import type { EmployerVerifySessionBody } from "@/lib/types";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, user.id, {
      namespace: "employer-verify-session",
      preset: "strict",
    });
    if (limited) return limited;

    const body = (await request.json().catch(() => ({}))) as Partial<EmployerVerifySessionBody>;
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const companyId = session.metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
    if (session.mode !== "subscription") {
      return NextResponse.json({ error: "Invalid checkout mode" }, { status: 400 });
    }
    const planType = session.metadata?.plan_type;
    if (planType !== "growth" && planType !== "scale") {
      return NextResponse.json({ error: "Invalid plan metadata" }, { status: 400 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id, user_id, stripe_subscription_status")
      .eq("id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 403 });
    }

    if ((company as { stripe_subscription_status?: string }).stripe_subscription_status === "active") {
      return NextResponse.json({ ok: true });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const subscriptionId = typeof session.subscription === "object" && session.subscription?.id
      ? session.subscription.id
      : typeof session.subscription === "string"
        ? session.subscription
        : null;
    if (!subscriptionId) {
      return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
    }

    const subscriptionStatus =
      typeof session.subscription === "object" && session.subscription?.status
        ? session.subscription.status
        : null;
    if (subscriptionStatus && subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
      return NextResponse.json({ error: "Subscription is not active yet" }, { status: 400 });
    }

    const updates: {
      stripe_subscription_status: string;
      stripe_subscription_id?: string;
      stripe_customer_id?: string;
    } = {
      stripe_subscription_status: "active",
    };
    if (subscriptionId) updates.stripe_subscription_id = subscriptionId;
    if (session.customer) updates.stripe_customer_id = typeof session.customer === "string" ? session.customer : session.customer.id;

    const { error } = await supabase.from("companies").update(updates).eq("id", companyId);

    if (error) {
      console.error("verify-session update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("verify-session error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 500 }
    );
  }
}
