"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export type CustomSelectOption = { value: string; label: string } | string;

function normalizeOptions(options: CustomSelectOption[]): { value: string; label: string }[] {
  return options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
}

type CustomSelectProps = {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
};

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  id,
  className = "",
  triggerClassName = "",
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const normalized = normalizeOptions(options);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = normalized.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-[10px] border border-[var(--border)] bg-white px-4 py-3 text-left text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={!value ? "text-gray-400 dark:text-zinc-500" : ""}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="dropdown-list absolute top-full left-0 right-0 z-20 mt-1.5 max-h-60 overflow-y-auto rounded-[10px] border border-[var(--border)] bg-white py-1 shadow-card dark:border-white/[0.06] dark:bg-zinc-900"
        >
          {normalized.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-sm transition-colors first:rounded-t-[8px] last:rounded-b-[8px] ${
                value === opt.value
                  ? "bg-[var(--primary-muted)] text-gray-900 dark:bg-primary-muted/30 dark:text-zinc-100"
                  : "text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
