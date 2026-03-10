import { ThemeToggle } from "@/components/theme/theme-toggle";

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="fixed top-0 right-0 z-50 flex h-14 items-center justify-end px-4">
        <ThemeToggle />
      </header>
      {children}
    </div>
  );
}
