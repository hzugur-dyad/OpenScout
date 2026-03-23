"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import {
  Briefcase,
  Buildings,
  CaretDown,
  ChatCircle,
  FileText,
  Users,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";
import { AnimatedHero } from "@/components/landing/AnimatedHero";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { useTheme } from "next-themes";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is this free?",
    a: "Core features are free for job seekers. Mock interviews and CV analysis are limited. Upgrade to premium for unlimited access.",
  },
  {
    q: "How does the AI interview work?",
    a: "Based on your selected job category, the AI asks you questions. You answer verbally, the AI evaluates and provides a detailed report. Get a shareable Scout Score — one credential, many companies.",
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
  const { resolvedTheme } = useTheme();
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
                  { value: "Direct", label: "Employer access" },
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
                className="group relative overflow-hidden rounded-xl border border-black/10 bg-white/80 p-6 text-center backdrop-blur-sm transition-colors duration-300 hover:border-[var(--primary)]/40 dark:border-white/[0.12] dark:bg-zinc-950/35 dark:hover:border-[var(--primary)]/45"
              >
                <div className="mx-auto mb-4 h-px w-9 bg-[var(--primary)]/55 transition-all duration-300 group-hover:w-12 group-hover:bg-[var(--primary)]/75" />
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-zinc-400">
                  {item.label}
                </p>
                <p
                  className="mt-3 text-[1.6rem] font-semibold leading-none tracking-tight sm:text-[1.85rem]"
                  style={{ color: "var(--primary-dark)" }}
                >
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
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600 dark:text-zinc-400">
            {!isEmployer
              ? "Get your Scout Score — the one credential that gets you in the room. Job listings are where you use it."
              : "Post your role, set your bar. Only candidates with a Scout Score can apply — so you see CV score and interview report from day one."}
          </p>
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {(!isEmployer
              ? [
                  { step: 1, title: "Build Profile", desc: "Upload your CV and fill in your details. AI evaluates and scores you.", icon: FileText },
                  { step: 2, title: "Get your Scout Score", desc: "Take one AI interview per role. Get a shareable credential and report.", icon: ChatCircle },
                  { step: 3, title: "Apply everywhere", desc: "One credential, many companies. Connect with employers who trust Scout.", icon: Briefcase },
                ]
              : [
                  { step: 1, title: "Create company & post", desc: "Add your company and job listing. Set minimum CV score and optional interview questions.", icon: Buildings },
                  { step: 2, title: "Receive applications", desc: "Only Scout-vetted candidates can apply. Each has a CV score and AI interview report.", icon: Users },
                  { step: 3, title: "Hire faster", desc: "Skip first-round screening. Compare candidates on the same score and report format.", icon: Briefcase },
                ]
            ).map((item: { step: number; title: string; desc: string; icon: Icon }, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  <item.icon className="h-6 w-6" weight="regular" aria-hidden />
                </div>
                <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-zinc-100">{item.title}</h3>
                <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
                  {item.desc}
                </p>
                {i < 2 && (
                  <div className="absolute -right-4 top-6 hidden text-gray-200 dark:text-zinc-600 md:block">
                    <CaretDown className="h-8 w-8 rotate-[-90deg]" weight="regular" aria-hidden />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* Why OpenScout - different heading and cards for employer */}
      <section className="landing-framer-dim border-t border-[var(--border)] bg-zinc-50/50 py-20 dark:border-zinc-800 dark:bg-transparent">
        <Container>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-zinc-100">
            {!isEmployer ? "Why Candidates Choose OpenScout" : "Why Employers Use OpenScout"}
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
            {(!isEmployer
              ? [
                  { title: "Hired in days", desc: "No long waits. Our candidates get offers within 2 weeks." },
                  { title: "Skip the gatekeepers", desc: "Connect directly with employers. No recruiter screens." },
                  { title: "Real feedback", desc: "Learn exactly what to improve after every interview." },
                  { title: "Practice with AI", desc: "Test yourself with mock interviews and prepare for the real one." },
                ]
              : [
                  { title: "Pre-vetted candidates", desc: "Every applicant has a CV score and AI interview report. No blank resumes." },
                  { title: "Less screening time", desc: "Compare apples to apples. Same score format for every candidate." },
                  { title: "One credential, many roles", desc: "Candidates do the work once. You see their Scout Score when they apply." },
                  { title: "Hire in days", desc: "Cut first-round interviews. Move straight to the candidates who passed the bar." },
                ]
            ).map((item: { title: string; desc: string }, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex gap-4 rounded-[10px] border border-[var(--border)] bg-white/85 p-6 shadow-soft backdrop-blur-md dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--primary-lighter)" }}
                />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{item.desc}</p>
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
      <section className="landing-framer-dim border-t border-[var(--border)] bg-white py-20 dark:border-zinc-800 dark:bg-transparent">
        <Container>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-zinc-100">For Employers</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600 dark:text-zinc-400">
            Get applicants who are already Scout-vetted. Every candidate has a CV score and AI interview report — cut screening time and hire faster.
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
      <section
        className={cn(
          "py-20",
          mounted && resolvedTheme === "light"
            ? "bg-gradient-to-b from-white/80 via-white/55 to-[var(--primary-lighter)] backdrop-blur-md"
            : "landing-framer-dim",
        )}
      >
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Ready to get your Scout Score?</h2>
            <p className="mt-2 text-gray-600 dark:text-zinc-400">
              One credential, many companies. Create your profile and take the AI interview.
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
