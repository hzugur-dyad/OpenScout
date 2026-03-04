"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  const [userType, setUserType] = useState<"job_seeker" | "employer">("job_seeker");
  return (
    <>
      <Navbar userType={userType} onUserTypeChange={setUserType} isAuthenticated={false} />
      {children}
    </>
  );
}
