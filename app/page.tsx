import { getSession } from "@/lib/auth/session";
import { resolveDidToHandle } from "@/lib/atproto/publications";
import { LoginForm } from "@/components/LoginForm";
import { LogoutButton } from "@/components/LogoutButton";
import { PublicationsView } from "@/components/PublicationsView";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const { error } = await searchParams;
  const handle = session ? await resolveDidToHandle(session.did) : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">📖 folio</h1>
            <p className="text-xs text-zinc-500">standard.site → EPUB</p>
          </div>

          {session && (
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm text-zinc-400">
                {handle ?? session.did}
              </span>
              <LogoutButton />
            </div>
          )}
        </header>

        {session ? (
          <PublicationsView />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm">
              <LoginForm error={error === "login_failed" ? "Login failed. Please try again." : undefined} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
