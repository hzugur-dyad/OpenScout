"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Upload, X } from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "About",
    component: "AboutStep",
  },
  {
    id: 2,
    title: "Work Experience",
    component: "WorkExperienceStep",
  },
  {
    id: 3,
    title: "Education",
    component: "EducationStep",
  },
  {
    id: 4,
    title: "Job Preferences",
    component: "JobPreferencesStep",
  },
  {
    id: 5,
    title: "Links",
    component: "LinksStep",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cvFileUrl, setCvFileUrl] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    location: "",
    professional_summary: "",
    work_experiences: [] as Array<{
      company_name: string;
      job_title: string;
      start_date: string;
      end_date: string;
      employment_type: string;
      location: string;
      is_remote: boolean;
      description: string;
      highlights: string[];
    }>,
    educations: [] as Array<{
      institution: string;
      location: string;
      degree_type: string;
      field_of_study: string;
      start_year: string;
      end_year: string;
      completed: boolean;
    }>,
    job_search_status: "actively_looking",
    available_start: "within_1_month",
    salary_expectation: "",
    work_arrangement: "flexible",
    domain: "engineering",
    experience_level: "senior",
    desired_roles: [] as string[],
    skills: [] as string[],
    linkedin: "",
    github: "",
    portfolio: "",
    other_highlights: [] as string[],
  });

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfileLoading(false);
        return;
      }
      // Apply profile data from registration if present (e.g. user landed here after email confirm)
      try {
        const raw = typeof window !== "undefined" ? sessionStorage.getItem("pending_candidate_profile") : null;
        if (raw) {
          const parsed = JSON.parse(raw) as { first_name?: string; last_name?: string; location?: string };
          if (parsed.first_name != null || parsed.last_name != null || parsed.location != null) {
            await supabase.from("profiles").upsert({
              user_id: user.id,
              first_name: parsed.first_name ?? "",
              last_name: parsed.last_name ?? "",
              email: user.email ?? "",
              location: parsed.location ?? "",
              updated_at: new Date().toISOString(),
            });
            sessionStorage.removeItem("pending_candidate_profile");
          }
        }
      } catch (_) {}
      const [
        { data: profile },
        { data: privateRow },
        { data: workList },
        { data: eduList },
        { data: prefs },
        { data: links },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profile_private").select("cv_file_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("work_experiences").select("*").eq("user_id", user.id).order("sort_order"),
        supabase.from("educations").select("*").eq("user_id", user.id).order("sort_order"),
        supabase.from("job_preferences").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("professional_links").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setForm((f) => ({
        ...f,
        first_name: (profile as { first_name?: string } | null)?.first_name ?? "",
        last_name: (profile as { last_name?: string } | null)?.last_name ?? "",
        email: (profile as { email?: string } | null)?.email ?? user.email ?? "",
        location: (profile as { location?: string } | null)?.location ?? "",
        professional_summary: (profile as { professional_summary?: string } | null)?.professional_summary ?? "",
      }));
      setCvFileUrl((profile as { cv_file_url?: string } | null)?.cv_file_url ?? null);
      setForm((f) => ({
        ...f,
        work_experiences: (workList ?? []).map((w: Record<string, unknown>) => ({
          company_name: (w.company_name as string) ?? "",
          job_title: (w.job_title as string) ?? "",
          start_date: (w.start_date as string) ?? "",
          end_date: (w.end_date as string) ?? "",
          employment_type: (w.employment_type as string) ?? "full_time",
          location: (w.location as string) ?? "",
          is_remote: (w.is_remote as boolean) ?? false,
          description: (w.description as string) ?? "",
          highlights: (w.highlights as string[]) ?? [],
        })),
        educations: (eduList ?? []).map((e: Record<string, unknown>) => ({
          institution: (e.institution as string) ?? "",
          location: (e.location as string) ?? "",
          degree_type: (e.degree_type as string) ?? "bachelor",
          field_of_study: (e.field_of_study as string) ?? "",
          start_year: e.start_year != null ? String(e.start_year) : "",
          end_year: e.end_year != null ? String(e.end_year) : "",
          completed: (e.completed as boolean) ?? true,
        })),
        job_search_status: (prefs as { job_search_status?: string } | null)?.job_search_status ?? "actively_looking",
        available_start: (prefs as { available_start?: string } | null)?.available_start ?? "within_1_month",
        salary_expectation: (prefs as { salary_expectation?: number } | null)?.salary_expectation != null ? String((prefs as { salary_expectation?: number }).salary_expectation) : "",
        work_arrangement: (prefs as { work_arrangement?: string } | null)?.work_arrangement ?? "flexible",
        domain: (prefs as { domain?: string } | null)?.domain ?? "engineering",
        experience_level: (prefs as { experience_level?: string } | null)?.experience_level ?? "senior",
        desired_roles: (prefs as { desired_roles?: string[] } | null)?.desired_roles ?? [],
        skills: (prefs as { skills?: string[] } | null)?.skills ?? [],
        linkedin: (links as { linkedin?: string } | null)?.linkedin ?? "",
        github: (links as { github?: string } | null)?.github ?? "",
        portfolio: (links as { portfolio?: string } | null)?.portfolio ?? "",
        other_highlights: (links as { other_highlights?: string[] } | null)?.other_highlights ?? [],
      }));
      setProfileLoading(false);
    }
    loadProfile();
  }, [supabase]);

  function validateStep(stepNum: number): string | null {
    if (stepNum === 1) {
      if (!form.first_name.trim()) return "First name is required";
      if (!form.last_name.trim()) return "Last name is required";
      if (!form.email.trim()) return "Email is required";
      if (!form.location.trim()) return "Location is required";
    }
    if (stepNum === 5) {
      if (!form.linkedin.trim()) return "LinkedIn URL is required";
    }
    return null;
  }

  function handleNext() {
    setValidationError(null);
    const err = validateStep(step);
    if (err) {
      setValidationError(err);
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleSave() {
    setValidationError(null);
    const err = validateStep(5);
    if (err) {
      setValidationError(err);
      return;
    }
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session not found");

      const { data: onboardingRow } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase.from("profiles").upsert({
        user_id: user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        location: form.location,
        professional_summary: form.professional_summary,
        updated_at: new Date().toISOString(),
      });

      if (form.work_experiences.length > 0) {
        await supabase.from("work_experiences").delete().eq("user_id", user.id);
        for (let i = 0; i < form.work_experiences.length; i++) {
          const we = form.work_experiences[i];
          await supabase.from("work_experiences").insert({
            user_id: user.id,
            company_name: we.company_name,
            job_title: we.job_title,
            start_date: we.start_date || null,
            end_date: we.end_date || null,
            employment_type: we.employment_type || null,
            location: we.location || null,
            is_remote: we.is_remote,
            description: we.description || null,
            highlights: we.highlights || [],
            sort_order: i,
          });
        }
      }

      if (form.educations.length > 0) {
        await supabase.from("educations").delete().eq("user_id", user.id);
        for (let i = 0; i < form.educations.length; i++) {
          const ed = form.educations[i];
          await supabase.from("educations").insert({
            user_id: user.id,
            institution: ed.institution,
            location: ed.location || null,
            degree_type: ed.degree_type || null,
            field_of_study: ed.field_of_study || null,
            start_year: ed.start_year ? parseInt(ed.start_year) : null,
            end_year: ed.end_year ? parseInt(ed.end_year) : null,
            completed: ed.completed,
            sort_order: i,
          });
        }
      }

      await supabase.from("job_preferences").upsert({
        user_id: user.id,
        job_search_status: form.job_search_status,
        available_start: form.available_start,
        salary_expectation: form.salary_expectation ? parseInt(form.salary_expectation) : null,
        work_arrangement: form.work_arrangement,
        domain: form.domain,
        experience_level: form.experience_level,
        desired_roles: form.desired_roles,
        skills: form.skills,
        updated_at: new Date().toISOString(),
      });

      await supabase.from("professional_links").upsert({
        user_id: user.id,
        linkedin: form.linkedin || null,
        github: form.github || null,
        portfolio: form.portfolio || null,
        other_highlights: form.other_highlights,
        updated_at: new Date().toISOString(),
      });

      if (!(onboardingRow as { onboarding_completed_at?: string } | null)?.onboarding_completed_at) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .is("onboarding_completed_at", null);
      }

      trackClient(ANALYTICS_EVENTS.onboarding_completed, {});

      fetch("/api/referral/evaluate", { method: "POST" }).catch(() => {});

      setEditing(false);
      setStep(1);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  if (profileLoading) {
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="mt-1 text-gray-500">Your information is shown below. Edit when you need to.</p>
          </div>
          <Button variant="primary" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>

        <div className="mt-8 space-y-8">
          <section className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">About</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">First name</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.first_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Last name</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.last_name || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Email</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Location</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.location || "—"}</dd>
              </div>
              {form.professional_summary && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Professional summary</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-900 dark:text-zinc-100">{form.professional_summary}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Work Experience</h2>
            {form.work_experiences.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-zinc-500">No work experience added yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {form.work_experiences.map((we, i) => (
                  <li key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-zinc-700">
                    <p className="font-medium text-gray-900 dark:text-zinc-100">{we.job_title || "—"} at {we.company_name || "—"}</p>
                    {(we.start_date || we.end_date) && (
                      <p className="text-sm text-gray-500 dark:text-zinc-500">{we.start_date} – {we.end_date || "Present"}</p>
                    )}
                    {we.description && <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{we.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Education</h2>
            {form.educations.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-zinc-500">No education added yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {form.educations.map((ed, i) => (
                  <li key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-zinc-700">
                    <p className="font-medium text-gray-900 dark:text-zinc-100">{ed.institution || "—"}</p>
                    <p className="text-sm text-gray-600 dark:text-zinc-400">{ed.degree_type} {ed.field_of_study && `in ${ed.field_of_study}`}</p>
                    {(ed.start_year || ed.end_year) && (
                      <p className="text-sm text-gray-500 dark:text-zinc-500">{ed.start_year} – {ed.end_year || "Present"}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Job Preferences</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Job search status</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.job_search_status?.replace(/_/g, " ") ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Available to start</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.available_start?.replace(/_/g, " ") ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Domain</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.domain ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Links</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">LinkedIn</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.linkedin ? <a href={form.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{form.linkedin}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">GitHub</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.github ? <a href={form.github} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{form.github}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-zinc-500">Portfolio</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-zinc-100">{form.portfolio ? <a href={form.portfolio} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{form.portfolio}</a> : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">CV</h2>
            {cvFileUrl ? (
              <div className="mt-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <a
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault();
                    const { data } = await supabase.storage.from("cvs").createSignedUrl(cvFileUrl!, 60);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  Download CV
                </a>
                <input ref={cvInputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const name = file.name.toLowerCase();
                  if (!name.endsWith(".pdf") && !name.endsWith(".txt")) return;
                  if (file.size > 10 * 1024 * 1024) return;
                  setCvUploading(true);
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    const ext = file.name.split(".").pop() || "pdf";
                    const filePath = `${user.id}/cv.${ext}`;
                    await supabase.storage.from("cvs").upload(filePath, file, { upsert: true });
                    await supabase
                      .from("profile_private")
                      .update({ cv_file_url: filePath, updated_at: new Date().toISOString() })
                      .eq("user_id", user.id);
                    setCvFileUrl(filePath);
                    try { await fetch("/api/cv-extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath }) }); } catch {}
                  } finally { setCvUploading(false); }
                }} />
                <Button variant="outline" size="sm" onClick={() => cvInputRef.current?.click()} isLoading={cvUploading}>
                  Re-upload
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <input ref={cvInputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const name = file.name.toLowerCase();
                  if (!name.endsWith(".pdf") && !name.endsWith(".txt")) return;
                  if (file.size > 10 * 1024 * 1024) return;
                  setCvUploading(true);
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    const ext = file.name.split(".").pop() || "pdf";
                    const filePath = `${user.id}/cv.${ext}`;
                    await supabase.storage.from("cvs").upload(filePath, file, { upsert: true });
                    await supabase
                      .from("profile_private")
                      .update({ cv_file_url: filePath, updated_at: new Date().toISOString() })
                      .eq("user_id", user.id);
                    setCvFileUrl(filePath);
                    try { await fetch("/api/cv-extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath }) }); } catch {}
                  } finally { setCvUploading(false); }
                }} />
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500 hover:border-primary hover:text-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  <Upload className="h-5 w-5" />
                  {cvUploading ? "Uploading..." : "Upload your CV (PDF or TXT, max 10MB)"}
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="mt-6">
          <Button variant="primary" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Complete Your Profile</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">
        Review and complete your information.
      </p>
      <Link href="/cv-analysis" className="mt-2 inline-block text-sm text-primary hover:underline">
        Upload new CV
      </Link>

      <div className="mt-4">
        <SharePublicProfileButton />
      </div>

      <div className="mt-8">
        <OnboardingStepper currentStep={step} />
      </div>

      <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
        {validationError && (
          <div
            role="alert"
            data-testid="onboarding-validation-error"
            className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {validationError}
          </div>
        )}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
              data-testid="onboarding-step-about"
            >
              <h2 className="text-lg font-semibold">About</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                    required
                    aria-invalid={!!(validationError && !form.first_name.trim())}
                  />
                  {validationError && !form.first_name.trim() && (
                    <p className="mt-1 text-sm text-red-600" role="alert">Required</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Last Name <span className="text-red-500">*</span></label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                    required
                    aria-invalid={!!(validationError && !form.last_name.trim())}
                  />
                  {validationError && !form.last_name.trim() && (
                    <p className="mt-1 text-sm text-red-600" role="alert">Required</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                  required
                  aria-invalid={!!(validationError && !form.email.trim())}
                />
                {validationError && !form.email.trim() && (
                  <p className="mt-1 text-sm text-red-600" role="alert">Required</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Location <span className="text-red-500">*</span></label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Berlin, Germany"
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                  required
                  aria-invalid={!!(validationError && !form.location.trim())}
                />
                {validationError && !form.location.trim() && (
                  <p className="mt-1 text-sm text-red-600" role="alert">Required</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Professional Summary</label>
                <textarea
                  value={form.professional_summary}
                  onChange={(e) => setForm((f) => ({ ...f, professional_summary: e.target.value }))}
                  rows={4}
                  placeholder="A brief overview of your experience, skills, and career goals"
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
              data-testid="onboarding-step-work-experience"
            >
              <h2 className="text-lg font-semibold">Work Experience</h2>
              <p className="text-sm text-gray-600">Work experience: add your past roles below.</p>
              {form.work_experiences.length === 0 ? (
                <p className="text-sm text-gray-500">No work experience added yet.</p>
              ) : (
                form.work_experiences.map((we, i) => (
                  <div key={i} className="space-y-3 rounded-lg border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Experience {i + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            work_experiences: f.work_experiences.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
                        <input
                          value={we.company_name}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              work_experiences: f.work_experiences.map((w, idx) =>
                                idx === i ? { ...w, company_name: e.target.value } : w
                              ),
                            }))
                          }
                          placeholder="Company name"
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Job Title</label>
                        <input
                          value={we.job_title}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              work_experiences: f.work_experiences.map((w, idx) =>
                                idx === i ? { ...w, job_title: e.target.value } : w
                              ),
                            }))
                          }
                          placeholder="Job title"
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
                        <input
                          type="month"
                          value={we.start_date}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              work_experiences: f.work_experiences.map((w, idx) =>
                                idx === i ? { ...w, start_date: e.target.value } : w
                              ),
                            }))
                          }
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">End Date</label>
                        <input
                          type="month"
                          value={we.end_date}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              work_experiences: f.work_experiences.map((w, idx) =>
                                idx === i ? { ...w, end_date: e.target.value } : w
                              ),
                            }))
                          }
                          placeholder="Present"
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                      <textarea
                        value={we.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            work_experiences: f.work_experiences.map((w, idx) =>
                              idx === i ? { ...w, description: e.target.value } : w
                            ),
                          }))
                        }
                        rows={2}
                        placeholder="Brief description of your role"
                        className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                data-testid="add-work-experience"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    work_experiences: [
                      ...f.work_experiences,
                      {
                        company_name: "",
                        job_title: "",
                        start_date: "",
                        end_date: "",
                        employment_type: "full_time",
                        location: "",
                        is_remote: false,
                        description: "",
                        highlights: [],
                      },
                    ],
                  }))
                }
              >
                + Add Experience
              </Button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold">Education</h2>
              {form.educations.length === 0 ? (
                <p className="text-sm text-gray-500">No education added yet.</p>
              ) : (
                form.educations.map((ed, i) => (
                  <div key={i} className="space-y-3 rounded-lg border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Education {i + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            educations: f.educations.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Institution</label>
                      <input
                        value={ed.institution}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            educations: f.educations.map((e2, idx) =>
                              idx === i ? { ...e2, institution: e.target.value } : e2
                            ),
                          }))
                        }
                        placeholder="School or university"
                        className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Degree</label>
                        <CustomSelect
                          options={[
                            { value: "bachelor", label: "Bachelor" },
                            { value: "master", label: "Master" },
                            { value: "phd", label: "PhD" },
                            { value: "associate", label: "Associate" },
                            { value: "diploma", label: "Diploma" },
                          ]}
                          value={ed.degree_type}
                          onChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              educations: f.educations.map((e2, idx) =>
                                idx === i ? { ...e2, degree_type: v } : e2
                              ),
                            }))
                          }
                          aria-label="Degree"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Field of Study</label>
                        <input
                          value={ed.field_of_study}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              educations: f.educations.map((e2, idx) =>
                                idx === i ? { ...e2, field_of_study: e.target.value } : e2
                              ),
                            }))
                          }
                          placeholder="e.g. Computer Science"
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Start Year</label>
                        <input
                          type="number"
                          min={1950}
                          max={2030}
                          value={ed.start_year}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              educations: f.educations.map((e2, idx) =>
                                idx === i ? { ...e2, start_year: e.target.value } : e2
                              ),
                            }))
                          }
                          placeholder="2020"
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">End Year</label>
                        <input
                          type="number"
                          min={1950}
                          max={2030}
                          value={ed.end_year}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              educations: f.educations.map((e2, idx) =>
                                idx === i ? { ...e2, end_year: e.target.value } : e2
                              ),
                            }))
                          }
                          placeholder="2024"
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
                        <input
                          value={ed.location}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              educations: f.educations.map((e2, idx) =>
                                idx === i ? { ...e2, location: e.target.value } : e2
                              ),
                            }))
                          }
                          placeholder="City, Country"
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    educations: [
                      ...f.educations,
                      {
                        institution: "",
                        location: "",
                        degree_type: "bachelor",
                        field_of_study: "",
                        start_year: "",
                        end_year: "",
                        completed: true,
                      },
                    ],
                  }))
                }
              >
                + Add Education
              </Button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold">Job Preferences</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-200">Job search status</label>
                <CustomSelect
                  options={[
                    { value: "actively_looking", label: "Actively looking" },
                    { value: "open", label: "Open to opportunities" },
                    { value: "not_looking", label: "Not looking now" },
                  ]}
                  value={form.job_search_status}
                  onChange={(v) => setForm((f) => ({ ...f, job_search_status: v }))}
                  aria-label="Job search status"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-200">When can you start?</label>
                <CustomSelect
                  options={[
                    { value: "immediately", label: "Immediately" },
                    { value: "within_1_month", label: "Within 1 month" },
                    { value: "within_3_months", label: "Within 3 months" },
                  ]}
                  value={form.available_start}
                  onChange={(v) => setForm((f) => ({ ...f, available_start: v }))}
                  aria-label="When can you start"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-200">Domain</label>
                <CustomSelect
                  options={[
                    { value: "engineering", label: "Engineering" },
                    { value: "marketing", label: "Marketing" },
                    { value: "finance", label: "Finance" },
                  ]}
                  value={form.domain}
                  onChange={(v) => setForm((f) => ({ ...f, domain: v }))}
                  aria-label="Domain"
                />
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold">Links & Extras</h2>
              <div>
                <label className="mb-1 block text-sm font-medium">LinkedIn <span className="text-red-500">*</span></label>
                <input
                  value={form.linkedin}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">GitHub (optional)</label>
                <input
                  value={form.github}
                  onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
                  placeholder="https://github.com/..."
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Portfolio (optional)</label>
                <input
                  value={form.portfolio}
                  onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex justify-between">
          {step === 1 ? (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Back to profile
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </Button>
          )}
          {step < 5 ? (
            <Button variant="primary" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSave} isLoading={isLoading}>
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
