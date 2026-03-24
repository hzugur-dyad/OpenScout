"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FileText, UploadSimple } from "@phosphor-icons/react";
import { Newsreader } from "next/font/google";
import { applyPendingCandidateProfileIfAny } from "@/lib/apply-pending-registration-profile";
import { captureException } from "@/lib/monitoring";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

/** Step panel motion: ≤400ms, ease-out; disabled when user prefers reduced motion */
const stepEase = { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const };

const easeOut = "ease-[cubic-bezier(0.16,1,0.3,1)]";

const focusRing =
  "focus-visible:border-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 dark:focus-visible:border-zinc-400 dark:focus-visible:ring-zinc-400 dark:focus-visible:ring-offset-[#161616]";

/** ~99% off-white fields; stroke defines edges (minimal shadow). */
const inputClass = `min-h-11 w-full touch-manipulation rounded-lg border border-[#E5E5E3] bg-[#FDFDFC] px-3.5 py-2.5 text-base leading-[1.5] text-[#111111] transition-[border-color,background-color,color] duration-200 ${easeOut} placeholder:text-black/45 sm:text-sm ${focusRing} dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500`;

const inputClassSm = `min-h-11 w-full touch-manipulation rounded-lg border border-[#E5E5E3] bg-[#FDFDFC] px-3 py-2.5 text-base leading-[1.5] text-[#111111] transition-[border-color,background-color,color] duration-200 ${easeOut} placeholder:text-black/45 sm:py-2 sm:text-sm ${focusRing} dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500`;

/** Primary CTA: darker base, hover lifts lightness, active presses darker (no layout shift). */
const minimalPrimaryBtn = `rounded-lg !bg-[#141414] !text-[#FAFAFA] transition-colors duration-200 ${easeOut} hover:!bg-[#2c2c2c] active:!bg-[#0a0a0a] dark:!bg-zinc-100 dark:!text-[#141414] dark:hover:!bg-white dark:active:!bg-zinc-200`;

const minimalOutlineBtn = `rounded-lg border-[#E5E5E3] bg-transparent transition-colors duration-200 ${easeOut} hover:border-[#C8C8C4] hover:bg-[#F2F1EE] dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900`;

/** Match dashboard page: full-bleed bone canvas, same radial wash, max-w-5xl content */
function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative -mx-4 min-h-full min-h-dvh overflow-x-clip bg-transparent px-4 pb-24 pt-10 lg:-mx-8 lg:px-8 dark:bg-transparent">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-transparent [background-image:radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(251,243,219,0.08),transparent_58%)] dark:[background-image:radial-gradient(ellipse_75%_50%_at_50%_-20%,rgba(253,235,236,0.03),transparent_55%)]"
      />
      <div className="relative mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}

const pageTitleClass = `text-[2.25rem] font-semibold leading-[1.12] tracking-[-0.03em] text-[#111111] md:text-5xl dark:text-zinc-100 ${newsreader.className}`;

const stepHeadingClass =
  "text-lg font-semibold leading-snug tracking-tight text-[#111111] dark:text-zinc-100";

const labelUI = "text-sm font-medium text-black/75 dark:text-zinc-200";

const labelCompact = "text-xs font-medium text-black/55 dark:text-zinc-400";

const requiredMark = "text-[#9F2F2D] dark:text-red-300/90";

const mainFormCard = `mt-6 rounded-xl border border-[#E5E5E3] bg-[#FAFAF9] p-8 transition-[border-color,background-color] duration-200 ${easeOut} md:mt-0 md:p-10 hover:border-[#C8C8C4] hover:bg-[#F9F9F7] dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700 dark:hover:bg-[#161616]`;

const bentoInnerCard = `space-y-3 rounded-lg border border-[#E5E5E3] bg-[#F2F1EE] p-5 transition-[border-color,background-color] duration-200 ${easeOut} hover:border-[#C8C8C4] dark:border-zinc-800 dark:bg-[#1a1a18] dark:hover:border-zinc-700`;

const readonlySectionCard =
  "os-surface-card rounded-[10px] p-6 md:p-7 dark:bg-black/45 dark:border-white/[0.12]";

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
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const linkedinRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const stepMotionProps = prefersReducedMotion
    ? {
        initial: false as const,
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12, ease: "easeOut" as const },
      }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: stepEase,
      };

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

  function focusFirstInvalidField(stepNum: number) {
    queueMicrotask(() => {
      if (stepNum === 1) {
        if (!form.first_name.trim()) firstNameRef.current?.focus();
        else if (!form.last_name.trim()) lastNameRef.current?.focus();
        else if (!form.email.trim()) emailRef.current?.focus();
        else if (!form.location.trim()) locationRef.current?.focus();
      } else if (stepNum === 5) {
        linkedinRef.current?.focus();
      }
    });
  }

  function handleNext() {
    setValidationError(null);
    setSaveError(null);
    const err = validateStep(step);
    if (err) {
      setValidationError(err);
      focusFirstInvalidField(step);
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleCvUpload(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".txt")) return;
    if (file.size > 10 * 1024 * 1024) return;
    setCvUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() || "pdf";
      const filePath = `${user.id}/cv.${ext}`;
      await supabase.storage.from("cvs").upload(filePath, file, { upsert: true });
      await supabase
        .from("profile_private")
        .update({ cv_file_url: filePath, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      setCvFileUrl(filePath);
      try {
        await fetch("/api/cv-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath }),
        });
      } catch {}
    } finally {
      setCvUploading(false);
    }
  }

  async function handleSave() {
    setValidationError(null);
    const err = validateStep(5);
    if (err) {
      setValidationError(err);
      focusFirstInvalidField(5);
      return;
    }
    setIsLoading(true);
    setSaveError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        setSaveError("Your session expired. Please sign in again and continue.");
        router.push("/login?next=/onboarding");
        return;
      }

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
      const normalized = e instanceof Error ? e : new Error(String(e));
      // Session/auth state can legitimately drop during long onboarding edits.
      // We handle it gracefully without sending noisy monitoring events.
      if (normalized.message === "Session not found") {
        setSaveError("Your session expired. Please sign in again and continue.");
        router.push("/login?next=/onboarding");
        return;
      }
      captureException(normalized, { route: "/onboarding" });
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
            <div className="h-5 w-24 animate-pulse rounded bg-[#E5E5E3] dark:bg-zinc-800" />
            <ul className="space-y-4">
              {[0, 1, 2, 3, 4].map((k) => (
                <li key={k} className="flex gap-3">
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-[#E5E5E3] dark:bg-zinc-800" />
                  <div className="h-3.5 flex-1 animate-pulse rounded-sm bg-[#E5E5E3]/80 dark:bg-zinc-800/90" />
                </li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-xl border border-[#E5E5E3] bg-[#FAFAF9] p-8 md:p-10 dark:border-zinc-800 dark:bg-[#141414]"
            aria-busy
            aria-label="Loading profile form"
          >
            <div className="h-8 w-2/3 max-w-xs animate-pulse rounded-md bg-[#E5E5E3] dark:bg-zinc-800" />
            <div className="mt-4 h-3.5 w-full max-w-[38ch] animate-pulse rounded-sm bg-[#E5E5E3]/90 dark:bg-zinc-800/90" />
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              <div className="h-10 animate-pulse rounded-md border border-[#E5E5E3] bg-[#F2F1EE] dark:border-zinc-800 dark:bg-zinc-900" />
              <div className="h-10 animate-pulse rounded-md border border-[#E5E5E3] bg-[#F2F1EE] dark:border-zinc-800 dark:bg-zinc-900" />
            </div>
            <div className="mt-4 h-10 max-w-lg animate-pulse rounded-md border border-[#E5E5E3] bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900" />
            <div className="mt-10 h-24 animate-pulse rounded-md border border-[#E5E5E3] bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900" />
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (!editing) {
    return (
      <OnboardingShell>
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-black/55 dark:text-zinc-500">
            Candidate profile
          </p>
          <h1 className={`mt-4 ${pageTitleClass}`}>My Profile</h1>
          <p className="mt-3 max-w-[65ch] text-base leading-[1.5] text-black/70 dark:text-zinc-400">
            Read-only summary for employers. Edit when something changes.
          </p>
        </div>

        <div className="mt-14 max-w-3xl space-y-6">
          <section className={readonlySectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">
              About
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">First name</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.first_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Last name</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.last_name || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Email</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Location</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.location || "—"}</dd>
              </div>
              {form.professional_summary && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Professional summary</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[#111111] dark:text-zinc-100">{form.professional_summary}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className={readonlySectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">Work experience</h2>
            {form.work_experiences.length === 0 ? (
              <p className="mt-3 text-sm leading-[1.5] text-black/55 dark:text-zinc-400">No roles listed yet.</p>
            ) : (
              <ul className="mt-4 space-y-6">
                {form.work_experiences.map((we, i) => (
                  <li key={i}>
                    <p className="font-medium text-[#111111] dark:text-zinc-100">{we.job_title || "—"} at {we.company_name || "—"}</p>
                    {(we.start_date || we.end_date) && (
                      <p className="text-sm text-black/55 dark:text-zinc-400">{we.start_date} – {we.end_date || "Present"}</p>
                    )}
                    {we.description && <p className="mt-1 text-sm leading-[1.5] text-black/70 dark:text-zinc-400">{we.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={readonlySectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">Education</h2>
            {form.educations.length === 0 ? (
              <p className="mt-3 text-sm leading-[1.5] text-black/55 dark:text-zinc-400">No education listed yet.</p>
            ) : (
              <ul className="mt-4 space-y-6">
                {form.educations.map((ed, i) => (
                  <li key={i}>
                    <p className="font-medium text-[#111111] dark:text-zinc-100">{ed.institution || "—"}</p>
                    <p className="text-sm leading-[1.5] text-black/70 dark:text-zinc-400">{ed.degree_type} {ed.field_of_study && `in ${ed.field_of_study}`}</p>
                    {(ed.start_year || ed.end_year) && (
                      <p className="text-sm text-black/55 dark:text-zinc-400">{ed.start_year} – {ed.end_year || "Present"}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={readonlySectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">Job preferences</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Job search status</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.job_search_status?.replace(/_/g, " ") ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Available to start</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.available_start?.replace(/_/g, " ") ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Domain</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.domain ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className={readonlySectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">Links</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">LinkedIn</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.linkedin ? <a href={form.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111111] underline decoration-[#E5E5E3] underline-offset-4 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300">{form.linkedin}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">GitHub</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.github ? <a href={form.github} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111111] underline decoration-[#E5E5E3] underline-offset-4 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300">{form.github}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-black/55 dark:text-zinc-500">Portfolio</dt>
                <dd className="mt-0.5 text-[#111111] dark:text-zinc-100">{form.portfolio ? <a href={form.portfolio} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111111] underline decoration-[#E5E5E3] underline-offset-4 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300">{form.portfolio}</a> : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className={readonlySectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-black/55 dark:text-zinc-500">CV</h2>
            {cvFileUrl ? (
              <div className="mt-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#111111] dark:text-zinc-200" weight="bold" aria-hidden />
                <button
                  type="button"
                  onClick={async () => {
                    const { data } = await supabase.storage.from("cvs").createSignedUrl(cvFileUrl!, 60);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  }}
                  className={`rounded-sm font-medium text-[#111111] underline decoration-[#E5E5E3] underline-offset-4 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300 ${focusRing}`}
                >
                  Download CV
                </button>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleCvUpload(file);
                  }}
                />
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
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleCvUpload(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  disabled={cvUploading}
                  aria-busy={cvUploading}
                  aria-label={cvUploading ? "Uploading CV" : "Upload your CV, PDF or TXT up to 10 MB"}
                  className={`flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-dashed border-[#E5E5E3] bg-[#F2F1EE] p-6 text-sm leading-[1.5] text-black/75 transition-[border-color,background-color] duration-200 ${easeOut} hover:border-[#B8B8B4] hover:bg-[#FAFAF9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 dark:focus-visible:ring-zinc-400 dark:focus-visible:ring-offset-zinc-950`}
                >
                  <UploadSimple className="h-5 w-5 shrink-0" weight="bold" aria-hidden />
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
      <a
        href="#onboarding-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#111111] focus:px-4 focus:py-2.5 focus:text-sm focus:text-white focus:outline-none focus:ring-2 focus:ring-[#111111] focus:ring-offset-2 dark:focus:bg-zinc-100 dark:focus:text-[#111111] dark:focus:ring-zinc-100"
      >
        Skip to profile form
      </a>
      <div className="grid items-start gap-12 md:grid-cols-[minmax(0,15rem)_1fr] lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,13.5rem)] lg:gap-10">
        <aside className="lg:-ml-3" aria-label="Onboarding introduction">
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-black/55 dark:text-zinc-500">
            Setup
          </p>
          <h1 className={`mt-4 ${pageTitleClass}`}>Complete your profile</h1>
          <p className="mt-3 max-w-[65ch] text-base leading-[1.5] text-black/70 dark:text-zinc-400">
            One pass for your details—whether you just signed up or are updating later.
          </p>
          {!onboardingCompletedAt && (
            <p
              className="mt-6 rounded-lg border border-[#E8DFC4] bg-[#FBF6E8] px-4 py-3 text-sm leading-[1.5] text-[#7A5E20] dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300"
              role="status"
            >
              Account is ready. Move through the steps; you can edit fields anytime after saving.
            </p>
          )}
          <Link
            href="/cv-analysis"
            className={`mt-5 inline-flex min-h-11 items-center text-sm font-medium text-[#111111] underline decoration-[#E5E5E3] underline-offset-4 transition-colors duration-200 ${easeOut} hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300`}
          >
            Upload new CV
          </Link>
          <div className="mt-6">
            <p className="mb-2 max-w-[65ch] text-sm leading-[1.5] text-black/60 dark:text-zinc-400">
              When you save your profile, you can share a public page that shows your Scout Score and hiring signal—use
              it on applications and LinkedIn.
            </p>
            <SharePublicProfileButton surface="onboarding" />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="md:hidden">
            <OnboardingStepper currentStep={step} />
          </div>

          <main id="onboarding-main" className={mainFormCard} tabIndex={-1}>
            {validationError && (
              <div
                role="alert"
                data-testid="onboarding-validation-error"
                className="mb-5 rounded-lg border border-[#E8C9CD] bg-[#FDF2F3] px-4 py-3 text-sm leading-[1.5] text-[#8B2926] dark:border-zinc-700 dark:bg-red-950/30 dark:text-red-200"
              >
                {validationError}
              </div>
            )}
            {saveError && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-[#E8C9CD] bg-[#FDF2F3] px-4 py-3 text-sm leading-[1.5] text-[#8B2926] dark:border-zinc-700 dark:bg-red-950/30 dark:text-red-200"
              >
                {saveError}
              </div>
            )}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="1"
              {...stepMotionProps}
              className="space-y-4"
              data-testid="onboarding-step-about"
            >
              <h2 className={stepHeadingClass}>About</h2>
              <p className="max-w-[65ch] text-sm leading-[1.5] text-black/55 dark:text-zinc-400">
                Pre-filled from your account when available. Adjust anything that is out of date.
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="onboarding-first-name" className={labelUI}>
                    First name <span className={requiredMark}>*</span>
                  </label>
                  <input
                    id="onboarding-first-name"
                    ref={firstNameRef}
                    name="first_name"
                    autoComplete="given-name"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className={inputClass}
                    required
                    aria-invalid={!!(validationError && !form.first_name.trim())}
                    aria-required
                    aria-describedby={validationError && !form.first_name.trim() ? "onboarding-first-name-error" : undefined}
                  />
                  {validationError && !form.first_name.trim() && (
                    <p id="onboarding-first-name-error" className="mt-1 text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">Required</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="onboarding-last-name" className={labelUI}>
                    Last name <span className={requiredMark}>*</span>
                  </label>
                  <input
                    id="onboarding-last-name"
                    ref={lastNameRef}
                    name="last_name"
                    autoComplete="family-name"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className={inputClass}
                    required
                    aria-invalid={!!(validationError && !form.last_name.trim())}
                    aria-required
                    aria-describedby={validationError && !form.last_name.trim() ? "onboarding-last-name-error" : undefined}
                  />
                  {validationError && !form.last_name.trim() && (
                    <p id="onboarding-last-name-error" className="mt-1 text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">Required</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="onboarding-email" className={labelUI}>
                  Email <span className={requiredMark}>*</span>
                </label>
                <input
                  id="onboarding-email"
                  ref={emailRef}
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  required
                  aria-invalid={!!(validationError && !form.email.trim())}
                  aria-required
                  aria-describedby={validationError && !form.email.trim() ? "onboarding-email-error" : undefined}
                />
                {validationError && !form.email.trim() && (
                  <p id="onboarding-email-error" className="mt-1 text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">Required</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="onboarding-location" className={labelUI}>
                  Location <span className={requiredMark}>*</span>
                </label>
                <input
                  id="onboarding-location"
                  ref={locationRef}
                  name="location"
                  autoComplete="address-level2"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Berlin, Germany"
                  className={inputClass}
                  required
                  aria-invalid={!!(validationError && !form.location.trim())}
                  aria-required
                  aria-describedby={validationError && !form.location.trim() ? "onboarding-location-error" : undefined}
                />
                {validationError && !form.location.trim() && (
                  <p id="onboarding-location-error" className="text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">Required</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="onboarding-summary" className={labelUI}>Professional summary</label>
                <textarea
                  id="onboarding-summary"
                  name="professional_summary"
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
              {...stepMotionProps}
              className="space-y-4"
              data-testid="onboarding-step-work-experience"
            >
              <h2 className={stepHeadingClass}>Work experience</h2>
              <p className="max-w-[65ch] text-sm leading-[1.5] text-black/55 dark:text-zinc-400">
                Add roles in reverse chronological order when you can; you can skip this step and return later.
              </p>
              {form.work_experiences.length === 0 ? (
                <p className="text-sm leading-[1.5] text-black/55 dark:text-zinc-400">No roles yet. Use the button below to add one.</p>
              ) : (
                form.work_experiences.map((we, i) => (
                  <div key={i} className={bentoInnerCard}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-black/75 dark:text-zinc-200">Role {i + 1}</span>
                      <button
                        type="button"
                        aria-label={`Remove work experience ${i + 1}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            work_experiences: f.work_experiences.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="min-h-11 min-w-11 touch-manipulation rounded-md px-2 text-sm font-medium text-[#9F2F2D] transition-colors hover:bg-[#FDEBEC]/60 hover:text-[#7a2523] dark:text-red-300/90 dark:hover:bg-red-950/20 dark:hover:text-red-200"
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
              {...stepMotionProps}
              className="space-y-4"
            >
              <h2 className={stepHeadingClass}>Education</h2>
              {form.educations.length === 0 ? (
                <p className="text-sm leading-[1.5] text-black/55 dark:text-zinc-400">No entries yet. Add a school or program below.</p>
              ) : (
                form.educations.map((ed, i) => (
                  <div key={i} className={bentoInnerCard}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-black/75 dark:text-zinc-200">Entry {i + 1}</span>
                      <button
                        type="button"
                        aria-label={`Remove education entry ${i + 1}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            educations: f.educations.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="min-h-11 min-w-11 touch-manipulation rounded-md px-2 text-sm font-medium text-[#9F2F2D] transition-colors hover:bg-[#FDEBEC]/60 hover:text-[#7a2523] dark:text-red-300/90 dark:hover:bg-red-950/20 dark:hover:text-red-200"
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
                      <div className="flex flex-col gap-2">
                        <label htmlFor={`onboarding-edu-${i}-field`} className={labelCompact}>
                          Field of study
                        </label>
                        <input
                          id={`onboarding-edu-${i}-field`}
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
              {...stepMotionProps}
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
              {...stepMotionProps}
              className="space-y-4"
            >
              <h2 className={stepHeadingClass}>Links</h2>
              <p className="max-w-[65ch] text-sm leading-[1.5] text-black/55 dark:text-zinc-400">
                LinkedIn is required so recruiters can verify your background. Other links are optional.
              </p>
              <div className="flex flex-col gap-2">
                <label htmlFor="onboarding-linkedin" className={labelUI}>
                  LinkedIn <span className={requiredMark}>*</span>
                </label>
                <input
                  id="onboarding-linkedin"
                  ref={linkedinRef}
                  type="url"
                  name="linkedin"
                  autoComplete="url"
                  inputMode="url"
                  value={form.linkedin}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                  className={inputClass}
                  aria-invalid={!!(validationError && !form.linkedin.trim())}
                  aria-required
                  aria-describedby={validationError && !form.linkedin.trim() ? "onboarding-linkedin-error" : undefined}
                />
                {validationError && !form.linkedin.trim() && (
                  <p id="onboarding-linkedin-error" className="text-sm text-[#9F2F2D] dark:text-red-300/90" role="alert">
                    LinkedIn URL is required
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="onboarding-github" className={labelUI}>GitHub (optional)</label>
                <input
                  id="onboarding-github"
                  type="url"
                  name="github"
                  autoComplete="url"
                  inputMode="url"
                  value={form.github}
                  onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
                  placeholder="https://github.com/..."
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="onboarding-portfolio" className={labelUI}>Portfolio (optional)</label>
                <input
                  id="onboarding-portfolio"
                  type="url"
                  name="portfolio"
                  autoComplete="url"
                  inputMode="url"
                  value={form.portfolio}
                  onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

            <div className="mt-12 flex flex-col-reverse gap-3 border-t border-[#E5E5E3] pt-10 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
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
          </main>
        </div>

        <aside className="hidden lg:block" aria-label="Onboarding progress">
          <OnboardingStepper currentStep={step} />
        </aside>
      </div>
    </OnboardingShell>
  );
}
