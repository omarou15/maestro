import { spawnSync, execSync } from "child_process"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import type { Plugin } from "./types.js"

const MAESTRO_DIR = "/root/maestro"
const SANDBOX_LOG = "/root/maestro/server/sandbox.log"
const MAX_TIMEOUT = 300000 // 5 min max

// Dangerous patterns that should be blocked or flagged
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\/(?!root\/maestro)/i,       // rm -rf outside maestro
  /mkfs/i,                                    // format disk
  /dd\s+if=/i,                               // disk write
  /shutdown|reboot|halt|poweroff/i,          // system shutdown
  /iptables|ufw.*delete/i,                   // firewall tampering
  /passwd|useradd|usermod.*root/i,           // user management
  /chmod\s+777\s+\//i,                       // dangerous permissions on root
  /curl.*\|\s*sh/i,                          // pipe to shell
  /wget.*\|\s*sh/i,                          // pipe to shell
]

const WARN_PATTERNS = [
  /git\s+push\s+--force/i,
  /git\s+reset\s+--hard/i,
  /npm\s+publish/i,
  /systemctl\s+(stop|disable)/i,
  /DROP\s+TABLE|DELETE\s+FROM/i,
]

type SandboxResult = {
  success: boolean
  output: string
  error?: string
  snapshot?: string
  rolled_back?: boolean
  warnings?: string[]
  duration_ms: number
}

function logSandbox(entry: string) {
  const line = `[${new Date().toISOString()}] ${entry}\n`
  try {
    const existing = existsSync(SANDBOX_LOG) ? readFileSync(SANDBOX_LOG, "utf-8") : ""
    // Keep last 500 lines
    const lines = existing.split("\n").slice(-499)
    writeFileSync(SANDBOX_LOG, [...lines, line.trim()].join("\n"), "utf-8")
  } catch { /* ignore */ }
}

function checkBlocked(prompt: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return `Commande bloquée par le sandbox : pattern "${pattern.source}" détecté`
    }
  }
  return null
}

function checkWarnings(prompt: string): string[] {
  const warnings: string[] = []
  for (const pattern of WARN_PATTERNS) {
    if (pattern.test(prompt)) {
      warnings.push(`Opération risquée détectée : "${pattern.source}"`)
    }
  }
  return warnings
}

function createGitSnapshot(): string | null {
  try {
    // Save current state as a stash-like reference
    const hash = execSync("cd /root/maestro && git rev-parse HEAD", { encoding: "utf8" }).trim()
    // Auto-commit any uncommitted changes
    try {
      execSync("cd /root/maestro && git add -A && git stash", { encoding: "utf8", stdio: "pipe" })
    } catch { /* no changes to stash */ }
    return hash
  } catch {
    return null
  }
}

function rollbackToSnapshot(hash: string): boolean {
  try {
    execSync(`cd /root/maestro && git checkout ${hash} -- .`, { encoding: "utf8" })
    // Restore stash if any
    try {
      execSync("cd /root/maestro && git stash pop", { encoding: "utf8", stdio: "pipe" })
    } catch { /* no stash */ }
    return true
  } catch {
    return false
  }
}

function verifyBuild(): boolean {
  try {
    // Check backend build
    execSync("cd /root/maestro/server && npx tsc --noEmit", { encoding: "utf8", timeout: 30000, stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export const sandboxPlugin: Plugin = {
  id: "sandbox",
  name: "Sandbox Execution",
  version: "1.0.0",
  register(ctx) {
    // Sandbox self-modify — replaces the raw self-modify with a protected version
    ctx.app.post("/api/sandbox/modify", async (req, res) => {
      const { prompt, skipBuildCheck, force } = req.body
      if (!prompt) return res.status(400).json({ error: "prompt required" })
      const start = Date.now()

      // Check for blocked patterns
      const blocked = checkBlocked(prompt)
      if (blocked && !force) {
        logSandbox(`BLOCKED: ${prompt.slice(0, 100)} — ${blocked}`)
        await ctx.fire("activity", { text: `Sandbox BLOQUÉ: ${blocked}`, type: "alert" })
        return res.json({ success: false, error: blocked, duration_ms: Date.now() - start })
      }

      // Check for warnings
      const warnings = checkWarnings(prompt)
      if (warnings.length > 0) {
        logSandbox(`WARN: ${prompt.slice(0, 100)} — ${warnings.join("; ")}`)
      }

      // Create snapshot before modification
      const snapshot = createGitSnapshot()
      logSandbox(`EXECUTE: ${prompt.slice(0, 100)} (snapshot: ${snapshot || "none"})`)
      await ctx.fire("activity", { text: `Sandbox: "${prompt.slice(0, 60)}..."`, type: "auto" })

      // Execute via claude CLI
      const result = spawnSync(
        "claude", ["-p", prompt, "--output-format", "text"],
        {
          cwd: MAESTRO_DIR,
          timeout: Math.min(MAX_TIMEOUT, 180000),
          encoding: "utf8",
          env: { ...process.env, HOME: "/root" },
        }
      )

      if (result.error || result.status !== 0) {
        // Rollback on failure
        if (snapshot) rollbackToSnapshot(snapshot)
        const error = result.error?.message || result.stderr || "Échec"
        logSandbox(`FAILED: ${error.slice(0, 200)}`)
        await ctx.fire("activity", { text: `Sandbox ÉCHEC: ${error.slice(0, 80)}`, type: "alert" })

        const response: SandboxResult = {
          success: false,
          output: result.stdout || "",
          error,
          snapshot: snapshot || undefined,
          rolled_back: !!snapshot,
          warnings: warnings.length > 0 ? warnings : undefined,
          duration_ms: Date.now() - start,
        }
        return res.json(response)
      }

      // Verify build integrity (unless skipped)
      let rolled_back = false
      if (!skipBuildCheck) {
        const buildOk = verifyBuild()
        if (!buildOk && snapshot) {
          rollbackToSnapshot(snapshot)
          rolled_back = true
          logSandbox(`ROLLBACK: Build cassé après modification`)
          await ctx.fire("activity", { text: "Sandbox ROLLBACK: build cassé, modification annulée", type: "alert" })

          const response: SandboxResult = {
            success: false,
            output: result.stdout,
            error: "Build cassé après modification — rollback automatique",
            snapshot: snapshot,
            rolled_back: true,
            warnings: warnings.length > 0 ? warnings : undefined,
            duration_ms: Date.now() - start,
          }
          return res.json(response)
        }
      }

      logSandbox(`SUCCESS: ${result.stdout.slice(0, 150)}`)
      await ctx.fire("activity", { text: `Sandbox OK: modification appliquée`, type: "done" })

      const response: SandboxResult = {
        success: true,
        output: result.stdout,
        snapshot: snapshot || undefined,
        rolled_back,
        warnings: warnings.length > 0 ? warnings : undefined,
        duration_ms: Date.now() - start,
      }
      res.json(response)
    })

    // Preview mode — just check if a prompt would be blocked or warned
    ctx.app.post("/api/sandbox/preview", (req, res) => {
      const { prompt } = req.body
      if (!prompt) return res.status(400).json({ error: "prompt required" })

      const blocked = checkBlocked(prompt)
      const warnings = checkWarnings(prompt)

      res.json({
        allowed: !blocked,
        blocked: blocked || null,
        warnings,
      })
    })

    // Rollback to a specific git commit
    ctx.app.post("/api/sandbox/rollback", (req, res) => {
      const { commit } = req.body
      if (!commit) return res.status(400).json({ error: "commit hash required" })

      logSandbox(`MANUAL ROLLBACK to ${commit}`)
      const success = rollbackToSnapshot(commit)
      ctx.fire("activity", { text: `Rollback manuel vers ${commit.slice(0, 8)}`, type: success ? "done" : "alert" })
      res.json({ ok: success, commit })
    })

    // Get sandbox log
    ctx.app.get("/api/sandbox/log", (_, res) => {
      try {
        const log = existsSync(SANDBOX_LOG) ? readFileSync(SANDBOX_LOG, "utf-8") : ""
        res.json({ log: log.split("\n").filter(Boolean).slice(-100) })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })
  },
}
