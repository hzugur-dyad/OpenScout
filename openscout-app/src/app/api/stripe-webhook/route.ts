import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStatusFromStripe(status: string): string {
  if (status === "active" || status === "trialing") return "active";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") return "canceled";
  if (status === "past_due" || status === "incomplete" || status === "paused") return "past_due";
  return status;
}

export async function POST(request: NextRequest) {
  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch (e) {
    console.error("stripe-webhook: failed to read body", e);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecretKey);
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("stripe-webhook: signature verification failed", message);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  async function resolveCompanyId(
    fromMetadata: string | undefined,
    subscriptionId: string | null
  ): Promise<string | null> {
    if (fromMetadata) return fromMetadata;
    if (!subscriptionId) return null;
    const { data: row } = await supabase
      .from("companies")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    return (row as { id?: string } | null)?.id ?? null;
  }

  type SubMeta = { company_id?: string; user_id?: string; plan_type?: string };

  const EMPLOYER_PLAN_LIMITS: Record<string, number> = { growth: 50, scale: 100 };

  function getEmployerPlanFields(planType: string | undefined, active: boolean) {
    if (!active || !planType) return { plan: "trial", total_application_limit: 50 };
    const limit = EMPLOYER_PLAN_LIMITS[planType];
    if (limit != null) return { plan: planType, total_application_limit: limit };
    return { plan: "growth", total_application_limit: 50 };
  }

  function isCandidateSub(metadata: SubMeta | undefined): boolean {
    return Boolean(metadata?.plan_type && metadata?.user_id && !metadata?.company_id);
  }

  async function handleCandidatePlanUpdate(userId: string, planType: string, active: boolean) {
    const validPlans = ["plus", "pro"];
    const newPlan = active && validPlans.includes(planType) ? planType : "free";
    await supabase
      .from("profiles")
      .update({ plan: newPlan })
      .eq("user_id", userId);
  }

  switch (event.type) {
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata as SubMeta | undefined;

      if (isCandidateSub(meta)) {
        const active = sub.status === "active" || sub.status === "trialing";
        await handleCandidatePlanUpdate(meta!.user_id!, meta!.plan_type!, active);
        break;
      }

      const companyId = await resolveCompanyId(meta?.company_id, sub.id);
      if (!companyId) {
        return NextResponse.json({ received: true });
      }
      const status = getStatusFromStripe(sub.status);
      const active = status === "active";
      const planFields = getEmployerPlanFields(meta?.plan_type, active);
      await supabase
        .from("companies")
        .update({
          stripe_subscription_status: status,
          stripe_subscription_id: sub.id,
          ...planFields,
          ...(sub.customer ? { stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id } : {}),
        })
        .eq("id", companyId);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata as SubMeta | undefined;

      if (isCandidateSub(meta)) {
        await handleCandidatePlanUpdate(meta!.user_id!, meta!.plan_type!, false);
        break;
      }

      const companyId = await resolveCompanyId(meta?.company_id, sub.id);
      if (!companyId) {
        return NextResponse.json({ received: true });
      }
      await supabase
        .from("companies")
        .update({
          stripe_subscription_status: "canceled",
          stripe_subscription_id: null,
          plan: "trial",
          total_application_limit: 50,
        })
        .eq("id", companyId);
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata as SubMeta | undefined;

      if (isCandidateSub(meta) && session.mode === "subscription") {
        await handleCandidatePlanUpdate(meta!.user_id!, meta!.plan_type!, true);
        break;
      }

      const companyId = meta?.company_id ?? null;
      if (!companyId || session.mode !== "subscription" || !session.subscription) {
        return NextResponse.json({ received: true });
      }
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const checkoutPlanFields = getEmployerPlanFields(meta?.plan_type, true);
      await supabase
        .from("companies")
        .update({
          stripe_subscription_status: "active",
          stripe_subscription_id: subId,
          ...checkoutPlanFields,
          ...(session.customer ? { stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer.id } : {}),
        })
        .eq("id", companyId);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
