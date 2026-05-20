import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppSidebar } from '@/components/navigation/AppSidebar'
import { AppHeader } from '@/components/navigation/AppHeader'
import { AppErrorBoundary } from '@/app/error-boundary'
import type { MeResponse } from '@/types/api'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/use-media-query'
import { DashboardShellContext } from '@/components/layouts/dashboard-shell-context'

export function DashboardLayout({
  me,
  children,
  breadcrumbs,
}: {
  me: MeResponse
  children?: ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isLg = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (isLg) setMobileNavOpen(false)
  }, [isLg])

  const openMobileNav = useCallback(() => setMobileNavOpen(true), [])
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  const shell = useMemo(
    () => ({
      openMobileNav,
      closeMobileNav,
    }),
    [openMobileNav, closeMobileNav],
  )

  return (
    <DashboardShellContext.Provider value={shell}>
      <div className="flex h-dvh min-h-0 w-full bg-background text-foreground">
        {isLg ? (
          <div className="flex h-full min-h-0 shrink-0">
            <AppSidebar me={me} />
          </div>
        ) : (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent
              side="left"
              className="flex h-full w-[min(18rem,88vw)] max-w-none flex-col gap-0 border-r border-sidebar-border bg-sidebar p-0 sm:max-w-none [&>button]:hidden"
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">Main navigation</SheetTitle>
              <AppSidebar me={me} />
            </SheetContent>
          </Sheet>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader me={me} breadcrumbs={breadcrumbs} />
          <AppErrorBoundary>
            <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-6">
              {children}
            </main>
          </AppErrorBoundary>
        </div>
      </div>
    </DashboardShellContext.Provider>
  )
}
