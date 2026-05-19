import { BookOpen, Cable, Film, LayoutDashboard, LineChart, Shield, KeyRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/types/api'

export type NavSection = { label: string; items: NavItem[] }

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Minimum role / capability */
  require?: 'sessions' | 'reports' | 'tokens' | 'admin'
}

export const navSections: NavSection[] = [
  {
    label: 'Access',
    items: [
      { to: '/connections', label: 'Connections', icon: Cable },
      { to: '/sessions', label: 'Sessions', icon: LayoutDashboard, require: 'sessions' },
      { to: '/recordings', label: 'Recordings', icon: Film },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/reports', label: 'Reports', icon: LineChart, require: 'reports' },
      { to: '/tokens', label: 'API tokens', icon: KeyRound, require: 'tokens' },
      { to: '/admin', label: 'Admin', icon: Shield, require: 'admin' },
    ],
  },
  {
    label: 'Help',
    items: [{ to: '/docs', label: 'Documentation', icon: BookOpen }],
  },
]

export function canSeeNavItem(
  item: NavItem,
  ctx: { role: Role; apiKey: boolean; isAdmin: boolean; showSessions: boolean; showReports: boolean; showTokens: boolean },
): boolean {
  switch (item.require) {
    case 'sessions':
      return ctx.showSessions
    case 'reports':
      return ctx.showReports
    case 'tokens':
      return ctx.showTokens
    case 'admin':
      return ctx.isAdmin
    default:
      return true
  }
}
