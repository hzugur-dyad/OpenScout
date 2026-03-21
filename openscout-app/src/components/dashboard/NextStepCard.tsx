"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import type { NextStepCardModel } from "@/lib/next-step-guidance";

type Props = {
  step: NextStepCardModel;
};

const stepSpring = { type: "spring" as const, stiffness: 100, damping: 20 };

const shellClassName =
  "relative overflow-hidden rounded-lg border border-[#EAEAEA] bg-[#FFFFFF] shadow-none transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#141414] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]";

export function NextStepCard({ step }: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const descId = useId();

  const inner = (
    <>
      <div
        className="absolute left-0 top-0 h-full w-[3px] bg-[#111111] dark:bg-[#E7E5E4]"
        aria-hidden
      />
      <div className="p-6 pl-8 md:p-10 md:pl-11">
        <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-[#A09C98]">
          Suggested next step
        </p>
        <h2
          id="dashboard-next-step-title"
          className="mt-3 text-xl font-semibold leading-snug tracking-tight text-zinc-950 md:text-2xl dark:text-zinc-50"
        >
          {step.title}
        </h2>
        <p
          id={descId}
          className="mt-3 max-w-[65ch] text-sm leading-[1.6] text-[#787774] dark:text-[#A09C98]"
        >
          {step.description}
        </p>
        <div className="mt-8">
          <Button
            variant="charcoal"
            icon={ArrowRight}
            iconPosition="right"
            type="button"
            onClick={() => router.push(step.href)}
            aria-describedby={descId}
            className="min-h-11 px-6"
          >
            {step.ctaLabel}
          </Button>
        </div>
      </div>
    </>
  );

  if (reduceMotion) {
    return (
      <article className={shellClassName} aria-labelledby="dashboard-next-step-title">
        {inner}
      </article>
    );
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={stepSpring}
      className={shellClassName}
      aria-labelledby="dashboard-next-step-title"
    >
      {inner}
    </motion.article>
  );
}
