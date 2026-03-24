"use client";

import Link from "next/link";
import {
  User,
  Award,
  Send,
  Building2,
  ListChecks,
  Zap,
  Timer,
  UserRoundSearch,
  MessageSquareText,
  BrainCircuit,
  BadgeCheck,
  GitCompareArrows,
  Scale,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Fragment } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";
import { AnimatedHero } from "@/components/landing/AnimatedHero";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";

const faqs = [
  {
    q: "Is this free?",
    a: "Core features are free for job seekers. Mock interviews and CV analysis are limited. Upgrade to premium for unlimited access.",
  },
  {
    q: "How does the mock interview work?",
    a: "Pick a job category, answer Nova’s questions out loud, and receive a scored report plus a shareable Scout Score — one credential, many companies.",
  },
  {
    q: "What is the Scout Score?",
    a: "Your Scout Score is a shareable credential (CV score + interview score + report). Employers on OpenScout see it so you skip first-round screening. Read more in our blog.",
  },
  {
    q: "Which job categories do you support?",
    a: "Software (Frontend, Backend, Full Stack), Marketing, Finance, HR and more. The list keeps growing.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All your data is encrypted and stored according to our privacy policy.",
  },
];

export default function LandingPage() {
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";

  return (
    <>
      {/* Hero with entrance animation */}
      <AnimatedHero />

      {/* Stats/Benefits */}
      <section className="landing-framer-dim border-y border-[var(--border)] py-16 dark:border-zinc-800">
        <Container>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(!isEmployer
              ? [
                  { value: "AI Evaluation", label: "Fair interview" },
                  { value: "< 2 weeks", label: "Fast process" },
                  { value: "100%", label: "Free for candidates" },
                  { value: "AI Precision", label: "Consistent quality" },
                ]
              : [
                  { value: "Pre-vetted", label: "CV + interview score" },
                  { value: "< 2 weeks", label: "Hire faster" },
                  { value: "One bar", label: "Same format for all" },
                  { value: "Less screening", label: "Skip first rounds" },
                ]
            ).map((item: { value: string; label: string }, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-xl border border-black/10 bg-black/5 p-6 text-center backdrop-blur-sm transition-colors duration-300 hover:border-[var(--primary)]/40 dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl dark:hover:border-[var(--primary)]/45"
              >
                <div className="mx-auto mb-4 h-px w-9 bg-[var(--primary)]/55 transition-all duration-300 group-hover:w-12 group-hover:bg-[var(--primary)]/75" />
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-700 dark:text-zinc-300">
                  {item.label}
                </p>
                <p className="mt-3 text-[1.6rem] font-semibold leading-none tracking-tight text-gray-900 dark:text-zinc-100 sm:text-[1.85rem]">
                  {item.value}
                </p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works - different for job seeker vs employer */}
      <section className="py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-zinc-100">How It Works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-800 dark:text-zinc-300">
            {!isEmployer
              ? "Get your Scout Score — the one credential that gets you in the room. Job listings are where you use it."
              : "Post your role, set your bar. Only candidates with a Scout Score can apply — so you see CV score and interview report from day one."}
          </p>
          {(() => {
            const steps = !isEmployer
              ? [
                  { step: 1, title: "Build Profile", desc: "Upload your CV and fill in your details. AI evaluates and scores you.", icon: User },
                  { step: 2, title: "Get your Scout Score", desc: "Take one mock interview per role. Get a shareable credential and report.", icon: Award },
                  { step: 3, title: "Apply everywhere", desc: "One credential, many companies. Connect with employers who trust Scout.", icon: Send },
                ]
              : [
                  { step: 1, title: "Create company & post", desc: "Add your company and job listing. Set minimum CV score and optional interview questions.", icon: Building2 },
                  { step: 2, title: "Receive applications", desc: "Only Scout-vetted candidates can apply. Each has a CV score and mock interview report.", icon: ListChecks },
                  { step: 3, title: "Hire faster", desc: "Skip first-round screening. Compare candidates on the same score and report format.", icon: Zap },
                ];
            return (
              <div className="mx-auto mt-16 flex max-w-4xl flex-col items-stretch gap-6 md:flex-row md:items-stretch md:gap-0">
                {steps.map((item: { step: number; title: string; desc: string; icon: LucideIcon }, i) => (
                  <Fragment key={item.step}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex h-full min-h-[220px] flex-1 flex-col items-center rounded-[10px] border border-[var(--border)] bg-black/5 p-6 shadow-soft backdrop-blur-md dark:border-white/[0.12] dark:bg-black/40 dark:backdrop-blur-xl"
                    >
                      <div
                        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: "var(--primary)" }}
                      >
                        <item.icon className="h-6 w-6" aria-hidden />
                      </div>
                      <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-zinc-100">{item.title}</h3>
                      <p className="mt-2 text-center text-sm text-gray-700 dark:text-zinc-300">
                        {item.desc}
                      </p>
                    </motion.div>
                    {i < steps.length - 1 && (
                      <div className="hidden shrink-0 items-center md:flex" aria-hidden>
                        <div className="h-px w-10 bg-zinc-300 dark:bg-zinc-600" />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            );
          })()}
        </Container>
      </section>

      {/* Why OpenScout - different heading and cards for employer */}
      <section className="landing-framer-dim border-t border-[var(--border)] bg-transparent py-20 dark:border-zinc-800 dark:bg-transparent">
        <Container>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-zinc-100">
            {!isEmployer ? "Why Candidates Choose OpenScout" : "Why Employers Use OpenScout"}
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
            {(!isEmployer
              ? [
                  {
                    title: "Hired in days",
                    desc: "No long waits. Our candidates get offers within 2 weeks.",
                    icon: Timer,
                  },
                  {
                    title: "Skip the gatekeepers",
                    desc: "Connect directly with employers. No recruiter screens.",
                    icon: UserRoundSearch,
                  },
                  {
                    title: "Real feedback",
                    desc: "Learn exactly what to improve after every interview.",
                    icon: MessageSquareText,
                  },
                  {
                    title: "Practice with AI",
                    desc: "Test yourself with mock interviews and prepare for the real one.",
                    icon: BrainCircuit,
                  },
                ]
              : [
                  {
                    title: "Pre-vetted candidates",
                    desc: "Every applicant has a CV score and mock interview report. No blank resumes.",
                    icon: BadgeCheck,
                  },
                  {
                    title: "Less screening time",
                    desc: "Compare apples to apples. Same score format for every candidate.",
                    icon: GitCompareArrows,
                  },
                  {
                    title: "One credential, many roles",
                    desc: "Candidates do the work once. You see their Scout Score when they apply.",
                    icon: Scale,
                  },
                  {
                    title: "Hire in days",
                    desc: "Cut first-round interviews. Move straight to the candidates who passed the bar.",
                    icon: Rocket,
                  },
                ]
            ).map((item: { title: string; desc: string; icon: LucideIcon }, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex gap-4 rounded-[10px] border border-[var(--border)] bg-black/5 p-6 shadow-soft backdrop-blur-md dark:border-white/[0.12] dark:bg-black/40 dark:backdrop-blur-xl"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--primary-lighter)" }}
                >
                  <item.icon className="h-5 w-5 text-[var(--primary)]" aria-hidden />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-700 dark:text-zinc-300">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      <LandingPricing />

      {/* FAQ */}
      <section className="py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-zinc-100">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="mx-auto mt-12 max-w-2xl space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Container>
      </section>

      {/* For employers */}
      <section className="landing-framer-dim border-t border-[var(--border)] bg-transparent py-20 dark:border-zinc-800 dark:bg-transparent">
        <Container>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-zinc-100">For Employers</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-800 dark:text-zinc-300">
            Get applicants who are already Scout-vetted. Every candidate has a CV score and mock interview report — cut screening time and hire faster.
          </p>
          <div className="mt-10 flex justify-center">
            <Link href="/employer">
              <Button variant="secondary" size="lg">
                Post a job — get Scout-vetted candidates
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      {/* CTA — style only depends on theme after mount to avoid hydration mismatch */}
      <section className="landing-framer-dim py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Ready to get your Scout Score?</h2>
            <p className="mt-2 text-gray-800 dark:text-zinc-300">
              One credential, many companies. Create your profile and take the mock interview.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <Button variant="primary" size="lg">
                Get my Scout Score
              </Button>
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
