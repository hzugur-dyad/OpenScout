import Link from "next/link";
import { seoMockInterviewHref } from "@/lib/seo/conversion-links";

type Props = { jobSlug: string; jobTitle: string };

/** In-content links to mock interview (with job) and CV analysis — does not replace existing copy. */
export function SeoPreparationLinks({ jobSlug, jobTitle }: Props) {
  return (
    <p className="mt-4 text-gray-700 dark:text-zinc-300">
      You can also open a{" "}
      <Link href={seoMockInterviewHref(jobSlug)} className="text-[var(--primary)] hover:underline">
        mock interview
      </Link>{" "}
      for {jobTitle} roles, or use{" "}
      <Link href="/cv-analysis" className="text-[var(--primary)] hover:underline">
        CV analysis
      </Link>{" "}
      to improve your resume before you apply.
    </p>
  );
}
