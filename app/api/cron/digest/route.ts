import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPublishersWithDocuments } from "@/lib/atproto/publications";
import { generateEpub } from "@/lib/epub/generate";
import { sendEpubDigest } from "@/lib/email/send";

const CRON_SECRET = process.env.CRON_SECRET;

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export async function GET(request: NextRequest) {
  // Verify the request comes from Railway's cron (or curl in dev)
  const secret = request.headers.get("x-cron-secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const now = Date.now();

  const schedules = await db
    .selectFrom("digest_schedule")
    .selectAll()
    .execute();

  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const schedule of schedules) {
    const intervalMs = (FREQUENCY_DAYS[schedule.frequency] ?? 7) * 24 * 60 * 60 * 1000;
    const lastSent = schedule.last_sent_at ?? 0;

    if (now - lastSent < intervalMs) {
      results.skipped++;
      continue;
    }

    try {
      const to = new Date(now);
      const from = new Date(now - intervalMs);

      const publishers = await getPublishersWithDocuments(schedule.did, from);
      const totalDocs = publishers.reduce((s, p) => s + p.documents.length, 0);

      if (totalDocs === 0) {
        // Nothing to send — still update last_sent_at so we don't re-check every day
        await db
          .updateTable("digest_schedule")
          .set({ last_sent_at: now })
          .where("did", "=", schedule.did)
          .execute();
        results.skipped++;
        continue;
      }

      const epub = await generateEpub(publishers, from, to);
      const filename = `folio-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.epub`;

      await sendEpubDigest({
        to: schedule.email,
        epub,
        filename,
        fromDate: from,
        toDate: to,
        articleCount: totalDocs,
        publisherCount: publishers.length,
      });

      await db
        .updateTable("digest_schedule")
        .set({ last_sent_at: now })
        .where("did", "=", schedule.did)
        .execute();

      results.sent++;
    } catch (err) {
      console.error(`Digest failed for ${schedule.did}:`, err);
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
