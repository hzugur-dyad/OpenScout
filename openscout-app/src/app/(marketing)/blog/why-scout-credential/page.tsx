import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Why we built a single credential for job seekers | OpenScout",
  description: "One credential, many companies. We built the Scout Score so you do the work once and stand out everywhere.",
};

export default function WhyScoutCredentialPage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
      <article className="mx-auto max-w-2xl">
        <Link href="/blog" className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300">
          ← Blog
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-zinc-100">
          Why we built a single credential for job seekers
        </h1>
        <p className="mt-2 text-gray-500 dark:text-zinc-400">One credential, many companies.</p>

        <div className="mt-8 space-y-6 text-gray-700 dark:text-zinc-300">
          <p>
            Job hunting is broken: you apply to dozens of companies, fill the same forms, do the same screening calls, and repeat. Employers get hundreds of raw resumes and spend hours filtering. Nobody wins.
          </p>
          <p>
            We built the <strong>Scout Score</strong> so you do the work once. You complete your profile, take one AI interview per role type, and get a shareable credential — a link that shows your CV score, your interview score, and a structured report. When you apply to jobs on OpenScout, employers see that you're already vetted. You skip the first-round noise. They see only candidates who've already passed the bar.
          </p>
          <p>
            That's the promise: <strong>one credential, many companies.</strong> Not "one more job board." The product is the credential. Job listings are where you use it. Get your Scout Score, share it, and let employers come to you.
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
