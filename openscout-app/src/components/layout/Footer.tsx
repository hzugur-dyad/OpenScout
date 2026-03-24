import Link from "next/link";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";

const productLinks = [
  { href: "/jobs", label: "Job listings" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
] as const;

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-employers", label: "For employers" },
] as const;

const legalLinks = [
  { href: "/terms", label: "Terms of use" },
  { href: "/privacy", label: "Privacy" },
  { href: "mailto:hello@openscout.com", label: "Contact", external: true },
] as const;

function FooterLinkColumn({
  title,
  links,
  id,
}: {
  title: string;
  id: string;
  links: readonly ({ href: string; label: string; external?: boolean } & Record<string, unknown>)[];
}) {
  return (
    <nav className="min-w-0" aria-labelledby={id}>
      <p id={id} className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
        {title}
      </p>
      <ul className="mt-3 space-y-2.5">
        {links.map((item) => (
          <li key={item.href}>
            {"external" in item && item.external ? (
              <a
                href={item.href}
                className="text-sm text-gray-700 transition-colors hover:text-gray-900 dark:text-zinc-300 dark:hover:text-white"
              >
                {item.label}
              </a>
            ) : (
              <Link
                href={item.href}
                className="text-sm text-gray-700 transition-colors hover:text-gray-900 dark:text-zinc-300 dark:hover:text-white"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="landing-framer-dim w-full border-t border-[var(--border)] dark:border-zinc-800">
      <div className="w-full bg-white/55 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md dark:bg-zinc-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:py-8">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-8">
            <div className="sm:col-span-2 lg:col-span-4">
              <Link
                href="/"
                className="inline-flex items-center gap-3 rounded-md outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              >
                <OpenScoutLogoMark className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
                <span className="text-base font-semibold text-gray-900 dark:text-zinc-100 sm:text-lg">
                  OpenScout
                </span>
              </Link>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                AI-powered hiring: discover roles, analyze your CV for fit, and practice structured interviews.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:col-span-2 lg:col-span-8 lg:grid-cols-3">
              <FooterLinkColumn id="footer-product" title="Product" links={productLinks} />
              <FooterLinkColumn id="footer-company" title="Company" links={companyLinks} />
              <FooterLinkColumn id="footer-legal" title="Legal" links={legalLinks} />
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-black/10 pt-6 dark:border-white/10 sm:flex-row sm:items-center">
            <p className="text-center text-xs text-gray-600 dark:text-zinc-400 sm:text-left">
              © {new Date().getFullYear()} OpenScout. All rights reserved.
            </p>
            <Link
              href="/faq"
              className="text-xs text-gray-600 transition-colors hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
            >
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
