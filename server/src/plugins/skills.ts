import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { Plugin } from "./types.js"

const SKILLS_DIR = "/root/maestro/skills"

if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true })

function parseSkillMd(content: string) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return { name: "", description: "", body: content }
  const fm = fmMatch[1]
  const body = fmMatch[2]
  const nameMatch = fm.match(/name:\s*(.+)/)
  const descMatch = fm.match(/description:\s*"?(.+?)"?\s*$/)
  return {
    name: nameMatch ? nameMatch[1].trim() : "",
    description: descMatch ? descMatch[1].trim() : "",
    body: body.trim(),
  }
}

export const skillsPlugin: Plugin = {
  id: "skills",
  name: "Skills System",
  version: "1.0.0",
  register(ctx) {
    // List all skills
    ctx.app.get("/api/skills", (_, res) => {
      try {
        const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
        const skills = dirs.map(d => {
          const skillPath = join(SKILLS_DIR, d.name, "SKILL.md")
          if (!existsSync(skillPath)) return null
          const content = readFileSync(skillPath, "utf-8")
          const parsed = parseSkillMd(content)
          return { id: d.name, name: parsed.name || d.name, description: parsed.description }
        }).filter(Boolean)
        res.json({ skills })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Get full skill content
    ctx.app.get("/api/skills/:id", (req, res) => {
      const skillPath = join(SKILLS_DIR, req.params.id, "SKILL.md")
      if (!existsSync(skillPath)) return res.status(404).json({ error: "Skill not found" })
      try {
        const content = readFileSync(skillPath, "utf-8")
        const parsed = parseSkillMd(content)
        res.json({ id: req.params.id, ...parsed, raw: content })
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

    // Get all skill descriptions (for injection into chat context)
    ctx.app.get("/api/skills/context/descriptions", (_, res) => {
      try {
        const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
        const descriptions = dirs.map(d => {
          const skillPath = join(SKILLS_DIR, d.name, "SKILL.md")
          if (!existsSync(skillPath)) return null
          const content = readFileSync(skillPath, "utf-8")
          const parsed = parseSkillMd(content)
          return `[${d.name}] ${parsed.description}`
        }).filter(Boolean)
        res.json({ descriptions })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })
  },
}
