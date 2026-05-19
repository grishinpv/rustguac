import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  fetchMe,
  fetchReportsSessions,
  fetchReportsSummary,
  fetchTopConnections,
  fetchTopUsers,
} from '../api/services'
import type { HistorySession } from '../types/api'
import { useAuthStore } from '../stores/authStore'
import { hasRole } from '../lib/roles'
import type { Role } from '../types/api'

function formatDuration(secs: number | undefined) {
  if (secs == null || secs < 0) return '--'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDate(iso: string | undefined) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ReportsPage() {
  const navigate = useNavigate()
  const apiKey = useAuthStore((s) => s.apiKey)
  const { data: me, isSuccess: meOk } = useQuery({ queryKey: ['me'], queryFn: fetchMe })

  const { data: summary } = useQuery({ queryKey: ['reports', 'summary'], queryFn: fetchReportsSummary })
  const [offset, setOffset] = useState(0)
  const limit = 100
  const { data: page } = useQuery({
    queryKey: ['reports', 'sessions', offset, limit],
    queryFn: () => fetchReportsSessions(limit, offset),
  })
  const { data: topConn = [] } = useQuery({ queryKey: ['reports', 'top-connections'], queryFn: fetchTopConnections })
  const { data: topUsers = [] } = useQuery({ queryKey: ['reports', 'top-users'], queryFn: fetchTopUsers })

  const [filter, setFilter] = useState('')
  const [sortCol, setSortCol] = useState<keyof HistorySession>('started_at')
  const [sortDir, setSortDir] = useState(-1)

  const sessions = page?.sessions || []
  const total = page?.total || 0

  const filteredSorted = useMemo(() => {
    let rows = sessions.slice()
    rows.sort((a, b) => {
      let va: string | number = (a[sortCol] ?? '') as string | number
      let vb: string | number = (b[sortCol] ?? '') as string | number
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir
      const sa = String(va).toLowerCase()
      const sb = String(vb).toLowerCase()
      if (sa < sb) return -1 * sortDir
      if (sa > sb) return 1 * sortDir
      return 0
    })
    const ft = filter.trim().toLowerCase()
    if (ft) {
      rows = rows.filter((s) => {
        const hay = [
          s.created_by,
          s.entry_display_name,
          s.address_book_folder,
          s.session_type,
          s.hostname,
          s.status,
          formatDate(s.started_at),
          formatDuration(s.duration_secs),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(ft)
      })
    }
    return rows
  }, [sessions, sortCol, sortDir, filter])

  useEffect(() => {
    if (!meOk || !me) return
    if (!hasRole(me.role as Role, 'poweruser') && !apiKey) navigate('/connections', { replace: true })
  }, [meOk, me, apiKey, navigate])

  function exportCsv() {
    const params: string[] = []
    if (filter.trim()) params.push(`user=${encodeURIComponent(filter.trim())}`)
    if (apiKey) params.push(`key=${encodeURIComponent(apiKey)}`)
    window.location.href = `/api/reports/sessions/csv${params.length ? `?${params.join('&')}` : ''}`
  }

  return (
    <div>
      <h2>Reports</h2>
      <div className="summary-cards mb-8 mt-4 flex flex-wrap gap-4">
        {[
          ['Total Sessions', summary?.total_sessions ?? '--'],
          ['Total Hours', summary?.total_hours != null ? summary.total_hours.toFixed(1) : '--'],
          ['Unique Users', summary?.unique_users ?? '--'],
          ['Active Now', summary?.active_now ?? '--'],
        ].map(([k, v]) => (
          <div key={k} className="summary-card rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="card-label text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              {k}
            </div>
            <div className="card-value text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      <h2>Session History</h2>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          className="max-w-full rounded border px-3 py-2 font-mono"
          style={{ width: 360, borderColor: 'var(--border)', background: 'var(--input)', color: 'var(--text)' }}
          placeholder="Filter sessions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button type="button" className="btn-add" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <table className="w-full border-collapse border" style={{ borderColor: 'var(--border)' }}>
        <thead>
          <tr>
            {(
              [
                ['created_by', 'User'],
                ['entry_display_name', 'Entry'],
                ['address_book_folder', 'Folder'],
                ['session_type', 'Type'],
                ['hostname', 'Hostname'],
                ['started_at', 'Started'],
                ['duration_secs', 'Duration'],
                ['status', 'Status'],
                ['', ''],
              ] as const
            ).map(([col, label]) => (
              <th
                key={col || label}
                className={col ? 'sortable cursor-pointer border-b p-3 text-left text-sm uppercase' : 'border-b p-3'}
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
                onClick={
                  col
                    ? () => {
                        if (sortCol === col) setSortDir((d) => -d)
                        else {
                          setSortCol(col)
                          setSortDir(1)
                        }
                      }
                    : undefined
                }
              >
                {label}
                {col && sortCol === col ? <span className="ml-1 text-[0.7em]">{sortDir === 1 ? '\u25B2' : '\u25BC'}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredSorted.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty border-b p-4" style={{ borderColor: 'var(--border)' }}>
                No sessions found.
              </td>
            </tr>
          ) : (
            filteredSorted.map((s, i) => (
              <tr key={`${s.started_at}-${i}`}>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  {s.created_by || s.username || ''}
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  {s.entry_display_name || s.address_book_entry || ''}
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  {s.address_book_folder || ''}
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  <span className={`type-badge type-${s.session_type || ''}`}>{s.session_type}</span>
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  {s.hostname || ''}
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  {formatDate(s.started_at)}
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  {formatDuration(s.duration_secs)}
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  <span className={`status-badge status-${(s.status || '').toLowerCase()}`}>{s.status}</span>
                </td>
                <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  {s.recording_file ? (
                    <a className="btn-small" href="/recordings" title={s.recording_file}>
                      recording
                    </a>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="pagination mt-3 flex items-center gap-3">
        <button type="button" className="btn-small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
          Previous
        </button>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {total === 0 ? '0' : `${offset + 1}-${Math.min(offset + limit, total)}`} of {total}
        </span>
        <button type="button" className="btn-small" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
          Next
        </button>
      </div>
      <div className="panels mt-10 flex flex-wrap gap-8">
        <div className="panel min-w-[320px] flex-1 rounded border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="panel-title mb-3 text-sm font-bold uppercase" style={{ color: 'var(--primary)' }}>
            Top Connections
          </div>
          {!topConn.length ? <p className="empty text-sm">No data yet.</p> : null}
          {topConn.length ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs">Name</th>
                  <th className="p-2 text-left text-xs">Type</th>
                  <th className="p-2 text-left text-xs">Sessions</th>
                  <th className="p-2 text-left text-xs">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {topConn.map((c, i) => (
                  <tr key={i}>
                    <td className="p-2 text-sm">{c.name || c.address_book_entry}</td>
                    <td className="p-2 text-sm">
                      <span className={`type-badge type-${c.session_type || ''}`}>{c.session_type}</span>
                    </td>
                    <td className="p-2 text-sm">{c.session_count ?? 0}</td>
                    <td className="p-2 text-sm">{c.total_hours != null ? c.total_hours.toFixed(1) : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <div className="panel min-w-[320px] flex-1 rounded border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="panel-title mb-3 text-sm font-bold uppercase" style={{ color: 'var(--primary)' }}>
            Top Users
          </div>
          {!topUsers.length ? <p className="empty text-sm">No data yet.</p> : null}
          {topUsers.length ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs">User</th>
                  <th className="p-2 text-left text-xs">Sessions</th>
                  <th className="p-2 text-left text-xs">Total Hours</th>
                  <th className="p-2 text-left text-xs">Last Session</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr key={i}>
                    <td className="p-2 text-sm">{u.user}</td>
                    <td className="p-2 text-sm">{u.session_count ?? 0}</td>
                    <td className="p-2 text-sm">{u.total_hours != null ? u.total_hours.toFixed(1) : '0'}</td>
                    <td className="p-2 text-sm">{formatDate(u.last_session)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  )
}
