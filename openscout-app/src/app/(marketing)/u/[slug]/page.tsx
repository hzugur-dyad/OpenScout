import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { HiringFitBadge } from "@/components/employer/HiringFitBadge";
import { fetchPublicCandidateProfileBySlug } from "@/lib/public-candidate-profile";
import { absoluteUrl } from "@/lib/seo/site";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const fetched = await fetchPublicCandidateProfileBySlug(slug);
  if (fetched.status !== "ok") {
    return { title: "Profile | OpenScout", robots: { index: false, follow: false } };
  }
  const d = fetched.data;
  if (d.hidden) {
    return { title: "Profile | OpenScout", robots: { index: false, follow: false } };
  }

  const displayName = d.firstName?.trim() || "OpenScout member";
  const roleLabel = d.targetRole?.trim() || "Candidate";
  const title = `${displayName} · ${roleLabel} | OpenScout`;
  const description =
    d.summary?.slice(0, 160) ||
    `${displayName} — OpenScout candidate profile with AI interview practice and Scout Score.`;

  const ogPath = `/api/og/profile/${encodeURIComponent(d.slug)}`;
  const ogUrl = absoluteUrl(ogPath);
  const pagePath = `/u/${encodeURIComponent(d.slug)}`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: absoluteUrl(pagePath),
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function PublicCandidateProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const fetched = await fetchPublicCandidateProfileBySlug(slug);

  if (fetched.status === "unavailable") {
    return (
      <div className="os-public-canvas py-20">
        <Container>
          <div className="os-public-card mx-auto max-w-md p-10 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Temporarily unavailable</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Public profiles require configuration. Please try again later.
            </p>
            <Link href="/" className="mt-8 inline-block">
              <Button variant="outline">Go to OpenScout</Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  if (fetched.status === "not_found") {
    notFound();
  }

  const d = fetched.data;

  if (d.hidden) {
    return (
      <div className="os-public-canvas py-20">
        <Container>
          <div className="os-public-card mx-auto max-w-xl p-10 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Profile unavailable</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              This member has chosen not to show a public profile.
            </p>
            <Link href="/" className="mt-8 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Back to OpenScout
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  const displayName = d.firstName?.trim() || "OpenScout member";
  const roleLabel = d.targetRole?.trim() || null;
  const openCat = d.openToCategory?.trim() || roleLabel;
  const evalRole = d.latestEvaluatedRole?.trim() || d.latestInterviewCategory?.trim() || null;

  return (
    <div className="os-public-canvas py-16 md:py-20">
      <Container className="px-5 sm:px-6">
        <article className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            OpenScout · AI-evaluated candidate profile
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
            {displayName}
          </h1>
          {d.hasCompletedInterview && (
            <p className="mt-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              Verified AI interview (OpenScout)
            </p>
          )}
          {roleLabel && (
            <p className="mt-1 text-lg text-gray-600 dark:text-zinc-300">{roleLabel}</p>
          )}
          {d.summary && (
            <p className="mt-6 text-gray-700 dark:text-zinc-300">{d.summary}</p>
          )}

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="os-surface-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Best Scout Score
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {typeof d.bestScoutScore === "number" ? d.bestScoutScore : "—"}
              </p>
            </div>
            <div className="os-surface-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Hiring signal
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {typeof d.bestHiringScore === "number" ? d.bestHiringScore : "—"}
              </p>
              {d.hiringFitLabel && (
                <div className="mt-2">
                  <HiringFitBadge tag={d.hiringFitLabel} />
                </div>
              )}
            </div>
          </div>

          {d.latestInterviewCategory && (
            <p className="mt-6 text-sm text-gray-600 dark:text-zinc-400">
              Latest AI interview:{" "}
              <span className="font-medium text-gray-900 dark:text-zinc-200">{d.latestInterviewCategory}</span>
            </p>
          )}

          {d.strengthsTop3.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Highlights</h2>
              <ul className="mt-3 list-inside list-disc space-y-1 text-gray-700 dark:text-zinc-300">
                {d.strengthsTop3.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="os-surface-card mt-10 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">At a glance</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                <span>{d.hasCompletedInterview ? "AI interview completed" : "AI interview not completed yet"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                <span>
                  {typeof d.bestScoutScore === "number" ? "Scout Score available" : "Scout Score not yet available"}
                </span>
              </li>
              {openCat && (
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                  <span>Open to roles in {openCat}</span>
                </li>
              )}
              {evalRole && (
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                  <span>Latest evaluated role: {evalRole}</span>
                </li>
              )}
            </ul>
          </section>

          {(d.latestResultId || d.latestPassSlug) && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Verified links</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {d.latestResultId && (
                  <li>
                    <Link
                      href={`/result/${encodeURIComponent(d.latestResultId)}`}
                      className="font-medium text-[var(--primary)] hover:underline dark:text-[var(--primary)]"
                    >
                      Latest interview result
                    </Link>
                  </li>
                )}
                {d.latestPassSlug && (
                  <li>
                    <Link
                      href={`/pass/${encodeURIComponent(d.latestPassSlug)}`}
                      className="font-medium text-[var(--primary)] hover:underline dark:text-[var(--primary)]"
                    >
                      Scout Pass
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          )}

          <div className="os-surface-card mt-12 p-8 text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Build your own professional signal
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Complete a short profile, run an AI mock interview, and publish a public page with your Scout Score—so
              recruiters see verified readiness, not just a PDF.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register">
                <Button variant="primary">Start on OpenScout</Button>
              </Link>
              <Link href="/mock-interview">
                <Button variant="outline">Practice interview first</Button>
              </Link>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-gray-500 dark:text-zinc-300">
            Public profiles are optional and controlled by each member.
          </p>
        </article>
      </Container>
    </div>
  );
}
