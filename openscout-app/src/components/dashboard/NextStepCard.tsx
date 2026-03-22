import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { NextStepCardModel } from "@/lib/next-step-guidance";

type Props = {
  step: NextStepCardModel;
};

export function NextStepCard({ step }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 border-l-emerald-500/45 bg-white p-8 pl-7 shadow-[0_20px_44px_-22px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-zinc-800/90 dark:border-l-emerald-400/40 dark:bg-zinc-900 dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-500">
        Your next step
      </p>
      <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {step.title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {step.description}
      </p>
      <div className="mt-6">
        <Link
          href={step.href}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {step.ctaLabel}
          <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
