"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Container } from "@/components/ui/Container";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Tier = {
  id: string;
  name: string;
  tagline: string;
  price: string;
  period: string;
  highlights: string[];
  cta: { label: string; href: string; variant: "primary" | "secondary" | "outline" };
  featured?: boolean;
};

const ctaBase =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-transparent";

const ctaVariants: Record<Tier["cta"]["variant"], string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark",
  secondary:
    "bg-primary-lighter text-primary-dark hover:bg-primary-muted dark:bg-primary-muted dark:text-primary-dark dark:hover:bg-primary-lighter",
  outline:
    "border border-[var(--border-strong)] bg-transparent hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
};

const candidateTiers: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Core Scout tools",
    price: "$0",
    period: "",
    highlights: ["1 CV analysis / week", "1 mock interview / week", "Profile & job browse"],
    cta: { label: "Start free", href: "/register", variant: "outline" },
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "More reps per week",
    price: "$9.99",
    period: "/ month",
    highlights: ["5 CV analyses / week", "5 mock interviews / week", "Detailed reports"],
    cta: { label: "Choose Plus", href: "/register", variant: "secondary" },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Full runway",
    price: "$19.99",
    period: "/ month",
    highlights: ["Unlimited CV analyses", "Unlimited mock interviews", "Priority support"],
    cta: { label: "Go Pro", href: "/register", variant: "primary" },
    featured: true,
  },
];

const employerTiers: Tier[] = [
  {
    id: "trial",
    name: "Trial",
    tagline: "Try the pipeline",
    price: "$0",
    period: "· 7 days",
    highlights: ["1 job listing", "Scout-vetted applicants", "CV + interview scores"],
    cta: { label: "Start trial", href: "/employer/register", variant: "outline" },
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Hiring teams",
    price: "$99",
    period: "/ month",
    highlights: ["Unlimited listings", "50 applications (total)", "Full reports & support"],
    cta: { label: "Get Growth", href: "/employer/pricing", variant: "primary" },
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "High volume",
    price: "$149",
    period: "/ month",
    highlights: ["Unlimited listings", "100 applications (total)", "Dedicated account manager"],
    cta: { label: "Choose Scale", href: "/employer/pricing", variant: "secondary" },
  },
];

export function LandingPricing() {
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";
  const tiers = isEmployer ? employerTiers : candidateTiers;
  const lastTrackedAudienceRef = useRef<string | null>(null);

  useEffect(() => {
    const audience = isEmployer ? "employer" : "candidate";
    if (lastTrackedAudienceRef.current === audience) return;
    lastTrackedAudienceRef.current = audience;
    trackClient(ANALYTICS_EVENTS.pricing_viewed, {
      surface: "landing_pricing",
      audience,
    });
  }, [isEmployer]);

  return (
    <section className="relative overflow-hidden py-24">
      {/* Soft field — not a flat gray slab */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, color-mix(in srgb, var(--primary) 8%, transparent), transparent 50%)",
        }}
      />

      <Container>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl md:pr-8"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-700 dark:text-zinc-300">
            Pricing
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl md:tracking-tighter">
            {isEmployer ? "Post once. Hire with signal." : "Start free. Scale when you’re ready."}
          </h2>
          <p className="mt-3 max-w-[65ch] text-pretty text-sm leading-relaxed text-zinc-800 dark:text-zinc-300 md:text-base">
            {isEmployer
              ? "Candidates stay free. You pay for listings, applications, and the time you save on screening."
              : "Upgrade only if you want more CV reviews and mock interviews each week — no surprise fees."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-14 max-w-5xl"
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-white/70 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-black/45 dark:backdrop-blur-xl">
            <div className="grid divide-y divide-[var(--border)] dark:divide-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={cn(
                    "relative flex flex-col px-6 py-9 sm:px-8 sm:py-10",
                    tier.featured &&
                      "bg-gradient-to-b from-[var(--primary-muted)]/50 via-transparent to-transparent dark:from-primary/10 dark:via-transparent"
                  )}
                >
                  {tier.featured && (
                    <div
                      className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-90"
                      aria-hidden
                    />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{tier.name}</h3>
                      <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{tier.tagline}</p>
                    </div>
                    {tier.featured && (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: "var(--primary-muted)",
                          color: "var(--primary-dark)",
                        }}
                      >
                        Best fit
                      </span>
                    )}
                  </div>

                  <div className="mt-8 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                    <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                      {tier.price}
                    </span>
                    {tier.period ? (
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tier.period}</span>
                    ) : null}
                  </div>

                  <ul className="mt-8 flex flex-col gap-2.5 border-t border-[var(--border)] pt-8 dark:border-white/[0.06]">
                    {tier.highlights.map((line) => (
                      <li
                        key={line}
                        className="text-sm leading-snug text-zinc-800 dark:text-zinc-200"
                      >
                        <span className="mr-2 inline-block h-1 w-1 translate-y-[-0.15em] rounded-full bg-[var(--primary)] align-middle opacity-80" />
                        {line}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10 flex flex-1 flex-col justify-end">
                    <Link
                      href={tier.cta.href}
                      onClick={() =>
                        trackClient(ANALYTICS_EVENTS.upgrade_clicked, {
                          surface: "landing_pricing",
                          audience: isEmployer ? "employer" : "candidate",
                          target_plan: tier.id,
                        })
                      }
                      className={cn(ctaBase, ctaVariants[tier.cta.variant], "group w-full")}
                    >
                      {tier.cta.label}
                      <ArrowUpRight className="h-4 w-4 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" weight="regular" aria-hidden />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 max-w-[65ch] text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            {isEmployer
              ? "USD · Billed after sign-in. New accounts get a 7-day trial with one listing."
              : "USD pricing. Upgrade anytime from your dashboard after you create an account."}
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
