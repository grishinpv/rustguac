import { createContext, useContext } from 'react'

export type DashboardShellValue = {
  openMobileNav: () => void
  closeMobileNav: () => void
}

export const DashboardShellContext = createContext<DashboardShellValue | null>(null)

export function useDashboardShell(): DashboardShellValue {
  const v = useContext(DashboardShellContext)
  if (!v) {
    throw new Error('useDashboardShell must be used within DashboardLayout')
  }
  return v
}

export function useDashboardShellOptional(): DashboardShellValue | null {
  return useContext(DashboardShellContext)
}
