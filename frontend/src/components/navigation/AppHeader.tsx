import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  Circle,
  Command,
  LogOut,
  Menu,
  MonitorPlay,
  Moon,
  Search,
  Sun,
  SunMoon,
  KeyRound,
  Sparkles,
} from 'lucide-react'
import { fetchAuthStatus, fetchSessionsList, logout } from '@/services'
import type { AuthStatus, MeResponse } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'
import { initThemeFromPayload, setThemePreset, themeDescriptions } from '@/lib/theme'
import { useAppearance, type Appearance } from '@/hooks/use-appearance'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hasRole } from '@/lib/roles'
import type { Role } from '@/types/api'
import { useDashboardShell } from '@/components/layouts/dashboard-shell-context'

const pathTitles: Record<string, string> = {
  '/connections': 'Connections',
  '/sessions': 'Sessions',
  '/recordings': 'Recordings',
  '/reports': 'Reports',
  '/docs': 'Documentation',
  '/tokens': 'API tokens',
  '/admin': 'Administration',
}

function initials(me: MeResponse) {
  const n = me.name || me.email || '?'
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase()
  return n.slice(0, 2).toUpperCase()
}

export function AppHeader({
  me,
  breadcrumbs,
}: {
  me: MeResponse
  breadcrumbs?: { label: string; href?: string }[]
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const setApiKey = useAuthStore((s) => s.setApiKey)
  const apiKey = useAuthStore((s) => s.apiKey)
  const { data: auth } = useQuery<AuthStatus>({ queryKey: ['auth-status'], queryFn: fetchAuthStatus })
  const { appearance, setAppearance } = useAppearance()
  const [cmdOpen, setCmdOpen] = useState(false)
  const { openMobileNav } = useDashboardShell()

  const showSessions = hasRole(me.role as Role, 'poweruser') || !!apiKey

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', 'strip'],
    queryFn: () => fetchSessionsList(false),
    refetchInterval: 10_000,
    enabled: showSessions,
  })

  const activeSessionCount = useMemo(
    () => sessions.filter((s) => s.status === 'active' || s.status === 'pending').length,
    [sessions],
  )

  useEffect(() => {
    if (auth?.theme) initThemeFromPayload(auth.theme)
  }, [auth])

  const siteTitle = auth?.site_title || 'rustguac'
  const presets = auth?.theme?.presets || {}
  const adminPreset = auth?.theme?.admin_preset || 'aurora'
  const activeTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('rustguac_theme') : null
  const resolvedPreset = activeTheme && presets[activeTheme] ? activeTheme : adminPreset

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const crumbs = breadcrumbs?.length
    ? breadcrumbs
    : [{ label: 'Home', href: '/connections' }, { label: pathTitles[location.pathname] || 'Page' }]

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/80 px-3 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md sm:gap-3 sm:px-4 lg:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground lg:hidden"
          onClick={() => openMobileNav()}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <nav className="flex items-center gap-1 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1 truncate">
                {i > 0 ? <span className="text-border">/</span> : null}
                {c.href ? (
                  <button
                    type="button"
                    className="truncate hover:text-foreground"
                    onClick={() => navigate(c.href!)}
                  >
                    {c.label}
                  </button>
                ) : (
                  <span className={cn('truncate', i === crumbs.length - 1 && 'font-medium text-foreground')}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight">{siteTitle}</h1>
            <Badge variant="muted" className="hidden font-mono text-[10px] sm:inline-flex">
              {typeof window !== 'undefined' ? window.location.hostname : ''}
            </Badge>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 border-dashed text-muted-foreground md:hidden"
          onClick={() => setCmdOpen(true)}
          aria-label="Search connections"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-8 max-w-[220px] flex-1 border-dashed text-muted-foreground md:flex lg:max-w-sm"
          onClick={() => setCmdOpen(true)}
        >
          <Search className="mr-2 h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">Search connections…</span>
          <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        <div className="flex shrink-0 items-center gap-1">
          {showSessions ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 text-muted-foreground"
                  onClick={() => navigate('/sessions')}
                  aria-label="Live sessions"
                >
                  <MonitorPlay className="h-4 w-4" />
                  {activeSessionCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/90 px-1 text-[9px] font-bold text-white">
                      {activeSessionCount > 9 ? '9+' : activeSessionCount}
                    </span>
                  ) : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Session monitor ({activeSessionCount} active)</TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>No new alerts</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="h-8 gap-2 px-1.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">{initials(me)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-xs font-medium lg:inline">{me.name || me.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{me.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{me.email}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Role · {me.role}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Appearance</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={appearance} onValueChange={(v) => setAppearance(v as Appearance)}>
                <DropdownMenuRadioItem value="light" className="gap-2 text-xs">
                  <Sun className="h-3.5 w-3.5" /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="gap-2 text-xs">
                  <Moon className="h-3.5 w-3.5" /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" className="gap-2 text-xs">
                  <SunMoon className="h-3.5 w-3.5" /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Color preset</DropdownMenuLabel>
              {Object.keys(presets).map((name) => (
                <DropdownMenuItem
                  key={name}
                  className="gap-2 text-xs"
                  onClick={() => {
                    setThemePreset(name, presets as Record<string, Record<string, string>>)
                  }}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-border"
                    style={{
                      background: `linear-gradient(135deg,${(presets as Record<string, Record<string, string>>)[name]?.primary} 50%,${(presets as Record<string, Record<string, string>>)[name]?.accent} 50%)`,
                    }}
                  />
                  <span className="flex flex-1 flex-col gap-0">
                    <span className={cn('font-medium', name === resolvedPreset && 'text-primary')}>{name}</span>
                    <span className="text-[10px] text-muted-foreground">{themeDescriptions[name] || ''}</span>
                  </span>
                  {name === resolvedPreset ? <Circle className="ml-auto h-2 w-2 fill-primary" /> : null}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => navigate('/connections?credentials=1')}>
                <KeyRound className="h-3.5 w-3.5" /> My credentials
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => navigate('/connections?tour=1')}>
                <Sparkles className="h-3.5 w-3.5" /> Welcome tour
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs text-destructive focus:text-destructive"
                onClick={() => {
                  setApiKey(null)
                  logout().finally(() => navigate('/'))
                }}
              >
                <LogOut className="h-3.5 w-3.5" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Command className="h-4 w-4" /> Command palette
            </DialogTitle>
            <DialogDescription className="text-xs">Jump to connection inventory search</DialogDescription>
          </DialogHeader>
          <div className="p-3">
            <Input
              autoFocus
              placeholder="Type to open connections search…"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (e.target as HTMLInputElement).value.trim()
                  setCmdOpen(false)
                  navigate(q ? `/connections?q=${encodeURIComponent(q)}` : '/connections')
                }
              }}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">Press Enter to go to Connections. Use / on that page for quick find.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
