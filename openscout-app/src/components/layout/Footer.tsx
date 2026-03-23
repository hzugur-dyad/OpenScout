import Link from "next/link";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";

export function Footer() {
  return (
    <footer className="landing-framer-dim border-t border-[var(--border)] dark:border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="rounded-2xl border border-white/25 bg-white/55 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
            <div className="flex items-center gap-2">
              <OpenScoutLogoMark className="h-14 w-14" />
              <span className="font-semibold text-gray-900 dark:text-zinc-100">OpenScout</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-700 dark:text-zinc-200">
              <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">
                Terms of Use
              </Link>
              <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">
                Privacy
              </Link>
              <a href="mailto:hello@openscout.com" className="hover:text-gray-900 dark:hover:text-white">
                contact@openscout.com
              </a>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-gray-600 dark:text-zinc-300 md:text-right">
            © {new Date().getFullYear()} OpenScout. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
