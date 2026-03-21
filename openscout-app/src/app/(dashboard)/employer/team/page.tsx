import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { getEmployerPrimaryCompany } from "@/lib/employer-company";

export default async function EmployerTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const company = await getEmployerPrimaryCompany(supabase, user.id);
  if (!company) redirect("/employer");

  const { data: members } = await supabase
    .from("company_members")
    .select("user_id, role, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/employer" className="text-sm text-gray-500 hover:underline dark:text-zinc-400">
        ← Back to employer
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-zinc-100">Team</h1>
      <p className="mt-1 text-gray-600 dark:text-zinc-400">
        People who can access {company.name} on OpenScout. Invite flows can extend this list later.
      </p>

      <ul className="mt-8 divide-y divide-[var(--border)] rounded-[10px] border border-[var(--border)] bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
        {(members ?? []).length === 0 ? (
          <li className="px-4 py-6 text-sm text-gray-500 dark:text-zinc-500">No team rows yet.</li>
        ) : (
          (members ?? []).map((m) => {
            const row = m as { user_id: string; role: string; created_at: string };
            const self = row.user_id === user.id;
            return (
              <li key={row.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium capitalize text-gray-900 dark:text-zinc-100">{row.role}</span>
                  {self && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-zinc-500">(you)</span>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-zinc-500">{row.user_id}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  {row.created_at ? new Date(row.created_at).toLocaleDateString() : ""}
                </span>
              </li>
            );
          })
        )}
      </ul>

      <p className="mt-6 text-sm text-gray-500 dark:text-zinc-500">
        Owners can add recruiters and viewers from the database or a future invite UI. Viewers can review
        applications but cannot change pipeline or listings.
      </p>

      <div className="mt-8">
        <Link href="/employer">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
