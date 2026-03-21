import { notFound } from "next/navigation";
import Link from "next/link";
import { getJobTitleBySlug, getAllJobSlugs } from "@/lib/seo/job-titles";
import { buildSEOMetadata } from "@/lib/seo/metadata";
import { getSkillsContent } from "@/lib/seo/content";
import { SEOPageLayout } from "@/components/seo/SEOPageLayout";
import { SeoCtaBlock, SeoStickyInterviewCta } from "@/components/seo/SeoJobConversion";
import { SeoPreparationLinks } from "@/components/seo/SeoPreparationLinks";

type Props = { params: Promise<{ jobTitle: string }> };

export async function generateStaticParams() {
  return getAllJobSlugs().map((jobTitle) => ({ jobTitle }));
}

export async function generateMetadata({ params }: Props) {
  const { jobTitle: slug } = await params;
  const title = getJobTitleBySlug(slug);
  if (!title) return { title: "Not Found" };
  return buildSEOMetadata({
    title: `Key Skills for ${title} | OpenScout`,
    description: `Essential skills for ${title} roles and how to demonstrate them. Prepare your CV and practice interviews with OpenScout.`,
    path: `/skills/${slug}`,
  });
}

export default async function SkillsPage({ params }: Props) {
  const { jobTitle: slug } = await params;
  const jobTitle = getJobTitleBySlug(slug);
  if (!jobTitle) notFound();

  const content = getSkillsContent(jobTitle);
  const midSplit = content.sections.length > 1 ? Math.ceil(content.sections.length / 2) : content.sections.length;
  const firstSections = content.sections.slice(0, midSplit);
  const laterSections = content.sections.slice(midSplit);

  return (
    <SEOPageLayout title={`Key Skills for ${jobTitle}`}>
      <SeoCtaBlock
        jobSlug={slug}
        pageType="skills"
        position="top"
        headline={`Test yourself with a real AI interview for the ${jobTitle} role`}
        buttonLabel="Start AI Interview"
      />

      <section>
        <p className="text-lg text-gray-600">{content.intro}</p>
        <SeoPreparationLinks jobSlug={slug} jobTitle={jobTitle} />
      </section>

      {firstSections.map((section, i) => (
        <section key={i}>
          <h2 className="text-2xl font-semibold text-gray-900">{section.heading}</h2>
          <p className="mt-4 text-gray-700">{section.body}</p>
        </section>
      ))}

      {laterSections.length > 0 && (
        <SeoCtaBlock
          jobSlug={slug}
          pageType="skills"
          position="mid"
          headline="See how you would perform in a real interview"
          buttonLabel="Try AI Interview"
        />
      )}

      {laterSections.map((section, i) => (
        <section key={`rest-${i}`}>
          <h2 className="text-2xl font-semibold text-gray-900">{section.heading}</h2>
          <p className="mt-4 text-gray-700">{section.body}</p>
        </section>
      ))}

      <SeoCtaBlock
        jobSlug={slug}
        pageType="skills"
        position="bottom"
        headline="Get your AI-powered interview score"
        buttonLabel="Start now"
      />

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
            <Link href={`/resume-examples/${slug}`} className="text-[var(--primary)] hover:underline">
              {jobTitle} Resume Examples
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

      <SeoStickyInterviewCta jobSlug={slug} pageType="skills" />
    </SEOPageLayout>
  );
}
