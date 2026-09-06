"use client";

import { useState } from "react";

export function LoginForm({ error }: { error?: string }) {
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(error ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/oauth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      window.location.href = data.redirectUrl;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-4xl">📖</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">folio</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Turn your standard.site subscriptions into an EPUB for your e-reader.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-widest text-zinc-500">
            AT Protocol handle
          </label>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="you.bsky.social"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950/75 px-3 py-2.5 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-300/15"
            disabled={loading}
            autoComplete="username"
          />
        </div>

        {formError && (
          <p className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !handle.trim()}
          className="w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 font-medium text-zinc-100 transition hover:border-amber-400/60 hover:bg-zinc-700 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
