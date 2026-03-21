import type { SupabaseClient } from "@supabase/supabase-js";

export type EmployerCompanyRow = {
  id: string;
  name: string;
  stripe_subscription_status: string | null;
  trial_started_at: string | null;
  plan?: string | null;
};

/** Company the user owns, or the first company they are a member of. */
export async function getEmployerPrimaryCompany(
  supabase: SupabaseClient,
  userId: string
): Promise<EmployerCompanyRow | null> {
  const { data: owned } = await supabase
    .from("companies")
    .select("id,name,stripe_subscription_status,trial_started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (owned) return owned as EmployerCompanyRow;

  const { data: mem } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const cid = (mem as { company_id?: string } | null)?.company_id;
  if (!cid) return null;

  const { data: c } = await supabase
    .from("companies")
    .select("id,name,stripe_subscription_status,trial_started_at,plan")
    .eq("id", cid)
    .maybeSingle();
  return (c as EmployerCompanyRow | null) ?? null;
}

/** True if the user owns the company or is a company_member (any role). */
export async function userHasCompanyAccess(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<boolean> {
  const { data: c } = await supabase.from("companies").select("user_id").eq("id", companyId).maybeSingle();
  const owner = (c as { user_id?: string | null } | null)?.user_id;
  if (owner === userId) return true;
  const { data: m } = await supabase
    .from("company_members")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!m;
}

/** Owner or recruiter/owner member — can change pipeline and notes. */
export async function userCanRecruitForCompany(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<boolean> {
  const { data: c } = await supabase.from("companies").select("user_id").eq("id", companyId).maybeSingle();
  const owner = (c as { user_id?: string | null } | null)?.user_id;
  if (owner === userId) return true;
  const { data: m } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (m as { role?: string } | null)?.role;
  return role === "owner" || role === "recruiter";
}
