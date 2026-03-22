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
import { FileText, UploadSimple } from "@phosphor-icons/react";
import { Newsreader } from "next/font/google";
import { applyPendingCandidateProfileIfAny } from "@/lib/apply-pending-registration-profile";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

const stepEase = { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };

const inputClass =
  "w-full rounded-md border border-[#EAEAEA] bg-white px-3.5 py-2.5 text-sm leading-[1.6] text-[#111111] transition-colors placeholder:text-[#787774] focus:border-[#111111] focus:outline-none focus:ring-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400";

const inputClassSm =
  "w-full rounded-md border border-[#EAEAEA] bg-white px-3 py-2 text-sm leading-[1.6] text-[#111111] transition-colors placeholder:text-[#787774] focus:border-[#111111] focus:outline-none focus:ring-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400";

/** Minimalist primary CTA: off-black surface, crisp radius (overrides theme gold on this page). */
const minimalPrimaryBtn =
  "rounded-md !bg-[#111111] !text-white hover:!bg-[#333333] active:scale-[0.98] dark:!bg-zinc-100 dark:!text-[#111111] dark:hover:!bg-white";

const minimalOutlineBtn =
  "rounded-md border-[#EAEAEA] bg-transparent hover:bg-[#F7F6F3] dark:border-zinc-700 dark:hover:bg-zinc-900";

/** Match dashboard page: full-bleed bone canvas, same radial wash, max-w-5xl content */
function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative -mx-4 min-h-full overflow-x-clip bg-[#F7F6F3] px-4 pb-24 pt-10 lg:-mx-8 lg:px-8 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[#F7F6F3] [background-image:radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(251,243,219,0.38),transparent_58%)] dark:bg-zinc-950 dark:[background-image:radial-gradient(ellipse_75%_50%_at_50%_-20%,rgba(253,235,236,0.06),transparent_55%)]"
      />
      <div className="relative mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}

const pageTitleClass = `text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[#111111] md:text-5xl dark:text-zinc-100 ${newsreader.className}`;

const stepHeadingClass =
  "text-lg font-semibold tracking-tight text-[#111111] dark:text-zinc-100";

const labelUI = "text-sm font-medium text-[#2F3437] dark:text-zinc-200";

const labelCompact = "text-xs font-medium text-[#787774] dark:text-zinc-400";

const requiredMark = "text-[#9F2F2D] dark:text-red-300/90";

const mainFormCard =
  "mt-8 rounded-xl border border-[#EAEAEA] bg-white p-8 transition-[box-shadow] duration-200 md:mt-12 md:p-10 dark:border-zinc-800 dark:bg-[#141312] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]";

const bentoInnerCard =
  "space-y-3 rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] p-5 transition-[box-shadow] duration-200 dark:border-zinc-800 dark:bg-[#141312] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cvFileUrl, setCvFileUrl] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<string | null>(null);
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
      await applyPendingCandidateProfileIfAny(supabase, user.id, user.email ?? undefined);

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
      const cvPath = (privateRow as { cv_file_url?: string | null } | null)?.cv_file_url ?? null;
      setCvFileUrl(cvPath);
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
      const completedAt = (profile as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at ?? null;
      setOnboardingCompletedAt(completedAt);
      setEditing(completedAt == null);
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
    setSaveError(null);
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
    setSaveError(null);
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
        const completedIso = new Date().toISOString();
        await supabase
          .from("profiles")
          .update({ onboarding_completed_at: completedIso })
          .eq("user_id", user.id)
          .is("onboarding_completed_at", null);
        setOnboardingCompletedAt(completedIso);
      }

      trackClient(ANALYTICS_EVENTS.onboarding_completed, {});

      fetch("/api/referral/evaluate", { method: "POST" }).catch(() => {});

      setEditing(false);
      setStep(1);
      router.refresh();
    } catch (e) {
      console.error(e);
      setSaveError("We could not save your profile. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (profileLoading) {
    return (
      <OnboardingShell>
        <div className="grid gap-12 md:grid-cols-[minmax(0,15rem)_1fr] lg:gap-16">
          <div className="hidden space-y-5 md:block">
            <div className="h-5 w-24 animate-pulse rounded bg-[#EAEAEA] dark:bg-zinc-800" />
            <ul className="space-y-4">
              {[0, 1, 2, 3, 4].map((k) => (
                <li key={k} className="flex gap-3">
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-[#EAEAEA] dark:bg-zinc-800" />
                  <div className="h-3.5 flex-1 animate-pulse rounded-sm bg-[#EAEAEA]/80 dark:bg-zinc-800/90" />
                </li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-xl border border-[#EAEAEA] bg-white p-8 md:p-10 dark:border-zinc-800 dark:bg-[#141312]"
            aria-busy
            aria-label="Loading profile form"
          >
            <div className="h-8 w-2/3 max-w-xs animate-pulse rounded-md bg-[#EAEAEA] dark:bg-zinc-800" />
            <div className="mt-4 h-3.5 w-full max-w-[38ch] animate-pulse rounded-sm bg-[#EAEAEA]/90 dark:bg-zinc-800/90" />
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              <div className="h-10 animate-pulse rounded-md border border-[#EAEAEA] bg-[#F9F9F8] dark:border-zinc-800 dark:bg-zinc-900" />
              <div className="h-10 animate-pulse rounded-md border border-[#EAEAEA] bg-[#F9F9F8] dark:border-zinc-800 dark:bg-zinc-900" />
            </div>
            <div className="mt-4 h-10 max-w-lg animate-pulse rounded-md border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900" />
            <div className="mt-10 h-24 animate-pulse rounded-md border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (!editing) {
    return (
      <OnboardingShell>
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
              Candidate profile
            </p>
            <h1 className={`mt-4 ${pageTitleClass}`}>My profile</h1>
            <p className="mt-3 max-w-[65ch] text-base leading-[1.6] text-[#2F3437] dark:text-zinc-400">
              Read-only summary for employers. Edit when something changes.
            </p>
          </div>
          <Button
            variant="primary"
            className={`shrink-0 ${minimalPrimaryBtn}`}
            onClick={() => {
              setSaveError(null);
              setEditing(true);
            }}
          >
            Edit profile
          </Button>
        </div>

        <div className="mt-14 max-w-3xl divide-y divide-[#EAEAEA] border-t border-[#EAEAEA] dark:divide-zinc-800 dark:border-zinc-800">
          <section className="py-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">
              About
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">First name</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.first_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Last name</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.last_name || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Email</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Location</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.location || "—"}</dd>
              </div>
              {form.professional_summary && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Professional summary</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[#111111] dark:text-zinc-100">{form.professional_summary}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="py-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">Work experience</h2>
            {form.work_experiences.length === 0 ? (
              <p className="mt-3 text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">No roles listed yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {form.work_experiences.map((we, i) => (
                  <li key={i} className="border-b border-[#EAEAEA] pb-4 last:border-0 last:pb-0 dark:border-zinc-800">
                    <p className="font-medium text-[#111111] dark:text-zinc-100">{we.job_title || "—"} at {we.company_name || "—"}</p>
                    {(we.start_date || we.end_date) && (
                      <p className="text-sm text-[#787774] dark:text-zinc-400">{we.start_date} – {we.end_date || "Present"}</p>
                    )}
                    {we.description && <p className="mt-1 text-sm leading-[1.6] text-[#2F3437] dark:text-zinc-400">{we.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="py-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">Education</h2>
            {form.educations.length === 0 ? (
              <p className="mt-3 text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">No education listed yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {form.educations.map((ed, i) => (
                  <li key={i} className="border-b border-[#EAEAEA] pb-4 last:border-0 last:pb-0 dark:border-zinc-800">
                    <p className="font-medium text-[#111111] dark:text-zinc-100">{ed.institution || "—"}</p>
                    <p className="text-sm leading-[1.6] text-[#2F3437] dark:text-zinc-400">{ed.degree_type} {ed.field_of_study && `in ${ed.field_of_study}`}</p>
                    {(ed.start_year || ed.end_year) && (
                      <p className="text-sm text-[#787774] dark:text-zinc-400">{ed.start_year} – {ed.end_year || "Present"}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="py-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">Job preferences</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Job search status</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.job_search_status?.replace(/_/g, " ") ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Available to start</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.available_start?.replace(/_/g, " ") ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Domain</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.domain ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="py-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">Links</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">LinkedIn</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.linkedin ? <a href={form.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111111] underline decoration-[#EAEAEA] underline-offset-4 transition-colors hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300">{form.linkedin}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">GitHub</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.github ? <a href={form.github} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111111] underline decoration-[#EAEAEA] underline-offset-4 transition-colors hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300">{form.github}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[#787774] dark:text-zinc-500">Portfolio</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.portfolio ? <a href={form.portfolio} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111111] underline decoration-[#EAEAEA] underline-offset-4 transition-colors hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300">{form.portfolio}</a> : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="py-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">CV</h2>
            {cvFileUrl ? (
              <div className="mt-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#111111] dark:text-zinc-200" weight="bold" aria-hidden />
                <a
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault();
                    const { data } = await supabase.storage.from("cvs").createSignedUrl(cvFileUrl!, 60);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  }}
                  className="font-medium text-[#111111] underline decoration-[#EAEAEA] underline-offset-4 transition-colors hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300"
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
                <Button
                  variant="outline"
                  size="sm"
                  className={minimalOutlineBtn}
                  onClick={() => cvInputRef.current?.click()}
                  isLoading={cvUploading}
                >
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
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#EAEAEA] bg-[#F7F6F3] p-6 text-sm leading-[1.6] text-[#2F3437] transition-[border-color,background-color,box-shadow] duration-200 hover:border-[#111111]/20 hover:bg-[#FBFBFA] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
                >
                  <UploadSimple className="h-5 w-5" weight="bold" aria-hidden />
                  {cvUploading ? "Uploading..." : "Upload your CV (PDF or TXT, max 10MB)"}
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="mt-10">
          <Button
            variant="primary"
            className={minimalPrimaryBtn}
            onClick={() => {
              setSaveError(null);
              setEditing(true);
            }}
          >
            Edit profile
          </Button>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell>
      <div className="grid gap-12 md:grid-cols-[minmax(0,15rem)_1fr] lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-16">
        <aside className="md:pt-0.5">
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
            Setup
          </p>
          <h1 className={`mt-4 ${pageTitleClass}`}>Complete your profile</h1>
          <p className="mt-3 max-w-[65ch] text-base leading-[1.6] text-[#2F3437] dark:text-zinc-400">
            One pass for your details—whether you just signed up or are updating later.
          </p>
          {!onboardingCompletedAt && (
            <p
              className="mt-6 rounded-md border border-[#EAEAEA] bg-[#FBF3DB] px-4 py-3 text-sm leading-[1.6] text-[#956400] dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300"
              role="status"
            >
              Account is ready. Move through the steps; you can edit fields anytime after saving.
            </p>
          )}
          <Link
            href="/cv-analysis"
            className="mt-5 inline-flex text-sm font-medium text-[#111111] underline decoration-[#EAEAEA] underline-offset-4 transition-colors hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300"
          >
            Upload new CV
          </Link>
          <div className="mt-6">
            <SharePublicProfileButton />
          </div>
          <div className="mt-10 hidden md:block">
            <OnboardingStepper currentStep={step} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="md:hidden">
            <OnboardingStepper currentStep={step} />
          </div>

          <div className={mainFormCard}>
            {validationError && (
              <div
                role="alert"
                data-testid="onboarding-validation-error"
                className="mb-5 rounded-md border border-[#EAEAEA] bg-[#FDEBEC] px-4 py-3 text-sm leading-[1.6] text-[#9F2F2D] dark:border-zinc-700 dark:bg-red-950/30 dark:text-red-200"
              >
                {validationError}
              </div>
            )}
            {saveError && (
              <div
                role="alert"
                className="mb-5 rounded-md border border-[#EAEAEA] bg-[#FDEBEC] px-4 py-3 text-sm leading-[1.6] text-[#9F2F2D] dark:border-zinc-700 dark:bg-red-950/30 dark:text-red-200"
              >
                {saveError}
              </div>
            )}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={stepEase}
              className="space-y-4"
              data-testid="onboarding-step-about"
            >
              <h2 className={stepHeadingClass}>About</h2>
              <p className="max-w-[65ch] text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                Pre-filled from your account when available. Adjust anything that is out of date.
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className={labelUI}>
                    First name <span className={requiredMark}>*</span>
                  </label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className={inputClass}
                    required
                    aria-invalid={!!(validationError && !form.first_name.trim())}
                  />
                  {validationError && !form.first_name.trim() && (
                    <p className="mt-1 text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">Required</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelUI}>
                    Last name <span className={requiredMark}>*</span>
                  </label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className={inputClass}
                    required
                    aria-invalid={!!(validationError && !form.last_name.trim())}
                  />
                  {validationError && !form.last_name.trim() && (
                    <p className="mt-1 text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">Required</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelUI}>
                  Email <span className={requiredMark}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  required
                  aria-invalid={!!(validationError && !form.email.trim())}
                />
                {validationError && !form.email.trim() && (
                  <p className="mt-1 text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">Required</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelUI}>
                  Location <span className={requiredMark}>*</span>
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Berlin, Germany"
                  className={inputClass}
                  required
                  aria-invalid={!!(validationError && !form.location.trim())}
                />
                {validationError && !form.location.trim() && (
                  <p className="text-sm text-[#9F2F2D]" role="alert">Required</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelUI}>Professional summary</label>
                <textarea
                  value={form.professional_summary}
                  onChange={(e) => setForm((f) => ({ ...f, professional_summary: e.target.value }))}
                  rows={4}
                  placeholder="A brief overview of your experience, skills, and career goals"
                  className={inputClass}
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={stepEase}
              className="space-y-4"
              data-testid="onboarding-step-work-experience"
            >
              <h2 className={stepHeadingClass}>Work experience</h2>
              <p className="max-w-[65ch] text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                Add roles in reverse chronological order when you can; you can skip this step and return later.
              </p>
              {form.work_experiences.length === 0 ? (
                <p className="text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">No roles yet. Use the button below to add one.</p>
              ) : (
                form.work_experiences.map((we, i) => (
                  <div key={i} className={bentoInnerCard}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#2F3437] dark:text-zinc-200">Role {i + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            work_experiences: f.work_experiences.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-sm font-medium text-[#9F2F2D] transition-colors hover:text-[#7a2523] dark:text-red-300/90 dark:hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>Company</label>
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
                          className={inputClassSm}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>Job title</label>
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
                          className={inputClassSm}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>Start date</label>
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
                          className={inputClassSm}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>End date</label>
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
                          className={inputClassSm}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className={labelCompact}>Description</label>
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
                        className={inputClassSm}
                      />
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                className={minimalOutlineBtn}
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
                Add role
              </Button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={stepEase}
              className="space-y-4"
            >
              <h2 className={stepHeadingClass}>Education</h2>
              {form.educations.length === 0 ? (
                <p className="text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">No entries yet. Add a school or program below.</p>
              ) : (
                form.educations.map((ed, i) => (
                  <div key={i} className={bentoInnerCard}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#2F3437] dark:text-zinc-200">Entry {i + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            educations: f.educations.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-sm font-medium text-[#9F2F2D] transition-colors hover:text-[#7a2523] dark:text-red-300/90 dark:hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className={labelCompact}>Institution</label>
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
                        className={inputClassSm}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>Degree</label>
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
                          className={inputClassSm}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>Start year</label>
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
                          className={inputClassSm}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>End year</label>
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
                          className={inputClassSm}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className={labelCompact}>Location</label>
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
                          className={inputClassSm}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                className={minimalOutlineBtn}
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
                Add education
              </Button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={stepEase}
              className="space-y-4"
            >
              <h2 className={stepHeadingClass}>Job preferences</h2>
              <div className="flex flex-col gap-2">
                <label className={labelUI}>Job search status</label>
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
              <div className="flex flex-col gap-2">
                <label className={labelUI}>When can you start?</label>
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
              <div className="flex flex-col gap-2">
                <label className={labelUI}>Domain</label>
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={stepEase}
              className="space-y-4"
            >
              <h2 className={stepHeadingClass}>Links</h2>
              <p className="max-w-[65ch] text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                LinkedIn is required so recruiters can verify your background. Other links are optional.
              </p>
              <div className="flex flex-col gap-2">
                <label className={labelUI}>
                  LinkedIn <span className={requiredMark}>*</span>
                </label>
                <input
                  value={form.linkedin}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelUI}>GitHub (optional)</label>
                <input
                  value={form.github}
                  onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
                  placeholder="https://github.com/..."
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelUI}>Portfolio (optional)</label>
                <input
                  value={form.portfolio}
                  onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

            <div className="mt-12 flex flex-col-reverse gap-3 border-t border-[#EAEAEA] pt-10 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              {step === 1 ? (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Back to profile
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  Back
                </Button>
              )}
              {step < 5 ? (
                <Button variant="primary" className={minimalPrimaryBtn} onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button variant="primary" className={minimalPrimaryBtn} onClick={handleSave} isLoading={isLoading}>
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
