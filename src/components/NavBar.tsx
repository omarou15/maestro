"use client"

import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", 
    icon: (active: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#D4940A" : "#7A8580"} strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { label: "Chat", href: "/chat",
    icon: (active: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#D4940A" : "#7A8580"} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
  { label: "Mémoire", href: "/knowledge",
    icon: (active: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#D4940A" : "#7A8580"} strokeWidth="2" strokeLinecap="round"><path d="M12 2a7 7 0 017 7c0 3-2 5.5-4 7.5L12 22l-3-5.5C7 14.5 5 12 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/></svg> },
  { label: "Coffre", href: "/vault",
    icon: (active: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#D4940A" : "#7A8580"} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/></svg> },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--maestro-border)] px-4 pb-safe flex justify-around z-50" style={{ paddingTop: 6, paddingBottom: "max(env(safe-area-inset-bottom, 6px), 6px)" }}>
      {NAV_ITEMS.map((n, i) => {
        const isActive = pathname === n.href
        return (
          <a key={i} href={n.href}
            className={`text-center py-1 px-3 flex flex-col items-center transition-all duration-200 ${
              isActive ? "opacity-100" : "opacity-50 hover:opacity-70"
            }`}>
            {n.icon(isActive)}
            <div className={`text-[9px] font-semibold mt-1 ${
              isActive ? "text-[var(--maestro-accent)]" : "text-[var(--maestro-muted)]"
            }`}>{n.label}</div>
          </a>
        )
      })}
    </nav>
  )
}
