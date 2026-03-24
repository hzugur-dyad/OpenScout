import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, user.id, {
      namespace: "billing-portal",
      preset: "strict",
    });
    if (limited) return limited;

    const scope = request.nextUrl.searchParams.get("scope") === "employer" ? "employer" : "candidate";
    const stripe = new Stripe(stripeSecretKey);
    const origin = request.nextUrl.origin;

    if (scope === "employer") {
      const { data: company } = await supabase
        .from("companies")
        .select("id, stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const customerId = (company as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
      if (!customerId) {
        return NextResponse.json({ error: "No active billing account found for employer." }, { status: 400 });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/employer/pricing`,
      });
      return NextResponse.redirect(session.url, { status: 303 });
    }

    if (!user.email) {
      return NextResponse.json({ error: "No email found for this account." }, { status: 400 });
    }

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 10,
    });
    const customer = customers.data[0];
    if (!customer) {
      return NextResponse.json({ error: "No billing account found for candidate." }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/pricing`,
    });
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not open billing portal." },
      { status: 500 }
    );
  }
}

