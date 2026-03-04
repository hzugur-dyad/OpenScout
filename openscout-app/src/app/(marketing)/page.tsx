"use client";

import Link from "next/link";
import { ChevronDown, FileText, MessageCircle, Briefcase, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

const faqs = [
  {
    q: "Is this free?",
    a: "Core features are free for job seekers. Mock interviews and CV analysis are limited. Upgrade to premium for unlimited access.",
  },
  {
    q: "How does the AI interview work?",
    a: "Based on your selected job category, the AI asks you questions. You answer verbally, the AI evaluates and provides a detailed report.",
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
  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32"
        style={{
          background: "linear-gradient(180deg, var(--primary-lighter) 0%, var(--background) 60%)",
        }}
      >
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Find your job with{" "}
              <span style={{ color: "var(--primary-dark)" }}>OpenScout</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 sm:text-xl">
              One interview, multiple companies. Test yourself with AI and get
              real feedback.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/register">
                <Button variant="primary" size="lg" icon={Play} iconPosition="left">
                  Start Interview
                </Button>
              </Link>
              <Link href="/jobs">
                <Button variant="outline" size="lg">
                  View Job Listings
                </Button>
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* Stats/Benefits */}
      <section className="border-y border-[var(--border)] bg-white py-16">
        <Container>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: "AI Evaluation", label: "Fair interview" },
              { value: "< 2 weeks", label: "Fast process" },
              { value: "100%", label: "Free for candidates" },
              { value: "Direct", label: "Employer access" },
            ].map((item, i) => (
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

      {/* How it works */}
      <section className="py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold">How It Works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
            Create your profile, take an AI interview, and land job opportunities.
          </p>
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: 1,
                title: "Build Profile",
                desc: "Upload your CV and fill in your details. AI auto-completes for you.",
                icon: FileText,
              },
              {
                step: 2,
                title: "AI Interview",
                desc: "Take an AI interview tailored to your role and get a score.",
                icon: MessageCircle,
              },
              {
                step: 3,
                title: "Get Hired",
                desc: "Match with companies and connect directly with employers.",
                icon: Briefcase,
              },
            ].map((item, i) => (
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

      {/* Why OpenScout */}
      <section className="border-t border-[var(--border)] bg-gray-50/50 py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold">
            Why Candidates Choose OpenScout
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                title: "Hired in days",
                desc: "No long waits. Our candidates get offers within 2 weeks.",
              },
              {
                title: "Skip the gatekeepers",
                desc: "Connect directly with employers. No recruiter screens.",
              },
              {
                title: "Real feedback",
                desc: "Learn exactly what to improve after every interview.",
              },
              {
                title: "Practice with AI",
                desc: "Test yourself with mock interviews and prepare for the real one.",
              },
            ].map((item, i) => (
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

      {/* CTA */}
      <section
        className="py-20"
        style={{
          background: "linear-gradient(180deg, var(--background) 0%, var(--primary-lighter) 100%)",
        }}
      >
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">Ready to get started?</h2>
            <p className="mt-2 text-gray-600">
              Create your profile, take an AI interview, and discover job opportunities.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <Button variant="primary" size="lg">
                Start Interview
              </Button>
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
