import { getDb } from "@/lib/db";

async function main() {
  const db = getDb();
  const result = await db
    .updateTable("digest_schedule")
    .set({ last_sent_at: null })
    .executeTakeFirst();
  console.log(`Reset ${result.numUpdatedRows} digest schedule(s).`);
}

main();
