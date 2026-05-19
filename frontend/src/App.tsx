import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMe } from '@/services'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/LoginPage'
import { ClientPage } from './pages/ClientPage'
import { Skeleton } from './components/ui/skeleton'

const ConnectionsPage = lazy(() => import('./pages/connections/ConnectionsPage').then((m) => ({ default: m.ConnectionsPage })))
const SessionsPage = lazy(() => import('./pages/SessionsPage').then((m) => ({ default: m.SessionsPage })))
const RecordingsPage = lazy(() => import('./pages/RecordingsPage').then((m) => ({ default: m.RecordingsPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const DocsPage = lazy(() => import('./pages/DocsPage').then((m) => ({ default: m.DocsPage })))
const TokensPage = lazy(() => import('./pages/TokensPage').then((m) => ({ default: m.TokensPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

function AuthenticatedLayout() {
  const { data: me, isPending, isError } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  })
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    )
  }
  if (isError || !me) {
    return <Navigate to="/" replace />
  }
  return (
    <AppShell me={me}>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center p-8">
            <div className="flex w-full max-w-lg flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/client/:sessionId" element={<ClientPage />} />
      <Route element={<AuthenticatedLayout />}>
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/recordings" element={<RecordingsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/tokens" element={<TokensPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/connections" replace />} />
    </Routes>
  )
}
