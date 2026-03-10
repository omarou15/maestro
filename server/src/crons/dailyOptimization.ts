/**
 * Daily Memory Optimization
 * Runs every day at 03:00 UTC
 * Archives old logs, updates MEMORY.md, optimizes database
 */

import { execSync } from 'child_process'
import { readdirSync, statSync, renameSync, existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs'
import { Client } from 'pg'
import path from 'path'

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_7LqDjOY8brfU@ep-lucky-wave-a4071yjp-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
const WORKSPACE = '/root/.openclaw/workspace'
const MEMORY_DIR = path.join(WORKSPACE, 'memory')
const ARCHIVE_DIR = path.join(MEMORY_DIR, 'archive')

export async function runDailyOptimization() {
  console.log('[DAILY OPT] Starting memory optimization...')
  
  const results: string[] = []
  
  try {
    // 1. Archive old daily logs (>30 days)
    if (!existsSync(ARCHIVE_DIR)) {
      mkdirSync(ARCHIVE_DIR, { recursive: true })
      results.push('✅ Created archive directory')
    }
    
    if (existsSync(MEMORY_DIR)) {
      const files = readdirSync(MEMORY_DIR)
      const now = Date.now()
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)
      let archived = 0
      
      for (const file of files) {
        if (file.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
          const filePath = path.join(MEMORY_DIR, file)
          const stats = statSync(filePath)
          
          if (stats.mtimeMs < thirtyDaysAgo) {
            const archivePath = path.join(ARCHIVE_DIR, file)
            renameSync(filePath, archivePath)
            archived++
          }
        }
      }
      
      results.push(`✅ Archived ${archived} old daily logs`)
    }
    
    // 2. Extract recent learnings and update MEMORY.md
    try {
      const recentFiles = readdirSync(MEMORY_DIR)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
        .sort()
        .slice(-7) // Last 7 days
      
      if (recentFiles.length > 0) {
        const learnings: string[] = []
        
        for (const file of recentFiles) {
          const content = readFileSync(path.join(MEMORY_DIR, file), 'utf8')
          
          // Extract key learnings (lines with specific markers)
          const lines = content.split('\n')
          for (const line of lines) {
            if (
              line.includes('**Lesson:**') ||
              line.includes('**Learning:**') ||
              line.includes('**Insight:**') ||
              line.includes('**Important:**')
            ) {
              learnings.push(line.trim())
            }
          }
        }
        
        if (learnings.length > 0) {
          const memoryPath = path.join(WORKSPACE, 'MEMORY.md')
          const timestamp = new Date().toISOString().split('T')[0]
          const update = `\n## Weekly Update (${timestamp})\n\n${learnings.join('\n')}\n`
          
          if (existsSync(memoryPath)) {
            appendFileSync(memoryPath, update)
            results.push(`✅ Updated MEMORY.md with ${learnings.length} learnings`)
          }
        } else {
          results.push(`ℹ️ No new learnings found in recent logs`)
        }
      }
    } catch (err) {
      results.push(`⚠️ Memory update failed: ${err}`)
    }
    
    // 3. Database cleanup (old records >90 days)
    try {
      const client = new Client({ connectionString: DATABASE_URL })
      await client.connect()
      
      // Delete old activity logs
      const activityResult = await client.query(`
        DELETE FROM activity 
        WHERE timestamp < NOW() - INTERVAL '90 days'
        RETURNING id
      `)
      
      // Delete old model usage logs
      const modelResult = await client.query(`
        DELETE FROM model_usage 
        WHERE timestamp < NOW() - INTERVAL '90 days'
        RETURNING id
      `)
      
      results.push(`✅ Cleaned ${activityResult.rowCount || 0} old activity records`)
      results.push(`✅ Cleaned ${modelResult.rowCount || 0} old model usage records`)
      
      // Vacuum and analyze
      await client.query('VACUUM ANALYZE activity')
      await client.query('VACUUM ANALYZE model_usage')
      
      results.push(`✅ Database optimized (VACUUM ANALYZE)`)
      
      await client.end()
    } catch (err) {
      results.push(`⚠️ Database cleanup failed: ${err}`)
    }
    
    // 4. Check memory disk usage
    try {
      const memorySize = execSync(`du -sh ${MEMORY_DIR} | cut -f1`, { encoding: 'utf8' }).trim()
      results.push(`📊 Memory directory size: ${memorySize}`)
    } catch (err) {
      results.push(`⚠️ Disk usage check failed: ${err}`)
    }
    
    // 5. Git commit memory updates
    try {
      execSync(`cd ${WORKSPACE} && git add memory/ MEMORY.md`, { encoding: 'utf8' })
      execSync(`cd ${WORKSPACE} && git commit -m "Daily memory optimization: $(date +%Y-%m-%d)" || true`, { encoding: 'utf8' })
      results.push(`✅ Memory changes committed to Git`)
    } catch (err) {
      results.push(`ℹ️ No memory changes to commit`)
    }
    
    console.log('[DAILY OPT] Complete')
    console.log(results.join('\n'))
    
    return {
      success: true,
      results
    }
    
  } catch (err) {
    console.error('[DAILY OPT] Failed:', err)
    return {
      success: false,
      error: String(err),
      results: [`❌ Optimization failed: ${err}`]
    }
  }
}
