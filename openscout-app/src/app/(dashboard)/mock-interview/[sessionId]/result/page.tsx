"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function MockInterviewResultPage() {
  const searchParams = useSearchParams();
  const tooShort = searchParams.get("tooShort") === "1";
  const score = parseInt(searchParams.get("score") || "0");
  const strengths = JSON.parse(searchParams.get("strengths") || "[]") as string[];
  const improvements = JSON.parse(searchParams.get("improvements") || "[]") as string[];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Interview Result</h1>
      <p className="mt-1 text-gray-500">
        {tooShort ? "The interview was too short to analyze." : "Your AI evaluation is ready."}
      </p>

      {tooShort ? (
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-8 shadow-card">
          <p className="text-center text-amber-800">
            The interview was shorter than 5 minutes, so it could not be analyzed. Please try again with a longer conversation to receive feedback and a score.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card">
            <div className="flex items-center gap-6">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{
                  backgroundColor:
                    score >= 70 ? "#22c55e" : score >= 50 ? "var(--primary)" : "#ef4444",
                }}
              >
                {score}
              </div>
              <div>
                <h2 className="text-xl font-bold">Overall Score: {score}/100</h2>
                <p className="text-sm text-gray-500">Your interview performance</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card">
            <h3 className="font-semibold">Strengths</h3>
            <ul className="mt-3 space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card">
            <h3 className="font-semibold">Improvement Suggestions</h3>
            <ul className="mt-3 space-y-2">
              {improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="mt-8 flex gap-4">
        <Link href="/mock-interview">
          <Button variant="outline">New Interview</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="primary">Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
