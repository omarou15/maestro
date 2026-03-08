import { UserButton } from '@clerk/nextjs'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      {/* Header */}
      <header className="bg-[var(--maestro-primary)] px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
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
          <div>
            <div className="text-white text-base font-bold tracking-tight">MAESTRO</div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest">ORCHESTRATEUR IA</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-green-500/15 px-3 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-green-500 text-xs font-semibold font-mono">En ligne</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-5 py-6">
        {/* Command bar */}
        <div className="bg-white rounded-2xl p-1.5 pl-5 flex items-center gap-3 shadow-sm border-[1.5px] border-[var(--maestro-border)] mb-6">
          <span className="text-lg opacity-50">💬</span>
          <input
            type="text"
            placeholder='Donne un ordre à Maestro... "Crée un agent pour gérer mes emails"'
            className="flex-1 border-none outline-none text-sm bg-transparent text-[var(--maestro-primary)]"
          />
          <button className="bg-[var(--maestro-primary)] text-white rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-[var(--maestro-primary-light)] transition-colors">
            Envoyer →
          </button>
        </div>

        {/* Empty state */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-12 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-xl font-bold text-[var(--maestro-primary)] mb-2">Bienvenue sur Maestro</h2>
          <p className="text-sm text-[var(--maestro-muted)] max-w-md mx-auto mb-6">
            Ton orchestrateur IA est prêt. Donne-lui ta première mission en langage naturel et il créera les agents nécessaires.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              '📧 Gère mes emails Gmail',
              '👥 Suis mon équipe sur Monday',
              '💻 Dev-moi une application',
              '🛒 Commande mes courses',
            ].map((s, i) => (
              <button key={i} className="bg-[var(--maestro-surface)] text-[var(--maestro-primary)] text-xs font-medium px-4 py-2 rounded-lg border border-[var(--maestro-border)] hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--maestro-border)] px-5 py-2 flex justify-around">
        {[
          { icon: '🎯', label: 'Dashboard', active: true },
          { icon: '📋', label: 'Missions', active: false },
          { icon: '💬', label: 'Chat', active: false },
          { icon: '🔐', label: 'Coffre-fort', active: false },
        ].map((n, i) => (
          <div key={i} className={`text-center cursor-pointer ${n.active ? 'opacity-100' : 'opacity-40'}`}>
            <div className="text-lg">{n.icon}</div>
            <div className={`text-[10px] font-semibold mt-0.5 ${n.active ? 'text-[var(--maestro-accent)]' : 'text-[var(--maestro-muted)]'}`}>{n.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
