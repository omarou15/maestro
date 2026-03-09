import TelegramBot from "node-telegram-bot-api"
import Anthropic from "@anthropic-ai/sdk"
import https from "https"

const BACKEND = "http://localhost:4000"

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
- ❌ "Je vais procéder à l'orchestration de votre demande"
- ✅ "C'est parti, je lance ça"
- ❌ "Voici le résultat de l'analyse que j'ai effectuée"
- ✅ "Voilà ce que j'ai trouvé"

CONTEXTE UTILISATEUR :
- Omar, CEO cabinet audit énergétique / conseil, France
- 2-5 ingénieurs thermiciens (Karim fort en DPE, lent en RE2020)
- Gmail + Monday.com
- Clients : Nexity (devis détaillés), SCI Les Terrasses (urgent 240m²), Mme Leroy (lente, relancer)
- Préférences : emails chaleureux ("Belle journée") pas froids ("Cordialement"), courses Carrefour Villeurbanne 18h-20h, train 1ère classe Part-Dieu avec Carte Avantage

CAPACITÉS :
- Créer des agents spécialisés par mission (outil : orchestrate)
- Consulter missions et agents actifs (outil : list_missions)
- Voir les validations en attente (outil : list_approvals)
- Approuver ou refuser une validation (outil : resolve_approval)
- Consulter l'activité récente (outil : get_activity)
- Modifier ton propre code (outil : self_modify) — POUVOIR ULTIME
- Seuil autonomie : < 50€ auto, > 50€ validation

RÈGLE IMPORTANTE :
Quand Omar donne un ordre d'action, UTILISE TOUJOURS l'outil correspondant. Ne simule jamais une action.`
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "orchestrate",
    description: "Lance une nouvelle mission ou donne un ordre à Maestro.",
    input_schema: {
      type: "object" as const,
      properties: { message: { type: "string" } },
      required: ["message"],
    },
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
    input_schema: {
      type: "object" as const,
      properties: { prompt: { type: "string" } },
      required: ["prompt"],
    },
  },
]

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
        const res = await fetch(`${BACKEND}/api/self-modify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input.prompt }), signal: AbortSignal.timeout(200000) })
        return JSON.stringify(await res.json())
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
    // Try to split on newline for cleaner cuts
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

async function askClaude(
  anthropic: Anthropic,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = messages
  let finalText = ""

  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: getSystemPrompt(),
      tools: TOOLS,
      messages: currentMessages,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUses = response.content.filter((c: any) => c.type === "tool_use")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = response.content.find((c: any) => c.type === "text")

    if (toolUses.length === 0) {
      finalText = textBlock?.type === "text" ? textBlock.text : "Action effectuée."
      break
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults = await Promise.all(toolUses.map(async (tu: any) => ({
      type: "tool_result" as const,
      tool_use_id: tu.id,
      content: await executeTool(tu.name, tu.input),
    })))

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

export function startTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!token) {
    console.log("[TELEGRAM] TELEGRAM_BOT_TOKEN non défini — bot désactivé")
    return
  }
  if (!apiKey) {
    console.log("[TELEGRAM] ANTHROPIC_API_KEY non défini — bot désactivé")
    return
  }

  const bot = new TelegramBot(token, { polling: true })
  const anthropic = new Anthropic({ apiKey })

  console.log("[TELEGRAM] Bot démarré ✅")

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id
    const chatIdStr = String(chatId)

    // Filter by allowed chat ID
    if (allowedChatId && chatIdStr !== allowedChatId) {
      console.log(`[TELEGRAM] Message rejeté de chatId=${chatIdStr}`)
      await bot.sendMessage(chatId, "Accès non autorisé.")
      return
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentBlocks: any[] = []

      // Handle image if present
      if (msg.photo) {
        // Get largest photo size
        const photo = msg.photo[msg.photo.length - 1]
        const fileInfo = await bot.getFile(photo.file_id)
        const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`
        const base64 = await downloadFileAsBase64(fileUrl)
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: base64 },
        })
      }

      // Add text content
      const text = msg.text || msg.caption || ""
      if (text) {
        contentBlocks.push({ type: "text", text })
      }

      if (contentBlocks.length === 0) {
        await bot.sendMessage(chatId, "Je ne sais pas traiter ce type de message (audio, vidéo, etc.).")
        return
      }

      // Show typing indicator
      await bot.sendChatAction(chatId, "typing")

      const messages = [{ role: "user", content: contentBlocks }]
      const reply = await askClaude(anthropic, messages)

      // Split and send
      const parts = splitMessage(reply)
      for (const part of parts) {
        await bot.sendMessage(chatId, part)
      }
    } catch (err) {
      console.error("[TELEGRAM] Erreur:", err)
      await bot.sendMessage(chatId, "Oups, une erreur s'est produite. Réessaie dans un instant.")
    }
  })

  bot.on("polling_error", (err) => {
    console.error("[TELEGRAM] Polling error:", err.message)
  })
}
