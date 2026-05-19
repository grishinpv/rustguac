import type { ThemePayload } from '../types/api'

const THEME_KEY = 'rustguac_theme'
const COLORS_KEY = 'rustguac_theme_colors'

export function applyThemeColors(colors: Record<string, string>) {
  const r = document.documentElement.style
  for (const k of Object.keys(colors)) {
    r.setProperty('--' + k.replace(/_/g, '-'), colors[k])
  }
  let s = document.getElementById('bg-pattern-style')
  if (!s) {
    s = document.createElement('style')
    s.id = 'bg-pattern-style'
    document.head.appendChild(s)
  }
  const bp = colors.bg_pattern
  s.textContent = bp && bp !== 'none' ? `body{background-image:${bp};background-attachment:fixed}` : ''
  localStorage.setItem(COLORS_KEY, JSON.stringify(colors))
}

export function initThemeFromPayload(theme: ThemePayload | undefined) {
  if (!theme) return
  const presets = theme.presets || {}
  const adminPreset = theme.admin_preset || 'aurora'
  const u = localStorage.getItem(THEME_KEY)
  const active = u && presets[u] ? u : adminPreset
  const colors = active === adminPreset ? theme.admin_colors : presets[active]
  if (colors) applyThemeColors(colors as Record<string, string>)
  return { presets, adminPreset, active, logoUrl: theme.logo_url }
}

export function setThemePreset(name: string, presets: Record<string, Record<string, string>>) {
  localStorage.setItem(THEME_KEY, name)
  const c = presets[name]
  if (c) applyThemeColors(c as unknown as Record<string, string>)
}

export const themeDescriptions: Record<string, string> = {
  dark: 'Navy & cyan — the default',
  light: 'Clean white & blue',
  'high-contrast': 'Maximum readability',
  terminal: 'Retro green-on-black',
  nord: 'Arctic, muted blues',
  corporate: 'Slate & steel blue',
  aurora: 'Midnight blue with ambient glow',
  jaguar: 'Racing green & gold',
}
