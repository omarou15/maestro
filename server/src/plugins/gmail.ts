import type { Plugin } from "./types.js"

// Google OAuth2 token refresh
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) {
    console.error("[GMAIL] Token refresh failed:", await res.text())
    return null
  }
  const data = await res.json() as { access_token: string }
  return data.access_token
}

async function gmailApi(path: string, options?: RequestInit): Promise<unknown> {
  const token = await getAccessToken()
  if (!token) throw new Error("Gmail non configuré (tokens manquants)")
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail API ${res.status}: ${err.slice(0, 300)}`)
  }
  return res.json()
}

// Decode base64url email body
function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(padded, "base64").toString("utf-8")
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ""
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any): string {
  // Simple text/plain
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  // Multipart — find text/plain or text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      }
      // Nested multipart
      if (part.parts) {
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
  }
  return "[Contenu non lisible]"
}

export const gmailPlugin: Plugin = {
  id: "gmail",
  name: "Gmail Integration",
  version: "1.0.0",
  register(ctx) {
    const hasConfig = process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN
    if (!hasConfig) {
      console.log("[GMAIL] Credentials non définies — plugin désactivé")
      return
    }

    // List/search emails
    ctx.app.get("/api/gmail/messages", async (req, res) => {
      try {
        const q = String(req.query.q || "is:unread")
        const maxResults = Math.min(Number(req.query.max) || 10, 20)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = await gmailApi(`/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`) as any
        if (!list.messages?.length) return res.json({ messages: [], total: 0 })

        // Fetch each message metadata
        const messages = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          list.messages.slice(0, maxResults).map(async (m: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msg = await gmailApi(`/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`) as any
            const headers = msg.payload?.headers || []
            return {
              id: msg.id,
              threadId: msg.threadId,
              from: getHeader(headers, "From"),
              subject: getHeader(headers, "Subject"),
              date: getHeader(headers, "Date"),
              snippet: msg.snippet || "",
              labels: msg.labelIds || [],
              unread: msg.labelIds?.includes("UNREAD") ?? false,
            }
          })
        )
        res.json({ messages, total: list.resultSizeEstimate || messages.length })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Read full email
    ctx.app.get("/api/gmail/messages/:id", async (req, res) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = await gmailApi(`/messages/${req.params.id}?format=full`) as any
        const headers = msg.payload?.headers || []
        const body = extractBody(msg.payload)
        res.json({
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          body: body.slice(0, 10000),
          snippet: msg.snippet,
          labels: msg.labelIds || [],
        })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Read thread
    ctx.app.get("/api/gmail/threads/:id", async (req, res) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const thread = await gmailApi(`/threads/${req.params.id}?format=full`) as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages = (thread.messages || []).map((msg: any) => {
          const headers = msg.payload?.headers || []
          return {
            id: msg.id,
            from: getHeader(headers, "From"),
            to: getHeader(headers, "To"),
            date: getHeader(headers, "Date"),
            body: extractBody(msg.payload).slice(0, 5000),
            snippet: msg.snippet,
          }
        })
        res.json({ threadId: thread.id, messages })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Create draft
    ctx.app.post("/api/gmail/drafts", async (req, res) => {
      try {
        const { to, subject, body, inReplyTo, threadId } = req.body
        if (!to || !subject || !body) return res.status(400).json({ error: "to, subject, body required" })

        // Build RFC 2822 email
        const headers = [
          `To: ${to}`,
          `Subject: ${subject}`,
          `Content-Type: text/plain; charset="UTF-8"`,
        ]
        if (inReplyTo) {
          headers.push(`In-Reply-To: ${inReplyTo}`)
          headers.push(`References: ${inReplyTo}`)
        }
        const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`).toString("base64url")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const draft: Record<string, any> = { message: { raw } }
        if (threadId) draft.message.threadId = threadId

        const result = await gmailApi("/drafts", {
          method: "POST",
          body: JSON.stringify(draft),
        })
        res.json(result)
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Send email
    ctx.app.post("/api/gmail/send", async (req, res) => {
      try {
        const { to, subject, body, inReplyTo, threadId } = req.body
        if (!to || !subject || !body) return res.status(400).json({ error: "to, subject, body required" })

        const headers = [
          `To: ${to}`,
          `Subject: ${subject}`,
          `Content-Type: text/plain; charset="UTF-8"`,
        ]
        if (inReplyTo) {
          headers.push(`In-Reply-To: ${inReplyTo}`)
          headers.push(`References: ${inReplyTo}`)
        }
        const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`).toString("base64url")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: Record<string, any> = { raw }
        if (threadId) payload.threadId = threadId

        const result = await gmailApi("/messages/send", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        res.json(result)
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Get labels
    ctx.app.get("/api/gmail/labels", async (_req, res) => {
      try {
        const result = await gmailApi("/labels")
        res.json(result)
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    console.log("[GMAIL] Plugin activé")
  },
}
