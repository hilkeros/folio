import { NextRequest, NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export async function GET() {
  const did = await getDid();
  if (!did) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const row = await db
    .selectFrom("digest_schedule")
    .selectAll()
    .where("did", "=", did)
    .executeTakeFirst();

  return NextResponse.json({ schedule: row ?? null });
}

export async function POST(request: NextRequest) {
  const did = await getDid();
  if (!did) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, frequency } = await request.json() as {
    email?: string;
    frequency?: string;
  };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!["weekly", "biweekly", "monthly"].includes(frequency ?? "")) {
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
  }

  const db = getDb();
  await db
    .insertInto("digest_schedule")
    .values({ did, email, frequency: frequency!, last_sent_at: null, created_at: Date.now() })
    .onConflict((oc) =>
      oc.column("did").doUpdateSet({ email, frequency: frequency! }),
    )
    .execute();

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const did = await getDid();
  if (!did) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  await db.deleteFrom("digest_schedule").where("did", "=", did).execute();

  return NextResponse.json({ success: true });
}
