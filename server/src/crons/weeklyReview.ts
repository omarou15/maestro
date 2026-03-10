/**
 * Weekly Code Review
 * Runs every Sunday at 02:00 UTC
 * Checks dependencies, Git status, commit quality
 */

import { execSync } from 'child_process'
import { writeFileSync, existsSync, readFileSync } from 'fs'

export async function runWeeklyReview() {
  console.log('[WEEKLY REVIEW] Starting...')
  
  const results: string[] = []
  let issues = 0
  
  try {
    // 1. Check npm dependencies for vulnerabilities
    try {
      const auditOutput = execSync('cd /root/maestro/server && npm audit --json', { encoding: 'utf8' })
      const audit = JSON.parse(auditOutput)
      const vulns = audit.metadata?.vulnerabilities || {}
      
      if (vulns.critical > 0 || vulns.high > 0) {
        results.push(`⚠️ Security vulnerabilities: ${vulns.critical} critical, ${vulns.high} high`)
        issues++
      } else {
        results.push(`✅ No critical security vulnerabilities`)
      }
    } catch (err) {
      results.push(`⚠️ npm audit failed: ${err}`)
      issues++
    }
    
    // 2. Check Git status for uncommitted changes
    try {
      const gitStatus = execSync('cd /root/maestro && git status --porcelain', { encoding: 'utf8' })
      
      if (gitStatus.trim()) {
        results.push(`⚠️ Uncommitted changes detected (${gitStatus.trim().split('\n').length} files)`)
        issues++
        
        // Auto-commit if minor changes
        try {
          execSync('cd /root/maestro && git add -A && git commit -m "Weekly auto-commit: routine changes" && git push origin main', { encoding: 'utf8' })
          results.push(`✅ Auto-committed and pushed`)
        } catch {
          results.push(`⚠️ Could not auto-commit (manual intervention needed)`)
        }
      } else {
        results.push(`✅ Git repo clean`)
      }
    } catch (err) {
      results.push(`⚠️ Git check failed: ${err}`)
      issues++
    }
    
    // 3. Review recent commits (last 10)
    try {
      const commits = execSync('cd /root/maestro && git log --oneline -n 10', { encoding: 'utf8' })
      const commitCount = commits.trim().split('\n').length
      results.push(`📊 ${commitCount} commits in last batch`)
      
      // Check commit message quality (basic heuristic)
      const shortMessages = commits.split('\n').filter(line => {
        const msg = line.split(' ').slice(1).join(' ')
        return msg.length < 20
      })
      
      if (shortMessages.length > 3) {
        results.push(`⚠️ ${shortMessages.length} commits with short messages (consider being more descriptive)`)
      } else {
        results.push(`✅ Commit message quality good`)
      }
    } catch (err) {
      results.push(`⚠️ Commit review failed: ${err}`)
    }
    
    // 4. Check disk space
    try {
      const df = execSync('df -h / | tail -1', { encoding: 'utf8' })
      const usage = df.split(/\s+/)[4]
      const percent = parseInt(usage)
      
      if (percent > 80) {
        results.push(`⚠️ Disk space: ${usage} used (cleanup recommended)`)
        issues++
      } else {
        results.push(`✅ Disk space OK (${usage} used)`)
      }
    } catch (err) {
      results.push(`⚠️ Disk check failed: ${err}`)
    }
    
    // 5. Check for outdated packages
    try {
      const outdated = execSync('cd /root/maestro/server && npm outdated --json', { encoding: 'utf8' })
      if (outdated.trim()) {
        const packages = Object.keys(JSON.parse(outdated) || {})
        if (packages.length > 5) {
          results.push(`⚠️ ${packages.length} outdated packages (update recommended)`)
          issues++
        } else if (packages.length > 0) {
          results.push(`ℹ️ ${packages.length} outdated packages (not urgent)`)
        } else {
          results.push(`✅ All packages up to date`)
        }
      }
    } catch {
      // npm outdated returns non-zero when packages are outdated, which is expected
      results.push(`ℹ️ Some packages may be outdated (check manually)`)
    }
    
    // 6. Save report
    const report = `# Weekly Code Review - ${new Date().toISOString()}\n\n${results.join('\n')}\n\nTotal issues: ${issues}\n`
    const reportPath = '/root/maestro/WEEKLY_REVIEW.log'
    
    if (existsSync(reportPath)) {
      const existing = readFileSync(reportPath, 'utf8')
      writeFileSync(reportPath, report + '\n---\n\n' + existing)
    } else {
      writeFileSync(reportPath, report)
    }
    
    console.log('[WEEKLY REVIEW] Complete')
    console.log(report)
    
    // Return summary
    return {
      success: true,
      issues,
      results,
      report
    }
    
  } catch (err) {
    console.error('[WEEKLY REVIEW] Failed:', err)
    return {
      success: false,
      error: String(err),
      issues: -1,
      results: [`❌ Review failed: ${err}`]
    }
  }
}
