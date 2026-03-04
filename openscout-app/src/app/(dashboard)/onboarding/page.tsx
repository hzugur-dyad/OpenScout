"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";

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
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
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
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (profile) {
        setForm((f) => ({
          ...f,
          first_name: profile.first_name ?? "",
          last_name: profile.last_name ?? "",
          email: profile.email ?? user.email ?? "",
          location: profile.location ?? "",
          professional_summary: profile.professional_summary ?? "",
        }));
      }
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

      router.push("/dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Complete Your Profile</h1>
      <p className="mt-1 text-gray-500">
        Review and complete your information.
      </p>
      <a href="#" className="mt-2 inline-block text-sm text-primary hover:underline">
        Upload new CV
      </a>

      <div className="mt-8">
        <OnboardingStepper currentStep={step} />
      </div>

      <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft">
        {validationError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
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
            >
              <h2 className="text-lg font-semibold">About</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Last Name <span className="text-red-500">*</span></label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Location <span className="text-red-500">*</span></label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Berlin, Germany"
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                />
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
            >
              <h2 className="text-lg font-semibold">Work Experience</h2>
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
                        <label className="mb-1 block text-xs font-medium text-gray-600">Degree</label>
                        <select
                          value={ed.degree_type}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              educations: f.educations.map((e2, idx) =>
                                idx === i ? { ...e2, degree_type: e.target.value } : e2
                              ),
                            }))
                          }
                          className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm"
                        >
                          <option value="bachelor">Bachelor</option>
                          <option value="master">Master</option>
                          <option value="phd">PhD</option>
                          <option value="associate">Associate</option>
                          <option value="diploma">Diploma</option>
                        </select>
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
                <label className="mb-1 block text-sm font-medium">Job search status</label>
                <select
                  value={form.job_search_status}
                  onChange={(e) => setForm((f) => ({ ...f, job_search_status: e.target.value }))}
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                >
                  <option value="actively_looking">Actively looking</option>
                  <option value="open">Open to opportunities</option>
                  <option value="not_looking">Not looking now</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">When can you start?</label>
                <select
                  value={form.available_start}
                  onChange={(e) => setForm((f) => ({ ...f, available_start: e.target.value }))}
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                >
                  <option value="immediately">Immediately</option>
                  <option value="within_1_month">Within 1 month</option>
                  <option value="within_3_months">Within 3 months</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Domain</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  className="w-full rounded-[10px] border border-[var(--border)] px-4 py-2"
                >
                  <option value="engineering">Engineering</option>
                  <option value="marketing">Marketing</option>
                  <option value="finance">Finance</option>
                </select>
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
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            Back
          </Button>
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
