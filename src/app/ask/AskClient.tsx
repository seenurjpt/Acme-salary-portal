"use client";

import { useState } from "react";
import { Button, Input, Card, Badge } from "@/components/ui";

type Answer = {
  summary: string;
  data: unknown;
  source: "ai" | "local";
  intent: unknown;
};

const EXAMPLES = [
  "What is the average salary in Germany?",
  "Show median salary by department",
  "How many employees are in Engineering?",
  "Compare Engineering and Sales",
  "Highest salary by country",
];

export function AskClient() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setLoading(true);
    setError("");
    setAnswer(null);
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Sorry, I couldn't answer that.");
      return;
    }
    setAnswer(await res.json());
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">Ask about pay</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ask a question in plain English. Answers are computed from live data and normalized to USD.
      </p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Input
          placeholder="e.g. average salary in Germany"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:border-brand-300 hover:text-brand-700"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <Card className="mt-5 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{error}</p>
        </Card>
      )}

      {answer && (
        <Card className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base text-slate-800">{answer.summary}</p>
            <Badge>{answer.source === "ai" ? "AI" : "computed"}</Badge>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
              Show the numbers
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              {JSON.stringify(answer.data, null, 2)}
            </pre>
          </details>
        </Card>
      )}
    </div>
  );
}
