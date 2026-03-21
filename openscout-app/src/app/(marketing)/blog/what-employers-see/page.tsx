import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "What employers see in your Scout report | OpenScout",
  description: "Your Scout Score shows employers your CV score, interview score, and a structured report — so they know you're pre-vetted.",
};

export default function WhatEmployersSeePage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
      <article className="mx-auto max-w-2xl">
        <Link href="/blog" className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300">
          ← Blog
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-zinc-100">
          What employers see in your Scout report
        </h1>
        <p className="mt-2 text-gray-500 dark:text-zinc-400">Transparent, structured, and comparable.</p>

        <div className="mt-8 space-y-6 text-gray-700 dark:text-zinc-300">
          <p>
            When you apply with your Scout Score, employers don&apos;t see a blank resume. They see a <strong>CV score</strong> (0–100) based on your profile and uploaded CV, an <strong>interview score</strong> (0–100) from your AI interview, and a short <strong>report</strong> with strengths and areas to improve.
          </p>
          <p>
            Everything is structured the same for every candidate. That means employers can compare apples to apples: who passed the bar, who had a strong interview, and what to ask in a follow-up. No more guessing from PDFs. No more &quot;culture fit&quot; screens before skills. Scout-vetted means: we already ran the first filter. You get candidates who showed up and passed.
          </p>
          <p>
            Your Scout report is yours to share — via your Scout Pass link — so even off the platform, you can show employers you&apos;re pre-vetted. One credential, many companies.
          </p>
        </div>

        <div className="mt-10 flex gap-4">
          <Link href="/register">
            <Button variant="primary">Get my Scout Score</Button>
          </Link>
          <Link href="/blog">
            <Button variant="outline">Back to blog</Button>
          </Link>
        </div>
      </article>
      </Container>
    </div>
  );
}
