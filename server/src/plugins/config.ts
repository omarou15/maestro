import { readFileSync, writeFileSync, existsSync, watchFile, unwatchFile } from "fs"
import type { Plugin } from "./types.js"

const CONFIG_FILE = "/root/maestro/config.json"

// === Config Schema ===

type MaestroConfig = {
  // General
  name: string
  version: string
  locale: string
  timezone: string

  // Backend
  port: number
  frontendUrl: string

  // LLM
  defaultModel: string
  models: Record<string, { enabled: boolean; apiKey?: string }>

  // Autonomy rules
  autonomy: {
    maxAutoSpend: number    // € max sans validation
    dailySpendCap: number   // € max par jour
    allowSelfModify: boolean
    allowRestart: boolean
    emailEscalation: boolean
  }

  // Plugins
  plugins: Record<string, { enabled: boolean; config?: Record<string, unknown> }>

  // Channels
  channels: {
    telegram: { enabled: boolean; chatId?: string }
    web: { enabled: boolean }
  }
}

const DEFAULT_CONFIG: MaestroConfig = {
  name: "Maestro",
  version: "2.0.0",
  locale: "fr-FR",
  timezone: "Europe/Paris",
  port: 4000,
  frontendUrl: "*",
  defaultModel: "claude-sonnet-4-20250514",
  models: {
    "claude-sonnet": { enabled: true },
    "claude-opus": { enabled: true },
    "claude-haiku": { enabled: true },
  },
  autonomy: {
    maxAutoSpend: 50,
    dailySpendCap: 200,
    allowSelfModify: true,
    allowRestart: true,
    emailEscalation: true,
  },
  plugins: {
    crons: { enabled: true },
    skills: { enabled: true },
    sandbox: { enabled: true },
    telegram: { enabled: true },
  },
  channels: {
    telegram: { enabled: true },
    web: { enabled: true },
  },
}

// === Validation ===

type ValidationError = { path: string; message: string }

function validateConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = []
  if (!config || typeof config !== "object") {
    errors.push({ path: "", message: "Config doit être un objet" })
    return errors
  }

  const c = config as Record<string, unknown>

  // Type checks
  if (c.port !== undefined && (typeof c.port !== "number" || c.port < 1 || c.port > 65535)) {
    errors.push({ path: "port", message: "Port doit être entre 1 et 65535" })
  }
  if (c.locale !== undefined && typeof c.locale !== "string") {
    errors.push({ path: "locale", message: "Locale doit être une string" })
  }
  if (c.timezone !== undefined && typeof c.timezone !== "string") {
    errors.push({ path: "timezone", message: "Timezone doit être une string" })
  }

  // Autonomy checks
  if (c.autonomy && typeof c.autonomy === "object") {
    const a = c.autonomy as Record<string, unknown>
    if (a.maxAutoSpend !== undefined && (typeof a.maxAutoSpend !== "number" || a.maxAutoSpend < 0)) {
      errors.push({ path: "autonomy.maxAutoSpend", message: "Doit être un nombre >= 0" })
    }
    if (a.dailySpendCap !== undefined && (typeof a.dailySpendCap !== "number" || a.dailySpendCap < 0)) {
      errors.push({ path: "autonomy.dailySpendCap", message: "Doit être un nombre >= 0" })
    }
  }

  return errors
}

// === Config Store ===

let currentConfig: MaestroConfig = { ...DEFAULT_CONFIG }
let configWatcher: ReturnType<typeof watchFile> | null = null

function loadConfig(): MaestroConfig {
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8")
    return { ...DEFAULT_CONFIG }
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    // Deep merge with defaults
    return deepMerge(DEFAULT_CONFIG, parsed) as MaestroConfig
  } catch {
    console.error("[CONFIG] Erreur de parsing, utilisation des défauts")
    return { ...DEFAULT_CONFIG }
  }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object") {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>)
    } else {
      result[key] = source[key]
    }
  }
  return result
}

function saveConfig(config: MaestroConfig): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")
}

// Public accessor
export function getConfig(): MaestroConfig {
  return currentConfig
}

// === Plugin ===

export const configPlugin: Plugin = {
  id: "config",
  name: "Config Manager",
  version: "1.0.0",
  register(ctx) {
    // Load initial config
    currentConfig = loadConfig()
    console.log(`[CONFIG] Chargé depuis ${CONFIG_FILE}`)

    // Watch for external changes (hot-reload)
    watchFile(CONFIG_FILE, { interval: 2000 }, () => {
      try {
        const newConfig = loadConfig()
        const errors = validateConfig(newConfig)
        if (errors.length === 0) {
          currentConfig = newConfig
          console.log("[CONFIG] Hot-reload: config mise à jour")
          ctx.fire("config:reloaded", { time: new Date().toISOString() })
        } else {
          console.error("[CONFIG] Hot-reload ignoré:", errors)
        }
      } catch (e) {
        console.error("[CONFIG] Hot-reload erreur:", e)
      }
    })

    // Get current config
    ctx.app.get("/api/config", (_, res) => {
      res.json({ config: currentConfig })
    })

    // Update config (partial)
    ctx.app.patch("/api/config", (req, res) => {
      const updates = req.body
      if (!updates || typeof updates !== "object") {
        return res.status(400).json({ error: "Body doit être un objet" })
      }

      const merged = deepMerge(currentConfig as unknown as Record<string, unknown>, updates) as unknown as MaestroConfig
      const errors = validateConfig(merged)

      if (errors.length > 0) {
        return res.status(400).json({ errors })
      }

      currentConfig = merged
      saveConfig(currentConfig)
      ctx.fire("config:updated", { updates: Object.keys(updates) })
      res.json({ ok: true, config: currentConfig })
    })

    // Replace entire config
    ctx.app.put("/api/config", (req, res) => {
      const newConfig = req.body
      const errors = validateConfig(newConfig)

      if (errors.length > 0) {
        return res.status(400).json({ errors })
      }

      const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, newConfig) as unknown as MaestroConfig
      currentConfig = merged
      saveConfig(currentConfig)
      ctx.fire("config:replaced", { time: new Date().toISOString() })
      res.json({ ok: true, config: currentConfig })
    })

    // Validate a config without applying
    ctx.app.post("/api/config/validate", (req, res) => {
      const errors = validateConfig(req.body)
      res.json({ valid: errors.length === 0, errors })
    })

    // Reset to defaults
    ctx.app.post("/api/config/reset", (_, res) => {
      currentConfig = { ...DEFAULT_CONFIG }
      saveConfig(currentConfig)
      ctx.fire("config:reset", { time: new Date().toISOString() })
      res.json({ ok: true, config: currentConfig })
    })
  },
}
