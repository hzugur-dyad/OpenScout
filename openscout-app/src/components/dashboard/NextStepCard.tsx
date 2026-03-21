import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { NextStepCardModel } from "@/lib/next-step-guidance";

type Props = {
  step: NextStepCardModel;
};

export function NextStepCard({ step }: Props) {
  return (
    <Card className="mt-6 border-2 border-[var(--primary)]/25 bg-[var(--primary-muted)]/20 p-5 dark:border-zinc-600 dark:bg-zinc-900/80">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500">Your next step</p>
      <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-zinc-100">{step.title}</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{step.description}</p>
      <div className="mt-4">
        <Link href={step.href}>
          <Button variant="primary" icon={ArrowRight} iconPosition="right">
            {step.ctaLabel}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
