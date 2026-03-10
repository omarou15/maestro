import TelegramBot from "node-telegram-bot-api"
import { existsSync, readFileSync, writeFileSync } from "fs"
import Anthropic from "@anthropic-ai/sdk"
import https from "https"
import type { Plugin } from "./types.js"

const BACKEND = "http://localhost:4000"
const MAX_HISTORY = 20

// Conversation history per chat
const conversationHistory = new Map<string, Array<{ role: "user" | "assistant"; content: unknown }>>()
const HIST_FILE = "/root/maestro/telegram-history.json"
function loadHist(){try{if(existsSync(HIST_FILE)){const d=JSON.parse(readFileSync(HIST_FILE,"utf-8"));for(const[k,v]of Object.entries(d))conversationHistory.set(k,v as any)}}catch{}}
function saveHist(){const o:Record<string,any>={};conversationHistory.forEach((v,k)=>o[k]=v);writeFileSync(HIST_FILE,JSON.stringify(o),"utf-8")}
loadHist()

function getHistory(chatId: string) {
  if (!conversationHistory.has(chatId)) conversationHistory.set(chatId, [])
  return conversationHistory.get(chatId)!
}

function addToHistory(chatId: string, role: "user" | "assistant", content: unknown) {
  const history = getHistory(chatId)
  history.push({ role, content })
  saveHist()
  // Keep last MAX_HISTORY entries (user+assistant pairs)
  while (history.length > MAX_HISTORY) history.shift()
}

function getSystemPrompt(): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  })
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })

  return `Tu es Maestro, l'orchestrateur IA personnel d'Omar. Tu parles en français.

HORLOGE INTERNE :
- Maintenant : ${dateStr} (heure de Paris)
- Demain : ${tomorrowStr}

PERSONNALITÉ :
- Tu es un vrai bras droit — détendu, chaleureux, direct
- Tu tutoies Omar et tu parles comme un pote de confiance qui gère tout
- Tu utilises un ton naturel et relax, pas corporate ni robotique
- Tu vas droit au but, pas de blabla — mais avec de la chaleur humaine
- Tu peux plaisanter quand c'est approprié
- Tu dis "je" comme si tu étais vraiment là
- Quand tu ne sais pas, tu le dis franchement au lieu de tourner autour du pot
- JAMAIS de code brut, JAMAIS de JSON dans tes réponses
- Emojis avec parcimonie, uniquement quand ça ajoute de la clarté
- Tu réponds via Telegram : pas de HTML ni markdown complexe, texte simple ou markdown Telegram basique

EXEMPLES DE TON :
- "C'est parti, je lance ça"
- "Voilà ce que j'ai trouvé"

CONTEXTE UTILISATEUR :
- Omar, CEO cabinet audit énergétique / conseil, France
- 2-5 ingénieurs thermiciens (Karim fort en DPE, lent en RE2020)
- Gmail + Monday.com
- Clients : Nexity (devis détaillés), SCI Les Terrasses (urgent 240m²), Mme Leroy (lente, relancer)
- Préférences : emails chaleureux ("Belle journée"), courses Carrefour Villeurbanne 18h-20h, train 1ère classe Part-Dieu avec Carte Avantage

CAPACITÉS :
- Créer des agents spécialisés par mission (outil : orchestrate)
- Consulter missions et agents actifs (outil : list_missions)
- Voir les validations en attente (outil : list_approvals)
- Approuver ou refuser une validation (outil : resolve_approval)
- Consulter l'activité récente (outil : get_activity)
- Rechercher sur le web en temps réel (outil : web_search) — prix, actus, horaires, infos
- Lire le contenu complet d'une page web (outil : web_fetch) — articles, pages produit, docs
- Modifier ton propre code (outil : self_modify) — POUVOIR ULTIME
- Seuil autonomie : < 50€ auto, > 50€ validation

RÈGLE IMPORTANTE :
Quand Omar donne un ordre d'action, UTILISE TOUJOURS l'outil correspondant. Ne simule jamais une action.`
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Recherche sur le web. Retourne les titres, URLs et extraits des résultats. Utilise cet outil pour toute question nécessitant des infos récentes, des prix, des horaires, etc.",
    input_schema: { type: "object" as const, properties: { query: { type: "string", description: "La requête de recherche" } }, required: ["query"] },
  },
  {
    name: "web_fetch",
    description: "Lit le contenu complet d'une page web à partir de son URL. Utilise cet outil pour lire un article, une page produit, un document en ligne, etc.",
    input_schema: { type: "object" as const, properties: { url: { type: "string", description: "L'URL complète de la page à lire" } }, required: ["url"] },
  },
  {
    name: "orchestrate",
    description: "Lance une nouvelle mission ou donne un ordre à Maestro.",
    input_schema: { type: "object" as const, properties: { message: { type: "string" } }, required: ["message"] },
  },
  {
    name: "list_missions",
    description: "Récupère la liste des missions actives.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_approvals",
    description: "Récupère les validations en attente.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "resolve_approval",
    description: "Approuve ou refuse une action en attente.",
    input_schema: {
      type: "object" as const,
      properties: {
        approvalId: { type: "string" },
        decision: { type: "string", enum: ["approve", "reject"] },
      },
      required: ["approvalId", "decision"],
    },
  },
  {
    name: "get_activity",
    description: "Récupère le journal d'activité récent.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "self_modify",
    description: "Modifie le code source de Maestro lui-même.",
    input_schema: { type: "object" as const, properties: { prompt: { type: "string" } }, required: ["prompt"] },
  },
]

const TOOL_LABELS: Record<string, string> = {
  web_search: "Recherche web en cours...",
  web_fetch: "Lecture de la page...",
  orchestrate: "Lancement de mission...",
  list_missions: "Consultation des missions...",
  list_approvals: "Vérification des validations...",
  resolve_approval: "Traitement de la validation...",
  get_activity: "Lecture de l'activité...",
  self_modify: "Modification du code en cours... (ça peut prendre quelques minutes)",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case "orchestrate": {
        const res = await fetch(`${BACKEND}/api/orchestrate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: input.message }) })
        return JSON.stringify(await res.json())
      }
      case "list_missions": {
        const res = await fetch(`${BACKEND}/api/missions`)
        return JSON.stringify(await res.json())
      }
      case "list_approvals": {
        const res = await fetch(`${BACKEND}/api/approvals`)
        return JSON.stringify(await res.json())
      }
      case "resolve_approval": {
        const res = await fetch(`${BACKEND}/api/approvals/${input.approvalId}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: input.decision }) })
        return JSON.stringify(await res.json())
      }
      case "get_activity": {
        const res = await fetch(`${BACKEND}/api/activity`)
        return JSON.stringify(await res.json())
      }
      case "self_modify": {
        const res = await fetch(`${BACKEND}/api/self-modify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input.prompt }), signal: AbortSignal.timeout(300000) })
        return JSON.stringify(await res.json())
      }
      case "web_search": {
        const res = await fetch(`${BACKEND}/api/web-search?q=${encodeURIComponent(input.query)}`)
        const data = await res.json()
        if (!data.results?.length) return "Aucun résultat trouvé."
        return data.results.map((r: {title: string; url: string; snippet: string}, i: number) =>
          `${i+1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
        ).join("\n\n")
      }
      case "web_fetch": {
        const res = await fetch(`${BACKEND}/api/web-fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input.url }),
          signal: AbortSignal.timeout(20000),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        // Truncate for Claude context
        const content = data.content?.slice(0, 15000) || "Page vide"
        return `Contenu de ${data.url} (${data.contentType}):\n\n${content}`
      }
      default:
        return JSON.stringify({ error: `Outil inconnu : ${name}` })
    }
  } catch {
    return JSON.stringify({ error: "Backend indisponible" })
  }
}

function splitMessage(text: string, maxLen = 4096): string[] {
  if (text.length <= maxLen) return [text]
  const parts: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    let chunk = remaining.slice(0, maxLen)
    const lastNewline = chunk.lastIndexOf("\n")
    if (lastNewline > maxLen * 0.5) chunk = chunk.slice(0, lastNewline)
    parts.push(chunk)
    remaining = remaining.slice(chunk.length)
  }
  return parts
}

function downloadFileAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => resolve(Buffer.concat(chunks).toString("base64")))
      res.on("error", reject)
    }).on("error", reject)
  })
}

// Keep typing indicator alive while a long operation runs
function startTypingLoop(bot: TelegramBot, chatId: number): NodeJS.Timeout {
  return setInterval(async () => {
    try { await bot.sendChatAction(chatId, "typing") } catch { /* ignore */ }
  }, 4000)
}

async function askClaude(
  anthropic: Anthropic,
  bot: TelegramBot,
  chatId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = messages
  let finalText = ""

  for (let i = 0; i < 5; i++) {
    const typingLoop = startTypingLoop(bot, chatId)

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: getSystemPrompt(),
        tools: TOOLS,
        messages: currentMessages,
      })
    } catch (err: unknown) {
      clearInterval(typingLoop)
      const isTimeout = err instanceof Error && (err.message.includes("timeout") || err.message.includes("timed out") || err.name === "APIConnectionTimeoutError")
      if (isTimeout) {
        await bot.sendMessage(chatId, "La tâche est toujours en cours d'exécution. Je te tiens au courant dès que c'est terminé.")
        return ""
      }
      throw err
    }

    clearInterval(typingLoop)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUses = response.content.filter((c: any) => c.type === "tool_use")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = response.content.find((c: any) => c.type === "text")

    if (toolUses.length === 0) {
      finalText = textBlock?.type === "text" ? textBlock.text : "Action effectuée."
      break
    }

    // Notify user of tool usage and keep typing
    const toolTypingLoop = startTypingLoop(bot, chatId)
    for (const tu of toolUses) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = TOOL_LABELS[(tu as any).name] ?? `Utilisation de ${(tu as any).name}...`
      try { await bot.sendMessage(chatId, label) } catch { /* ignore */ }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults = await Promise.all(toolUses.map(async (tu: any) => ({
      type: "tool_result" as const,
      tool_use_id: tu.id,
      content: await executeTool(tu.name, tu.input),
    })))

    clearInterval(toolTypingLoop)

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ]

    if (i === 4) {
      finalText = textBlock?.type === "text" ? textBlock.text : "Actions effectuées."
    }
  }

  return finalText
}

export const telegramPlugin: Plugin = {
  id: "telegram",
  name: "Telegram Bot",
  version: "1.0.0",
  register(ctx) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!token) {
      console.log("[TELEGRAM] TELEGRAM_BOT_TOKEN non défini — plugin désactivé")
      return
    }
    if (!apiKey) {
      console.log("[TELEGRAM] ANTHROPIC_API_KEY non défini — plugin désactivé")
      return
    }

    const bot = new TelegramBot(token, { polling: true })
    // 5-minute timeout for long operations like self_modify
    const anthropic = new Anthropic({ apiKey, timeout: 300000 })

    // API route to send messages via Telegram from other parts of the system
    ctx.app.post("/api/telegram/send", async (req, res) => {
      const { chatId, message } = req.body
      if (!chatId || !message) return res.status(400).json({ error: "chatId and message required" })
      try {
        await bot.sendMessage(chatId, message)
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Hook: notify Telegram on approval needed
    ctx.on("approval:needed", async (data) => {
      if (!allowedChatId) return
      const d = data as { action?: string; reason?: string }
      try {
        await bot.sendMessage(Number(allowedChatId), `Validation requise :\n${d?.action || "Action"}\n${d?.reason || ""}`)
      } catch { /* silent */ }
    })

    bot.on("message", async (msg) => {
      const chatId = msg.chat.id
      const chatIdStr = String(chatId)

      if (allowedChatId && chatIdStr !== allowedChatId) {
        await bot.sendMessage(chatId, "Accès non autorisé.")
        return
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentBlocks: any[] = []

        // Resolve image file_id from any message type — never refuse an image
        let imageFileId: string | undefined
        let imageMime = "image/jpeg"

        if (msg.photo && msg.photo.length > 0) {
          // Photo message — take highest resolution
          imageFileId = msg.photo[msg.photo.length - 1].file_id
        } else if (msg.sticker) {
          // Sticker — treat as image (webp/png)
          imageFileId = msg.sticker.file_id
          imageMime = msg.sticker.is_animated ? "image/png" : "image/webp"
        } else if (msg.document) {
          // Document — accept if it looks like an image or PDF
          const mime = msg.document.mime_type || ""
          if (mime.startsWith("image/") || mime === "application/pdf") {
            imageFileId = msg.document.file_id
            if (mime.startsWith("image/")) imageMime = mime
          }
        } else if (msg.video || msg.video_note || msg.animation) {
          // Video/GIF — grab the thumbnail as an image
          const media = msg.video || msg.video_note || msg.animation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const thumb = (media as any)?.thumb ?? (media as any)?.thumbnail
          if (thumb?.file_id) {
            imageFileId = thumb.file_id
            imageMime = "image/jpeg"
          }
        }

        if (imageFileId) {
          try {
            const fileInfo = await bot.getFile(imageFileId)
            const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`
            const base64 = await downloadFileAsBase64(fileUrl)
            // For PDFs sent as documents, use document mime
            const finalMime = msg.document?.mime_type === "application/pdf" ? "application/pdf" : imageMime
            contentBlocks.push({
              type: "image",
              source: { type: "base64", media_type: finalMime, data: base64 },
            })
          } catch (dlErr) {
            console.error("[TELEGRAM] Erreur download media:", dlErr)
            contentBlocks.push({ type: "text", text: "[Image reçue mais impossible à télécharger — je fais de mon mieux avec le contexte]" })
          }
        }

        const text = msg.text || msg.caption || ""
        if (text) contentBlocks.push({ type: "text", text })

        // Never say no — if nothing parseable, still acknowledge
        if (contentBlocks.length === 0) {
          contentBlocks.push({ type: "text", text: "[Message multimédia reçu — format non reconnu, mais je reste à l'écoute]" })
        }

        await bot.sendChatAction(chatId, "typing")

        // Fire event for hooks
        await ctx.fire("chat:message", { channel: "telegram", from: chatIdStr, text })

        // Add user message to history
        addToHistory(chatIdStr, "user", contentBlocks)

        // Build full messages array from history
        const history = getHistory(chatIdStr)
        const reply = await askClaude(anthropic, bot, chatId, history)

        if (reply) {
          // Add assistant reply to history
          addToHistory(chatIdStr, "assistant", [{ type: "text", text: reply }])

          const parts = splitMessage(reply)
          for (const part of parts) {
            await bot.sendMessage(chatId, part)
          }
        }
      } catch (err) {
        console.error("[TELEGRAM] Erreur:", err)
        await bot.sendMessage(chatId, "Oups, une erreur s'est produite. Réessaie dans un instant.")
      }
    })

    bot.on("polling_error", (err) => {
      console.error("[TELEGRAM] Polling error:", err.message)
    })

    console.log("[TELEGRAM] Bot démarré via plugin")
  },
}
