"use client"

import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { icon: "🎯", label: "Dashboard", href: "/dashboard" },
  { icon: "💬", label: "Chat", href: "/chat" },
  { icon: "🔐", label: "Coffre-fort", href: "/vault" },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--maestro-border)] px-5 py-2 flex justify-around shadow-[0_-2px_12px_rgba(0,0,0,0.04)] z-50">
      {NAV_ITEMS.map((n, i) => {
        const isActive = pathname === n.href
        return (
          <a key={i} href={n.href}
            className={`text-center py-1 px-4 rounded-xl transition-all duration-200 ${
              isActive ? "opacity-100 scale-105" : "opacity-40 hover:opacity-70"
            }`}>
            <div className="text-lg">{n.icon}</div>
            <div className={`text-[10px] font-semibold mt-0.5 transition-colors ${
              isActive ? "text-[var(--maestro-accent)]" : "text-[var(--maestro-muted)]"
            }`}>{n.label}</div>
          </a>
        )
      })}
    </nav>
  )
}
