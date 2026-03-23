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
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LandingLottie } from "@/components/landing/LandingLottie";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";

const techIcons = [Code, Cpu, Palette, Lightning, Stack, Globe];

export function AnimatedHero() {
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";

  return (
    <section className="landing-framer-dim relative overflow-hidden">
      <div className="pt-20 pb-24 sm:pt-28 sm:pb-32">
        <Container>
          {!isEmployer ? (
            <div className="relative">
              <div className="mx-auto max-w-3xl text-center">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl">
                  Get your{" "}
                  <span style={{ color: "var(--primary-dark)" }}>Scout Score</span>
                </h1>

                <p className="mt-6 text-lg text-gray-800 dark:text-zinc-200 sm:text-xl">
                  One credential, many companies. Take one mock interview, get a shareable
                  score and report — stand out to every employer.
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
                      className="h-5 w-5 text-gray-600 dark:text-zinc-300"
                      weight="regular"
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
              <div className="absolute left-[-125] top-20 hidden lg:block -rotate-[1deg]">
                <LandingLottie
                  animationPath="/animations/landing-scene-left.json"
                  wrapperClassName="shrink-0 w-full max-w-[240px] sm:max-w-[274px] lg:max-w-[308px]"
                  loop={false}
                />
              </div>
              <div className="absolute -right-28 top-12 hidden lg:block">
                <LandingLottie />
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="mx-auto max-w-3xl text-center">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl">
                  Hire with{" "}
                  <span style={{ color: "var(--primary-dark)" }}>Scout-vetted</span> talent
                </h1>

                <p className="mt-6 text-lg text-gray-800 dark:text-zinc-200 sm:text-xl">
                  Every candidate has a CV score and mock interview report. Cut screening time
                  and hire faster — only applicants who passed the bar.
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
                      className="h-5 w-5 text-gray-600 dark:text-zinc-300"
                      weight="regular"
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
              <div className="absolute left-[-125] top-20 hidden lg:block -rotate-[1deg]">
                <LandingLottie
                  animationPath="/animations/landing-scene-left.json"
                  wrapperClassName="shrink-0 w-full max-w-[240px] sm:max-w-[274px] lg:max-w-[308px]"
                  loop={false}
                />
              </div>
              <div className="absolute -right-28 top-12 hidden lg:block">
                <LandingLottie />
              </div>
            </div>
          )}
        </Container>
      </div>
    </section>
  );
}
