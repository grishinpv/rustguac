import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { createMyToken, fetchMe, fetchMyTokens, revokeMyToken } from '../api/services'
import { useAuthStore } from '../stores/authStore'
import type { Role } from '../types/api'
import { getErrorMessage } from '../api/client'

export function TokensPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const apiKey = useAuthStore((s) => s.apiKey)
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const { data: tokens = [], refetch } = useQuery({ queryKey: ['my-tokens'], queryFn: fetchMyTokens, enabled: !!me && !apiKey })
  const [name, setName] = useState('')
  const [maxRole, setMaxRole] = useState('')
  const [expires, setExpires] = useState('')
  const [reveal, setReveal] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const level = me ? (me.role === 'admin' ? 4 : me.role === 'poweruser' ? 3 : me.role === 'operator' ? 2 : 1) : 0
  const canSee = level >= 2
  const canCreate = level >= 3

  useEffect(() => {
    if (apiKey) return
    if (me && level < 2) navigate('/connections', { replace: true })
  }, [me, level, navigate, apiKey])

  const createMut = useMutation({
    mutationFn: () => {
      const body: { name: string; max_role?: string; expires_at?: string } = { name: name.trim() }
      if (maxRole) body.max_role = maxRole
      if (expires) body.expires_at = `${expires}T23:59:59Z`
      return createMyToken(body)
    },
    onSuccess: (d) => {
      setReveal(d.token)
      setName('')
      setMaxRole('')
      setExpires('')
      void refetch()
    },
    onError: (e) => setErr(getErrorMessage(e)),
  })

  if (apiKey) {
    return (
      <div className="no-permission rounded border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}>
        API key admins manage user tokens via the Admin page.
      </div>
    )
  }

  if (!me) return <div className="p-8">Loading…</div>

  if (!canSee) {
    return (
      <div className="no-permission rounded border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}>
        Your role does not permit API token management.
      </div>
    )
  }

  const roles: Role[] = ['viewer', 'operator', 'poweruser', 'admin']
  const userLevel = me.role === 'admin' ? 4 : me.role === 'poweruser' ? 3 : me.role === 'operator' ? 2 : 1

  return (
    <div>
      {canCreate ? (
        <section className="mb-8">
          <h2>Create Token</h2>
          <div className="add-form mt-3 flex flex-wrap items-end gap-2">
            <input type="text" placeholder="Token name" className="rounded border px-2 py-2 font-mono" style={{ borderColor: 'var(--border)', background: 'var(--input)' }} value={name} onChange={(e) => setName(e.target.value)} />
            <select className="rounded border px-2 py-2" style={{ borderColor: 'var(--border)', background: 'var(--input)' }} value={maxRole} onChange={(e) => setMaxRole(e.target.value)}>
              <option value="">No role cap</option>
              {roles
                .filter((r) => (r === 'admin' ? 4 : r === 'poweruser' ? 3 : r === 'operator' ? 2 : 1) <= userLevel)
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
            <input type="date" title="Expiry (optional)" className="rounded border px-2 py-2" style={{ borderColor: 'var(--border)', background: 'var(--input)' }} value={expires} onChange={(e) => setExpires(e.target.value)} />
            <button type="button" className="btn-primary" disabled={createMut.isPending} onClick={() => { setErr(''); createMut.mutate() }}>
              Create
            </button>
          </div>
          {reveal ? (
            <div className="token-reveal mt-4 rounded border p-4" style={{ borderColor: 'var(--border)' }}>
              <strong>Token created:</strong> <code className="break-all">{reveal}</code>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-small btn-action" onClick={() => void navigator.clipboard.writeText(reveal)}>
                  copy
                </button>
                <button type="button" className="btn-small" onClick={() => setReveal(null)}>
                  dismiss
                </button>
              </div>
              <div className="warning mt-2 text-sm" style={{ color: 'var(--primary)' }}>
                This token will not be shown again. Copy it now.
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <h2>Your Tokens</h2>
      {err ? <div className="mb-2 text-sm" style={{ color: 'var(--primary)' }}>{err}</div> : null}
      {!tokens.length ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tokens yet.</p> : null}
      {tokens.length ? (
        <table className="mt-3 w-full border-collapse border" style={{ borderColor: 'var(--border)' }}>
          <thead>
            <tr>
              {['Name', 'Max Role', 'Expires', 'Created', 'Last Used', 'Status', ''].map((h) => (
                <th key={h} className="border-b p-3 text-left text-sm uppercase" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => {
              const now = new Date().toISOString()
              const expired = t.expires_at && t.expires_at < now
              return (
                <tr key={t.id} className={t.disabled || expired ? 'opacity-60' : ''}>
                  <td className="border-b p-3">{t.name}</td>
                  <td className="border-b p-3">{t.max_role || 'none'}</td>
                  <td className="border-b p-3">{t.expires_at ? t.expires_at.substring(0, 10) : 'never'}</td>
                  <td className="border-b p-3">{t.created_at ? t.created_at.substring(0, 10) : ''}</td>
                  <td className="border-b p-3">{t.last_used_at || 'never'}</td>
                  <td className="border-b p-3">{t.disabled ? 'disabled' : expired ? 'expired' : 'active'}</td>
                  <td className="border-b p-3">
                    {canCreate ? (
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => {
                          if (!confirm(`Revoke token "${t.name}"?`)) return
                          void revokeMyToken(t.id).then(() => void qc.invalidateQueries({ queryKey: ['my-tokens'] }))
                        }}
                      >
                        revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
