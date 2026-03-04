"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

const JOB_CATEGORIES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile Developer",
  "DevOps Engineer",
  "Data Scientist",
  "Product Manager",
  "Pazarlama Uzmani",
  "Finans Uzmani",
];

export default function MockInterviewPage() {
  const [jobCategory, setJobCategory] = useState(JOB_CATEGORIES[0]);
  const [showMicTest, setShowMicTest] = useState(false);
  const router = useRouter();

  function handleStart() {
    const id = crypto.randomUUID();
    router.push(`/mock-interview/${id}?category=${encodeURIComponent(jobCategory)}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">AI Mock Interview</h1>
      <p className="mt-1 text-gray-500">
        Select job category and practice with AI.
      </p>

      <div className="mt-8 space-y-6">
        <div>
            <label className="mb-2 block text-sm font-medium">Job Category</label>
          <select
            value={jobCategory}
            onChange={(e) => setJobCategory(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--border)] px-4 py-3"
          >
            {JOB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card">
          <h3 className="font-semibold">What to Expect</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>• ~20 minute conversation-style interview</li>
            <li>• Arka plan ve kariyer hedeflerinle ilgili sorular</li>
            <li>• Role-specific technical questions</li>
            <li>• Session kaydedilir ve rapor olusturulur</li>
          </ul>
        </div>

        <div className="flex gap-4">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleStart}
            icon={MessageCircle}
          >
            Start Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
