import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Accordion";

const faqItems = [
  {
    question: "What exactly is OpenScout?",
    answer:
      "OpenScout is an AI-powered hiring platform for both job seekers and employers. Candidates can discover jobs, analyze CV fit against real listings, and run structured mock interviews. Employers can post roles and review candidates using consistent signal instead of only resume files.",
  },
  {
    question: "How is OpenScout different from a normal job board?",
    answer:
      "Traditional boards mostly match keywords and CV uploads. OpenScout adds readiness signal: CV-job fit analysis and interview performance data in a common format. This helps candidates prepare better and helps employers reduce low-signal screening.",
  },
  {
    question: "Who can use OpenScout?",
    answer:
      "OpenScout is built for two groups: job seekers and employers. Job seekers use profile, CV analysis, and interview practice workflows. Employers use company setup, role posting, and candidate evaluation workflows.",
  },
  {
    question: "Is OpenScout free for candidates?",
    answer:
      "Core candidate features are available for free, including account creation and basic platform access. Some high-usage or advanced features may have limits depending on your current plan.",
  },
  {
    question: "How does CV analysis work?",
    answer:
      "You upload your CV and compare it with a target job listing. OpenScout analyzes alignment between your profile and role requirements, then highlights fit and gaps so you can improve before applying.",
  },
  {
    question: "What is the mock interview feature?",
    answer:
      "Mock interview simulates structured interview practice with AI. You answer role-related questions, then receive feedback and scoring that can help you improve communication quality, answer structure, and readiness.",
  },
  {
    question: "What is Scout Score?",
    answer:
      "Scout Score is a compact credential built from your preparation signal such as CV fit and interview output. It helps present candidate readiness in a standard format, so employers can compare applicants more fairly.",
  },
  {
    question: "Do employers only see resumes?",
    answer:
      "No. Employers can review more than a resume, including structured candidate data generated through platform workflows. This allows better shortlisting with less first-round guesswork.",
  },
  {
    question: "How does OpenScout help employers hire faster?",
    answer:
      "OpenScout reduces manual screening by presenting candidates in a comparable format. Employers can apply role-specific bars and focus on qualified profiles earlier, which shortens the initial hiring cycle.",
  },
  {
    question: "Can I apply to multiple jobs with one profile?",
    answer:
      "Yes. Your account and profile are reusable across jobs. You can use OpenScout workflows repeatedly and apply to multiple relevant roles without rebuilding your base profile each time.",
  },
  {
    question: "Is my data secure on OpenScout?",
    answer:
      "OpenScout applies standard security practices to protect account and profile data. For details on collection, storage, and usage of personal data, you can review the Privacy page.",
  },
  {
    question: "Can I delete my account or update my information?",
    answer:
      "Yes. You can update your profile and candidate information as your background changes. If needed, account-level requests can be handled through platform settings or support channels.",
  },
  {
    question: "What industries or roles does OpenScout support?",
    answer:
      "OpenScout supports a growing range of professional roles, including technical and non-technical positions. The platform continuously expands category coverage based on demand.",
  },
  {
    question: "Do I need to complete everything before applying?",
    answer:
      "Not always. You can start with core steps and improve over time. Completing CV analysis and mock interview usually strengthens your profile and helps you apply with better signal.",
  },
  {
    question: "How can I contact OpenScout?",
    answer:
      "You can reach out via the contact email in the footer. For policy-related questions, review the Terms and Privacy pages first, then contact the team with specific details.",
  },
] as const;

export const metadata: Metadata = {
  title: "FAQ | OpenScout",
  description:
    "Frequently asked questions about OpenScout features, candidate workflows, employer workflows, data usage, and platform value.",
  openGraph: {
    title: "OpenScout FAQ",
    description:
      "Learn how OpenScout works for candidates and employers: CV analysis, mock interviews, Scout Score, and hiring workflows.",
  },
};

export default function FAQPage() {
  return (
    <div className="py-12 dark:bg-transparent">
      <Container>
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Frequently Asked Questions</h1>
          <p className="mt-3 text-lg text-gray-700 dark:text-zinc-300">
            Practical answers about how OpenScout works for candidates and employers.
          </p>

          <Accordion type="single" collapsible className="mt-10 space-y-4">
            {faqItems.map((item, i) => (
              <AccordionItem key={item.question} value={`faq-${i}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </article>
      </Container>
    </div>
  );
}
