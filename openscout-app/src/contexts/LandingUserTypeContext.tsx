"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type LandingUserType = "job_seeker" | "employer";

const LandingUserTypeContext = createContext<{
  userType: LandingUserType;
  setUserType: (type: LandingUserType) => void;
} | null>(null);

export function LandingUserTypeProvider({ children }: { children: ReactNode }) {
  const [userType, setUserTypeState] = useState<LandingUserType>("job_seeker");
  const setUserType = useCallback((type: LandingUserType) => {
    setUserTypeState(type);
  }, []);
  return (
    <LandingUserTypeContext.Provider value={{ userType, setUserType }}>
      {children}
    </LandingUserTypeContext.Provider>
  );
}

export function useLandingUserType() {
  const ctx = useContext(LandingUserTypeContext);
  if (!ctx) return { userType: "job_seeker" as LandingUserType, setUserType: () => {} };
  return ctx;
}
