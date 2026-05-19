import { useCallback, useEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'rustguac_ui_appearance'
const CHANGE = 'rustguac-appearance-change'

export type Appearance = 'light' | 'dark' | 'system'

function getStored(): Appearance {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as Appearance | null
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function resolvedClass(appearance: Appearance): 'light' | 'dark' {
  if (appearance === 'system') return prefersDark() ? 'dark' : 'light'
  return appearance
}

export function applyDocumentAppearance(appearance: Appearance) {
  const root = document.documentElement
  const r = resolvedClass(appearance)
  root.classList.toggle('dark', r === 'dark')
}

function subscribe(listener: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mm = window.matchMedia('(prefers-color-scheme: dark)')
  const onMm = () => listener()
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener()
  }
  const onLocal = () => listener()
  mm.addEventListener('change', onMm)
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE, onLocal)
  return () => {
    mm.removeEventListener('change', onMm)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE, onLocal)
  }
}

function getSnapshot(): Appearance {
  return getStored()
}

export function useAppearance() {
  const appearance = useSyncExternalStore(subscribe, getSnapshot, () => 'system' as Appearance)

  useEffect(() => {
    applyDocumentAppearance(appearance)
  }, [appearance])

  const setAppearance = useCallback((next: Appearance) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    applyDocumentAppearance(next)
    window.dispatchEvent(new Event(CHANGE))
  }, [])

  return { appearance, setAppearance, resolved: resolvedClass(appearance) }
}

export function initAppearanceOnLoad() {
  if (typeof document === 'undefined') return
  applyDocumentAppearance(getStored())
}
