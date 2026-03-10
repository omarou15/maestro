"use client"

import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "./MaestroLogo"

type HeaderProps = {
  subtitle?: string
  rightContent?: React.ReactNode
}

export default function Header({ subtitle = "UNIFIED ENTITY", rightContent }: HeaderProps) {
  return (
    <header className="bg-[var(--maestro-primary)] px-4 h-14 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <a href="/dashboard" className="shrink-0">
          <MaestroLogo size={30} />
        </a>
        <div className="min-w-0">
          <div className="text-white text-[15px] font-bold tracking-tight">REDEXES 🔷</div>
          <div className="text-white/40 text-[9px] font-mono tracking-[0.08em] truncate">{subtitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightContent}
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
