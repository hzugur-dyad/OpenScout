import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { NextStepCardModel } from "@/lib/next-step-guidance";

type Props = {
  step: NextStepCardModel;
};

export function NextStepCard({ step }: Props) {
  return (
    <div className="rounded-xl border border-[#EAEAEA] border-l-[3px] border-l-[#346538]/35 bg-[#FAFBFA] p-8 pl-7 transition-[box-shadow] duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:border-l-[#9cb89e]/40 dark:bg-zinc-900/80 dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
      <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
        Your next step
      </p>
      <h2 className="mt-3 text-lg font-semibold tracking-tight text-[#111111] dark:text-zinc-100">
        {step.title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-[1.6] text-[#2F3437] dark:text-zinc-400">
        {step.description}
      </p>
      <div className="mt-6">
        <Link
          href={step.href}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#111111] px-6 text-sm font-medium text-white transition-colors hover:bg-[#333333] active:scale-[0.98] dark:bg-zinc-100 dark:text-[#111111] dark:hover:bg-white"
        >
          {step.ctaLabel}
          <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
