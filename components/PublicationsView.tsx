"use client";

import { useState, useEffect, useCallback } from "react";
import { DownloadForm } from "./DownloadForm";
import type { Publisher } from "@/lib/atproto/publications";

type Timeframe = "last_week" | "last_month" | "custom";

export function PublicationsView() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("last_week");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const fetchPublications = useCallback(
    async (tf: Timeframe, fromDate?: string, toDate?: string) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ timeframe: tf });
      if (tf === "custom" && fromDate && toDate) {
        params.set("from", new Date(fromDate).toISOString());
        params.set("to", new Date(toDate).toISOString());
      }

      try {
        const res = await fetch(`/api/subscriptions?${params}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to load");
        }
        const data = await res.json();
        setPublishers(data.publishers ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load publications");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchPublications("last_week");
  }, [fetchPublications]);

  function handleTimeframeChange(tf: Timeframe, fromDate?: string, toDate?: string) {
    setTimeframe(tf);
    setFrom(fromDate);
    setTo(toDate);
    if (tf !== "custom" || (fromDate && toDate)) {
      fetchPublications(tf, fromDate, toDate);
    }
  }

  const totalDocuments = publishers.reduce((sum, p) => sum + p.documents.length, 0);

  return (
    <div className="space-y-6">
      <DownloadForm onTimeframeChange={handleTimeframeChange} />

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <span className="animate-pulse">Loading publications…</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-5 text-sm text-rose-300">
            {error}
          </div>
        ) : publishers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
            <p className="text-zinc-500">
              No publications found for the selected timeframe.
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Follow standard.site publishers in the Atmosphere to see their articles here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              {totalDocuments} article{totalDocuments !== 1 ? "s" : ""} from{" "}
              {publishers.length} publisher{publishers.length !== 1 ? "s" : ""}
            </p>

            {publishers.map((publisher) => (
              <PublisherCard key={publisher.did} publisher={publisher} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PublisherCard({ publisher }: { publisher: Publisher }) {
  const name = publisher.publicationName || publisher.handle || publisher.did;
  const handle = publisher.handle ? `@${publisher.handle}` : publisher.did;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="font-medium text-zinc-100">{name}</h3>
        {publisher.publicationName && (
          <span className="font-mono text-sm text-zinc-500">{handle}</span>
        )}
        <span className="ml-auto text-xs text-zinc-600">
          {publisher.documents.length} article{publisher.documents.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ul className="space-y-2">
        {publisher.documents.map((doc) => (
          <li key={doc.uri} className="flex items-start gap-3">
            <time className="mt-0.5 shrink-0 font-mono text-xs text-zinc-600">
              {new Date(doc.publishedAt).toLocaleDateString("en-GB", {
                month: "short",
                day: "numeric",
              })}
            </time>
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">{doc.title}</p>
              {doc.description && (
                <p className="truncate text-xs text-zinc-500">{doc.description}</p>
              )}
              {doc.tags && doc.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-zinc-800 bg-zinc-800/60 px-1.5 py-0.5 text-xs text-zinc-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
