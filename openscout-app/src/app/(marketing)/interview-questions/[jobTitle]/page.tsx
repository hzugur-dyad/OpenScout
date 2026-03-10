import { notFound } from "next/navigation";
import Link from "next/link";
import { getJobTitleBySlug, getAllJobSlugs } from "@/lib/seo/job-titles";
import { buildSEOMetadata } from "@/lib/seo/metadata";
import { getInterviewQuestionsContent } from "@/lib/seo/content";
import { SEOPageLayout } from "@/components/seo/SEOPageLayout";

type Props = { params: Promise<{ jobTitle: string }> };

export async function generateStaticParams() {
  return getAllJobSlugs().map((jobTitle) => ({ jobTitle }));
}

export async function generateMetadata({ params }: Props) {
  const { jobTitle: slug } = await params;
  const title = getJobTitleBySlug(slug);
  if (!title) return { title: "Not Found" };
  return buildSEOMetadata({
    title: `${title} Interview Questions (With Answers) | OpenScout`,
    description: `Common ${title} interview questions and answers. Prepare with behavioral and technical questions, plus tips. Practice with AI on OpenScout.`,
    path: `/interview-questions/${slug}`,
  });
}

export default async function InterviewQuestionsPage({ params }: Props) {
  const { jobTitle: slug } = await params;
  const jobTitle = getJobTitleBySlug(slug);
  if (!jobTitle) notFound();

  const content = getInterviewQuestionsContent(jobTitle);

  return (
    <SEOPageLayout title={`${jobTitle} Interview Questions`} faqItems={content.faqItems}>
      <section>
        <p className="text-lg text-gray-600">{content.intro}</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900">Top Interview Questions</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-gray-700">
          {content.behavioralQuestions.slice(0, 3).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
          {content.technicalQuestions.slice(0, 3).map((q, i) => (
            <li key={`t-${i}`}>{q}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900">Behavioral Questions</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-gray-700">
          {content.behavioralQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900">Technical Questions</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-gray-700">
          {content.technicalQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900">Interview Preparation Tips</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-gray-700">
          {content.tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900">Related Career Resources</h2>
        <ul className="mt-4 space-y-2 text-gray-700">
          <li>
            <Link href={`/interview-guide/${slug}`} className="text-[var(--primary)] hover:underline">
              {jobTitle} Interview Guide
            </Link>
          </li>
          <li>
            <Link href={`/resume-examples/${slug}`} className="text-[var(--primary)] hover:underline">
              {jobTitle} Resume Examples
            </Link>
          </li>
          <li>
            <Link href={`/skills/${slug}`} className="text-[var(--primary)] hover:underline">
              Key Skills for {jobTitle}
            </Link>
          </li>
          <li>
            <Link href={`/salary/${slug}`} className="text-[var(--primary)] hover:underline">
              {jobTitle} Salary Guide
            </Link>
          </li>
          <li>
            <Link href="/jobs" className="text-[var(--primary)] hover:underline">
              Browse job listings
            </Link>
          </li>
          <li>
            <Link href="/blog" className="text-[var(--primary)] hover:underline">
              Blog
            </Link>
          </li>
        </ul>
      </section>
    </SEOPageLayout>
  );
}
