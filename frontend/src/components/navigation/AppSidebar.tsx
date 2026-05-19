import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import type { MeResponse, Role } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'
import { hasRole } from '@/lib/roles'
import { navSections, canSeeNavItem } from './nav-config'

const COLLAPSE_KEY = 'rustguac_sidebar_collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function saveCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function AppSidebar({ me }: { me: MeResponse }) {
  const location = useLocation()
  const apiKey = useAuthStore((s) => s.apiKey)
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  const ctx = useMemo(
    () => ({
      role: me.role as Role,
      apiKey: !!apiKey,
      isAdmin: me.role === 'admin' || !!apiKey,
      showSessions: hasRole(me.role as Role, 'poweruser') || !!apiKey,
      showReports: hasRole(me.role as Role, 'poweruser') || !!apiKey,
      showTokens: hasRole(me.role as Role, 'operator') || !!apiKey,
    }),
    [me.role, apiKey],
  )

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      saveCollapsed(next)
      return next
    })
  }

  return (
    <aside
      className={cn(
        'relative flex min-h-screen flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md transition-[width] duration-200 ease-out',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        {!collapsed ? (
          <span className="truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">Console</span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('ml-auto h-8 w-8 shrink-0 text-muted-foreground', collapsed && 'mx-auto ml-0')}
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {navSections.map((section) => {
            const items = section.items.filter((i) => canSeeNavItem(i, ctx))
            if (!items.length) return null
            return (
              <div key={section.label} className="mb-2">
                {!collapsed ? (
                  <div className="mb-1.5 px-2 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                    {section.label}
                  </div>
                ) : (
                  <Separator className="my-2 bg-sidebar-border" />
                )}
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const Icon = item.icon
                    const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                    const link = (
                      <NavLink
                        to={item.to}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100', active && 'opacity-100')} />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                        {active && !collapsed ? (
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        ) : null}
                      </NavLink>
                    )
                    if (collapsed) {
                      return (
                        <Tooltip key={item.to} delayDuration={0}>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      )
                    }
                    return <div key={item.to}>{link}</div>
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}
