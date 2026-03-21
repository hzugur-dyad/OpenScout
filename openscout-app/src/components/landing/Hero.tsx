"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Building2, Code2, Cpu, Palette, Zap, Layers, Globe } from "lucide-react";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useHeroEntrance } from "@/contexts/HeroEntranceContext";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
};

const techIcons = [Code2, Cpu, Palette, Zap, Layers, Globe];

export function Hero() {
  const { phase, setPhase } = useHeroEntrance();
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (phase === "centered") {
      const timer = setTimeout(() => setPhase("navbar"), 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, setPhase]);

  useEffect(() => {
    if (phase === "navbar") {
      const timer = setTimeout(() => {
        setPhase("content");
        setShowContent(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, setPhase]);

  return (
    <section className="relative overflow-hidden bg-white dark:bg-black">
      {/* Centered logo overlay */}
      <AnimatePresence>
        {phase === "centered" && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-white dark:bg-black"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <motion.div
              layoutId="hero-logo"
              className="flex items-center gap-3"
              transition={{ layout: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] } }}
            >
              <OpenScoutLogoMark className="h-36 w-36 sm:h-44 sm:w-44 md:h-52 md:w-52" />
              <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                OpenScout
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero content */}
      <div className="pt-20 pb-24 sm:pt-28 sm:pb-32">
        <Container>
          {showContent && (
            <AnimatePresence mode="wait">
              {!isEmployer ? (
                <motion.div
                  key="job_seeker"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                  className="mx-auto max-w-3xl text-center"
                >
                  <motion.div variants={fadeUp} className="mb-6 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1 text-xs font-medium text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      New: AI Mock Interview
                    </span>
                  </motion.div>

                  <motion.h1
                    variants={fadeUp}
                    className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl"
                  >
                    Get your{" "}
                    <span style={{ color: "var(--primary-dark)" }}>Scout Score</span>
                  </motion.h1>

                  <motion.p
                    variants={fadeUp}
                    className="mt-6 text-lg text-gray-600 dark:text-zinc-300 sm:text-xl"
                  >
                    One credential, many companies. Take one AI interview, get a shareable
                    score and report — stand out to every employer.
                  </motion.p>

                  <motion.div
                    variants={fadeUp}
                    className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
                  >
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
                  </motion.div>

                  <motion.div
                    variants={fadeUp}
                    className="mt-12 flex items-center justify-center gap-5"
                  >
                    {techIcons.map((Icon, i) => (
                      <Icon key={i} className="h-5 w-5 text-gray-400 dark:text-zinc-500" />
                    ))}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="employer"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                  className="mx-auto max-w-3xl text-center"
                >
                  <motion.div variants={fadeUp} className="mb-6 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1 text-xs font-medium text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Employer Portal
                    </span>
                  </motion.div>

                  <motion.h1
                    variants={fadeUp}
                    className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl"
                  >
                    Hire with{" "}
                    <span style={{ color: "var(--primary-dark)" }}>Scout-vetted</span> talent
                  </motion.h1>

                  <motion.p
                    variants={fadeUp}
                    className="mt-6 text-lg text-gray-600 dark:text-zinc-300 sm:text-xl"
                  >
                    Every candidate has a CV score and AI interview report. Cut screening
                    time and hire faster — only applicants who passed the bar.
                  </motion.p>

                  <motion.div
                    variants={fadeUp}
                    className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
                  >
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
                  </motion.div>

                  <motion.div
                    variants={fadeUp}
                    className="mt-12 flex items-center justify-center gap-5"
                  >
                    {techIcons.map((Icon, i) => (
                      <Icon key={i} className="h-5 w-5 text-gray-400 dark:text-zinc-500" />
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </Container>
      </div>
    </section>
  );
}
