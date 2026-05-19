import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { AuthStatus, MeResponse, Role } from '../../types/api'
import type { ReactNode } from 'react'
import { fetchAuthStatus, logout } from '../../api/services'
import { useAuthStore } from '../../stores/authStore'
import { hasRole } from '../../lib/roles'
import { initThemeFromPayload, setThemePreset, themeDescriptions } from '../../lib/theme'

const linkCls = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'active font-bold' : 'text-[var(--text-muted)] no-underline py-1 hover:text-[var(--text)]'

export function AppShell({ me, children }: { me: MeResponse; children?: ReactNode }) {
  const navigate = useNavigate()
  const setApiKey = useAuthStore((s) => s.setApiKey)
  const apiKey = useAuthStore((s) => s.apiKey)
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: auth } = useQuery<AuthStatus>({ queryKey: ['auth-status'], queryFn: fetchAuthStatus })

  useEffect(() => {
    if (!menuOpen) return
    const fn = () => setMenuOpen(false)
    document.addEventListener('click', fn)
    return () => document.removeEventListener('click', fn)
  }, [menuOpen])

  useEffect(() => {
    if (auth?.theme) initThemeFromPayload(auth.theme)
  }, [auth])

  const siteTitle = auth?.site_title || 'rustguac'
  const presets = auth?.theme?.presets || {}
  const activeTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('rustguac_theme') : null
  const adminPreset = auth?.theme?.admin_preset || 'aurora'
  const resolvedActive = activeTheme && presets[activeTheme] ? activeTheme : adminPreset

  const isAdmin = me.role === 'admin' || !!apiKey
  const showSessions = hasRole(me.role as Role, 'poweruser') || !!apiKey
  const showReports = hasRole(me.role as Role, 'poweruser') || !!apiKey
  const showTokens = hasRole(me.role as Role, 'operator') || !!apiKey

  return (
    <div className="min-h-screen px-10 py-10" style={{ fontFamily: 'monospace', fontSize: 18, color: 'var(--text)' }}>
      <div className="flex items-center gap-3">
        <img
          id="site-logo"
          src={auth?.theme?.logo_url || '/logo.svg'}
          alt=""
          className="h-9 w-auto"
        />
        <h1 className="m-0 text-3xl font-bold" style={{ color: 'var(--primary)' }}>
          {siteTitle}
        </h1>
      </div>
      <nav className="mb-7 mt-4 flex flex-wrap items-center gap-7 border-b pb-3 text-lg" style={{ borderColor: 'var(--border)' }}>
        <NavLink to="/connections" className={linkCls}>
          Connections
        </NavLink>
        {showSessions ? (
          <NavLink to="/sessions" className={linkCls}>
            Sessions
          </NavLink>
        ) : null}
        <NavLink to="/recordings" className={linkCls}>
          Recordings
        </NavLink>
        {showReports ? (
          <NavLink to="/reports" className={linkCls}>
            Reports
          </NavLink>
        ) : null}
        <NavLink to="/docs" className={linkCls}>
          Docs
        </NavLink>
        {showTokens ? (
          <NavLink to="/tokens" className={linkCls}>
            Tokens
          </NavLink>
        ) : null}
        {isAdmin ? (
          <NavLink to="/admin" className={linkCls}>
            Admin
          </NavLink>
        ) : null}
        <span id="user-menu-wrapper" className="relative ml-auto inline-flex items-center gap-3">
          <a
            href="#logout"
            id="logout-item"
            className="no-underline py-1"
            style={{ color: 'var(--text-muted)' }}
            onClick={(e) => {
              e.preventDefault()
              setApiKey(null)
              logout().finally(() => navigate('/'))
            }}
          >
            Logout
          </a>
          <span
            id="user-menu-btn"
            title="Preferences"
            className="inline-flex h-[38px] cursor-pointer items-center gap-1 rounded border px-2 text-lg"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            onKeyDown={(e) => e.key === 'Enter' && setMenuOpen((v) => !v)}
            role="button"
            tabIndex={0}
          >
            &#9881; Settings
          </span>
          <div
            id="user-menu"
            className="absolute right-0 top-[calc(38px+8px)] z-50 min-w-[260px] rounded border p-1 shadow-lg"
            style={{
              display: menuOpen ? 'block' : 'none',
              background: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="um-section-label px-3 pb-1 pt-2 text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              Theme
            </div>
            <div id="um-theme-list">
              {Object.keys(presets).map((name) => (
                <div
                  key={name}
                  className={'um-item flex cursor-pointer items-center gap-2 px-3 py-2 text-base ' + (name === resolvedActive ? 'text-[var(--accent)]' : '')}
                  onClick={() => {
                    setThemePreset(name, presets as Record<string, Record<string, string>>)
                    setMenuOpen(false)
                  }}
                >
                  <span
                    className="um-swatch inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full border"
                    style={{
                      borderColor: 'var(--border)',
                      background: `linear-gradient(135deg,${(presets as Record<string, Record<string, string>>)[name]?.primary} 50%,${(presets as Record<string, Record<string, string>>)[name]?.accent} 50%)`,
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="font-bold">{name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      {themeDescriptions[name] || ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="um-divider my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            <div
              className="um-item cursor-pointer px-3 py-2 text-base hover:bg-[var(--input)]"
              role="button"
              tabIndex={0}
              onClick={() => {
                setMenuOpen(false)
                navigate('/connections?credentials=1')
              }}
            >
              &#128273; My Credentials
            </div>
            <div
              className="um-item cursor-pointer px-3 py-2 text-base hover:bg-[var(--input)]"
              role="button"
              tabIndex={0}
              onClick={() => {
                setMenuOpen(false)
                navigate('/connections?tour=1')
              }}
            >
              &#9432; Welcome Tour
            </div>
          </div>
        </span>
      </nav>
      {children ?? <Outlet />}
    </div>
  )
}
