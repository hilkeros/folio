export interface StandardDocument {
  uri: string;
  cid: string;
  authorDid: string;
  authorHandle: string | null;
  title: string;
  description?: string;
  publishedAt: string;
  path?: string;
  site?: string;
  tags?: string[];
  canonicalUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: any;
}

export interface Publisher {
  did: string;
  handle: string | null;
  publicationName?: string;
  publicationUri: string;
  documents: StandardDocument[];
}

// --- DID / PDS resolution ---

async function resolveDidDoc(did: string): Promise<Record<string, unknown> | null> {
  try {
    const url = did.startsWith("did:plc:")
      ? `https://plc.directory/${did}`
      : did.startsWith("did:web:")
      ? `https://${did.slice("did:web:".length)}/.well-known/did.json`
      : null;
    if (!url) return null;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function resolveDidToHandle(did: string): Promise<string | null> {
  const doc = await resolveDidDoc(did);
  if (!doc) return null;
  const aliases = Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs : [];
  const atUri = aliases.find(
    (v): v is string => typeof v === "string" && v.startsWith("at://"),
  );
  if (!atUri) return null;
  const handle = atUri.slice("at://".length).trim();
  return handle || null;
}

async function resolvePds(did: string): Promise<string | null> {
  const doc = await resolveDidDoc(did);
  if (!doc) return null;
  const services = Array.isArray(doc.service) ? doc.service : [];
  const pds = services.find(
    (s): s is { serviceEndpoint: string } =>
      typeof s === "object" &&
      s !== null &&
      (s as Record<string, unknown>).type === "AtprotoPersonalDataServer",
  );
  return pds?.serviceEndpoint ?? null;
}

// --- AT URI parsing ---

function parseAtUri(atUri: string): { did: string; collection: string; rkey: string } | null {
  const match = atUri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

// --- Publication info resolution ---

interface PublicationInfo {
  name?: string;
  url?: string;
}

const pubInfoCache = new Map<string, PublicationInfo>();

async function resolvePublicationInfo(publicationAtUri: string): Promise<PublicationInfo> {
  if (pubInfoCache.has(publicationAtUri)) return pubInfoCache.get(publicationAtUri)!;

  const parsed = parseAtUri(publicationAtUri);
  if (!parsed) {
    pubInfoCache.set(publicationAtUri, {});
    return {};
  }

  try {
    const pds = await resolvePds(parsed.did);
    if (!pds) {
      pubInfoCache.set(publicationAtUri, {});
      return {};
    }
    const params = new URLSearchParams({
      repo: parsed.did,
      collection: parsed.collection,
      rkey: parsed.rkey,
    });
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      pubInfoCache.set(publicationAtUri, {});
      return {};
    }
    const data = (await res.json()) as { value?: { name?: string; url?: string } };
    const info: PublicationInfo = {
      name: data.value?.name,
      url: data.value?.url?.replace(/\/$/, ""),
    };
    pubInfoCache.set(publicationAtUri, info);
    return info;
  } catch {
    pubInfoCache.set(publicationAtUri, {});
    return {};
  }
}

function buildCanonicalUrl(pubUrl: string | undefined, path: string | undefined): string | undefined {
  if (!pubUrl || !path) return undefined;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${pubUrl}${cleanPath}`;
}

// --- Subscriptions ---

// Lists the user's site.standard.graph.subscription records from their own PDS.
async function getSubscriptions(
  userDid: string,
): Promise<Array<{ publicationUri: string; publisherDid: string }>> {
  const pds = await resolvePds(userDid);
  if (!pds) return [];

  const results: Array<{ publicationUri: string; publisherDid: string }> = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      repo: userDid,
      collection: "site.standard.graph.subscription",
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) break;

    const data = (await res.json()) as {
      records?: Array<{ value: { publication?: string } }>;
      cursor?: string;
    };
    if (!data.records?.length) break;

    for (const record of data.records) {
      const publicationUri = record.value.publication;
      if (!publicationUri) continue;
      const parsed = parseAtUri(publicationUri);
      if (!parsed) continue;
      results.push({ publicationUri, publisherDid: parsed.did });
    }

    cursor = data.cursor;
  } while (cursor);

  return results;
}

// --- Document listing ---

interface DocRecord {
  uri: string;
  cid: string;
  value: {
    $type?: string;
    title?: string;
    description?: string;
    publishedAt?: string;
    path?: string;
    site?: string;
    tags?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content?: any;
  };
}

// Lists site.standard.document records from a publisher's PDS that belong to
// the given publication, stopping once records are older than cutoffDate.
async function listDocumentsForPublication(
  publisherDid: string,
  publicationUri: string,
  cutoffDate: Date,
): Promise<DocRecord[]> {
  const pds = await resolvePds(publisherDid);
  if (!pds) return [];

  const results: DocRecord[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      repo: publisherDid,
      collection: "site.standard.document",
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) break;

    const data = (await res.json()) as { records?: DocRecord[]; cursor?: string };
    if (!data.records?.length) break;

    let hitCutoff = false;
    for (const record of data.records) {
      const publishedAt = record.value.publishedAt;
      if (!publishedAt) continue;
      if (new Date(publishedAt) < cutoffDate) {
        hitCutoff = true;
        break;
      }
      // Filter to only documents belonging to this publication
      if (record.value.site === publicationUri) {
        results.push(record);
      }
    }

    if (hitCutoff) break;
    cursor = data.cursor;
  } while (cursor);

  return results;
}

// --- Main export ---

export async function getPublishersWithDocuments(
  userDid: string,
  cutoffDate: Date,
): Promise<Publisher[]> {
  const subscriptions = await getSubscriptions(userDid);

  const publishers = await Promise.allSettled(
    subscriptions.map(async ({ publicationUri, publisherDid }): Promise<Publisher | null> => {
      const [records, pubInfo, handle] = await Promise.all([
        listDocumentsForPublication(publisherDid, publicationUri, cutoffDate),
        resolvePublicationInfo(publicationUri),
        resolveDidToHandle(publisherDid),
      ]);

      if (records.length === 0) return null;

      return {
        did: publisherDid,
        handle,
        publicationName: pubInfo.name,
        publicationUri,
        documents: records.map((record) => ({
          uri: record.uri,
          cid: record.cid,
          authorDid: publisherDid,
          authorHandle: handle,
          title: record.value.title ?? "(untitled)",
          description: record.value.description,
          publishedAt: record.value.publishedAt ?? new Date().toISOString(),
          path: record.value.path,
          site: record.value.site,
          tags: record.value.tags,
          content: record.value.content,
          canonicalUrl: buildCanonicalUrl(pubInfo.url, record.value.path),
        })),
      };
    }),
  );

  return publishers
    .filter(
      (r): r is PromiseFulfilledResult<Publisher> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value)
    .sort((a, b) => {
      const aLatest = a.documents[0]?.publishedAt ?? "";
      const bLatest = b.documents[0]?.publishedAt ?? "";
      return bLatest.localeCompare(aLatest);
    });
}
