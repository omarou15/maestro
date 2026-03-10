// Unified heartbeat: Check both OpenClaw (mind) + Maestro (body)
import { readFileSync, existsSync } from "fs"

interface HealthCheck {
  name: string
  status: "ok" | "warn" | "error"
  message: string
  timestamp: string
}

interface UnifiedStatus {
  mind: HealthCheck[]
  body: HealthCheck[]
  overall: {
    score: number // 0-100
    status: "healthy" | "warning" | "critical"
    timestamp: string
  }
}

async function checkMaestroBackend(): Promise<HealthCheck> {
  try {
    const res = await fetch("http://localhost:4000/health", { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      return { name: "Maestro Backend", status: "ok", message: "Running", timestamp: new Date().toISOString() }
    }
    return { name: "Maestro Backend", status: "error", message: "HTTP error", timestamp: new Date().toISOString() }
  } catch (e) {
    return { name: "Maestro Backend", status: "error", message: String(e), timestamp: new Date().toISOString() }
  }
}

async function checkNeonDatabase(): Promise<HealthCheck> {
  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) return { name: "Neon DB", status: "warn", message: "No connection string", timestamp: new Date().toISOString() }
    
    const res = await fetch("https://api.neon.tech/v1/projects", {
      headers: { Authorization: `Bearer ${process.env.NEON_API_KEY || ""}` },
      signal: AbortSignal.timeout(5000),
    })
    
    if (res.ok) {
      return { name: "Neon DB", status: "ok", message: "Connected", timestamp: new Date().toISOString() }
    }
    return { name: "Neon DB", status: "warn", message: "API unreachable", timestamp: new Date().toISOString() }
  } catch (e) {
    return { name: "Neon DB", status: "warn", message: String(e), timestamp: new Date().toISOString() }
  }
}

async function checkGitRepository(): Promise<HealthCheck> {
  try {
    const { execSync } = await import("child_process")
    const status = execSync("git -C /root/maestro status --porcelain", { encoding: "utf-8" })
    const isDirty = status.trim().length > 0
    
    return {
      name: "Git Repository",
      status: isDirty ? "warn" : "ok",
      message: isDirty ? `${status.split("\n").length} uncommitted changes` : "Clean",
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    return { name: "Git Repository", status: "error", message: String(e), timestamp: new Date().toISOString() }
  }
}

async function checkMemorySystem(): Promise<HealthCheck> {
  try {
    const memoryPath = "/root/.openclaw/workspace/MEMORY.md"
    const dailyPath = "/root/.openclaw/workspace/memory"
    
    const memoryExists = existsSync(memoryPath)
    const dailyExists = existsSync(dailyPath)
    
    if (memoryExists && dailyExists) {
      const memoryContent = readFileSync(memoryPath, "utf-8")
      const size = memoryContent.length
      return { name: "Memory System", status: "ok", message: `MEMORY.md (${Math.round(size / 1024)}KB)`, timestamp: new Date().toISOString() }
    }
    
    return { name: "Memory System", status: "warn", message: "Missing memory files", timestamp: new Date().toISOString() }
  } catch (e) {
    return { name: "Memory System", status: "error", message: String(e), timestamp: new Date().toISOString() }
  }
}

async function checkTelegramBot(): Promise<HealthCheck> {
  try {
    // Check if Telegram plugin is registered
    const res = await fetch("http://localhost:4000/api/plugins", { signal: AbortSignal.timeout(5000) })
    const data = await res.json() as { plugins?: Array<{ id: string }> }
    const hasTelegram = data.plugins?.some((p) => p.id === "telegram")
    
    return {
      name: "Telegram Bot",
      status: hasTelegram ? "ok" : "warn",
      message: hasTelegram ? "Active (via OpenClaw)" : "Not registered",
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    return { name: "Telegram Bot", status: "warn", message: String(e), timestamp: new Date().toISOString() }
  }
}

function calculateOverallScore(checks: HealthCheck[]): number {
  const okCount = checks.filter((c) => c.status === "ok").length
  const warnCount = checks.filter((c) => c.status === "warn").length
  const errorCount = checks.filter((c) => c.status === "error").length
  
  // Score: 100 - (errors * 25) - (warnings * 10)
  const score = Math.max(0, 100 - errorCount * 25 - warnCount * 10)
  return score
}

export async function runUnifiedHeartbeat(): Promise<UnifiedStatus> {
  const mind = [
    await checkMemorySystem(),
    await checkTelegramBot(),
  ]
  
  const body = [
    await checkMaestroBackend(),
    await checkNeonDatabase(),
    await checkGitRepository(),
  ]
  
  const allChecks = [...mind, ...body]
  const score = calculateOverallScore(allChecks)
  
  const status: UnifiedStatus = {
    mind,
    body,
    overall: {
      score,
      status: score >= 80 ? "healthy" : score >= 50 ? "warning" : "critical",
      timestamp: new Date().toISOString(),
    },
  }
  
  return status
}

export function formatHeartbeatReport(status: UnifiedStatus): string {
  const mindStr = status.mind.map((c) => `  ${c.status === "ok" ? "✓" : c.status === "warn" ? "⚠" : "✗"} ${c.name}: ${c.message}`).join("\n")
  const bodyStr = status.body.map((c) => `  ${c.status === "ok" ? "✓" : c.status === "warn" ? "⚠" : "✗"} ${c.name}: ${c.message}`).join("\n")
  
  return `
🔷 UNIFIED HEARTBEAT [${status.overall.status.toUpperCase()}]
Score: ${status.overall.score}/100 | ${new Date(status.overall.timestamp).toLocaleTimeString("en-US")}

🧠 MIND (OpenClaw):
${mindStr}

💪 BODY (Maestro):
${bodyStr}

${status.overall.status === "healthy" ? "✅ All systems operational" : "⚠️ Issues detected - review above"}
  `.trim()
}
