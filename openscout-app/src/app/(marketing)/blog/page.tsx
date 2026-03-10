import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Blog | OpenScout",
  description: "How Scout Score works and why it matters. One credential, many companies.",
};

const posts = [
  {
    slug: "why-scout-credential",
    title: "Why we built a single credential for job seekers",
    excerpt: "One credential, many companies. We built the Scout Score so you do the work once and stand out everywhere.",
  },
  {
    slug: "what-employers-see",
    title: "What employers see in your Scout report",
    excerpt: "Your Scout Score shows employers your CV score, interview score, and a structured report — so they know you're pre-vetted.",
  },
];

export default function BlogPage() {
  return (
    <div className="py-12">
      <Container>
      <h1 className="text-3xl font-bold">Blog</h1>
      <p className="mt-2 text-gray-600">
        How Scout Score works and why it matters.
      </p>
      <ul className="mt-10 space-y-6">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="block rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
              <h2 className="text-xl font-semibold">{p.title}</h2>
              <p className="mt-2 text-gray-600">{p.excerpt}</p>
              <span className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--primary)" }}>
                Read more →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-10">
        <Link href="/">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
      </Container>
    </div>
  );
}
