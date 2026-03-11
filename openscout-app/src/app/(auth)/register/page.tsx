"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Compass, Upload, FileText, X, Check } from "lucide-react";

const PENDING_PROFILE_KEY = "pending_candidate_profile";
const TOTAL_STEPS = 6;

const STEP_LABELS = ["Account", "About", "Work", "Education", "Preferences", "Links & CV"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <div key={label} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                done
                  ? "bg-primary text-white"
                  : active
                    ? "bg-primary text-white"
                    : "border-2 border-gray-200 bg-white text-gray-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-500"
              }`}
              style={active ? { backgroundColor: "var(--primary)" } : done ? { backgroundColor: "var(--primary)" } : {}}
            >
              {done ? <Check className="h-4 w-4" /> : stepNum}
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-6 rounded ${done ? "bg-primary" : "bg-gray-200 dark:bg-zinc-600"}`}
                style={done ? { backgroundColor: "var(--primary)" } : {}}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

type WorkExp = {
  company_name: string;
  job_title: string;
  start_date: string;
  end_date: string;
  employment_type: string;
  location: string;
  is_remote: boolean;
  description: string;
  highlights: string[];
};

type Education = {
  institution: string;
  location: string;
  degree_type: string;
  field_of_study: string;
  start_year: string;
  end_year: string;
  completed: boolean;
};

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 - Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 - About
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");

  // Step 3 - Work Experience
  const [workExperiences, setWorkExperiences] = useState<WorkExp[]>([]);

  // Step 4 - Education
  const [educations, setEducations] = useState<Education[]>([]);

  // Step 5 - Job Preferences
  const [jobSearchStatus, setJobSearchStatus] = useState("actively_looking");
  const [availableStart, setAvailableStart] = useState("within_1_month");
  const [domain, setDomain] = useState("engineering");

  // Step 6 - Links & CV
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && typeof window !== "undefined") {
      try { sessionStorage.setItem("referral_ref", ref.trim()); } catch {}
    }
  }, [searchParams]);

  const inputClass = "w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500";

  function validateStep(): string | null {
    if (step === 1) {
      if (!email.trim()) return "Email is required";
      if (password.length < 6) return "Password must be at least 6 characters";
      if (password !== confirmPassword) return "Passwords do not match";
    }
    if (step === 2) {
      if (!firstName.trim()) return "First name is required";
      if (!lastName.trim()) return "Last name is required";
      if (!location.trim()) return "Location is required";
    }
    if (step === 6) {
      if (!linkedin.trim()) return "LinkedIn URL is required";
      if (!cvFile) return "Please upload your CV (PDF or TXT)";
    }
    return null;
  }

  function handleNext() {
    setError(null);
    const err = validateStep();
    if (err) { setError(err); return; }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".txt")) {
      setError("Only PDF and TXT files are supported");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit");
      return;
    }
    setError(null);
    setCvFile(file);
  }

  function buildProfilePayload() {
    return {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      location: location.trim(),
      professional_summary: summary.trim(),
      work_experiences: workExperiences,
      educations,
      job_search_status: jobSearchStatus,
      available_start: availableStart,
      domain,
      linkedin: linkedin.trim(),
      github: github.trim(),
      portfolio: portfolio.trim(),
    };
  }

  async function saveFullProfile(userId: string, userEmail: string) {
    const payload = buildProfilePayload();

    await supabase.from("profiles").upsert({
      user_id: userId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: userEmail,
      location: payload.location,
      professional_summary: payload.professional_summary,
      updated_at: new Date().toISOString(),
    });

    if (payload.work_experiences.length > 0) {
      await supabase.from("work_experiences").delete().eq("user_id", userId);
      for (let i = 0; i < payload.work_experiences.length; i++) {
        const we = payload.work_experiences[i];
        await supabase.from("work_experiences").insert({
          user_id: userId,
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

    if (payload.educations.length > 0) {
      await supabase.from("educations").delete().eq("user_id", userId);
      for (let i = 0; i < payload.educations.length; i++) {
        const ed = payload.educations[i];
        await supabase.from("educations").insert({
          user_id: userId,
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
      user_id: userId,
      job_search_status: payload.job_search_status,
      available_start: payload.available_start,
      domain: payload.domain,
      updated_at: new Date().toISOString(),
    });

    await supabase.from("professional_links").upsert({
      user_id: userId,
      linkedin: payload.linkedin || null,
      github: payload.github || null,
      portfolio: payload.portfolio || null,
      updated_at: new Date().toISOString(),
    });

    // Upload CV to Supabase Storage
    if (cvFile) {
      const ext = cvFile.name.split(".").pop() || "pdf";
      const filePath = `${userId}/cv.${ext}`;
      await supabase.storage.from("cvs").upload(filePath, cvFile, { upsert: true });
      const { data: urlData } = supabase.storage.from("cvs").getPublicUrl(filePath);

      let cvRawText = "";
      try {
        const buffer = await cvFile.arrayBuffer();
        if (cvFile.name.toLowerCase().endsWith(".txt")) {
          cvRawText = new TextDecoder().decode(buffer);
        }
        // For PDF: text extraction will happen server-side on first use
      } catch {}

      await supabase.from("profiles").update({
        cv_file_url: urlData?.publicUrl || filePath,
        ...(cvRawText ? { cv_raw_text: cvRawText } : {}),
      }).eq("user_id", userId);
    }
  }

  async function handleSubmit() {
    setError(null);
    const err = validateStep();
    if (err) { setError(err); return; }

    setIsLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
        },
      });
      if (signUpError) throw signUpError;

      if (data?.user && !data?.session) {
        // Email confirmation required -- store profile in sessionStorage
        setSuccess(true);
        try {
          sessionStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(buildProfilePayload()));
        } catch {}
        return;
      }

      if (data?.user && data?.session) {
        await saveFullProfile(data.user.id, data.user.email ?? email.trim());
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const lower = raw.toLowerCase();
      setError(
        lower.includes("rate limit") || lower.includes("rate_limit")
          ? "Too many sign-up attempts. Please wait a few minutes and try again."
          : raw
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--primary-lighter)]/30 px-4 dark:bg-transparent">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--primary)" }}>
              <Compass className="h-6 w-6 text-white" />
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-zinc-100">OpenScout</span>
          </Link>
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card text-center dark:border-white/[0.06] dark:bg-zinc-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Check your email</h1>
            <p className="mt-2 text-gray-500 dark:text-zinc-400">
              We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account and sign in.
            </p>
            <p className="mt-4 text-sm text-gray-400 dark:text-zinc-500">Your profile will be saved once you confirm your email.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--primary-lighter)]/30 px-4 py-8 dark:bg-transparent">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--primary)" }}>
            <Compass className="h-6 w-6 text-white" />
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-zinc-100">OpenScout</span>
        </Link>

        <div className="mb-6">
          <StepIndicator current={step} />
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-zinc-100">{STEP_LABELS[step - 1]}</h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-zinc-400">Step {step} of {TOTAL_STEPS}</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{error}</div>
          )}

          {/* Step 1 - Account */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} placeholder="At least 6 characters" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} />
              </div>
            </div>
          )}

          {/* Step 2 - About */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">First Name <span className="text-red-500">*</span></label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} placeholder="Jane" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Last Name <span className="text-red-500">*</span></label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} placeholder="Doe" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Location <span className="text-red-500">*</span></label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} required className={inputClass} placeholder="Berlin, Germany" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Professional Summary</label>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputClass} placeholder="Brief overview of your experience and goals" />
              </div>
            </div>
          )}

          {/* Step 3 - Work Experience */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-zinc-400">Add your past roles. You can skip this and add later.</p>
              {workExperiences.map((we, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-zinc-400">Experience {i + 1}</span>
                    <button type="button" onClick={() => setWorkExperiences((arr) => arr.filter((_, idx) => idx !== i))} className="text-sm text-red-600 hover:underline">Remove</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Company</label>
                      <input value={we.company_name} onChange={(e) => setWorkExperiences((arr) => arr.map((w, idx) => idx === i ? { ...w, company_name: e.target.value } : w))} className={inputClass} placeholder="Company name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Job Title</label>
                      <input value={we.job_title} onChange={(e) => setWorkExperiences((arr) => arr.map((w, idx) => idx === i ? { ...w, job_title: e.target.value } : w))} className={inputClass} placeholder="Job title" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Start Date</label>
                      <input type="month" value={we.start_date} onChange={(e) => setWorkExperiences((arr) => arr.map((w, idx) => idx === i ? { ...w, start_date: e.target.value } : w))} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">End Date</label>
                      <input type="month" value={we.end_date} onChange={(e) => setWorkExperiences((arr) => arr.map((w, idx) => idx === i ? { ...w, end_date: e.target.value } : w))} className={inputClass} placeholder="Present" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Description</label>
                    <textarea value={we.description} onChange={(e) => setWorkExperiences((arr) => arr.map((w, idx) => idx === i ? { ...w, description: e.target.value } : w))} rows={2} className={inputClass} placeholder="Brief description" />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setWorkExperiences((arr) => [...arr, { company_name: "", job_title: "", start_date: "", end_date: "", employment_type: "full_time", location: "", is_remote: false, description: "", highlights: [] }])}>
                + Add Experience
              </Button>
            </div>
          )}

          {/* Step 4 - Education */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-zinc-400">Add your education. You can skip this and add later.</p>
              {educations.map((ed, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-zinc-400">Education {i + 1}</span>
                    <button type="button" onClick={() => setEducations((arr) => arr.filter((_, idx) => idx !== i))} className="text-sm text-red-600 hover:underline">Remove</button>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Institution</label>
                    <input value={ed.institution} onChange={(e) => setEducations((arr) => arr.map((e2, idx) => idx === i ? { ...e2, institution: e.target.value } : e2))} className={inputClass} placeholder="University / School" />
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
                        onChange={(v) => setEducations((arr) => arr.map((e2, idx) => idx === i ? { ...e2, degree_type: v } : e2))}
                        aria-label="Degree"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Field of Study</label>
                      <input value={ed.field_of_study} onChange={(e) => setEducations((arr) => arr.map((e2, idx) => idx === i ? { ...e2, field_of_study: e.target.value } : e2))} className={inputClass} placeholder="e.g. Computer Science" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Start Year</label>
                      <input type="number" min={1950} max={2030} value={ed.start_year} onChange={(e) => setEducations((arr) => arr.map((e2, idx) => idx === i ? { ...e2, start_year: e.target.value } : e2))} className={inputClass} placeholder="2020" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">End Year</label>
                      <input type="number" min={1950} max={2030} value={ed.end_year} onChange={(e) => setEducations((arr) => arr.map((e2, idx) => idx === i ? { ...e2, end_year: e.target.value } : e2))} className={inputClass} placeholder="2024" />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEducations((arr) => [...arr, { institution: "", location: "", degree_type: "bachelor", field_of_study: "", start_year: "", end_year: "", completed: true }])}>
                + Add Education
              </Button>
            </div>
          )}

          {/* Step 5 - Job Preferences */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Job search status</label>
                <CustomSelect
                  options={[
                    { value: "actively_looking", label: "Actively looking" },
                    { value: "open", label: "Open to opportunities" },
                    { value: "not_looking", label: "Not looking now" },
                  ]}
                  value={jobSearchStatus}
                  onChange={setJobSearchStatus}
                  aria-label="Job search status"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">When can you start?</label>
                <CustomSelect
                  options={[
                    { value: "immediately", label: "Immediately" },
                    { value: "within_1_month", label: "Within 1 month" },
                    { value: "within_3_months", label: "Within 3 months" },
                  ]}
                  value={availableStart}
                  onChange={setAvailableStart}
                  aria-label="When can you start"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Domain</label>
                <CustomSelect
                  options={[
                    { value: "engineering", label: "Engineering" },
                    { value: "marketing", label: "Marketing" },
                    { value: "finance", label: "Finance" },
                    { value: "design", label: "Design" },
                    { value: "other", label: "Other" },
                  ]}
                  value={domain}
                  onChange={setDomain}
                  aria-label="Domain"
                />
              </div>
            </div>
          )}

          {/* Step 6 - Links & CV */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">LinkedIn <span className="text-red-500">*</span></label>
                <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className={inputClass} placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">GitHub (optional)</label>
                <input value={github} onChange={(e) => setGithub(e.target.value)} className={inputClass} placeholder="https://github.com/..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Portfolio (optional)</label>
                <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className={inputClass} placeholder="https://..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Upload CV <span className="text-red-500">*</span></label>
                <input ref={fileInputRef} type="file" accept=".pdf,.txt" onChange={handleFileChange} className="hidden" />
                {cvFile ? (
                  <div className="flex items-center gap-3 rounded-[10px] border border-green-200 bg-green-50 p-3">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="flex-1 truncate text-sm font-medium text-green-800">{cvFile.name}</span>
                    <button type="button" onClick={() => { setCvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500 hover:border-primary hover:text-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-primary dark:hover:text-primary"
                  >
                    <Upload className="h-5 w-5" />
                    Click to upload PDF or TXT (max 10MB)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack}>Back</Button>
            ) : (
              <div />
            )}
            {step < TOTAL_STEPS ? (
              <Button variant="primary" onClick={handleNext}>Next</Button>
            ) : (
              <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
                Create Account
              </Button>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
            Hiring?{" "}
            <Link href="/employer/register" className="font-medium text-primary hover:underline">Register as employer</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
