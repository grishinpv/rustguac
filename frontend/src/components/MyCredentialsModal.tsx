import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchCredentialVariables, fetchMyCredentials, saveMyCredentials } from '../api/services'
import { getErrorMessage } from '../api/client'

function suffixOrder(n: string) {
  if (n.endsWith('_username')) return 0
  if (n.endsWith('_password')) return 1
  if (n.endsWith('_domain')) return 2
  if (n.endsWith('_key')) return 3
  return 4
}

export function MyCredentialsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})

  const q = useQuery({
    queryKey: ['my-credentials-modal', open],
    queryFn: async () => {
      const [vars, creds] = await Promise.all([fetchCredentialVariables(), fetchMyCredentials()])
      return { vars, creds }
    },
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setValues({})
      return
    }
    if (!q.data) return
    const saved = q.data.creds.credentials || {}
    const domains = q.data.vars.domains || {}
    const next: Record<string, string> = {}
    for (const d of Object.keys(domains)) {
      for (const v of domains[d] || []) {
        const secret = v.name.endsWith('_password') || v.name.endsWith('_key')
        if (!secret) {
          const disp = saved[v.name]?.display
          if (disp) next[v.name] = disp
        }
      }
    }
    setValues(next)
  }, [open, q.data])

  const mut = useMutation({
    mutationFn: async () => {
      const creds: Record<string, string> = {}
      for (const [k, v] of Object.entries(values)) {
        const t = v.trim()
        if (t) creds[k] = t
      }
      if (Object.keys(creds).length === 0) return
      await saveMyCredentials(creds)
    },
    onSuccess: () => onClose(),
  })

  const domainKeys = useMemo(() => Object.keys(q.data?.vars.domains || {}).sort(), [q.data])

  if (!open) return null

  const err = q.isError ? getErrorMessage(q.error) : mut.isError ? getErrorMessage(mut.error) : ''
  const domains = q.data?.vars.domains || {}
  const saved = q.data?.creds.credentials || {}
  const hasVarDefs = domainKeys.length > 0 || (q.data?.vars.variables && Object.keys(q.data.vars.variables).length > 0)

  return (
    <div
      className="modal-overlay active fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal max-h-[85vh] w-full max-w-lg overflow-y-auto rounded border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h3 className="mt-0">My Credentials</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Values are stored in the vault and applied when you connect to entries that reference credential variables.
        </p>
        {q.isPending ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : null}
        {q.isSuccess && !hasVarDefs ? (
          <p className="empty" style={{ color: 'var(--text-dim)' }}>
            No credential variables are defined for your entries.
          </p>
        ) : null}
        {domainKeys.map((domain) => (
          <div key={domain}>
            <div className="mb-1 mt-3 text-xs font-bold uppercase" style={{ color: 'var(--accent)' }}>
              {domain}
            </div>
            {(domains[domain] || [])
              .slice()
              .sort((a, b) => {
                const oa = suffixOrder(a.name)
                const ob = suffixOrder(b.name)
                return oa !== ob ? oa - ob : a.name.localeCompare(b.name)
              })
              .map((v) => {
                const name = v.name
                const isSecret = name.endsWith('_password') || name.endsWith('_key')
                const sv = saved[name]
                const displayName = name.replace(`${domain}_`, '')
                return (
                  <label key={name} className="mt-2 block text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span>
                      {displayName}
                      <span className="ml-1 text-xs" style={{ color: 'var(--text-dim)' }}>
                        ({v.entry_count} {v.entry_count === 1 ? 'entry' : 'entries'})
                      </span>
                    </span>
                    {name.endsWith('_key') ? (
                      <textarea
                        className="mt-1 block w-full rounded border bg-[var(--input)] px-2 py-2 font-mono text-sm"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        rows={3}
                        placeholder={sv && isSecret ? '(saved — leave blank to keep)' : 'Paste SSH private key'}
                        value={values[name] ?? ''}
                        onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                      />
                    ) : (
                      <input
                        type={isSecret ? 'password' : 'text'}
                        className="mt-1 block w-full rounded border bg-[var(--input)] px-2 py-2 font-mono"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        placeholder={sv && isSecret ? '(saved — leave blank to keep)' : ''}
                        value={values[name] ?? ''}
                        onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                      />
                    )}
                  </label>
                )
              })}
          </div>
        ))}
        {err ? (
          <div className="mt-2 text-sm" style={{ color: 'var(--primary)' }}>
            {err}
          </div>
        ) : null}
        <div className="modal-actions mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            Save
          </button>
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
