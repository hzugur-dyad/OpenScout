"use client";

import Link from "next/link";
import {
  Buildings,
  Code,
  Cpu,
  Globe,
  Lightning,
  Palette,
  Play,
  Stack,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";

const techIcons = [Code, Cpu, Palette, Lightning, Stack, Globe];

export function Hero() {
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";

  return (
    <section className="relative overflow-hidden bg-white dark:bg-zinc-950">
      <div className="pt-20 pb-24 sm:pt-28 sm:pb-32">
        <Container>
          {!isEmployer ? (
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1 text-xs font-medium text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  New: AI Mock Interview
                </span>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl">
                Get your <span style={{ color: "var(--primary-dark)" }}>Scout Score</span>
              </h1>

              <p className="mt-6 text-lg text-gray-600 dark:text-zinc-300 sm:text-xl">
                Practice with AI, prove yourself with a shareable score, and apply with
                confidence - every candidate is evaluated by the same fair standards.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link href="/register">
                  <Button variant="primary" size="lg" icon={Play} iconPosition="left">
                    Get my Scout Score
                  </Button>
                </Link>
                <Link href="/jobs">
                  <Button variant="outline" size="lg">
                    View Job Listings
                  </Button>
                </Link>
              </div>

              <div className="mt-12 flex items-center justify-center gap-5">
                {techIcons.map((Icon, i) => (
                  <Icon
                    key={i}
                    className="h-5 w-5 text-gray-400 dark:text-zinc-500"
                    weight="regular"
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1 text-xs font-medium text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Employer Portal
                </span>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl">
                Hire with <span style={{ color: "var(--primary-dark)" }}>Scout-vetted</span>{" "}
                talent
              </h1>

              <p className="mt-6 text-lg text-gray-600 dark:text-zinc-300 sm:text-xl">
                Scout pre-vets every applicant, so your team screens less, hires faster, and
                selects higher-quality candidates with confidence.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link href="/employer">
                  <Button variant="primary" size="lg" icon={Buildings} iconPosition="left">
                    Post a job
                  </Button>
                </Link>
                <Link href="/employer/pricing">
                  <Button variant="outline" size="lg">
                    See pricing
                  </Button>
                </Link>
              </div>

              <div className="mt-12 flex items-center justify-center gap-5">
                {techIcons.map((Icon, i) => (
                  <Icon
                    key={i}
                    className="h-5 w-5 text-gray-400 dark:text-zinc-500"
                    weight="regular"
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          )}
        </Container>
      </div>
    </section>
  );
}
