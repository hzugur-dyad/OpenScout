import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { NextStepCardModel } from "@/lib/next-step-guidance";

type Props = {
  step: NextStepCardModel;
};

export function NextStepCard({ step }: Props) {
  return (
    <div className="rounded-[12px] border border-zinc-200/90 border-l-[3px] border-l-[#346538]/40 bg-[#F7FAF7] p-8 pl-7 transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] hover:border-zinc-300 hover:bg-[#F3F6F3] dark:border-zinc-800 dark:border-l-[#9cb89e]/45 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/30">
      <p className="text-xs font-semibold uppercase tracking-[0.05em] text-zinc-900/50 dark:text-zinc-500">
        Your next step
      </p>
      <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-100">
        {step.title}
      </h2>
      <p className="mt-2 max-w-xl text-sm font-normal leading-[1.5] text-zinc-900/60 dark:text-zinc-400">
        {step.description}
      </p>
      <div className="mt-6">
        <Link
          href={step.href}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-zinc-900 px-6 text-sm font-semibold text-zinc-50 transition-[background-color,transform,color] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] hover:bg-zinc-800 active:scale-[0.99] active:bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:active:bg-zinc-200"
        >
          {step.ctaLabel}
          <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
