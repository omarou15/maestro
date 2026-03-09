import { neon } from "@neondatabase/serverless"

export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return neon(url)
}

export async function initSchema() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Nouvelle conversation',
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      compacted_memory JSONB,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id
    ON conversations(user_id, updated_at DESC)
  `
}
