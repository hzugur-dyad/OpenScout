"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Play,
  Building2,
  Code2,
  Cpu,
  Palette,
  Zap,
  Layers,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useHeroEntrance } from "@/contexts/HeroEntranceContext";
import { useLandingUserType } from "@/contexts/LandingUserTypeContext";

const LAYOUT_EASE = [0.22, 1, 0.36, 1] as const;
const CENTER_REVEAL_DURATION = 1;
const HOLD_BEFORE_SHIFT_MS = 1100;
const HERO_STAGGER = 0.15;
const HERO_DELAY_CHILDREN = 0.05;

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: HERO_STAGGER,
      delayChildren: HERO_DELAY_CHILDREN,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: LAYOUT_EASE },
  },
};

const techIcons = [Code2, Cpu, Palette, Zap, Layers, Globe];

export function AnimatedHero() {
  const { phase, setPhase } = useHeroEntrance();
  const { userType } = useLandingUserType();
  const isEmployer = userType === "employer";
  const [showContent, setShowContent] = useState(false);

  // 1. Center reveal: logo fades in slowly on mount
  // 2. After 1–1.2s, move logo to navbar (setPhase("navbar"))
  useEffect(() => {
    if (phase !== "centered") return;
    const timer = setTimeout(() => setPhase("navbar"), HOLD_BEFORE_SHIFT_MS);
    return () => clearTimeout(timer);
  }, [phase, setPhase]);

  // 3. When logo moves, show hero content with stagger
  useEffect(() => {
    if (phase === "navbar") {
      setShowContent(true);
    }
  }, [phase]);

  return (
    <section className="relative overflow-hidden bg-white dark:bg-black">
      {/* 1. Center reveal — logo + brand name fade in at center */}
      <AnimatePresence>
        {phase === "centered" && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-white dark:bg-black"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              layoutId="hero-logo"
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: CENTER_REVEAL_DURATION,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--primary-lighter)" }}
              >
                <Compass
                  className="h-7 w-7"
                  style={{ color: "var(--primary-dark)" }}
                />
              </span>
              <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                OpenScout
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Hero content — stagger in when logo starts moving (phase navbar) */}
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
                  <motion.h1
                    variants={fadeUp}
                    className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl"
                  >
                    Get your{" "}
                    <span style={{ color: "var(--primary-dark)" }}>
                      Scout Score
                    </span>
                  </motion.h1>

                  <motion.p
                    variants={fadeUp}
                    className="mt-6 text-lg text-gray-600 dark:text-zinc-300 sm:text-xl"
                  >
                    One credential, many companies. Take one AI interview, get a
                    shareable score and report — stand out to every employer.
                  </motion.p>

                  <motion.div
                    variants={fadeUp}
                    className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
                  >
                    <Link href="/register">
                      <Button
                        variant="primary"
                        size="lg"
                        icon={Play}
                        iconPosition="left"
                      >
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
                      <Icon
                        key={i}
                        className="h-5 w-5 text-gray-400 dark:text-zinc-500"
                      />
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
                  <motion.h1
                    variants={fadeUp}
                    className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl"
                  >
                    Hire with{" "}
                    <span style={{ color: "var(--primary-dark)" }}>
                      Scout-vetted
                    </span>{" "}
                    talent
                  </motion.h1>

                  <motion.p
                    variants={fadeUp}
                    className="mt-6 text-lg text-gray-600 dark:text-zinc-300 sm:text-xl"
                  >
                    Every candidate has a CV score and AI interview report. Cut
                    screening time and hire faster — only applicants who passed
                    the bar.
                  </motion.p>

                  <motion.div
                    variants={fadeUp}
                    className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
                  >
                    <Link href="/employer">
                      <Button
                        variant="primary"
                        size="lg"
                        icon={Building2}
                        iconPosition="left"
                      >
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
                      <Icon
                        key={i}
                        className="h-5 w-5 text-gray-400 dark:text-zinc-500"
                      />
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
