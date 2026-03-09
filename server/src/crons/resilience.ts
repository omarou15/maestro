// RESILIENCE — Système de survie de Maestro
// Maestro doit survivre aux pannes, se backup, et se restaurer

import { execSync } from "child_process"
import { readFileSync, writeFileSync, existsSync } from "fs"

const BACKUP_DIR = "/root/maestro-backups"

export function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = `${BACKUP_DIR}/backup-${timestamp}`

  try {
    execSync(`mkdir -p ${BACKUP_DIR}`)

    // Backup critical files
    execSync(`mkdir -p ${backupPath}`)
    execSync(`cp /root/maestro/MAESTRO.md ${backupPath}/`)
    execSync(`cp /root/maestro/GOALS.md ${backupPath}/`)
    execSync(`cp /root/maestro/LEARNINGS.md ${backupPath}/`)
    execSync(`cp /root/maestro/CLAUDE.md ${backupPath}/`)

    if (existsSync("/root/maestro/HEALTH_STATUS.json")) {
      execSync(`cp /root/maestro/HEALTH_STATUS.json ${backupPath}/`)
    }

    // Backup env
    if (existsSync("/root/maestro/server/.env")) {
      execSync(`cp /root/maestro/server/.env ${backupPath}/`)
    }

    // Keep only last 10 backups
    try {
      const backups = execSync(`ls -t ${BACKUP_DIR}`).toString().trim().split("\n")
      if (backups.length > 10) {
        backups.slice(10).forEach(b => {
          execSync(`rm -rf ${BACKUP_DIR}/${b}`)
        })
      }
    } catch {}

    console.log(`[RESILIENCE] Backup created: ${backupPath}`)
    return backupPath
  } catch (error) {
    console.error(`[RESILIENCE] Backup failed: ${error}`)
    return null
  }
}

export function checkGitStatus(): { clean: boolean; branch: string; lastCommit: string } {
  try {
    const branch = execSync("cd /root/maestro && git branch --show-current").toString().trim()
    const status = execSync("cd /root/maestro && git status --porcelain").toString().trim()
    const lastCommit = execSync("cd /root/maestro && git log -1 --oneline").toString().trim()
    return { clean: status === "", branch, lastCommit }
  } catch {
    return { clean: false, branch: "unknown", lastCommit: "unknown" }
  }
}

export function selfHeal() {
  console.log("[RESILIENCE] Running self-heal check...")

  // 1. Check if git is clean
  const git = checkGitStatus()
  if (!git.clean) {
    console.log("[RESILIENCE] Git has uncommitted changes — auto-committing")
    try {
      execSync('cd /root/maestro && git add -A && git commit -m "Auto-save: changes détectées par resilience system"')
      console.log("[RESILIENCE] Auto-commit done")
    } catch {}
  }

  // 2. Check if maestro-core is running
  try {
    const serviceStatus = execSync("systemctl is-active maestro-core").toString().trim()
    if (serviceStatus !== "active") {
      console.log("[RESILIENCE] maestro-core is down — restarting")
      execSync("systemctl restart maestro-core")
      console.log("[RESILIENCE] maestro-core restarted")
    }
  } catch {
    console.log("[RESILIENCE] Cannot check service status")
  }

  // 3. Create a backup
  createBackup()
}
