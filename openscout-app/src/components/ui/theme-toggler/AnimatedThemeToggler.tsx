"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION = 650;

interface AnimatedThemeTogglerProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "onClick"> {
  duration?: number;
}

export function AnimatedThemeToggler({
  className,
  duration = DEFAULT_DURATION,
  ...props
}: AnimatedThemeTogglerProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const toggleTheme = useCallback(() => {
    const nextTheme = isDark ? "light" : "dark";
    const button = buttonRef.current;

    if (
      typeof document.startViewTransition === "function" &&
      button
    ) {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme);
        });
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: ["inset(0 100% 0 0)", "inset(0 0 0 0)"],
          },
          {
            duration,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    } else {
      setTheme(nextTheme);
    }
  }, [isDark, setTheme, duration]);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        ref={buttonRef}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white/80 text-gray-600 transition-colors hover:bg-gray-100",
          "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
          className
        )}
        {...props}
      >
        <Sun className="h-4 w-4" weight="regular" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white/80 text-gray-600 transition-colors hover:bg-gray-100",
        "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
        className
      )}
      {...props}
    >
      {isDark ? (
        <Sun className="h-4 w-4" weight="regular" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" weight="regular" aria-hidden />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
