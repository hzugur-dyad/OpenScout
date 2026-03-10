import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { FAQSchema } from "./FAQSchema";
import type { FAQItem } from "@/lib/seo/content";

type Props = {
  title: string;
  children: React.ReactNode;
  faqItems?: FAQItem[];
};

export function SEOPageLayout({ title, children, faqItems }: Props) {
  return (
    <div className="py-12">
      {faqItems && faqItems.length > 0 && <FAQSchema faqItems={faqItems} />}
      <Container>
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
          <div className="mt-8 space-y-10 text-gray-700">{children}</div>

          <section className="mt-12 rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-soft">
            <h2 className="text-xl font-semibold text-gray-900">Prepare with OpenScout</h2>
            <p className="mt-2 text-gray-600">
              Practice with AI, get your CV scored, and create a free account to stand out to employers.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/mock-interview"
                className="inline-flex items-center justify-center rounded-[10px] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Practice interview with AI
              </Link>
              <Link
                href="/cv-analysis"
                className="inline-flex items-center justify-center rounded-[10px] border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Analyze your CV
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-[10px] border border-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-lighter)]"
              >
                Create your free OpenScout account
              </Link>
            </div>
          </section>
        </article>
      </Container>
    </div>
  );
}
