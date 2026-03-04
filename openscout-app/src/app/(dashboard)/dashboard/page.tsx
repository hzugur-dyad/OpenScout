import Link from "next/link";
import { FileText, MessageCircle, Briefcase, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Welcome</h1>
      <p className="mt-1 text-gray-500">
        Complete your profile and take an AI interview.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/onboarding">
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <FileText className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
            </div>
            <h3 className="font-semibold">Complete Your Profile</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your profile in 5 steps
            </p>
            <div className="mt-4 flex items-center text-sm font-medium" style={{ color: "var(--primary)" }}>
              Start <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </Link>

        <Link href="/cv-analysis">
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <FileText className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
            </div>
            <h3 className="font-semibold">CV Analysis</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get your CV evaluated by AI
            </p>
            <div className="mt-4 flex items-center text-sm font-medium" style={{ color: "var(--primary)" }}>
              Start <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </Link>

        <Link href="/mock-interview">
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <MessageCircle className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
            </div>
            <h3 className="font-semibold">Mock Interview</h3>
            <p className="mt-1 text-sm text-gray-500">
              Practice with AI
            </p>
            <div className="mt-4 flex items-center text-sm font-medium" style={{ color: "var(--primary)" }}>
              Start <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </Link>

        <Link href="/jobs" className="sm:col-span-2 lg:col-span-3">
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--primary-muted)" }}
                >
                  <Briefcase className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
                </div>
                <div>
                  <h3 className="font-semibold">Is Ilanlari</h3>
                  <p className="text-sm text-gray-500">
                    Apply to open positions
                  </p>
                </div>
              </div>
              <Button variant="primary" size="sm">
                View Listings
              </Button>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
