import type { Metadata } from "next";

const DEFAULT_ORIGIN =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) ||
  (typeof process !== "undefined" && process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "";

export type BuildSEOMetadataParams = {
  title: string;
  description: string;
  path: string;
};

/** Build Next.js Metadata with title, description, OpenGraph, and canonical. */
export function buildSEOMetadata({ title, description, path }: BuildSEOMetadataParams): Metadata {
  const canonical = DEFAULT_ORIGIN ? `${DEFAULT_ORIGIN.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}` : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
    },
    ...(canonical && { alternates: { canonical } }),
  };
}
