import type { HiringFitTag } from "@/lib/hiring-score";

export function HiringFitBadge({ tag }: { tag: HiringFitTag }) {
  const base = "inline-flex rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap";
  switch (tag) {
    case "Strong Fit":
      return <span className={`${base} bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200`}>{tag}</span>;
    case "Good Fit":
      return <span className={`${base} bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200`}>{tag}</span>;
    case "Average":
      return <span className={`${base} bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-200`}>{tag}</span>;
    case "Weak Fit":
    default:
      return <span className={`${base} bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200`}>{tag}</span>;
  }
}
