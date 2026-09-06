"use client";

import { useState, useEffect } from "react";

type Frequency = "weekly" | "biweekly" | "monthly";

interface Schedule {
  email: string;
  frequency: Frequency;
  last_sent_at: number | null;
}

export function DigestSettings() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/digest/schedule")
      .then((r) => r.json())
      .then((data) => {
        if (data.schedule) {
          setSchedule(data.schedule);
          setEmail(data.schedule.email);
          setFrequency(data.schedule.frequency);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/digest/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, frequency }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
    } else {
      setSchedule({ email, frequency, last_sent_at: schedule?.last_sent_at ?? null });
      setSuccess(true);
    }
    setSaving(false);
  }

  async function handleCancel() {
    if (!confirm("Cancel your email digest?")) return;
    await fetch("/api/digest/schedule", { method: "DELETE" });
    setSchedule(null);
    setEmail("");
    setFrequency("weekly");
    setSuccess(false);
  }

  if (loading) return null;

  const frequencyLabel: Record<Frequency, string> = {
    weekly: "Weekly",
    biweekly: "Every two weeks",
    monthly: "Monthly",
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-widest text-zinc-500">
        Email digest
      </h2>
      <p className="mb-4 text-xs text-zinc-600">
        Receive your EPUB automatically by email. If you send it to your Send-to-PocketBook or Send-to-Kindle email address, it will be delivered to your e-reader automatically.
      </p>
       <p className="mb-4 text-xs text-zinc-600">
        The email address wil be saved in our database and used only for sending the digest. You can cancel the digest at any time. Your email address will not be shared with anyone else or be published as an atproto record.
       </p>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-600">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950/50 px-2.5 py-2 text-sm text-zinc-200 outline-none focus:border-amber-400/60 placeholder:text-zinc-600"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-600">Frequency</label>
          <div className="flex gap-2">
            {(["weekly", "biweekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  frequency === f
                    ? "border-amber-400/60 bg-amber-950/30 text-amber-200"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {frequencyLabel[f]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
            Digest schedule saved.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !email}
            className="flex-1 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-amber-400/60 hover:bg-zinc-700 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : schedule ? "Update schedule" : "Set up digest"}
          </button>

          {schedule && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-500 transition hover:border-rose-900/60 hover:text-rose-400"
            >
              Cancel digest
            </button>
          )}
        </div>

        {schedule?.last_sent_at && (
          <p className="text-xs text-zinc-600">
            Last sent:{" "}
            {new Date(schedule.last_sent_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </form>
    </div>
  );
}
