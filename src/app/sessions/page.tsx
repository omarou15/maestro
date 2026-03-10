"use client"

import { useState, useEffect } from "react"
import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

type Session = {
  id: string
  parentId: string | null
  channel: string
  userId: string
  createdAt: string
  updatedAt: string
  metadata: any
  children?: Session[]
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - will be replaced with real database queries
    const mockSessions: Session[] = [
      {
        id: 'main',
        parentId: null,
        channel: 'telegram',
        userId: '6567012355',
        createdAt: '2026-03-10T17:49:00Z',
        updatedAt: new Date().toISOString(),
        metadata: { name: 'Sidi Omar', type: 'primary' },
        children: [
          {
            id: 'coding-task-123',
            parentId: 'main',
            channel: 'subagent',
            userId: '6567012355',
            createdAt: '2026-03-10T18:15:00Z',
            updatedAt: '2026-03-10T18:45:00Z',
            metadata: { skill: 'coding-agent', task: 'Fix TypeScript errors' },
          },
          {
            id: 'browser-auto-456',
            parentId: 'main',
            channel: 'browser',
            userId: '6567012355',
            createdAt: '2026-03-10T19:00:00Z',
            updatedAt: '2026-03-10T19:15:00Z',
            metadata: { url: 'maestro-chi.vercel.app', actions: 12 },
          }
        ]
      }
    ]
    
    setSessions(mockSessions)
    setLoading(false)
  }, [])

  const formatDuration = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ${minutes % 60}m`
    return `${Math.floor(hours / 24)}d ${hours % 24}h`
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'telegram': return '💬'
      case 'subagent': return '🤖'
      case 'browser': return '🌐'
      case 'ssh': return '🖥️'
      default: return '📡'
    }
  }

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'telegram': return 'bg-blue-50 border-blue-200 text-blue-700'
      case 'subagent': return 'bg-purple-50 border-purple-200 text-purple-700'
      case 'browser': return 'bg-green-50 border-green-200 text-green-700'
      default: return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--maestro-cream)]">
        <Header subtitle="SESSION MANAGEMENT" />
        <NavBar />
        <div className="p-6 flex items-center justify-center">
          <div className="text-[var(--maestro-muted)]">Chargement...</div>
        </div>
      </div>
    )
  }

  const activeCount = sessions.filter(s => new Date(s.updatedAt).getTime() > Date.now() - 3600000).length
  const totalChildren = sessions.reduce((sum, s) => sum + (s.children?.length || 0), 0)

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      <Header subtitle="SESSION MANAGEMENT" />
      <NavBar />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h1 className="text-2xl font-bold text-[var(--maestro-primary)] mb-2">💬 Session Management</h1>
          <p className="text-sm text-[var(--maestro-muted)]">
            Unified session tree showing all conversations, sub-agents, and automation tasks.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <div className="text-sm text-blue-700 mb-1">Total Sessions</div>
            <div className="text-3xl font-bold text-blue-600">{sessions.length + totalChildren}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="text-sm text-green-700 mb-1">Active</div>
            <div className="text-3xl font-bold text-green-600">{activeCount}</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <div className="text-sm text-purple-700 mb-1">Parent Sessions</div>
            <div className="text-3xl font-bold text-purple-600">{sessions.filter(s => !s.parentId).length}</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
            <div className="text-sm text-amber-700 mb-1">Sub-sessions</div>
            <div className="text-3xl font-bold text-amber-600">{totalChildren}</div>
          </div>
        </div>

        {/* Session Tree */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">Session Tree</h2>
          
          <div className="space-y-4">
            {sessions.map(session => (
              <div key={session.id}>
                {/* Parent Session */}
                <div className={`border-2 rounded-xl p-4 ${getChannelColor(session.channel)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getChannelIcon(session.channel)}</span>
                      <div>
                        <div className="font-bold">{session.id}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {session.channel} • {session.metadata?.name || session.userId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs opacity-70">
                      <div>Started: {formatTime(session.createdAt)}</div>
                      <div>Duration: {formatDuration(session.createdAt, session.updatedAt)}</div>
                    </div>
                  </div>
                  
                  {session.metadata && (
                    <div className="text-xs opacity-70 mt-2">
                      {Object.entries(session.metadata).slice(0, 3).map(([key, value]) => (
                        <span key={key} className="mr-3">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Child Sessions */}
                {session.children && session.children.length > 0 && (
                  <div className="ml-8 mt-3 space-y-2 border-l-2 border-gray-300 pl-4">
                    {session.children.map(child => (
                      <div key={child.id} className={`border rounded-lg p-3 ${getChannelColor(child.channel)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getChannelIcon(child.channel)}</span>
                            <div>
                              <div className="font-semibold text-sm">{child.id}</div>
                              <div className="text-xs opacity-70 mt-0.5">
                                {child.channel} • {child.metadata?.skill || child.metadata?.task || 'Task'}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs opacity-70 text-right">
                            <div>{formatTime(child.createdAt)}</div>
                            <div>{formatDuration(child.createdAt, child.updatedAt)}</div>
                          </div>
                        </div>
                        
                        {child.metadata && (
                          <div className="text-xs opacity-70 mt-2">
                            {child.metadata.task && <div>📋 {child.metadata.task}</div>}
                            {child.metadata.url && <div>🌐 {child.metadata.url}</div>}
                            {child.metadata.actions && <div>⚡ {child.metadata.actions} actions</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Session Types */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h2 className="text-lg font-bold text-[var(--maestro-primary)] mb-4">Session Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '💬', name: 'Telegram', desc: 'Primary conversation with Sidi Omar', color: 'blue' },
              { icon: '🤖', name: 'Sub-agents', desc: 'Spawned agents for specific tasks', color: 'purple' },
              { icon: '🌐', name: 'Browser', desc: 'Web automation sessions', color: 'green' },
              { icon: '🖥️', name: 'SSH/Code', desc: 'Direct terminal access', color: 'gray' },
            ].map((type, i) => (
              <div key={i} className={`p-4 rounded-lg border bg-${type.color}-50 border-${type.color}-200`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{type.icon}</span>
                  <span className={`font-semibold text-${type.color}-700`}>{type.name}</span>
                </div>
                <div className={`text-xs text-${type.color}-600`}>{type.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Note */}
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <div className="text-sm text-purple-800">
            <strong>Unified Session Tree:</strong> All conversations, sub-agents, and tasks tracked in one tree.
            Parent/child attribution for revenue, context passing between sessions, full history.
          </div>
        </div>
      </div>
    </div>
  )
}
