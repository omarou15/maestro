import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

function getKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY || "maestro-vault-default-key-change!!"
  return Buffer.from(raw.substring(0, 32).padEnd(32, "0"))
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv("aes-256-cbc", key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return `${iv.toString("hex")}:${encrypted}`
}

export function decrypt(stored: string): string {
  try {
    const key = getKey()
    const [ivHex, encrypted] = stored.split(":")
    const iv = Buffer.from(ivHex, "hex")
    const decipher = createDecipheriv("aes-256-cbc", key, iv)
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    return stored // fallback if not encrypted
  }
}

export function maskValue(value: string): string {
  if (!value) return "••••••••"
  if (value.length <= 8) return "••••••••"
  const start = value.substring(0, 6)
  const end = value.substring(value.length - 4)
  return `${start}••••••••${end}`
}
