import Link from "next/link";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";

export function Footer() {
  return (
    <footer className="landing-framer-dim border-t border-[var(--border)] dark:border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-9 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <OpenScoutLogoMark className="h-12 w-12" />
            <span className="font-semibold text-gray-900 dark:text-zinc-100">OpenScout</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500 dark:text-zinc-200">
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
        <p className="mt-4 text-center text-sm text-gray-400 dark:text-zinc-400 md:text-right">
          © {new Date().getFullYear()} OpenScout. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
