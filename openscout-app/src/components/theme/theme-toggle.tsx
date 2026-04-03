"use client";

import type { ComponentPropsWithoutRef } from "react";
import { AnimatedThemeToggler } from "@/components/ui/theme-toggler";

export function ThemeToggle(props: ComponentPropsWithoutRef<typeof AnimatedThemeToggler>) {
  return <AnimatedThemeToggler {...props} />;
}
