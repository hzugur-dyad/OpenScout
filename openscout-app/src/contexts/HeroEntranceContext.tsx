"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Phase = "centered" | "navbar" | "content";

interface HeroEntranceContextValue {
  phase: Phase;
  setPhase: (p: Phase) => void;
}

const HeroEntranceContext = createContext<HeroEntranceContextValue | null>(null);

export function HeroEntranceProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("centered");
  return (
    <HeroEntranceContext.Provider value={{ phase, setPhase }}>
      {children}
    </HeroEntranceContext.Provider>
  );
}

export function useHeroEntrance() {
  const ctx = useContext(HeroEntranceContext);
  if (!ctx) throw new Error("useHeroEntrance must be used within HeroEntranceProvider");
  return ctx;
}

export function useHeroEntranceOptional() {
  return useContext(HeroEntranceContext);
}
