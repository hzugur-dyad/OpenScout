import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

export default async function EmployerApplicationsPage({
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
    .select("id, title, company_id")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) notFound();

  const { data: company } = await supabase
    .from("companies")
    .select("id, stripe_subscription_status")
    .eq("id", (job as { company_id: string }).company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) notFound();

  const isSubscribed = (company as { stripe_subscription_status?: string }).stripe_subscription_status === "active";

  type ApplicationRow = {
    id: string;
    user_id: string;
    status: string;
    cv_score: number | null;
    interview_score: number | null;
    created_at: string;
    profiles: { first_name?: string; last_name?: string; email?: string } | null;
  };
  let applications: ApplicationRow[] | null = null;
  if (isSubscribed) {
    const { data } = await supabase
      .from("job_applications")
      .select(`
        id,
        user_id,
        status,
        cv_score,
        interview_score,
        created_at,
        profiles(first_name, last_name, email)
      `)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    applications = data as ApplicationRow[] | null;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/employer" className="text-sm text-gray-500 hover:underline">
            ← Back to employer
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Applications</h1>
          <p className="mt-1 text-gray-500">
            Listing: <span className="font-medium text-gray-700">{job.title}</span>
          </p>
          <p className="mt-1 text-sm font-medium text-gray-600">
            Only Scout-vetted candidates — each has completed CV analysis and AI interview.
          </p>
        </div>
        <Link href={`/employer/${jobId}/edit`}>
          <Button variant="outline">Edit listing</Button>
        </Link>
      </div>

      {!isSubscribed ? (
        <div className="mt-10 rounded-[10px] border border-[var(--primary)] bg-[var(--primary-lighter)]/30 p-10 text-center">
          <p className="font-medium text-gray-800">Upgrade to Growth to view applications</p>
          <p className="mt-1 text-sm text-gray-600">
            Application details are available on the Growth plan.
          </p>
          <Link href="/employer/pricing" className="mt-4 inline-block">
            <Button variant="primary">View pricing</Button>
          </Link>
        </div>
      ) : !applications || applications.length === 0 ? (
        <div className="mt-10 rounded-[10px] border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">No applications yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Once candidates pass the CV score gate and take the interview, their results will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Candidate</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">CV</th>
                <th className="px-4 py-3 font-medium text-gray-600">Interview</th>
                <th className="px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => {
                const profile = (a as { profiles?: { first_name?: string; last_name?: string; email?: string } | null }).profiles;
                const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || null;
                const candidateLabel = name || (
                  <span className="font-mono text-xs text-gray-500">{a.user_id}</span>
                );
                return (
                  <tr key={a.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 text-gray-700">
                      <Link href={`/employer/${jobId}/applications/${a.id}`} className="block hover:underline">
                        <div className="font-medium">{candidateLabel}</div>
                        {name && profile?.email && (
                          <div className="text-xs text-gray-500">{profile.email}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.status}</td>
                    <td className="px-4 py-3 text-gray-700">{a.cv_score ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{a.interview_score ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

