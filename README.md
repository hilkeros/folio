# folio

Turn your [standard.site](https://standard.site) subscriptions into an EPUB for your e-reader.

Folio reads the `site.standard.graph.subscription` records from your AT Protocol account, fetches new articles from the publications you follow, and bundles them into a single EPUB — either on demand from the browser or automatically delivered to your email on a schedule.

## Features

- Sign in with any AT Protocol account (Bluesky, self-hosted PDS, etc.)
- Lists articles from your standard.site subscriptions filtered by timeframe
- Download an EPUB directly from the browser
- Schedule a weekly, biweekly, or monthly digest sent to any email address — useful with a Send-to-Kindle or Send-to-PocketBook address for automatic e-reader delivery
- Generated cover page with the edition date range, readable on grayscale e-ink displays

## Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- AT Protocol OAuth via [`@atproto/oauth-client-node`](https://github.com/bluesky-social/atproto)
- SQLite + [Kysely](https://kysely.dev) for session and schedule storage
- [epub-gen-memory](https://github.com/bbollenberger/epub-gen-memory) for EPUB generation
- [sharp](https://sharp.pixelplumbing.com) for cover image generation
- [Resend](https://resend.com) for email delivery

## Getting started

```bash
pnpm install
pnpm dev
```

The dev server runs migrations automatically and starts on `http://localhost:3000`. In development, AT Protocol OAuth uses loopback mode — no keys or public URL needed.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values.

| Variable | Required | Description |
|---|---|---|
| `PUBLIC_URL` | Production | Your deployment URL, e.g. `https://folio.example.com`. Leave unset in development. |
| `PRIVATE_KEY` | Production | ES256 private key in JWK format. Generate with `pnpm gen-key`. |
| `DATABASE_PATH` | Optional | Path to the SQLite file. Defaults to `app.db`. |
| `RESEND_API_KEY` | Digest feature | API key from [resend.com](https://resend.com). |
| `EMAIL_FROM` | Digest feature | Sender address, e.g. `folio <digest@example.com>`. |
| `CRON_SECRET` | Production | Shared secret for authenticating the cron endpoint. Generate with `openssl rand -hex 32`. |

## Scripts

```bash
pnpm dev            # Run migrations and start the dev server
pnpm build          # Production build
pnpm start          # Run migrations and start the production server
pnpm migrate        # Run database migrations manually
pnpm gen-key        # Generate an ES256 private key for production OAuth
pnpm reset-digests  # Reset last_sent_at for all digest schedules (triggers a resend on next cron run)
```

## Deploying to Railway

1. Create a new Railway project and connect your repository.
2. Set all required environment variables in the Railway dashboard.
3. Add a **Cron** service to the same project with the following command, scheduled daily (`0 7 * * *`):
   ```
   curl -s -H "x-cron-secret: $CRON_SECRET" https://your-app.railway.app/api/cron/digest
   ```
   The cron endpoint checks each user's schedule and only sends when the configured interval has elapsed, so running it daily is safe regardless of frequency setting.
4. Add a persistent volume mounted at the path matching `DATABASE_PATH` so the SQLite database survives deploys.

## Content support

Folio parses the `content` field of `site.standard.document` records. Supported formats:

- `pub.leaflet.content` — pages/blocks structure (leaflet.pub)
- `blog.pckt.content` — flat items structure (pckt.blog), including `blog.pckt.block.bulletList`

For publishers that don't embed content in their records (e.g. the AT Protocol blog), folio includes a link to the full article online.
