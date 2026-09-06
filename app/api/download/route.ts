import { NextRequest, NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { getPublishersWithDocuments } from "@/lib/atproto/publications";
import { generateEpub } from "@/lib/epub/generate";

export async function POST(request: NextRequest) {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    timeframe?: string;
    from?: string;
    to?: string;
  };

  const now = new Date();
  let from: Date;
  let to: Date = now;

  if (body.timeframe === "custom" && body.from && body.to) {
    from = new Date(body.from);
    to = new Date(body.to);
  } else if (body.timeframe === "last_month") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 1);
  } else {
    // default: last_week
    from = new Date(now);
    from.setDate(from.getDate() - 7);
  }

  try {
    const publishers = await getPublishersWithDocuments(did, from);

    if (publishers.length === 0 || publishers.every((p) => p.documents.length === 0)) {
      return NextResponse.json(
        { error: "No documents found for the selected timeframe" },
        { status: 404 },
      );
    }

    const epubBuffer = await generateEpub(publishers, from, to);

    const filename = `folio-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.epub`;

    return new NextResponse(epubBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(epubBuffer.length),
      },
    });
  } catch (error) {
    console.error("Failed to generate EPUB:", error);
    return NextResponse.json(
      { error: "Failed to generate EPUB" },
      { status: 500 },
    );
  }
}
