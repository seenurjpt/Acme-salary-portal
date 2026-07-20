"use client";

/**
 * Floating "Ask AI" assistant — a button pinned bottom-right that slides open a
 * chat-style panel. Available on every authenticated page so the HR manager can
 * ask pay questions without leaving what they're doing.
 */

import { useEffect, useRef, useState } from "react";
import { Badge } from "./ui";

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; data?: unknown; source?: "ai" | "local"; error?: boolean };

const EXAMPLES = [
  "Average salary in Germany?",
  "Median salary by department",
  "How many employees in Engineering?",
  "Compare Engineering and Sales",
];

export function AskWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the latest message; focus input when the panel opens.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.error ?? "Sorry, I couldn't answer that.", error: true },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.summary, data: data.data, source: data.source },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Something went wrong. Please try again.", error: true },
      ]);
    }
    setLoading(false);
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask AI about pay"
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/30 transition-all duration-300 hover:bg-brand-700 hover:shadow-xl ${
          open ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <SparkleIcon />
        Ask AI
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-900/20 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Slide-in panel */}
      <div
        role="dialog"
        aria-label="Ask AI"
        className={`fixed bottom-4 right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out ${
          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+2rem)] opacity-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <SparkleIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Ask about pay</p>
              <p className="text-xs text-slate-400">Answers computed from live data · USD</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-500">
                Ask a question about how the org pays people — in plain English.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => ask(ex)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div
                  className={`max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm ${
                    m.error ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <p>{m.text}</p>
                  {!m.error && m.source && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge>{m.source === "ai" ? "AI" : "computed"}</Badge>
                      {m.data != null && (
                        <details className="text-xs text-slate-400">
                          <summary className="cursor-pointer hover:text-slate-600">numbers</summary>
                          <pre className="mt-1.5 max-h-40 overflow-auto rounded-md bg-white p-2 text-[11px] text-slate-600">
                            {JSON.stringify(m.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5">
                <span className="inline-flex gap-1">
                  <Dot delay="0ms" />
                  <Dot delay="150ms" />
                  <Dot delay="300ms" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          className="flex gap-2 border-t border-slate-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. average salary in Germany"
            className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.8 5.6a2 2 0 001.3 1.3L20.7 11l-5.6 1.8a2 2 0 00-1.3 1.3L12 19.7l-1.8-5.6a2 2 0 00-1.3-1.3L3.3 11l5.6-1.8a2 2 0 001.3-1.3L12 2z" />
      <circle cx="19" cy="5" r="1.5" />
      <circle cx="5" cy="19" r="1.2" />
    </svg>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
      style={{ animationDelay: delay }}
    />
  );
}
