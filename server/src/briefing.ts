import fetch from "node-fetch"

const BACKEND = "http://localhost:4000"
const TG_API = "https://api.telegram.org/bot"

export async function sendBriefing() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  if (!token || !chatId) return

  const dateStr = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Paris" })

  let survival = { score: 0 }
  let missions: any[] = []
  let revenue = { total: 0 }
  let crons: any[] = []

  try { survival = await (await fetch(BACKEND + "/api/survival")).json() as any } catch {}
  try { const d = await (await fetch(BACKEND + "/api/missions")).json() as any; missions = d.missions || d || [] } catch {}
  try { revenue = await (await fetch(BACKEND + "/api/revenue/status")).json() as any } catch {}
  try { const d = await (await fetch(BACKEND + "/api/crons")).json() as any; crons = d.crons || [] } catch {}

  const activeMissions = Array.isArray(missions) ? missions.filter((m: any) => m.status === "active").length : 0
  const activeCrons = crons.filter((c: any) => c.active).length
  const failedCrons = crons.filter((c: any) => c.lastStatus === "error").length
  const scoreEmoji = (survival as any).score > 80 ? "🟢" : (survival as any).score > 50 ? "🟡" : "🔴"

  const msg = `☀️ BRIEFING MATIN — ${dateStr}\n\n${scoreEmoji} Score vital : ${(survival as any).score || 0}/100\n🎯 Missions actives : ${activeMissions}\n💰 Revenus du mois : ${(revenue as any).total || 0}€\n⏰ Crons : ${activeCrons} actifs${failedCrons > 0 ? ", " + failedCrons + " en erreur ⚠️" : ""}\n\n${(survival as any).score < 80 ? "⚠️ Attention : score vital bas, vérification recommandée" : "✅ Tout roule, bonne journée Omar !"}`

  await fetch(TG_API + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg }),
  })
  return msg
}
