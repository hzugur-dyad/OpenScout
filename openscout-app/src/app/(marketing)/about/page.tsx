import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "About OpenScout | AI-powered hiring & job search",
  description:
    "OpenScout helps candidates and employers hire with signal: job discovery, CV analysis for real roles, and structured AI mock interviews.",
  openGraph: {
    title: "About OpenScout",
    description:
      "AI-powered hiring: discover roles, analyze your CV, and practice interviews with structured feedback.",
  },
};

export default function AboutPage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">About OpenScout</h1>
          <p className="mt-3 text-lg text-gray-700 dark:text-zinc-300">
            We build tools so hiring and job search rely on evidence, not noise.
          </p>

          <div className="mt-8 space-y-5 text-gray-700 dark:text-zinc-300">
            <p>
              OpenScout is an AI-powered hiring platform for people who take their careers seriously. Job seekers
              discover roles, analyze their CV against real job descriptions, and practice with structured mock
              interviews so they show up prepared.
            </p>
            <p>
              Employers get clearer signal: candidates can share a consistent profile — including CV fit and
              interview performance — instead of anonymous PDFs in a pile. The goal is fewer wasted screens and
              better matches on both sides.
            </p>
            <p>
              We are focused on transparency, structured feedback, and products you can trust for high-stakes
              decisions — not vanity metrics or black-box scores.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/register">
              <Button variant="primary">Get started</Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="outline">How it works</Button>
            </Link>
          </div>
        </article>
      </Container>
    </div>
  );
}
