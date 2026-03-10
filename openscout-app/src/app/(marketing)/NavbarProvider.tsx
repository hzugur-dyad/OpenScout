"use client";

import { Navbar } from "@/components/layout/Navbar";
import { LandingUserTypeProvider, useLandingUserType } from "@/contexts/LandingUserTypeContext";

function NavbarWithContext() {
  const { userType, setUserType } = useLandingUserType();
  return (
    <Navbar
      userType={userType}
      onUserTypeChange={setUserType}
      isAuthenticated={false}
    />
  );
}

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  return (
    <LandingUserTypeProvider>
      <NavbarWithContext />
      {children}
    </LandingUserTypeProvider>
  );
}
