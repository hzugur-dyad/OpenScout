"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ChevronDown, X, Plus } from "lucide-react";
import { JOB_TITLES, SKILLS_TECH_OPTIONS, WORK_TRAIT_OPTIONS } from "@/constants/jobFormOptions";

export type AiInterviewConfig = {
  custom_questions?: string[];
  cv_required_items?: string[];
};

type JobListing = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  min_cv_score: number | null;
  is_active: boolean;
  ai_interview_config?: AiInterviewConfig | null;
};

export function EmployerJobForm(props: {
  mode: "create" | "edit";
  companyId: string;
  initial?: Partial<JobListing>;
}) {
  const { mode, companyId, initial } = props;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const config = (initial?.ai_interview_config as AiInterviewConfig | undefined) || {};

  const [titleSelect, setTitleSelect] = useState<string>(() => {
    const t = initial?.title?.trim() ?? "";
    if (JOB_TITLES.includes(t as (typeof JOB_TITLES)[number])) return t;
    return t ? "Other" : "";
  });
  const [titleOther, setTitleOther] = useState(() => {
    const t = initial?.title?.trim() ?? "";
    if (!t || JOB_TITLES.includes(t as (typeof JOB_TITLES)[number])) return "";
    return t;
  });
  const [titleOpen, setTitleOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const descDropdownRef = useRef<HTMLDivElement>(null);
  const reqDropdownRef = useRef<HTMLDivElement>(null);

  const [descTags, setDescTags] = useState<string[]>(() => []);
  const [descCustom, setDescCustom] = useState(() => initial?.description?.trim() ?? "");
  const [descDropdownOpen, setDescDropdownOpen] = useState(false);

  const [reqTags, setReqTags] = useState<string[]>(() => []);
  const [reqCustom, setReqCustom] = useState(() => initial?.requirements?.trim() ?? "");
  const [reqDropdownOpen, setReqDropdownOpen] = useState(false);

  const [customQuestions, setCustomQuestions] = useState<string[]>(() => config.custom_questions?.length ? [...config.custom_questions] : [""]);
  const [cvRequiredItems, setCvRequiredItems] = useState<string[]>(() => config.cv_required_items?.length ? [...config.cv_required_items] : [""]);

  const [minCvScore, setMinCvScore] = useState<number>(initial?.min_cv_score ?? 0);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (titleRef.current && !titleRef.current.contains(target)) setTitleOpen(false);
      if (descDropdownRef.current && !descDropdownRef.current.contains(target)) setDescDropdownOpen(false);
      if (reqDropdownRef.current && !reqDropdownRef.current.contains(target)) setReqDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const titleDisplay = titleSelect === "Other" ? titleOther.trim() : titleSelect;
  const titleValue = titleSelect === "Other" ? titleOther.trim() : titleSelect;

  function mergeTagsAndCustom(tags: string[], custom: string): string {
    const a = [...tags];
    if (custom.trim()) a.push(custom.trim());
    return a.join(", ");
  }

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      const trimmedTitle = titleValue.trim();
      if (!trimmedTitle) throw new Error("Title is required");
      if (minCvScore < 0 || minCvScore > 100) throw new Error("Min CV score must be between 0 and 100");

      const descriptionMerged = mergeTagsAndCustom(descTags, descCustom);
      const requirementsMerged = mergeTagsAndCustom(reqTags, reqCustom);
      const questions = customQuestions.map((q) => q.trim()).filter(Boolean);
      const cvItems = cvRequiredItems.map((s) => s.trim()).filter(Boolean);
      const ai_interview_config: AiInterviewConfig = {
        ...(questions.length > 0 && { custom_questions: questions }),
        ...(cvItems.length > 0 && { cv_required_items: cvItems }),
      };

      const payload = {
        title: trimmedTitle,
        description: descriptionMerged || null,
        requirements: requirementsMerged || null,
        min_cv_score: minCvScore,
        is_active: isActive,
        ai_interview_config: Object.keys(ai_interview_config).length ? ai_interview_config : {},
      };

      if (mode === "create") {
        const { error: insertError } = await supabase.from("job_listings").insert({
          company_id: companyId,
          ...payload,
        });
        if (insertError) throw insertError;
      } else {
        if (!initial?.id) throw new Error("Missing job id");
        const { error: updateError } = await supabase.from("job_listings").update(payload).eq("id", initial.id);
        if (updateError) throw updateError;
      }

      router.push("/employer");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save job listing";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card">
      <div className="grid gap-5">
        {/* Title combobox */}
        <div ref={titleRef} className="relative">
          <label className="text-sm font-medium">Title</label>
          <button
            type="button"
            onClick={() => setTitleOpen((o) => !o)}
            className="mt-2 flex w-full items-center justify-between rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-3 text-left text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <span className={!titleDisplay ? "text-gray-400" : ""}>{titleDisplay || "Select role..."}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${titleOpen ? "rotate-180" : ""}`} />
          </button>
          {titleOpen && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-[10px] border border-[var(--border)] bg-white py-1 shadow-lg">
              {JOB_TITLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTitleSelect(t);
                    setTitleOpen(false);
                    if (t !== "Other") setTitleOther("");
                  }}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {titleSelect === "Other" && (
            <input
              value={titleOther}
              onChange={(e) => setTitleOther(e.target.value)}
              placeholder="Enter job title"
              className="mt-2 w-full rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>

        {/* Description: technical skills / technologies */}
        <div className="relative" ref={descDropdownRef}>
          <label className="text-sm font-medium">Technical Skills &amp; Technologies</label>
          <p className="mt-0.5 text-xs text-gray-500">Select required technologies and describe technical responsibilities.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {descTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-primary-muted px-3 py-1 text-sm"
                style={{ backgroundColor: "var(--primary-muted)" }}
              >
                {t}
                <button type="button" onClick={() => setDescTags(descTags.filter((x) => x !== t))} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDescDropdownOpen((o) => !o)}
            className="mt-2 rounded-[10px] border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-primary hover:text-primary"
          >
            + Add skills / tech
          </button>
          {descDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-[10px] border border-[var(--border)] bg-white p-2 shadow-lg">
              {SKILLS_TECH_OPTIONS.filter((t) => !descTags.includes(t)).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDescTags([...descTags, t]);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={descCustom}
            onChange={(e) => setDescCustom(e.target.value)}
            placeholder="Role overview, technical responsibilities, tools, frameworks, etc."
            rows={4}
            className="mt-2 w-full rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Requirements: personal traits / work preferences */}
        <div className="relative" ref={reqDropdownRef}>
          <label className="text-sm font-medium">Work Preferences &amp; Personal Traits</label>
          <p className="mt-0.5 text-xs text-gray-500">Define work style, environment, and soft skill expectations.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reqTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                style={{ backgroundColor: "var(--primary-muted)" }}
              >
                {t}
                <button type="button" onClick={() => setReqTags(reqTags.filter((x) => x !== t))} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setReqDropdownOpen((o) => !o)}
            className="mt-2 rounded-[10px] border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-primary hover:text-primary"
          >
            + Add trait / preference
          </button>
          {reqDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-[10px] border border-[var(--border)] bg-white p-2 shadow-lg">
              {WORK_TRAIT_OPTIONS.filter((t) => !reqTags.includes(t)).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReqTags([...reqTags, t])}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={reqCustom}
            onChange={(e) => setReqCustom(e.target.value)}
            placeholder="Years of experience, work arrangement details, personality traits, etc."
            rows={3}
            className="mt-2 w-full rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Custom interview questions */}
        <div>
          <label className="text-sm font-medium">Questions you want asked in the interview</label>
          <p className="mt-1 text-xs text-gray-500">
            Optional. Write the question in English (e.g. &quot;Do you like soccer?&quot;) or briefly describe the topic — the AI will turn it into a natural interview question.
          </p>
          <div className="mt-2 space-y-2">
            {customQuestions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => {
                    const next = [...customQuestions];
                    next[i] = e.target.value;
                    setCustomQuestions(next);
                  }}
                  placeholder={`Question ${i + 1}`}
                  className="flex-1 rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setCustomQuestions(customQuestions.filter((_, j) => j !== i))}
                  className="rounded-lg px-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCustomQuestions([...customQuestions, ""])}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Add question
            </button>
          </div>
        </div>

        {/* CV required items */}
        <div>
          <label className="text-sm font-medium">Required items on the CV</label>
          <p className="mt-1 text-xs text-gray-500">These items are considered in CV scoring.</p>
          <div className="mt-2 space-y-2">
            {cvRequiredItems.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={s}
                  onChange={(e) => {
                    const next = [...cvRequiredItems];
                    next[i] = e.target.value;
                    setCvRequiredItems(next);
                  }}
                  placeholder="E.g.: 3 years React, English B2"
                  className="flex-1 rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setCvRequiredItems(cvRequiredItems.filter((_, j) => j !== i))}
                  className="rounded-lg px-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCvRequiredItems([...cvRequiredItems, ""])}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Minimum CV score (0–100)</label>
            <input
              type="number"
              value={minCvScore}
              onChange={(e) => setMinCvScore(Number(e.target.value))}
              className="mt-2 w-full rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              min={0}
              max={100}
            />
          </div>
          <div className="flex items-end gap-3">
            <input
              id="active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="active" className="text-sm">
              Listing is active (public)
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button variant="primary" onClick={handleSave} isLoading={loading}>
            {mode === "create" ? "Create listing" : "Save changes"}
          </Button>
          <Button variant="outline" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
