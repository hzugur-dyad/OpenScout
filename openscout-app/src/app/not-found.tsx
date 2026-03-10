import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="text-3xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-600">This page could not be found.</p>
      <Link
        href="/"
        className="mt-6 rounded-[10px] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Go home
      </Link>
    </div>
  );
}
