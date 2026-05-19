import type { ReactNode } from 'react'
import { AppSidebar } from '@/components/navigation/AppSidebar'
import { AppHeader } from '@/components/navigation/AppHeader'
import { AppErrorBoundary } from '@/app/error-boundary'
import type { MeResponse } from '@/types/api'

export function DashboardLayout({ me, children, breadcrumbs }: { me: MeResponse; children?: ReactNode; breadcrumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar me={me} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader me={me} breadcrumbs={breadcrumbs} />
        <AppErrorBoundary>
          <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
        </AppErrorBoundary>
      </div>
    </div>
  )
}
