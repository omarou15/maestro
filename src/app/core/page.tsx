"use client"

import { useState, useEffect } from "react"
import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

type CoreStatus = {
  memory: { files: number; chunks: number; lastUpdate: string }
  sessions: { active: number; total: number }
  survival: { score: number; streak: number; status: string }
  activity: Array<{ time: string; action: string; type: string }>
}

export default function CorePage() {
  const [status, setStatus] = useState<CoreStatus | null>(null)
  const [memories, setMemories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:4000/api/survival").then(r => r.json()),
      fetch("http://localhost:4000/api/activity").then(r => r.json()),
      fetch("http://localhost:4000/api/core/files?name=memory").then(r => r.json()).catch(() => null),
    ]).then(([survival, activity, memory]) => {
      setStatus({
        memory: {
          files: 1,
          chunks: 0,
          lastUpdate: new Date().toISOString(),
        },
        sessions: {
          active: 1,
          total: 1,
        },
        survival: {
          score: survival.score || 100,
          streak: survival.streak || 0,
          status: survival.score >= 80 ? "healthy" : "warning",
        },
        activity: (activity.log || []).slice(0, 10).map((a: any) => ({
          time: new Date(a.time || Date.now()).toLocaleTimeString("fr-FR"),
          action: a.text || a.action || "Action",
          type: a.type || "info",
        })),
      })
      if (memory?.content) {
        const lines = memory.content.split("\n").filter((l: string) => l.trim() && !l.startsWith("#"))
        setMemories(lines.slice(0, 20))
      }
      setLoading(false)
    }).catch(err => {
      console.error("Error loading core status:", err)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--maestro-cream)]">
        <Header subtitle="CORE STATUS" />
        <NavBar />
        <div className="p-6 flex items-center justify-center">
          <div className="text-[var(--maestro-muted)]">Chargement...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      <Header subtitle="CORE STATUS" />
      <NavBar />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Identity */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">🔷 Redexes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[var(--maestro-muted)] text-xs mb-1">Mind</div>
              <div className="font-semibold text-[var(--maestro-primary)]">OpenClaw</div>
              <div className="text-xs text-[var(--maestro-muted)] mt-1">
                Conversation, memory, tools, Telegram
              </div>
            </div>
            <div>
              <div className="text-[var(--maestro-muted)] text-xs mb-1">Body</div>
              <div className="font-semibold text-[var(--maestro-primary)]">Maestro Repo</div>
              <div className="text-xs text-[var(--maestro-muted)] mt-1">
                Dashboard, GitHub, survival, database
              </div>
            </div>
            <div>
              <div className="text-[var(--maestro-muted)] text-xs mb-1">Status</div>
              <div className="font-semibold text-green-600">Unified ✅</div>
              <div className="text-xs text-[var(--maestro-muted)] mt-1">
                Phases 1-3 complete, Phase 4 in progress
              </div>
            </div>
          </div>
        </div>

        {/* Survival */}
        {status && (
          <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
            <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">💓 Survival</h2>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-4xl font-bold text-green-600">{status.survival.score}</div>
                <div className="text-xs text-[var(--maestro-muted)]">Score / 100</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--maestro-primary)]">{status.survival.streak}</div>
                <div className="text-xs text-[var(--maestro-muted)]">Streak (checks)</div>
              </div>
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${status.survival.score}%` }}
                  />
                </div>
                <div className="text-xs text-[var(--maestro-muted)] mt-1">
                  {status.survival.status === "healthy" ? "✅ Healthy" : "⚠️ Needs attention"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Memory */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">🧠 Memory</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-[var(--maestro-muted)] mb-2">Architecture</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>MEMORY.md (curated long-term)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>memory/YYYY-MM-DD.md (daily logs)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Neon PostgreSQL (structured data)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">🔍</span>
                  <span>Semantic search via memory_search</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--maestro-muted)] mb-2">Recent Memories</div>
              {memories.length > 0 ? (
                <div className="space-y-1 text-xs text-[var(--maestro-muted)] max-h-40 overflow-y-auto">
                  {memories.map((m, i) => (
                    <div key={i} className="truncate">• {m}</div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--maestro-muted)]">
                  No recent memories loaded
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sessions */}
        {status && (
          <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
            <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">💬 Sessions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600">{status.sessions.active}</div>
                <div className="text-xs text-green-700">Active sessions</div>
                <div className="text-xs text-[var(--maestro-muted)] mt-1">Telegram (main)</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-600">{status.sessions.total}</div>
                <div className="text-xs text-blue-700">Total sessions</div>
                <div className="text-xs text-[var(--maestro-muted)] mt-1">Since fusion</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {status && status.activity.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
            <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">⚡ Recent Activity</h2>
            <div className="space-y-2">
              {status.activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm border-l-2 border-[var(--maestro-border)] pl-3">
                  <span className="text-[var(--maestro-muted)] text-xs shrink-0">{a.time}</span>
                  <span className="text-[var(--maestro-primary)] flex-1">{a.action}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    a.type === "done" ? "bg-green-100 text-green-700" :
                    a.type === "alert" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {a.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
