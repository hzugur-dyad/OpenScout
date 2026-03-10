import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployerJobForm } from "@/components/employer/EmployerJobForm";

export default async function EmployerEditListingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const { data: job } = await supabase
    .from("job_listings")
    .select("id, company_id, title, description, requirements, min_cv_score, is_active, ai_interview_config")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) notFound();

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", job.company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Edit listing</h1>
      <p className="mt-1 text-gray-500">Update title, requirements, and visibility.</p>
      <div className="mt-8">
        <EmployerJobForm
          mode="edit"
          companyId={job.company_id}
          initial={job}
        />
      </div>
    </div>
  );
}

