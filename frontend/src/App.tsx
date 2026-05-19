import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMe } from './api/services'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/LoginPage'
import { ClientPage } from './pages/ClientPage'

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
    return <div className="p-8 text-[var(--text-muted)]">Loading…</div>
  }
  if (isError || !me) {
    return <Navigate to="/" replace />
  }
  return (
    <AppShell me={me}>
      <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading…</div>}>
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
