import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { Plugin } from "./types.js"

const SKILLS_DIR = "/root/maestro/skills"

if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true })

// === Structured Frontmatter Types (OpenClaw-inspired) ===

type InstallSpec = {
  kind: "apt" | "npm" | "pip" | "brew" | "custom"
  package?: string
  command?: string
}

type SkillMetadata = {
  name: string
  description: string
  emoji?: string
  version?: string
  author?: string
  // Dependencies
  requires?: {
    bins?: string[]      // Required binaries in PATH
    env?: string[]       // Required environment variables
    node?: string[]      // Required npm packages
  }
  // Auto-install specs
  install?: InstallSpec[]
  // Platform filter
  os?: ("linux" | "darwin" | "win32")[]
  // Always load into chat context (even if not invoked)
  always?: boolean
  // Tags for categorization
  tags?: string[]
}

type ParsedSkill = {
  name: string
  description: string
  metadata: SkillMetadata
  body: string
  raw: string
  available: boolean
  missingDeps: string[]
}

// === YAML-like frontmatter parser (no external dependency) ===

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return { meta: {}, body: content }

  const fm = fmMatch[1]
  const body = fmMatch[2].trim()
  const meta: Record<string, unknown> = {}

  // Parse simple YAML (key: value, arrays, nested objects)
  let currentKey = ""
  let currentObj: Record<string, unknown> | null = null

  for (const line of fm.split("\n")) {
    const trimmed = line.trimEnd()

    // Top-level key: value
    const topMatch = trimmed.match(/^(\w+):\s*(.*)$/)
    if (topMatch) {
      const [, key, val] = topMatch
      currentKey = key

      if (val === "") {
        // Could be object or array start
        meta[key] = {}
        currentObj = meta[key] as Record<string, unknown>
      } else if (val.startsWith("[") && val.endsWith("]")) {
        // Inline array: [a, b, c]
        meta[key] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
        currentObj = null
      } else if (val === "true") {
        meta[key] = true; currentObj = null
      } else if (val === "false") {
        meta[key] = false; currentObj = null
      } else {
        meta[key] = val.replace(/^["']|["']$/g, "")
        currentObj = null
      }
      continue
    }

    // Nested key (2-space indent): "  bins: [gh, node]"
    const nestedMatch = trimmed.match(/^  (\w+):\s*(.*)$/)
    if (nestedMatch && currentObj) {
      const [, nKey, nVal] = nestedMatch
      if (nVal.startsWith("[") && nVal.endsWith("]")) {
        currentObj[nKey] = nVal.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      } else if (nVal === "true") {
        currentObj[nKey] = true
      } else if (nVal === "false") {
        currentObj[nKey] = false
      } else {
        currentObj[nKey] = nVal.replace(/^["']|["']$/g, "")
      }
      continue
    }

    // Array item (2-space indent): "  - value"
    const arrayMatch = trimmed.match(/^  - (.+)$/)
    if (arrayMatch && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = []
      const arrVal = arrayMatch[1].trim()
      // Check if it's an object like "{ kind: apt, package: curl }"
      if (arrVal.startsWith("{") && arrVal.endsWith("}")) {
        const obj: Record<string, string> = {}
        arrVal.slice(1, -1).split(",").forEach(pair => {
          const [k, v] = pair.split(":").map(s => s.trim().replace(/^["']|["']$/g, ""))
          if (k && v) obj[k] = v
        })
        ;(meta[currentKey] as unknown[]).push(obj)
      } else {
        ;(meta[currentKey] as unknown[]).push(arrVal.replace(/^["']|["']$/g, ""))
      }
    }
  }

  return { meta, body }
}

function extractMetadata(meta: Record<string, unknown>): SkillMetadata {
  return {
    name: String(meta.name || ""),
    description: String(meta.description || ""),
    emoji: meta.emoji ? String(meta.emoji) : undefined,
    version: meta.version ? String(meta.version) : undefined,
    author: meta.author ? String(meta.author) : undefined,
    requires: meta.requires ? meta.requires as SkillMetadata["requires"] : undefined,
    install: Array.isArray(meta.install) ? meta.install as InstallSpec[] : undefined,
    os: Array.isArray(meta.os) ? meta.os as SkillMetadata["os"] : undefined,
    always: typeof meta.always === "boolean" ? meta.always : undefined,
    tags: Array.isArray(meta.tags) ? meta.tags as string[] : undefined,
  }
}

// === Dependency checking ===

function hasBinary(name: string): boolean {
  try {
    execSync(`which ${name}`, { encoding: "utf8", stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function hasEnvVar(name: string): boolean {
  return !!process.env[name]
}

function checkDependencies(meta: SkillMetadata): string[] {
  const missing: string[] = []

  // Check platform
  if (meta.os && !meta.os.includes(process.platform as "linux" | "darwin" | "win32")) {
    missing.push(`platform:${process.platform} (requires ${meta.os.join("|")})`)
  }

  // Check binaries
  if (meta.requires?.bins) {
    for (const bin of meta.requires.bins) {
      if (!hasBinary(bin)) missing.push(`bin:${bin}`)
    }
  }

  // Check env vars
  if (meta.requires?.env) {
    for (const env of meta.requires.env) {
      if (!hasEnvVar(env)) missing.push(`env:${env}`)
    }
  }

  return missing
}

// === Auto-install ===

function tryInstall(specs: InstallSpec[]): { success: boolean; output: string } {
  for (const spec of specs) {
    try {
      let cmd = ""
      switch (spec.kind) {
        case "apt":
          cmd = `apt-get install -y ${spec.package}`
          break
        case "npm":
          cmd = `npm install -g ${spec.package}`
          break
        case "pip":
          cmd = `pip install ${spec.package}`
          break
        case "custom":
          cmd = spec.command || ""
          break
        default:
          continue
      }
      if (!cmd) continue
      const output = execSync(cmd, { encoding: "utf8", timeout: 60000, stdio: "pipe" })
      return { success: true, output: output.slice(-200) }
    } catch (e) {
      // Try next install method
      continue
    }
  }
  return { success: false, output: "Aucune méthode d'installation n'a fonctionné" }
}

// === Parse a single skill ===

function parseSkill(id: string): ParsedSkill | null {
  const skillPath = join(SKILLS_DIR, id, "SKILL.md")
  if (!existsSync(skillPath)) return null

  const raw = readFileSync(skillPath, "utf-8")
  const { meta, body } = parseFrontmatter(raw)
  const metadata = extractMetadata(meta)
  const missingDeps = checkDependencies(metadata)

  return {
    name: metadata.name || id,
    description: metadata.description,
    metadata,
    body,
    raw,
    available: missingDeps.length === 0,
    missingDeps,
  }
}

// === Plugin ===

export const skillsPlugin: Plugin = {
  id: "skills",
  name: "Skills System",
  version: "2.0.0",
  register(ctx) {
    // List all skills with availability status
    ctx.app.get("/api/skills", (_, res) => {
      try {
        const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
        const skills = dirs.map(d => {
          const skill = parseSkill(d.name)
          if (!skill) return null
          return {
            id: d.name,
            name: skill.name,
            description: skill.description,
            emoji: skill.metadata.emoji,
            tags: skill.metadata.tags,
            available: skill.available,
            missingDeps: skill.missingDeps,
            always: skill.metadata.always,
            version: skill.metadata.version,
          }
        }).filter(Boolean)
        res.json({ skills })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Get full skill content with metadata
    ctx.app.get("/api/skills/:id", (req, res) => {
      try {
        const skill = parseSkill(req.params.id)
        if (!skill) return res.status(404).json({ error: "Skill not found" })
        res.json({ id: req.params.id, ...skill })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Try to install a skill's dependencies
    ctx.app.post("/api/skills/:id/install", (req, res) => {
      try {
        const skill = parseSkill(req.params.id)
        if (!skill) return res.status(404).json({ error: "Skill not found" })
        if (skill.available) return res.json({ ok: true, message: "Toutes les dépendances sont déjà satisfaites" })
        if (!skill.metadata.install || skill.metadata.install.length === 0) {
          return res.json({ ok: false, message: "Pas de méthode d'installation définie", missingDeps: skill.missingDeps })
        }
        const result = tryInstall(skill.metadata.install)
        // Re-check after install
        const updated = parseSkill(req.params.id)
        res.json({
          ok: result.success,
          output: result.output,
          available: updated?.available ?? false,
          missingDeps: updated?.missingDeps ?? [],
        })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Create or update a skill
    ctx.app.put("/api/skills/:id", (req, res) => {
      const { content } = req.body
      if (!content) return res.status(400).json({ error: "content required" })
      const skillDir = join(SKILLS_DIR, req.params.id)
      try {
        if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true })
        writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8")
        execSync(`cd /root/maestro && git add skills/ && git commit -m "skill: update ${req.params.id}" && git push origin main`, { encoding: "utf8" })
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Delete a skill
    ctx.app.delete("/api/skills/:id", (req, res) => {
      const skillDir = join(SKILLS_DIR, req.params.id)
      if (!existsSync(skillDir)) return res.status(404).json({ error: "Skill not found" })
      try {
        rmSync(skillDir, { recursive: true })
        execSync(`cd /root/maestro && git add -A && git commit -m "skill: delete ${req.params.id}" && git push origin main`, { encoding: "utf8" })
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Get all skill descriptions for chat context injection
    // Only returns available skills (or always-on skills even if missing deps)
    ctx.app.get("/api/skills/context/descriptions", (_, res) => {
      try {
        const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
        const descriptions = dirs.map(d => {
          const skill = parseSkill(d.name)
          if (!skill) return null
          if (!skill.available && !skill.metadata.always) return null
          const emoji = skill.metadata.emoji ? `${skill.metadata.emoji} ` : ""
          const tags = skill.metadata.tags?.length ? ` [${skill.metadata.tags.join(", ")}]` : ""
          return `${emoji}[${d.name}] ${skill.description}${tags}`
        }).filter(Boolean)
        res.json({ descriptions })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })
  },
}
