import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProviderWrapper } from "@/components/theme/ThemeProviderWrapper";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { absoluteUrl, DEFAULT_OG_IMAGE_PATH, getSiteUrl } from "@/lib/seo/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();
const ogImage = absoluteUrl(DEFAULT_OG_IMAGE_PATH);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OpenScout — AI Powered Hiring",
    template: "%s | OpenScout",
  },
  description:
    "OpenScout is an AI-powered hiring platform: job discovery, CV analysis against real roles, and structured mock interviews so candidates and employers hire with signal.",
  keywords: [
    "OpenScout",
    "AI hiring",
    "AI interview",
    "CV analysis",
    "job search",
    "recruiting",
    "mock interview",
    "employer hiring",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "OpenScout",
    title: "OpenScout — AI Powered Hiring",
    description:
      "Discover roles, analyze your CV for fit, and practice with AI interviews — built for serious hiring and job search.",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "OpenScout — AI Powered Hiring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenScout — AI Powered Hiring",
    description:
      "AI-powered hiring: CV screening, job listings, and interview practice in one place.",
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-[var(--foreground)] dark:bg-zinc-950 dark:text-zinc-100`}
      >
        <PostHogProvider>
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </PostHogProvider>
      </body>
    </html>
  );
}
