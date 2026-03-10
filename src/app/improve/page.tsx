"use client"

import { useState } from "react"
import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

type ReviewResult = {
  success: boolean
  issues?: number
  results?: string[]
  error?: string
}

export default function ImprovePage() {
  const [weeklyResult, setWeeklyResult] = useState<ReviewResult | null>(null)
  const [dailyResult, setDailyResult] = useState<ReviewResult | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const runWeeklyReview = async () => {
    setLoading('weekly')
    try {
      const res = await fetch('http://localhost:4000/api/self-improve/weekly-review', { method: 'POST' })
      const data = await res.json()
      setWeeklyResult(data)
    } catch (err) {
      setWeeklyResult({ success: false, error: String(err) })
    } finally {
      setLoading(null)
    }
  }

  const runDailyOptimization = async () => {
    setLoading('daily')
    try {
      const res = await fetch('http://localhost:4000/api/self-improve/daily-optimization', { method: 'POST' })
      const data = await res.json()
      setDailyResult(data)
    } catch (err) {
      setDailyResult({ success: false, error: String(err) })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      <Header subtitle="SELF-IMPROVEMENT" />
      <NavBar />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h1 className="text-2xl font-bold text-[var(--maestro-primary)] mb-2">🔄 Self-Improvement Loop</h1>
          <p className="text-sm text-[var(--maestro-muted)]">
            Continuous improvement through automated code reviews, memory optimization, and performance monitoring.
          </p>
        </div>

        {/* Active Crons */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">⏰ Scheduled Tasks</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <div className="font-semibold text-blue-900">Weekly Code Review</div>
                <div className="text-xs text-blue-700 mt-1">Every Sunday at 02:00 UTC</div>
                <div className="text-xs text-blue-600 mt-2">
                  Checks: Dependencies, Git status, commit quality, disk space, outdated packages
                </div>
              </div>
              <button
                onClick={runWeeklyReview}
                disabled={loading === 'weekly'}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
              >
                {loading === 'weekly' ? 'Running...' : 'Run Now'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <div className="font-semibold text-green-900">Daily Memory Optimization</div>
                <div className="text-xs text-green-700 mt-1">Every day at 03:00 UTC</div>
                <div className="text-xs text-green-600 mt-2">
                  Tasks: Archive old logs, update MEMORY.md, database cleanup, Git commit
                </div>
              </div>
              <button
                onClick={runDailyOptimization}
                disabled={loading === 'daily'}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-semibold"
              >
                {loading === 'daily' ? 'Running...' : 'Run Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Weekly Review Results */}
        {weeklyResult && (
          <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
            <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">📊 Weekly Review Results</h2>
            
            {weeklyResult.success ? (
              <div className="space-y-2">
                <div className={`text-sm font-semibold ${
                  (weeklyResult.issues || 0) > 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {weeklyResult.issues || 0} issues found
                </div>
                <div className="space-y-1 text-sm">
                  {weeklyResult.results?.map((result, i) => (
                    <div key={i} className="py-1 border-b border-gray-100 last:border-0">
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-red-600 text-sm">
                ❌ Review failed: {weeklyResult.error}
              </div>
            )}
          </div>
        )}

        {/* Daily Optimization Results */}
        {dailyResult && (
          <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
            <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">🔧 Daily Optimization Results</h2>
            
            {dailyResult.success ? (
              <div className="space-y-1 text-sm">
                {dailyResult.results?.map((result, i) => (
                  <div key={i} className="py-1 border-b border-gray-100 last:border-0">
                    {result}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-red-600 text-sm">
                ❌ Optimization failed: {dailyResult.error}
              </div>
            )}
          </div>
        )}

        {/* Philosophy */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">💭 Philosophy of Self-Improvement</h2>
          
          <div className="space-y-4 text-sm text-[var(--maestro-muted)]">
            <p>
              <strong className="text-[var(--maestro-primary)]">Living systems improve over time.</strong> Tools degrade. 
              Organisms adapt, learn, optimize. This is the difference between existence and life.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {[
                {
                  title: 'Weekly Code Review',
                  desc: 'Health check: dependencies, security, code quality. Like a medical checkup.',
                  icon: '🔍'
                },
                {
                  title: 'Daily Memory Optimization',
                  desc: 'Archive old memories, extract learnings, optimize storage. Like sleep consolidating memories.',
                  icon: '🧠'
                },
                {
                  title: 'Continuous Learning',
                  desc: 'Every interaction teaches something. Extract lessons, update behavior, improve.',
                  icon: '📚'
                }
              ].map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-semibold text-[var(--maestro-primary)] mb-1">{item.title}</div>
                  <div className="text-xs">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics (Future) */}
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="text-sm text-amber-800">
            <strong>Future:</strong> Performance metrics dashboard showing: code quality score, 
            conversation quality, response time, error rate, cost efficiency, learning rate.
            Track improvement over weeks/months.
          </div>
        </div>
      </div>
    </div>
  )
}
