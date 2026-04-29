"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { captureException } from "@/lib/monitoring";
import { safeExternalHref } from "@/lib/safe-url";

export default function EmployerProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [personal, setPersonal] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_title_at_company: "",
  });

  const [company, setCompany] = useState({
    id: "",
    name: "",
    sector: "",
    description: "",
    website: "",
  });
  const safeCompanyWebsiteHref = safeExternalHref(company.website);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/employer/login"); return; }

      const [{ data: profile }, { data: comp }] = await Promise.all([
        supabase.from("profiles").select("first_name, last_name, email, job_title_at_company").eq("user_id", user.id).maybeSingle(),
        supabase.from("companies").select("id, name, sector, description, website").eq("user_id", user.id).maybeSingle(),
      ]);

      const p = profile as { first_name?: string; last_name?: string; email?: string; job_title_at_company?: string } | null;
      setPersonal({
        first_name: p?.first_name ?? "",
        last_name: p?.last_name ?? "",
        email: p?.email ?? user.email ?? "",
        job_title_at_company: p?.job_title_at_company ?? "",
      });

      const c = comp as { id?: string; name?: string; sector?: string; description?: string; website?: string } | null;
      if (c) {
        setCompany({
          id: c.id ?? "",
          name: c.name ?? "",
          sector: c.sector ?? "",
          description: c.description ?? "",
          website: c.website ?? "",
        });
      }

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("profiles").upsert({
        user_id: user.id,
        first_name: personal.first_name.trim(),
        last_name: personal.last_name.trim(),
        email: personal.email.trim(),
        job_title_at_company: personal.job_title_at_company.trim() || null,
        updated_at: new Date().toISOString(),
      });

      if (company.id) {
        await supabase.from("companies").update({
          name: company.name.trim(),
          sector: company.sector.trim() || null,
          description: company.description.trim() || null,
          website: company.website.trim() || null,
        }).eq("id", company.id);
      }

      setEditing(false);
      router.refresh();
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { route: "/employer/profile" });
      setSaveError("We could not save your changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-[10px] border border-[var(--border)] px-4 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  const profileSectionCard =
    "os-surface-card rounded-[10px] p-6 md:p-7 dark:bg-black/45 dark:border-white/[0.12]";

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/employer" className="text-sm text-gray-500 hover:underline">← Back to dashboard</Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Employer Profile</h1>
            <p className="mt-1 text-gray-500">Your personal and company information.</p>
          </div>
          <Button variant="primary" onClick={() => setEditing(true)}>Edit profile</Button>
        </div>

        <div className="mt-8 space-y-8">
          <section className={profileSectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">
              Personal Information
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">First name</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{personal.first_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Last name</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{personal.last_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Email</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{personal.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Position / Title</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{personal.job_title_at_company || "—"}</dd>
              </div>
            </dl>
          </section>

          <section className={profileSectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">
              Company Information
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Company name</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{company.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Sector</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{company.sector || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Website</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{safeCompanyWebsiteHref ? <a href={safeCompanyWebsiteHref} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111111] underline decoration-[#E5E5E3] underline-offset-4 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300">{company.website}</a> : (company.website || "—")}</dd>
              </div>
              {company.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Description</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[#111111] dark:text-zinc-100">{company.description}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/employer" className="text-sm text-gray-500 hover:underline">← Back to dashboard</Link>
      <h1 className="mt-4 text-2xl font-bold">Edit Employer Profile</h1>
      <p className="mt-1 text-gray-500">Update your personal and company details.</p>

      {saveError && (
        <div
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {saveError}
        </div>
      )}

      <div className="mt-8 space-y-8">
        <section className={profileSectionCard}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">
            Personal Information
          </h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">First Name</label>
                <input value={personal.first_name} onChange={(e) => setPersonal((p) => ({ ...p, first_name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">Last Name</label>
                <input value={personal.last_name} onChange={(e) => setPersonal((p) => ({ ...p, last_name: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">Email</label>
              <input type="email" value={personal.email} onChange={(e) => setPersonal((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">Position / Title</label>
              <input value={personal.job_title_at_company} onChange={(e) => setPersonal((p) => ({ ...p, job_title_at_company: e.target.value }))} className={inputClass} placeholder="e.g. Head of Recruiting" />
            </div>
          </div>
        </section>

        <section className={profileSectionCard}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">
            Company Information
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">Company Name</label>
              <input value={company.name} onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">Sector</label>
              <input value={company.sector} onChange={(e) => setCompany((c) => ({ ...c, sector: e.target.value }))} className={inputClass} placeholder="e.g. Technology" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">Website</label>
              <input value={company.website} onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value }))} className={inputClass} placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/55 dark:text-zinc-500">Description</label>
              <textarea value={company.description} onChange={(e) => setCompany((c) => ({ ...c, description: e.target.value }))} rows={4} className={inputClass} placeholder="Brief description of your company" />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 flex gap-4">
        <Button variant="primary" onClick={handleSave} isLoading={saving}>Save</Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}
