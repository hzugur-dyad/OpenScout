"use client";

import { motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";

const STEPS = [
  { id: 1, label: "About" },
  { id: 2, label: "Work experience" },
  { id: 3, label: "Education" },
  { id: 4, label: "Job preferences" },
  { id: 5, label: "Links" },
];

const quiet = { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };

export function OnboardingStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <div className="md:hidden -mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="flex min-w-min items-stretch gap-2 px-1">
          {STEPS.map((step) => {
            const done = currentStep > step.id;
            const current = currentStep === step.id;
            return (
              <li key={step.id} className="shrink-0">
                <div
                  className={`flex min-w-[7.25rem] flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-200 ${
                    current
                      ? "border-[#111111] bg-[#F7F6F3] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-zinc-100 dark:bg-zinc-900 dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                      : done
                        ? "border-[#EAEAEA] bg-[#F9F9F8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                        : "border-[#EAEAEA] bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ${
                        done || current
                          ? "bg-[#111111] text-white dark:bg-zinc-100 dark:text-[#111111]"
                          : "border border-[#EAEAEA] bg-white text-[#787774] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-500"
                      }`}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                      ) : (
                        step.id
                      )}
                    </span>
                    <span
                      className={`text-[11px] font-medium leading-tight tracking-tight ${
                        current ? "text-[#111111] dark:text-zinc-100" : "text-[#787774] dark:text-zinc-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <ol className="relative hidden md:block">
        {STEPS.map((step, i) => {
          const done = currentStep > step.id;
          const current = currentStep === step.id;
          const last = i === STEPS.length - 1;
          return (
            <li key={step.id} className="relative flex gap-4 pb-10 last:pb-0">
              {!last && (
                <div
                  className="absolute left-[13px] top-8 bottom-0 w-px bg-[#EAEAEA] dark:bg-zinc-800"
                  aria-hidden
                />
              )}
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ${
                    done || current
                      ? "bg-[#111111] text-white dark:bg-zinc-100 dark:text-[#111111]"
                      : "border border-[#EAEAEA] bg-white text-[#787774] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-600"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  ) : (
                    step.id
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`text-sm font-medium tracking-tight ${
                    current ? "text-[#111111] dark:text-zinc-50" : "text-[#787774] dark:text-zinc-500"
                  }`}
                >
                  {step.label}
                </p>
                {current && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={quiet}
                    className="mt-1 max-w-[30ch] text-xs leading-relaxed text-[#787774] dark:text-zinc-500"
                  >
                    You are here. Saving happens on the final step.
                  </motion.p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
