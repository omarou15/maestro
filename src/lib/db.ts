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

export async function initKnowledgeSchema() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'idea',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      source TEXT NOT NULL DEFAULT 'Manuel',
      importance TEXT NOT NULL DEFAULT 'moyenne',
      score INTEGER NOT NULL DEFAULT 5,
      linked_to JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 5`
  await sql`
    CREATE INDEX IF NOT EXISTS idx_knowledge_user_id
    ON knowledge_items(user_id, updated_at DESC)
  `
}

export async function initVaultSchema() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS vault_items (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'services',
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🔑',
      type TEXT NOT NULL DEFAULT 'Clé API',
      encrypted_value TEXT NOT NULL DEFAULT '',
      masked_value TEXT NOT NULL DEFAULT '••••••••',
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_vault_user_id
    ON vault_items(user_id, created_at DESC)
  `
}
