import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "How OpenScout works | CV analysis, jobs & AI interviews",
  description:
    "Step-by-step: find jobs, run CV analysis against real listings, practice mock interviews, and share your profile with employers.",
  openGraph: {
    title: "How OpenScout works",
    description: "CV analysis, job discovery, and AI mock interviews in one workflow.",
  },
};

const steps = [
  {
    title: "Create your profile",
    body: "Sign up and add your background so we can personalize job matches and interview practice.",
  },
  {
    title: "Analyze your CV for real roles",
    body: "Upload your CV and compare it to specific job descriptions — not generic tips — so you know where you fit.",
  },
  {
    title: "Practice structured interviews",
    body: "Run AI mock interviews with consistent scoring and feedback you can use to improve before real conversations.",
  },
  {
    title: "Apply with signal",
    body: "Use OpenScout job listings and share a profile that reflects your preparation, not just a resume file name.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">How OpenScout works</h1>
          <p className="mt-3 text-lg text-gray-700 dark:text-zinc-300">
            One flow from discovery to interview readiness — built for candidates and hiring teams.
          </p>

          <ol className="mt-10 space-y-8">
            {steps.map((step, i) => (
              <li key={step.title} className="border-l-2 border-[var(--primary)] pl-5 dark:border-[var(--primary)]">
                <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">Step {i + 1}</span>
                <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-zinc-100">{step.title}</h2>
                <p className="mt-2 text-gray-700 dark:text-zinc-300">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap gap-4">
            <Link href="/jobs">
              <Button variant="primary">Browse jobs</Button>
            </Link>
            <Link href="/for-employers">
              <Button variant="outline">For employers</Button>
            </Link>
          </div>
        </article>
      </Container>
    </div>
  );
}
