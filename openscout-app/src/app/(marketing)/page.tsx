"use client";

import Link from "next/link";
import { ChevronDown, FileText, MessageCircle, Briefcase, Play, Users, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";

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
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";

  return (
    <>
      {/* Hero - changes by Find jobs / I'm hiring */}
      <section
        className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32"
        style={{
          background: "linear-gradient(180deg, var(--primary-lighter) 0%, var(--background) 60%)",
        }}
      >
        <Container>
          <AnimatePresence mode="wait">
            {!isEmployer ? (
              <motion.div
                key="job_seeker"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="mx-auto max-w-3xl text-center"
              >
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Get your{" "}
                  <span style={{ color: "var(--primary-dark)" }}>Scout Score</span>
                </h1>
                <p className="mt-6 text-lg text-gray-600 sm:text-xl">
                  One credential, many companies. Take one AI interview, get a shareable score and report — stand out to every employer.
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
              </motion.div>
            ) : (
              <motion.div
                key="employer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="mx-auto max-w-3xl text-center"
              >
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Hire with{" "}
                  <span style={{ color: "var(--primary-dark)" }}>Scout-vetted</span> talent
                </h1>
                <p className="mt-6 text-lg text-gray-600 sm:text-xl">
                  Every candidate has a CV score and AI interview report. Cut screening time and hire faster — only applicants who passed the bar.
                </p>
                <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Link href="/employer">
                    <Button variant="primary" size="lg" icon={Building2} iconPosition="left">
                      Post a job
                    </Button>
                  </Link>
                  <Link href="/employer/pricing">
                    <Button variant="outline" size="lg">
                      See pricing
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Container>
      </section>

      {/* Stats/Benefits */}
      <section className="border-y border-[var(--border)] bg-white py-16">
        <Container>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
                className="flex flex-col items-center text-center"
              >
                <div
                  className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--primary-muted)" }}
                >
                  <span
                    className="text-xl font-bold"
                    style={{ color: "var(--primary-dark)" }}
                  >
                    {item.value}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-600">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works - different for job seeker vs employer */}
      <section className="py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold">How It Works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
            {!isEmployer
              ? "Get your Scout Score — the one credential that gets you in the room. Job listings are where you use it."
              : "Post your role, set your bar. Only candidates with a Scout Score can apply — so you see CV score and interview report from day one."}
          </p>
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {(!isEmployer
              ? [
                  { step: 1, title: "Build Profile", desc: "Upload your CV and fill in your details. AI evaluates and scores you.", icon: FileText },
                  { step: 2, title: "Get your Scout Score", desc: "Take one AI interview per role. Get a shareable credential and report.", icon: MessageCircle },
                  { step: 3, title: "Apply everywhere", desc: "One credential, many companies. Connect with employers who trust Scout.", icon: Briefcase },
                ]
              : [
                  { step: 1, title: "Create company & post", desc: "Add your company and job listing. Set minimum CV score and optional interview questions.", icon: Building2 },
                  { step: 2, title: "Receive applications", desc: "Only Scout-vetted candidates can apply. Each has a CV score and AI interview report.", icon: Users },
                  { step: 3, title: "Hire faster", desc: "Skip first-round screening. Compare candidates on the same score and report format.", icon: Briefcase },
                ]
            ).map((item: { step: number; title: string; desc: string; icon: typeof FileText }, i) => (
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
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-center text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-center text-sm text-gray-500">
                  {item.desc}
                </p>
                {i < 2 && (
                  <div className="absolute -right-4 top-6 hidden text-gray-200 md:block">
                    <ChevronDown className="h-8 w-8 rotate-[-90deg]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* Why OpenScout - different heading and cards for employer */}
      <section className="border-t border-[var(--border)] bg-gray-50/50 py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold">
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
                className="flex gap-4 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--primary-lighter)" }}
                />
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="mx-auto mt-12 max-w-2xl space-y-4">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group rounded-[10px] border border-[var(--border)] bg-white p-4 shadow-soft"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {faq.q}
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-gray-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* For employers */}
      <section className="border-t border-[var(--border)] bg-white py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold">For Employers</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
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

      {/* CTA */}
      <section
        className="py-20"
        style={{
          background: "linear-gradient(180deg, var(--background) 0%, var(--primary-lighter) 100%)",
        }}
      >
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">Ready to get your Scout Score?</h2>
            <p className="mt-2 text-gray-600">
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
