"use client"

import { useState, useEffect } from "react"
import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

type BrowserSession = {
  id: string
  url: string
  status: string
  startedAt: string
  lastActivity: string
  screenshots: number
  actions: number
}

type BrowserAction = {
  id: string
  sessionId: string
  type: string
  target: string
  timestamp: string
  success: boolean
  cost: number
}

export default function BrowserPage() {
  const [sessions, setSessions] = useState<BrowserSession[]>([])
  const [actions, setActions] = useState<BrowserAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data for now - will be replaced with real API calls
    const mockSessions: BrowserSession[] = [
      {
        id: 'bs-001',
        url: 'https://maestro-chi.vercel.app',
        status: 'active',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        lastActivity: new Date(Date.now() - 300000).toISOString(),
        screenshots: 5,
        actions: 12,
      }
    ]
    
    const mockActions: BrowserAction[] = [
      {
        id: 'ba-001',
        sessionId: 'bs-001',
        type: 'navigate',
        target: 'https://maestro-chi.vercel.app/dashboard',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        success: true,
        cost: 0.10,
      },
      {
        id: 'ba-002',
        sessionId: 'bs-001',
        type: 'screenshot',
        target: 'full page',
        timestamp: new Date(Date.now() - 480000).toISOString(),
        success: true,
        cost: 0.50,
      },
      {
        id: 'ba-003',
        sessionId: 'bs-001',
        type: 'click',
        target: '.login-button',
        timestamp: new Date(Date.now() - 360000).toISOString(),
        success: true,
        cost: 1.00,
      }
    ]
    
    setSessions(mockSessions)
    setActions(mockActions)
    setLoading(false)
  }, [])

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--maestro-cream)]">
        <Header subtitle="BROWSER AUTOMATION" />
        <NavBar />
        <div className="p-6 flex items-center justify-center">
          <div className="text-[var(--maestro-muted)]">Chargement...</div>
        </div>
      </div>
    )
  }

  const totalRevenue = actions.reduce((sum, a) => sum + a.cost, 0)

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      <Header subtitle="BROWSER AUTOMATION" />
      <NavBar />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h1 className="text-2xl font-bold text-[var(--maestro-primary)] mb-2">🌐 Browser Automation</h1>
          <p className="text-sm text-[var(--maestro-muted)]">
            Web automation powered by OpenClaw browser tool. Screenshots, clicks, navigation, form filling.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <div className="text-sm text-blue-700 mb-1">Active Sessions</div>
            <div className="text-3xl font-bold text-blue-600">{sessions.filter(s => s.status === 'active').length}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="text-sm text-green-700 mb-1">Total Actions</div>
            <div className="text-3xl font-bold text-green-600">{actions.length}</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <div className="text-sm text-purple-700 mb-1">Screenshots</div>
            <div className="text-3xl font-bold text-purple-600">
              {sessions.reduce((sum, s) => sum + s.screenshots, 0)}
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
            <div className="text-sm text-amber-700 mb-1">Revenue</div>
            <div className="text-3xl font-bold text-amber-600">€{totalRevenue.toFixed(2)}</div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">Active Sessions</h2>
          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map(session => (
                <div key={session.id} className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-[var(--maestro-primary)]">{session.url}</div>
                      <div className="text-xs text-[var(--maestro-muted)] mt-1">
                        Started {formatTime(session.startedAt)} • Last activity {formatTime(session.lastActivity)}
                      </div>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {session.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--maestro-muted)]">
                    <span>📸 {session.screenshots} screenshots</span>
                    <span>⚡ {session.actions} actions</span>
                    <span>🆔 {session.id}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--maestro-muted)]">
              <div className="text-4xl mb-2">🌐</div>
              <div className="text-sm">No active browser sessions</div>
            </div>
          )}
        </div>

        {/* Recent Actions */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">Recent Actions</h2>
          {actions.length > 0 ? (
            <div className="space-y-2">
              {actions.map(action => (
                <div key={action.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${
                      action.type === 'navigate' ? '🧭' :
                      action.type === 'screenshot' ? '📸' :
                      action.type === 'click' ? '👆' :
                      action.type === 'type' ? '⌨️' : '⚡'
                    }`} />
                    <div>
                      <div className="font-semibold text-sm text-[var(--maestro-primary)]">{action.type}</div>
                      <div className="text-xs text-[var(--maestro-muted)]">{action.target}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[var(--maestro-muted)]">{formatTime(action.timestamp)}</span>
                    <span className="text-green-600 font-semibold">€{action.cost.toFixed(2)}</span>
                    <span className={`px-2 py-0.5 rounded ${
                      action.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {action.success ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--maestro-muted)]">
              <div className="text-sm">No browser actions recorded yet</div>
            </div>
          )}
        </div>

        {/* Capabilities */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">Browser Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '🧭', name: 'Navigation', desc: 'Navigate to URLs, follow links' },
              { icon: '📸', name: 'Screenshots', desc: 'Full page or element screenshots' },
              { icon: '👆', name: 'Interaction', desc: 'Click, type, submit forms' },
              { icon: '🔍', name: 'Element Selection', desc: 'CSS selectors, aria refs' },
              { icon: '⚙️', name: 'Automation', desc: 'Complex multi-step workflows' },
              { icon: '📄', name: 'PDF Generation', desc: 'Web page → PDF document' },
            ].map((cap, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                <span className="text-2xl">{cap.icon}</span>
                <div>
                  <div className="font-semibold text-sm text-[var(--maestro-primary)]">{cap.name}</div>
                  <div className="text-xs text-[var(--maestro-muted)] mt-1">{cap.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Note */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="text-sm text-blue-800">
            <strong>Integration:</strong> Browser automation is powered by OpenClaw's browser tool. 
            Use <code>browser(action: 'screenshot')</code> in conversation or call the API directly.
            Revenue tracked automatically: €0.50/screenshot, €1.00/automation task.
          </div>
        </div>
      </div>
    </div>
  )
}
