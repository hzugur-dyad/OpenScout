"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatCircle, PaperPlaneRight, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

export type SupportChatMessage = {
  role: ChatRole;
  content: string;
};

const WELCOME: SupportChatMessage = {
  role: "assistant",
  content:
    "Hi — I'm the OpenScout assistant. Ask me about Scout Score, job listings, CV analysis, or how the platform works.",
};

export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SupportChatMessage[]>([WELCOME]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    const userMsg: SupportChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      if (!data.message) throw new Error("Empty response");
      setMessages((prev) => [...prev, { role: "assistant", content: data.message! }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <div className="pointer-events-none fixed bottom-2.5 right-0 z-[100] flex flex-col items-end gap-3 sm:bottom-3.5">
      <AnimatePresence>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            id="support-chat-panel"
            className="pointer-events-auto flex max-h-[min(440px,calc(100dvh-7rem))] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 text-zinc-100 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-md dark:border-zinc-600/60"
            role="dialog"
            aria-label="OpenScout support chat"
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-50">Support</p>
                <p className="text-xs text-zinc-400">AI assistant · OpenScout</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" weight="bold" />
              </button>
            </div>

            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm leading-relaxed"
            >
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2.5",
                      m.role === "user"
                        ? "rounded-br-md bg-[var(--primary)] text-zinc-950"
                        : "rounded-bl-md bg-zinc-800/90 text-zinc-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-zinc-800/90 px-3.5 py-2.5 text-zinc-400">
                    <span className="inline-flex gap-1">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse [animation-delay:150ms]">●</span>
                      <span className="animate-pulse [animation-delay:300ms]">●</span>
                    </span>
                  </div>
                </div>
              ) : null}
              {error ? (
                <p className="text-center text-xs text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <form
              className="border-t border-zinc-800 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ask about OpenScout…"
                  rows={2}
                  disabled={loading}
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl bg-[var(--primary)] text-zinc-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <PaperPlaneRight className="h-5 w-5" weight="bold" />
                </button>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto flex h-10 w-[min(168px,calc(100vw-2rem))] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#5f6254] bg-[#4c4e42] px-3 text-[#b5b6aa] shadow-[0_3px_14px_rgba(0,0,0,0.28)] transition-colors sm:h-11 sm:w-[176px]",
          "hover:border-[#6d7062] hover:bg-[#555748] hover:text-zinc-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7f8272] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        )}
        aria-expanded={open}
        aria-controls="support-chat-panel"
        aria-label={open ? "Close support chat" : "Open support chat"}
      >
        {open ? (
          <>
            <X className="h-5 w-5 shrink-0" weight="bold" />
            <span className="text-sm font-medium tracking-tight">Close</span>
          </>
        ) : (
          <>
            <ChatCircle className="h-5 w-5 shrink-0" weight="fill" />
            <span className="text-sm font-medium tracking-tight">Support</span>
          </>
        )}
      </button>
    </div>
  );
}
