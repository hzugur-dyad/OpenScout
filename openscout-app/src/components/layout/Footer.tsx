import Link from "next/link";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <OpenScoutLogoMark className="h-16 w-16" />
            <span className="font-semibold text-gray-900 dark:text-zinc-100">OpenScout</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500 dark:text-zinc-400">
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-zinc-100">
              Terms of Use
            </Link>
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-zinc-100">
              Privacy
            </Link>
            <a href="mailto:hello@openscout.com" className="hover:text-gray-900 dark:hover:text-zinc-100">
              contact@openscout.com
            </a>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-gray-400 dark:text-zinc-500 md:text-right">
          © {new Date().getFullYear()} OpenScout. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
