import { Footer } from "@/components/layout/Footer";
import { NavbarProvider } from "./NavbarProvider";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavbarProvider>
      <div className="flex min-h-screen flex-col dark:bg-transparent">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </NavbarProvider>
  );
}
