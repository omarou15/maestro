import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const { userId } = auth()
  if (userId) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#1A2F2A" />
            <circle cx="24" cy="24" r="6" fill="none" stroke="#D4940A" strokeWidth="2" />
            <circle cx="24" cy="24" r="11" fill="none" stroke="#D4940A" strokeWidth="1.2" opacity="0.6" />
            <circle cx="24" cy="24" r="16" fill="none" stroke="#D4940A" strokeWidth="0.8" opacity="0.3" />
            <path d="M24 18V10" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <path d="M29.2 21L35.5 14.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <path d="M18.8 21L12.5 14.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <circle cx="24" cy="10" r="2" fill="#D4940A" opacity="0.8" />
            <circle cx="35.5" cy="14.5" r="2" fill="#D4940A" opacity="0.7" />
            <circle cx="12.5" cy="14.5" r="2" fill="#D4940A" opacity="0.7" />
          </svg>
          <span className="text-lg font-bold text-[var(--maestro-primary)] tracking-tight">REDEXES</span>
        </div>
        <Link href="/sign-in" className="bg-[var(--maestro-primary)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--maestro-primary-light)] transition-colors">
          Se connecter
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <svg width="80" height="80" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#1A2F2A" />
            <circle cx="24" cy="24" r="6" fill="none" stroke="#D4940A" strokeWidth="2" />
            <circle cx="24" cy="24" r="11" fill="none" stroke="#D4940A" strokeWidth="1.2" opacity="0.6" />
            <circle cx="24" cy="24" r="16" fill="none" stroke="#D4940A" strokeWidth="0.8" opacity="0.3" />
            <path d="M24 18V10" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <path d="M29.2 21L35.5 14.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <path d="M18.8 21L12.5 14.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <path d="M29.2 27L35.5 33.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M18.8 27L12.5 33.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M24 30V38" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <circle cx="24" cy="10" r="2" fill="#D4940A" opacity="0.8" />
            <circle cx="35.5" cy="14.5" r="2" fill="#D4940A" opacity="0.7" />
            <circle cx="12.5" cy="14.5" r="2" fill="#D4940A" opacity="0.7" />
            <circle cx="35.5" cy="33.5" r="1.5" fill="#D4940A" opacity="0.4" />
            <circle cx="12.5" cy="33.5" r="1.5" fill="#D4940A" opacity="0.4" />
            <circle cx="24" cy="38" r="1.5" fill="#D4940A" opacity="0.4" />
          </svg>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--maestro-primary)] tracking-tight max-w-xl leading-tight mb-4">
          Mind + Body = <span className="text-[var(--maestro-accent)]">Unified AI</span>
        </h1>
        <p className="text-lg text-[var(--maestro-muted)] max-w-md mb-8 leading-relaxed">
          Redexes 🔷 — OpenClaw intelligence + Maestro interface. Conversation, memory, tools, self-modification. Always on, always learning.
        </p>
        <Link href="/sign-up" className="bg-[var(--maestro-accent)] text-white px-7 py-3 rounded-xl text-sm font-bold hover:bg-[var(--maestro-accent-light)] transition-colors shadow-lg shadow-amber-500/20">
          Commencer →
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-3xl w-full">
          {[
            { icon: '🧠', title: 'OpenClaw Mind', desc: 'Conversation, memory search, browser control, file ops, skills' },
            { icon: '💪', title: 'Maestro Body', desc: 'Web dashboard, GitHub self-modification, survival engine' },
            { icon: '🔷', title: 'Unified Entity', desc: 'File-based memory + PostgreSQL structure. Always learning.' },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-[var(--maestro-border)] text-left">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="font-bold text-[var(--maestro-primary)] text-sm mb-1">{f.title}</div>
              <div className="text-xs text-[var(--maestro-muted)] leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-[var(--maestro-muted)]">
        Redexes 🔷 · Unified AI Entity · 2026
      </footer>
    </div>
  )
}
