import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { interviewUi, type InterviewLocale } from "@/lib/interview-locale";

type Variant = "unauthenticated" | "not_found" | "eval_error";

export function MockInterviewResultFallback({
  locale: _locale,
  variant,
}: {
  locale: InterviewLocale;
  variant: Variant;
}) {
  const ui = interviewUi.en;

  if (variant === "eval_error") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{ui.resultTitle}</h1>
        <p className="mt-2 text-gray-600 dark:text-zinc-400">{ui.resultEvalFailedBody}</p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link href="/mock-interview">
            <Button variant="primary">{ui.newInterview}</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">{ui.dashboard}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (variant === "unauthenticated") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{ui.resultTitle}</h1>
        <p className="mt-2 text-gray-600 dark:text-zinc-400">{ui.resultUnauthenticatedBody}</p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link href="/login">
            <Button variant="primary">{ui.signInCta}</Button>
          </Link>
          <Link href="/mock-interview">
            <Button variant="outline">{ui.newInterview}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{ui.resultTitle}</h1>
      <p className="mt-2 text-gray-600 dark:text-zinc-400">{ui.resultNotFoundBody}</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/mock-interview">
          <Button variant="primary">{ui.newInterview}</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline">{ui.dashboard}</Button>
        </Link>
      </div>
    </div>
  );
}
