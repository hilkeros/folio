"use client";

import { useState } from "react";

type Timeframe = "last_week" | "last_month" | "custom";

interface Props {
  onTimeframeChange: (timeframe: Timeframe, from?: string, to?: string) => void;
}

export function DownloadForm({ onTimeframeChange }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>("last_week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTimeframeChange(value: Timeframe) {
    setTimeframe(value);
    onTimeframeChange(value, from || undefined, to || undefined);
  }

  function handleFromChange(value: string) {
    setFrom(value);
    if (timeframe === "custom") {
      onTimeframeChange("custom", value, to);
    }
  }

  function handleToChange(value: string) {
    setTo(value);
    if (timeframe === "custom") {
      onTimeframeChange("custom", from, value);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);

    const body: { timeframe: string; from?: string; to?: string } = { timeframe };
    if (timeframe === "custom") {
      body.from = new Date(from).toISOString();
      body.to = new Date(to).toISOString();
    }

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Download failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "folio.epub";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-zinc-500">
        Download as EPUB
      </h2>

      <div className="space-y-4">
        {/* Timeframe selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-widest text-zinc-600">
            Timeframe
          </label>
          <div className="flex gap-2">
            {(["last_week", "last_month", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTimeframeChange(t)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  timeframe === t
                    ? "border-amber-400/60 bg-amber-950/30 text-amber-200"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {t === "last_week" ? "Last week" : t === "last_month" ? "Last month" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date pickers */}
        {timeframe === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-zinc-600">From</label>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/50 px-2.5 py-2 text-sm text-zinc-200 outline-none focus:border-amber-400/60"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-zinc-600">To</label>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/50 px-2.5 py-2 text-sm text-zinc-200 outline-none focus:border-amber-400/60"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading || (timeframe === "custom" && !from)}
          className="w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 font-medium text-zinc-100 transition hover:border-amber-400/60 hover:bg-zinc-700 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? "Generating EPUB…" : "Download EPUB"}
        </button>
      </div>
    </div>
  );
}
