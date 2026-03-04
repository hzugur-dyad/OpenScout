"use client";

import { Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "About" },
  { id: 2, label: "Work Experience" },
  { id: 3, label: "Education" },
  { id: 4, label: "Job Preferences" },
  { id: 5, label: "Links" },
];

export function OnboardingStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                isCompleted
                  ? "bg-primary text-white"
                  : isCurrent
                  ? "bg-primary text-white"
                  : "border-2 border-gray-200 bg-white text-gray-400"
              }`}
              style={isCurrent && !isCompleted ? { backgroundColor: "var(--primary)" } : {}}
            >
              {isCompleted ? <Check className="h-5 w-5" /> : step.id}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-8 rounded ${
                  isCompleted ? "bg-primary" : "bg-gray-200"
                }`}
                style={isCompleted ? { backgroundColor: "var(--primary)" } : {}}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
