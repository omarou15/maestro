import type { Plugin } from "./types.js"

// Google OAuth2 token refresh (shares credentials with Gmail)
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
  if (!res.ok) return null
  const data = await res.json() as { access_token: string }
  return data.access_token
}

async function calApi(path: string, options?: RequestInit): Promise<unknown> {
  const token = await getAccessToken()
  if (!token) throw new Error("Google Calendar non configuré (tokens manquants)")
  const base = "https://www.googleapis.com/calendar/v3"
  const res = await fetch(`${base}${path}`, {
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
    throw new Error(`Calendar API ${res.status}: ${err.slice(0, 300)}`)
  }
  return res.json()
}

function toParisISO(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date()
    return now.toISOString()
  }
  return new Date(dateStr).toISOString()
}

export const gcalendarPlugin: Plugin = {
  id: "gcalendar",
  name: "Google Calendar",
  version: "1.0.0",
  register(ctx) {
    const hasConfig = process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN
    if (!hasConfig) {
      console.log("[GCALENDAR] Credentials non définies — plugin désactivé")
      return
    }

    // List upcoming events
    ctx.app.get("/api/calendar/events", async (req, res) => {
      try {
        const calId = String(req.query.calendarId || "primary")
        const timeMin = req.query.timeMin ? toParisISO(String(req.query.timeMin)) : new Date().toISOString()
        const maxDays = Number(req.query.days) || 7
        const timeMax = req.query.timeMax
          ? toParisISO(String(req.query.timeMax))
          : new Date(Date.now() + maxDays * 86400000).toISOString()
        const maxResults = Math.min(Number(req.query.max) || 20, 50)

        const params = new URLSearchParams({
          timeMin,
          timeMax,
          maxResults: String(maxResults),
          singleEvents: "true",
          orderBy: "startTime",
          timeZone: "Europe/Paris",
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await calApi(`/calendars/${encodeURIComponent(calId)}/events?${params}`) as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const events = (data.items || []).map((e: any) => ({
          id: e.id,
          summary: e.summary || "(Sans titre)",
          description: e.description || "",
          location: e.location || "",
          start: e.start?.dateTime || e.start?.date || "",
          end: e.end?.dateTime || e.end?.date || "",
          status: e.status,
          attendees: (e.attendees || []).map((a: { email: string; responseStatus?: string }) => ({
            email: a.email,
            status: a.responseStatus,
          })),
          htmlLink: e.htmlLink,
        }))
        res.json({ events, total: events.length })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Get single event
    ctx.app.get("/api/calendar/events/:id", async (req, res) => {
      try {
        const calId = String(req.query.calendarId || "primary")
        const event = await calApi(`/calendars/${encodeURIComponent(calId)}/events/${req.params.id}`)
        res.json(event)
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Create event
    ctx.app.post("/api/calendar/events", async (req, res) => {
      try {
        const calId = String(req.query.calendarId || "primary")
        const { summary, description, location, start, end, attendees } = req.body
        if (!summary || !start || !end) return res.status(400).json({ error: "summary, start, end required" })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event: Record<string, any> = {
          summary,
          description: description || "",
          location: location || "",
          start: { dateTime: toParisISO(start), timeZone: "Europe/Paris" },
          end: { dateTime: toParisISO(end), timeZone: "Europe/Paris" },
        }
        if (attendees?.length) {
          event.attendees = attendees.map((email: string) => ({ email }))
        }

        const result = await calApi(`/calendars/${encodeURIComponent(calId)}/events`, {
          method: "POST",
          body: JSON.stringify(event),
        })
        res.json(result)
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Update event
    ctx.app.put("/api/calendar/events/:id", async (req, res) => {
      try {
        const calId = String(req.query.calendarId || "primary")
        const { summary, description, location, start, end, attendees } = req.body
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch: Record<string, any> = {}
        if (summary) patch.summary = summary
        if (description !== undefined) patch.description = description
        if (location !== undefined) patch.location = location
        if (start) patch.start = { dateTime: toParisISO(start), timeZone: "Europe/Paris" }
        if (end) patch.end = { dateTime: toParisISO(end), timeZone: "Europe/Paris" }
        if (attendees?.length) patch.attendees = attendees.map((email: string) => ({ email }))

        const result = await calApi(`/calendars/${encodeURIComponent(calId)}/events/${req.params.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        })
        res.json(result)
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Delete event
    ctx.app.delete("/api/calendar/events/:id", async (req, res) => {
      try {
        const calId = String(req.query.calendarId || "primary")
        const token = await getAccessToken()
        if (!token) return res.status(500).json({ error: "Token manquant" })
        const apiRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${req.params.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          }
        )
        if (!apiRes.ok && apiRes.status !== 204) {
          return res.status(apiRes.status).json({ error: await apiRes.text() })
        }
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // List calendars
    ctx.app.get("/api/calendar/list", async (_req, res) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await calApi("/users/me/calendarList") as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const calendars = (data.items || []).map((c: any) => ({
          id: c.id,
          summary: c.summary,
          primary: c.primary || false,
          accessRole: c.accessRole,
        }))
        res.json({ calendars })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Find free time
    ctx.app.post("/api/calendar/freebusy", async (req, res) => {
      try {
        const { timeMin, timeMax, calendarId } = req.body
        if (!timeMin || !timeMax) return res.status(400).json({ error: "timeMin, timeMax required" })
        const result = await calApi("", {
          method: "POST",
          body: JSON.stringify({
            timeMin: toParisISO(timeMin),
            timeMax: toParisISO(timeMax),
            timeZone: "Europe/Paris",
            items: [{ id: calendarId || "primary" }],
          }),
        }).catch(() => null)
        // FreeBusy uses a different base URL
        const token = await getAccessToken()
        const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            timeMin: toParisISO(timeMin),
            timeMax: toParisISO(timeMax),
            timeZone: "Europe/Paris",
            items: [{ id: calendarId || "primary" }],
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (fbRes.ok) {
          res.json(await fbRes.json())
        } else {
          res.json(result || { error: "FreeBusy failed" })
        }
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    console.log("[GCALENDAR] Plugin activé")
  },
}
