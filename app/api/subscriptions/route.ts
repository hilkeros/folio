import { NextRequest, NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { getPublishersWithDocuments } from "@/lib/atproto/publications";

export async function GET(request: NextRequest) {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const timeframe = searchParams.get("timeframe") ?? "last_week";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  let from: Date;
  let to: Date = now;

  if (timeframe === "custom" && fromParam && toParam) {
    from = new Date(fromParam);
    to = new Date(toParam);
  } else if (timeframe === "last_month") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 1);
  } else {
    // default: last_week
    from = new Date(now);
    from.setDate(from.getDate() - 7);
  }

  try {
    const publishers = await getPublishersWithDocuments(did, from);
    return NextResponse.json({ publishers, from: from.toISOString(), to: to.toISOString() });
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 },
    );
  }
}
