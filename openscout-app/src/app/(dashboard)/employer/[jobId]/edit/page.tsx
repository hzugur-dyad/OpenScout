import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployerJobForm } from "@/components/employer/EmployerJobForm";
import { userCanRecruitForCompany } from "@/lib/employer-company";

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

  const canEdit = await userCanRecruitForCompany(supabase, user.id, job.company_id);
  if (!canEdit) notFound();

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

