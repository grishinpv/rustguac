import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  createAdminToken,
  createGroupMapping,
  deleteGroupMapping,
  deleteUser,
  disableUser,
  enableUser,
  fetchAddressbookAudit,
  fetchAdminTokens,
  fetchGroupMappings,
  fetchMe,
  fetchSystemStatus,
  fetchTokenAudit,
  fetchUsers,
  forceLogoutUser,
  revokeAdminToken,
  setUserRole,
  updateGroupMapping,
} from '../api/services'
import type { GroupMapping, OidcUser, Role, SystemStatus, TokenAuditRow, AddressbookAuditRow, UserTokenRow } from '../types/api'
import { getErrorMessage } from '../api/client'

export function AdminPage() {
  const navigate = useNavigate()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const { data: status } = useQuery({ queryKey: ['system-status'], queryFn: fetchSystemStatus, refetchInterval: 10000 })
  const { data: users = [], refetch: refetchUsers } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers, enabled: me?.role === 'admin' })
  const { data: mappings = [], refetch: refetchMap } = useQuery({ queryKey: ['group-mappings'], queryFn: fetchGroupMappings, enabled: me?.role === 'admin' })
  const { data: allTok = [], refetch: refetchTok } = useQuery({ queryKey: ['admin-tokens'], queryFn: fetchAdminTokens, enabled: me?.role === 'admin' })
  const [auditEmail, setAuditEmail] = useState('')
  const { data: audit = [], refetch: refetchAudit } = useQuery({
    queryKey: ['token-audit', auditEmail],
    queryFn: () => fetchTokenAudit(auditEmail || undefined),
    enabled: me?.role === 'admin',
  })
  const [abAuditEmail, setAbAuditEmail] = useState('')
  const { data: abAudit = [], refetch: refetchAbAudit } = useQuery({
    queryKey: ['ab-audit', abAuditEmail],
    queryFn: () => fetchAddressbookAudit(abAuditEmail || undefined),
    enabled: me?.role === 'admin',
  })

  const [newGroup, setNewGroup] = useState('')
  const [newRole, setNewRole] = useState<Role>('viewer')
  const [tokEmail, setTokEmail] = useState('')
  const [tokName, setTokName] = useState('')
  const [tokMax, setTokMax] = useState('')
  const [tokExp, setTokExp] = useState('')
  const [tokReveal, setTokReveal] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (me && me.role !== 'admin') navigate('/connections', { replace: true })
  }, [me, navigate])

  useEffect(() => {
    if (me?.role !== 'admin') return
    const id = window.setInterval(() => {
      void refetchUsers()
      void refetchMap()
      void refetchTok()
    }, 10000)
    return () => clearInterval(id)
  }, [me?.role, refetchUsers, refetchMap, refetchTok])

  if (!me || me.role !== 'admin') return <div className="p-8">Loading…</div>

  return (
    <div>
      {err ? (
        <div className="mb-3 text-sm" style={{ color: 'var(--primary)' }}>
          {err}
        </div>
      ) : null}
      <h2>System Status</h2>
      <StatusGrid status={status} />
      <h2 className="mt-10">Users</h2>
      <table className="mt-3 w-full border-collapse border text-sm" style={{ borderColor: 'var(--border)' }}>
        <thead>
          <tr>
            {['Email', 'Name', 'Role', 'Groups', 'Status', 'Last Login', ''].map((h) => (
              <th key={h} className="border-b p-2 text-left" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.email} u={u} onErr={setErr} onRefresh={() => void refetchUsers()} />
          ))}
        </tbody>
      </table>

      <h2 className="mt-10">Group-to-Role Mappings</h2>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        OIDC groups are matched to roles on every login. The highest matching role wins.
      </p>
      <table className="mt-2 w-full border-collapse border text-sm" style={{ borderColor: 'var(--border)' }}>
        <thead>
          <tr>
            {['Group', 'Role', 'Created', ''].map((h) => (
              <th key={h} className="border-b p-2 text-left" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mappings.map((m) => (
            <tr key={m.id}>
              <td className="border-b p-2">{m.oidc_group}</td>
              <td className="border-b p-2">
                <select
                  className="rounded border px-1"
                  style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
                  defaultValue={m.role}
                  onChange={(e) => {
                    void updateGroupMapping(m.id, m.oidc_group, e.target.value).catch((er) => setErr(getErrorMessage(er)))
                  }}
                >
                  {(['viewer', 'operator', 'poweruser', 'admin'] as const).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border-b p-2">{m.created_at || ''}</td>
              <td className="border-b p-2">
                <button
                  type="button"
                  className="btn-small"
                  onClick={() => void deleteGroupMapping(m.id).then(() => void refetchMap())}
                >
                  delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="add-form mt-3 flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1 font-mono" style={{ borderColor: 'var(--border)', background: 'var(--input)' }} placeholder="OIDC group" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        <select className="rounded border px-2 py-1" style={{ borderColor: 'var(--border)', background: 'var(--input)' }} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
          {(['viewer', 'operator', 'poweruser', 'admin'] as const).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const g = newGroup.trim()
            if (!g) {
              setErr('Group name is required')
              return
            }
            void createGroupMapping(g, newRole)
              .then(() => {
                setNewGroup('')
                void refetchMap()
              })
              .catch((e) => setErr(getErrorMessage(e)))
          }}
        >
          Add Mapping
        </button>
      </div>

      <h2 className="mt-10">User API Tokens</h2>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Tokens issued to OIDC users for API access.
      </p>
      {!allTok.length ? <p className="text-sm">No user tokens.</p> : null}
      {allTok.length ? (
        <table className="mt-2 w-full border-collapse border text-sm" style={{ borderColor: 'var(--border)' }}>
          <thead>
            <tr>
              {['User', 'Name', 'Max Role', 'Expires', 'Created', 'Last Used', 'Status', ''].map((h) => (
                <th key={h} className="border-b p-2 text-left" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTok.map((t) => (
              <tr key={t.id}>
                <td className="border-b p-2">{t.email}</td>
                <td className="border-b p-2">{t.name}</td>
                <td className="border-b p-2">{t.max_role || 'none'}</td>
                <td className="border-b p-2">{t.expires_at ? t.expires_at.substring(0, 10) : 'never'}</td>
                <td className="border-b p-2">{t.created_at ? t.created_at.substring(0, 10) : ''}</td>
                <td className="border-b p-2">{t.last_used_at || 'never'}</td>
                <td className="border-b p-2">{t.disabled ? 'disabled' : 'active'}</td>
                <td className="border-b p-2">
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => {
                      if (!confirm(`Revoke "${t.name}" for ${t.email}?`)) return
                      void revokeAdminToken(t.id).then(() => {
                        void refetchTok()
                        void refetchAudit()
                      })
                    }}
                  >
                    revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <h3 className="mt-6 text-lg">Create Token for User</h3>
      <div className="add-form mt-2 flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1" style={{ width: 200, borderColor: 'var(--border)', background: 'var(--input)' }} placeholder="user@example.com" value={tokEmail} onChange={(e) => setTokEmail(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Token name" value={tokName} onChange={(e) => setTokName(e.target.value)} />
        <select className="rounded border px-2 py-1" style={{ borderColor: 'var(--border)', background: 'var(--input)' }} value={tokMax} onChange={(e) => setTokMax(e.target.value)}>
          <option value="">No role cap</option>
          {(['viewer', 'operator', 'poweruser', 'admin'] as const).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input type="date" className="rounded border px-2 py-1" style={{ borderColor: 'var(--border)', background: 'var(--input)' }} value={tokExp} onChange={(e) => setTokExp(e.target.value)} />
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (!tokEmail.trim() || !tokName.trim()) {
              setErr('Email and token name required')
              return
            }
            const body: Parameters<typeof createAdminToken>[0] = { email: tokEmail.trim(), name: tokName.trim() }
            if (tokMax) body.max_role = tokMax
            if (tokExp) body.expires_at = `${tokExp}T23:59:59Z`
            void createAdminToken(body)
              .then((d) => {
                setTokReveal(d.token)
                setTokEmail('')
                setTokName('')
                setTokMax('')
                setTokExp('')
                void refetchTok()
                void refetchAudit()
              })
              .catch((e) => setErr(getErrorMessage(e)))
          }}
        >
          Create
        </button>
      </div>
      {tokReveal ? (
        <div className="token-reveal mt-3 rounded border p-4" style={{ borderColor: 'var(--border)' }}>
          <strong>Token:</strong> <code className="break-all">{tokReveal}</code>
          <button type="button" className="btn-small ml-2" onClick={() => void navigator.clipboard.writeText(tokReveal)}>
            copy
          </button>
          <button type="button" className="btn-small ml-2" onClick={() => setTokReveal(null)}>
            dismiss
          </button>
        </div>
      ) : null}

      <h2 className="mt-10">Token Audit Log</h2>
      <div className="mb-2 flex gap-2">
        <input className="rounded border px-2 py-1" style={{ width: 200, borderColor: 'var(--border)', background: 'var(--input)' }} placeholder="Filter by email" value={auditEmail} onChange={(e) => setAuditEmail(e.target.value)} />
        <button type="button" className="btn-primary px-3 py-1 text-sm" onClick={() => void refetchAudit()}>
          Filter
        </button>
      </div>
      <AuditTable rows={audit} cols={['created_at', 'user_email', 'token_name', 'action', 'ip_addr', 'details']} />

      <h2 className="mt-10">Connections Audit Log</h2>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Destructive and mutating address book actions (metadata only).
      </p>
      <div className="mb-2 flex gap-2">
        <input className="rounded border px-2 py-1" style={{ width: 200, borderColor: 'var(--border)', background: 'var(--input)' }} placeholder="Filter by email" value={abAuditEmail} onChange={(e) => setAbAuditEmail(e.target.value)} />
        <button type="button" className="btn-primary px-3 py-1 text-sm" onClick={() => void refetchAbAudit()}>
          Filter
        </button>
      </div>
      <AuditTable
        rows={abAudit}
        cols={['created_at', 'user_email', 'action', 'scope', 'folder_path', 'entry_name', 'ip_addr', 'details']}
      />
    </div>
  )
}

function StatusGrid({ status }: { status: SystemStatus | undefined }) {
  if (!status) return <p>Loading status…</p>
  const d = status
  return (
    <div className="status-grid mt-3 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
      <StatusCard label="Version" value={`v${d.version}`} />
      <StatusCard label="Active Sessions" value={String(d.sessions.active)} detail={`${d.sessions.pending} pending, ${d.sessions.total_current} total`} />
      <StatusCard label="Users" value={String(d.users.count)} />
      <StatusCard label="Session History" value={d.history.total_sessions.toLocaleString()} />
      <StatusCard label="Recordings" value={String(d.recordings.count)} detail={`${d.recordings.size_mb} MB`} />
      <StatusCard label="Disk Usage" value={`${d.recordings.disk_usage_pct}%`} />
      <StatusCard
        label="Vault"
        value={d.vault.configured ? (d.vault.connected ? 'Connected' : 'Disconnected') : 'Not configured'}
        color={d.vault.connected ? 'var(--accent)' : d.vault.configured ? 'var(--primary)' : 'var(--text-dim)'}
      />
      <div className="status-card rounded border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="label text-xs" style={{ color: 'var(--text-muted)' }}>
          Features
        </div>
        <div className="mt-1 flex flex-wrap gap-1 text-sm">
          <span className={d.features.oidc ? 'feat-on' : 'feat-off'}>OIDC</span>
          <span className={d.features.drive ? 'feat-on' : 'feat-off'}>Drive</span>
          <span className={d.features.tls ? 'feat-on' : 'feat-off'}>TLS</span>
          <span className={d.vault.configured ? 'feat-on' : 'feat-off'}>Vault</span>
        </div>
      </div>
    </div>
  )
}

function StatusCard({ label, value, detail, color }: { label: string; value: string; detail?: string; color?: string }) {
  return (
    <div className="status-card rounded border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="label text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="value text-xl font-bold" style={{ color: color || 'var(--text)' }}>
        {value}
      </div>
      {detail ? <div className="detail text-xs" style={{ color: 'var(--text-dim)' }}>{detail}</div> : null}
    </div>
  )
}

function UserRow({ u, onErr, onRefresh }: { u: OidcUser; onErr: (s: string) => void; onRefresh: () => void }) {
  const [role, setRole] = useState(u.role)
  return (
    <tr className={u.disabled ? 'opacity-60' : ''}>
      <td className="border-b p-2">{u.email}</td>
      <td className="border-b p-2">{u.name}</td>
      <td className="border-b p-2">
        <select
          className="rounded border px-1"
          style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
          value={role}
          onChange={(e) => {
            const r = e.target.value as Role
            setRole(r)
            void setUserRole(u.email, r).catch((er) => onErr(getErrorMessage(er)))
          }}
        >
          {(['viewer', 'operator', 'poweruser', 'admin'] as const).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </td>
      <td className="max-w-[200px] truncate border-b p-2" title={u.oidc_groups}>
        {(u.oidc_groups || '')
          .split(',')
          .filter(Boolean)
          .join(', ')}
      </td>
      <td className="border-b p-2">{u.disabled ? 'disabled' : 'active'}</td>
      <td className="border-b p-2">{u.last_login_at || 'never'}</td>
      <td className="border-b p-2">
        <button
          type="button"
          className="btn-small btn-action mr-1"
          onClick={() => void (u.disabled ? enableUser(u.email) : disableUser(u.email)).then(onRefresh)}
        >
          {u.disabled ? 'enable' : 'disable'}
        </button>
        <button
          type="button"
          className="btn-small btn-action mr-1"
          onClick={() =>
            void forceLogoutUser(u.email).then((d) => {
              if (d.sessions_revoked != null) onErr(`Revoked ${d.sessions_revoked} session(s)`)
            })
          }
        >
          force-logout
        </button>
        <button
          type="button"
          className="btn-small"
          onClick={() => {
            if (!confirm(`Delete user ${u.email}?`)) return
            void deleteUser(u.email).then(onRefresh)
          }}
        >
          delete
        </button>
      </td>
    </tr>
  )
}

function AuditTable({ rows, cols }: { rows: TokenAuditRow[] | AddressbookAuditRow[]; cols: string[] }) {
  if (!rows.length) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events.</p>
  return (
    <table className="w-full border-collapse border text-xs" style={{ borderColor: 'var(--border)' }}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} className="border-b p-2 text-left" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              {c.replace(/_/g, ' ')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c} className="audit-row border-b p-2" style={{ borderColor: 'var(--border)', maxWidth: c === 'details' ? 200 : undefined }} title={String((r as Record<string, unknown>)[c] ?? '')}>
                {String((r as Record<string, unknown>)[c] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
