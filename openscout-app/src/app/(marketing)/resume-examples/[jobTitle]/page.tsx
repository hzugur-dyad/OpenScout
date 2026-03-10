import { notFound } from "next/navigation";
import Link from "next/link";
import { getJobTitleBySlug, getAllJobSlugs } from "@/lib/seo/job-titles";
import { buildSEOMetadata } from "@/lib/seo/metadata";
import { getResumeExamplesContent } from "@/lib/seo/content";
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
    title: `${title} Resume Examples & Tips | OpenScout`,
    description: `Resume structure and examples for ${title} roles. Get your CV analyzed and scored by AI on OpenScout.`,
    path: `/resume-examples/${slug}`,
  });
}

export default async function ResumeExamplesPage({ params }: Props) {
  const { jobTitle: slug } = await params;
  const jobTitle = getJobTitleBySlug(slug);
  if (!jobTitle) notFound();

  const content = getResumeExamplesContent(jobTitle);

  return (
    <SEOPageLayout title={`${jobTitle} Resume Examples`}>
      <section>
        <p className="text-lg text-gray-600">{content.intro}</p>
      </section>

      {content.sections.map((section, i) => (
        <section key={i}>
          <h2 className="text-2xl font-semibold text-gray-900">{section.heading}</h2>
          <p className="mt-4 text-gray-700">{section.body}</p>
        </section>
      ))}

      <section>
        <h2 className="text-2xl font-semibold text-gray-900">Related Career Resources</h2>
        <ul className="mt-4 space-y-2 text-gray-700">
          <li>
            <Link href={`/interview-questions/${slug}`} className="text-[var(--primary)] hover:underline">
              {jobTitle} Interview Questions
            </Link>
          </li>
          <li>
            <Link href={`/interview-guide/${slug}`} className="text-[var(--primary)] hover:underline">
              {jobTitle} Interview Guide
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
        </ul>
      </section>
    </SEOPageLayout>
  );
}
