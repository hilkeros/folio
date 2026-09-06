import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "folio <digest@folio.hilk.eu>";

export async function sendEpubDigest({
  to,
  epub,
  filename,
  fromDate,
  toDate,
  articleCount,
  publisherCount,
}: {
  to: string;
  epub: Buffer;
  filename: string;
  fromDate: Date;
  toDate: Date;
  articleCount: number;
  publisherCount: number;
}) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Your folio digest — ${fmt(fromDate)} to ${fmt(toDate)}`,
    html: `
      <p>Hi,</p>
      <p>Your folio digest is ready: <strong>${articleCount} article${articleCount !== 1 ? "s" : ""}</strong> from <strong>${publisherCount} publication${publisherCount !== 1 ? "s" : ""}</strong> you follow on standard.site.</p>
      <p>The EPUB is attached — transfer it to your e-reader and enjoy.</p>
      <p style="color:#888;font-size:0.85em;margin-top:2em;">
        You're receiving this because you set up a digest schedule in folio.<br/>
        To change or cancel your schedule, visit the app.
      </p>
    `,
    attachments: [
      {
        filename,
        content: epub,
      },
    ],
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
