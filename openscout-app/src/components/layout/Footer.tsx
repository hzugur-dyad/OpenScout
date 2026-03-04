import Link from "next/link";
import { Compass } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-lighter)" }}
            >
              <Compass
                className="h-5 w-5"
                style={{ color: "var(--primary-dark)" }}
              />
            </span>
            <span className="font-semibold">OpenScout</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-900">
              Terms of Use
            </Link>
            <Link href="/privacy" className="hover:text-gray-900">
              Privacy
            </Link>
            <a href="mailto:hello@openscout.com" className="hover:text-gray-900">
              contact@openscout.com
            </a>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-gray-400 md:text-right">
          © {new Date().getFullYear()} OpenScout. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
