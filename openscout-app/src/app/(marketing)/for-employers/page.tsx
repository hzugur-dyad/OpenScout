import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "OpenScout for employers | Hire with CV & interview signal",
  description:
    "Post roles, review candidates with structured CV and interview signals, and spend less time on first-round filtering.",
  openGraph: {
    title: "OpenScout for employers",
    description: "Structured candidate signal: CV fit and interview performance in one place.",
  },
};

export default function ForEmployersPage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">OpenScout for employers</h1>
          <p className="mt-3 text-lg text-gray-700 dark:text-zinc-300">
            See candidates who have already invested in fit and preparation — not only what fits in a PDF.
          </p>

          <div className="mt-8 space-y-5 text-gray-700 dark:text-zinc-300">
            <p>
              OpenScout helps hiring teams move faster on quality. Candidates can complete CV analysis against your
              role, practice structured interviews, and apply with a profile that reflects real effort.
            </p>
            <p>
              You spend less time guessing from keywords and more time talking to people who understand the job.
              Listings, applications, and employer tools live in one product so your pipeline stays coherent.
            </p>
            <p>
              Ready to post a role or bring your team on board? Start from the employer area of the product and
              invite collaborators as you scale.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/employer/register">
              <Button variant="primary">Employer sign up</Button>
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
