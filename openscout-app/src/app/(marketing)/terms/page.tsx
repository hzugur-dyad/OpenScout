import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Terms of use | OpenScout",
  description: "Terms governing your use of OpenScout’s website, CV analysis, mock interviews, and employer tools.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
        <article className="prose prose-gray mx-auto max-w-2xl dark:prose-invert">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Terms of use</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Last updated: March 2026</p>

          <div className="mt-8 space-y-5 text-gray-700 dark:text-zinc-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:dark:text-zinc-100">
            <p>
              These terms (&quot;Terms&quot;) govern access to and use of OpenScout&apos;s websites, applications,
              and related services (collectively, the &quot;Services&quot;). By using the Services, you agree to
              these Terms.
            </p>

            <h2>Eligibility &amp; accounts</h2>
            <p>
              You must provide accurate registration information and keep your credentials secure. You are
              responsible for activity under your account. We may suspend or terminate accounts that violate
              these Terms or create risk for other users.
            </p>

            <h2>Acceptable use</h2>
            <p>
              You may not misuse the Services — including attempting to probe, scan, or test vulnerabilities;
              overload our systems; scrape in violation of our policies; or use the Services to harass, deceive, or
              distribute malware. You may not use AI outputs from the Services to misrepresent qualifications or
              impersonate others.
            </p>

            <h2>Content you provide</h2>
            <p>
              You retain rights to resumes, interview responses, and other materials you submit. You grant OpenScout
              a license to host, process, and display that content as needed to operate and improve the Services,
              including using service providers and models where applicable. Do not submit information you are not
              allowed to share.
            </p>

            <h2>Employer &amp; candidate features</h2>
            <p>
              Features for employers and candidates may have additional rules or commercial terms (for example,
              subscriptions). Where those terms conflict on a specific feature, the feature-specific terms control
              for that feature.
            </p>

            <h2>Disclaimers</h2>
            <p>
              The Services use automated and AI-assisted analysis. Outputs are informational and do not constitute
              legal, HR, or professional advice. Hiring decisions remain your responsibility. The Services are
              provided &quot;as is&quot; to the extent permitted by law.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, OpenScout and its suppliers will not be liable for indirect,
              incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill.
            </p>

            <h2>Changes</h2>
            <p>
              We may update these Terms from time to time. We will post the updated version with a new &quot;Last
              updated&quot; date. Continued use after changes constitutes acceptance of the revised Terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these Terms:{" "}
              <a href="mailto:hello@openscout.com" className="text-[var(--primary)] hover:underline">
                hello@openscout.com
              </a>
              .
            </p>
          </div>

          <p className="mt-10">
            <Link href="/" className="text-sm font-medium text-[var(--primary)] hover:underline">
              ← Back to home
            </Link>
          </p>
        </article>
      </Container>
    </div>
  );
}
