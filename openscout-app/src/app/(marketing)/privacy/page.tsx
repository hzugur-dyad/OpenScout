import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Privacy policy | OpenScout",
  description:
    "How OpenScout collects, uses, and protects personal data when you use our hiring and interview products.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
        <article className="prose prose-gray mx-auto max-w-2xl dark:prose-invert">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Privacy policy</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Last updated: March 2026</p>

          <div className="mt-8 space-y-5 text-gray-700 dark:text-zinc-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:dark:text-zinc-100">
            <p>
              OpenScout (&quot;we&quot;, &quot;us&quot;) respects your privacy. This policy describes how we collect,
              use, and share information when you use our websites and services.
            </p>

            <h2>Information we collect</h2>
            <p>
              We collect information you provide — such as name, email, employer details, resumes, job preferences,
              and content from mock interviews. We also collect technical data (IP address, device/browser type,
              cookies) and usage data to operate and secure the Services.
            </p>

            <h2>How we use information</h2>
            <p>
              We use data to provide and improve the Services, personalize your experience, analyze CV and
              interview inputs with automated systems, communicate with you, prevent fraud and abuse, and comply
              with law. Where we use vendors or AI subprocessors, we impose appropriate safeguards.
            </p>

            <h2>Sharing</h2>
            <p>
              We share information with service providers who help us host, analyze, and deliver the Services. If you
              apply to jobs or use employer features, we share relevant profile and application data with the
              parties you choose (for example, the employer). We may disclose information if required by law or to
              protect rights and safety.
            </p>

            <h2>Retention</h2>
            <p>
              We retain information for as long as your account is active and as needed to provide the Services,
              resolve disputes, and meet legal obligations. You may request deletion subject to exceptions we must
              keep by law.
            </p>

            <h2>Security</h2>
            <p>
              We use administrative, technical, and organizational measures designed to protect personal data. No
              method of transmission over the Internet is completely secure.
            </p>

            <h2>Your rights</h2>
            <p>
              Depending on where you live, you may have rights to access, correct, delete, or export your data, or to
              object to certain processing. Contact us to exercise these rights. You may also unsubscribe from
              marketing emails via the link in those messages.
            </p>

            <h2>International transfers</h2>
            <p>
              If you access the Services from outside the country where we operate servers, your data may be
              transferred and processed across borders with appropriate safeguards where required.
            </p>

            <h2>Children</h2>
            <p>The Services are not directed to children under 16, and we do not knowingly collect their data.</p>

            <h2>Changes</h2>
            <p>
              We may update this policy and will post the revised version with an updated date. Material changes may
              be communicated through the Services or by email.
            </p>

            <h2>Contact</h2>
            <p>
              Privacy questions:{" "}
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
