import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, SessionInfo } from '../types/api'
import {
  createAdhocSession,
  deleteSession,
  fetchMe,
  fetchSessionsList,
  shadowSession,
} from '../api/services'
import { useAuthStore } from '../stores/authStore'
import { hasRole } from '../lib/roles'
import { getErrorMessage } from '../api/client'

interface Hop {
  hostname: string
  port: number
  username: string
  password: string
  private_key: string
  expanded: boolean
}

const emptyForm = {
  hostname: '',
  port: '22',
  username: '',
  password: '',
  privateKey: '',
  generateKeypair: false,
  rdpHostname: '',
  rdpPort: '3389',
  rdpUsername: '',
  rdpPassword: '',
  rdpDomain: '',
  rdpSecurity: '',
  rdpIgnoreCert: false,
  vncHostname: '',
  vncPort: '5900',
  vncPassword: '',
  url: '',
  vdiImage: '',
  banner: '',
}

export function SessionsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const apiKey = useAuthStore((s) => s.apiKey)
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe })

  useEffect(() => {
    if (!me) return
    if (!apiKey && !hasRole(me.role as Role, 'poweruser')) {
      navigate('/connections', { replace: true })
    }
  }, [me, apiKey, navigate])

  const { data: sessions = [], refetch } = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: () => fetchSessionsList(true),
    refetchInterval: 5000,
  })

  const [sessionType, setSessionType] = useState('ssh')
  const [newOpen, setNewOpen] = useState(false)
  const [hops, setHops] = useState<Hop[]>([])
  const [err, setErr] = useState('')
  const [f, setF] = useState(emptyForm)

  const connectMut = useMutation({
    mutationFn: createAdhocSession,
    onSuccess: (d) => {
      window.open(d.client_url, '_blank')
      setHops([])
      setF(emptyForm)
      void qc.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (e) => setErr(getErrorMessage(e)),
  })

  const buildBody = useMemo(() => {
    return () => {
      const body: Record<string, unknown> = {}
      const hopList = hops
        .filter((h) => h.hostname.trim())
        .map((h) => {
          const o: Record<string, unknown> = {
            hostname: h.hostname.trim(),
            port: h.port || 22,
            username: h.username || '',
          }
          if (h.password) o.password = h.password
          if (h.private_key) o.private_key = h.private_key
          return o
        })
      if (hopList.length) body.jump_hosts = hopList

      if (sessionType === 'vdi') {
        body.session_type = 'vdi'
        body.container_image = f.vdiImage
      } else if (sessionType === 'web') {
        body.session_type = 'web'
        body.url = f.url
      } else if (sessionType === 'vnc') {
        body.session_type = 'vnc'
        body.hostname = f.vncHostname
        body.port = parseInt(f.vncPort, 10) || 5900
        if (f.vncPassword) body.password = f.vncPassword
      } else if (sessionType === 'rdp') {
        body.session_type = 'rdp'
        body.hostname = f.rdpHostname
        body.port = parseInt(f.rdpPort, 10) || 3389
        if (f.rdpUsername) body.username = f.rdpUsername
        if (f.rdpPassword) body.password = f.rdpPassword
        if (f.rdpDomain) body.domain = f.rdpDomain
        if (f.rdpSecurity) body.security = f.rdpSecurity
        if (f.rdpIgnoreCert) body.ignore_cert = true
      } else {
        body.session_type = 'ssh'
        body.hostname = f.hostname
        body.port = parseInt(f.port, 10) || 22
        if (f.username) body.username = f.username
        if (f.generateKeypair) body.generate_keypair = true
        else {
          if (f.password) body.password = f.password
          if (f.privateKey.trim()) body.private_key = f.privateKey.trim()
        }
      }
      if (f.banner.trim()) body.banner = f.banner.trim()
      body.width = window.innerWidth
      body.height = window.innerHeight
      body.dpi = Math.round((window.devicePixelRatio || 1) * 96)
      return body
    }
  }, [f, hops, sessionType])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    connectMut.mutate(buildBody())
  }

  const myName = me?.name || null
  const myRole = (me?.role || 'viewer') as Role

  const active = sessions.filter((s) => s.status === 'active' || s.status === 'pending')
  const activeCount = active.length
  const ownActive = active.filter((s) => myName && s.created_by === myName).length

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="card mb-6 max-w-[480px] rounded border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex cursor-pointer items-center gap-2 text-[var(--accent)]" onClick={() => setNewOpen(!newOpen)}>
          <span>{newOpen ? '\u25BC' : '\u25B6'}</span>
          <strong>New Ad-Hoc Session</strong>
        </div>
        {newOpen ? (
          <div className="mt-3 space-y-3">
            <label className="block text-xs uppercase text-[var(--text-muted)]">
              Type
              <select
                className="mt-1 block w-full rounded border bg-[var(--input)] px-2 py-2 font-mono"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
              >
                <option value="ssh">SSH</option>
                <option value="rdp">RDP</option>
                <option value="vnc">VNC</option>
                <option value="web">Web</option>
                <option value="vdi">VDI (Docker)</option>
              </select>
            </label>
            {sessionType === 'ssh' ? (
              <>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Host
                  <input className="mt-1 block w-full" value={f.hostname} onChange={(e) => setF({ ...f, hostname: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Port
                  <input type="number" className="mt-1 block w-full" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Username (optional)
                  <input className="mt-1 block w-full" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Password (optional)
                  <input
                    type="password"
                    className="mt-1 block w-full"
                    value={f.password}
                    onChange={(e) => setF({ ...f, password: e.target.value })}
                    disabled={f.generateKeypair}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm normal-case">
                  <input type="checkbox" checked={f.generateKeypair} onChange={(e) => setF({ ...f, generateKeypair: e.target.checked })} />
                  Generate ephemeral SSH keypair
                </label>
                {!f.generateKeypair ? (
                  <label className="block text-xs uppercase text-[var(--text-muted)]">
                    Private key (optional)
                    <textarea className="mt-1 block w-full font-mono text-sm" rows={3} value={f.privateKey} onChange={(e) => setF({ ...f, privateKey: e.target.value })} />
                  </label>
                ) : null}
              </>
            ) : null}
            {sessionType === 'rdp' ? (
              <>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Host
                  <input className="mt-1 block w-full" value={f.rdpHostname} onChange={(e) => setF({ ...f, rdpHostname: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Port
                  <input type="number" className="mt-1 block w-full" value={f.rdpPort} onChange={(e) => setF({ ...f, rdpPort: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Username
                  <input className="mt-1 block w-full" value={f.rdpUsername} onChange={(e) => setF({ ...f, rdpUsername: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Password
                  <input type="password" className="mt-1 block w-full" value={f.rdpPassword} onChange={(e) => setF({ ...f, rdpPassword: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Domain (optional)
                  <input className="mt-1 block w-full" value={f.rdpDomain} onChange={(e) => setF({ ...f, rdpDomain: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Security
                  <select className="mt-1 block w-full" value={f.rdpSecurity} onChange={(e) => setF({ ...f, rdpSecurity: e.target.value })}>
                    <option value="">Default</option>
                    <option value="tls">TLS</option>
                    <option value="nla">NLA</option>
                    <option value="rdp">RDP</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm normal-case">
                  <input type="checkbox" checked={f.rdpIgnoreCert} onChange={(e) => setF({ ...f, rdpIgnoreCert: e.target.checked })} />
                  Ignore certificate errors
                </label>
              </>
            ) : null}
            {sessionType === 'vnc' ? (
              <>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Host
                  <input className="mt-1 block w-full" value={f.vncHostname} onChange={(e) => setF({ ...f, vncHostname: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Port
                  <input type="number" className="mt-1 block w-full" value={f.vncPort} onChange={(e) => setF({ ...f, vncPort: e.target.value })} />
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)]">
                  Password (optional)
                  <input type="password" className="mt-1 block w-full" value={f.vncPassword} onChange={(e) => setF({ ...f, vncPassword: e.target.value })} />
                </label>
              </>
            ) : null}
            {sessionType === 'web' ? (
              <label className="block text-xs uppercase text-[var(--text-muted)]">
                URL
                <input className="mt-1 block w-full" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://example.com" />
              </label>
            ) : null}
            {sessionType === 'vdi' ? (
              <label className="block text-xs uppercase text-[var(--text-muted)]">
                Container Image
                <input className="mt-1 block w-full" value={f.vdiImage} onChange={(e) => setF({ ...f, vdiImage: e.target.value })} />
              </label>
            ) : null}

            {sessionType !== 'vdi' ? (
              <div className="border-t border-[var(--border)] pt-3">
                <div className="mb-2 text-[var(--accent)]">SSH Tunnel / Jump Hosts</div>
                {hops.map((h, i) => (
                  <div key={i} className="hop-card mb-2 border border-[var(--border)] bg-[var(--bg)]">
                    <div className="flex items-center gap-2 p-2">
                      <span className="font-bold text-[var(--accent)]">#{i + 1}</span>
                      <input
                        className="min-w-0 flex-1 rounded border bg-[var(--input)] px-2 py-1 font-mono"
                        placeholder="bastion.example.com"
                        value={h.hostname}
                        onChange={(e) => {
                          const n = [...hops]
                          n[i] = { ...h, hostname: e.target.value }
                          setHops(n)
                        }}
                      />
                      <button type="button" className="btn-small text-[var(--primary)]" onClick={() => setHops(hops.filter((_, j) => j !== i))}>
                        remove
                      </button>
                    </div>
                    {h.expanded ? (
                      <div className="border-t border-[var(--border)] p-3 pl-10">
                        <label className="text-xs text-[var(--text-muted)]">
                          Port
                          <input
                            type="number"
                            className="mt-1 block w-full"
                            value={h.port}
                            onChange={(e) => {
                              const n = [...hops]
                              n[i] = { ...h, port: parseInt(e.target.value, 10) || 22 }
                              setHops(n)
                            }}
                          />
                        </label>
                        <label className="mt-2 block text-xs text-[var(--text-muted)]">
                          Username
                          <input
                            className="mt-1 block w-full"
                            value={h.username}
                            onChange={(e) => {
                              const n = [...hops]
                              n[i] = { ...h, username: e.target.value }
                              setHops(n)
                            }}
                          />
                        </label>
                        <label className="mt-2 block text-xs text-[var(--text-muted)]">
                          Password
                          <input
                            type="password"
                            className="mt-1 block w-full"
                            value={h.password}
                            onChange={(e) => {
                              const n = [...hops]
                              n[i] = { ...h, password: e.target.value }
                              setHops(n)
                            }}
                          />
                        </label>
                        <label className="mt-2 block text-xs text-[var(--text-muted)]">
                          Private key
                          <textarea
                            className="mt-1 block w-full font-mono text-sm"
                            rows={2}
                            value={h.private_key}
                            onChange={(e) => {
                              const n = [...hops]
                              n[i] = { ...h, private_key: e.target.value }
                              setHops(n)
                            }}
                          />
                        </label>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="btn-small w-full border-t border-[var(--border)]"
                      onClick={() => {
                        const n = [...hops]
                        n[i] = { ...h, expanded: !h.expanded }
                        setHops(n)
                      }}
                    >
                      {h.expanded ? 'collapse' : 'expand'}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add-hop mt-2 rounded border px-3 py-1 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                  onClick={() =>
                    setHops([...hops, { hostname: '', port: 22, username: '', password: '', private_key: '', expanded: true }])
                  }
                >
                  + Add Jump Host
                </button>
              </div>
            ) : null}

            <label className="block text-xs uppercase text-[var(--text-muted)]">
              Banner message (optional)
              <input className="mt-1 block w-full" value={f.banner} onChange={(e) => setF({ ...f, banner: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary mt-4 h-11 min-w-[140px]" disabled={connectMut.isPending}>
              Connect
            </button>
            {err ? <div className="mt-2 text-[var(--primary)]">{err}</div> : null}
          </div>
        ) : null}
      </form>

      <div>
        <div className="section-head mb-3 flex items-baseline gap-2 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <strong className="text-sm uppercase tracking-widest text-[var(--accent)]">Sessions</strong>
          <span className="text-sm text-[var(--text-muted)]">
            {activeCount === 0
              ? ''
              : myRole === 'admin' && activeCount !== ownActive
                ? `${activeCount} active · ${ownActive} yours`
                : `${activeCount} active`}
          </span>
        </div>
        <table className="w-full border-collapse border border-[var(--border)]">
          <thead>
            <tr>
              {['ID', 'Type', 'Host', 'User', 'Owner', 'Status', 'Viewers', '', ''].map((h) => (
                <th key={h} className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm uppercase tracking-wider text-[var(--text-muted)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <SessionRow key={s.session_id} s={s} myName={myName} myRole={myRole} onRefresh={() => void refetch()} />
            ))}
          </tbody>
        </table>
        {activeCount === 0 ? (
          <p className="empty mt-4 text-[var(--text-dim)]">
            {myRole === 'admin'
              ? 'No active sessions.'
              : 'No active sessions. Use Connections to connect to a saved entry, or the form above to start an ad-hoc session.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SessionRow({
  s,
  myName,
  myRole,
  onRefresh,
}: {
  s: SessionInfo
  myName: string | null
  myRole: Role
  onRefresh: () => void
}) {
  const [shadowBusy, setShadowBusy] = useState(false)
  const shortId = s.session_id.substring(0, 8)
  const hostCol = s.session_type === 'web' ? s.url || '' : s.hostname
  const isActive = s.status === 'active'
  const isOwn = !!(myName && s.created_by === myName)
  const canShadow = isActive && !isOwn && myRole === 'admin'
  const canDelete = isOwn || myRole === 'admin'

  async function onShadow(e: React.MouseEvent) {
    e.preventDefault()
    setShadowBusy(true)
    try {
      const d = await shadowSession(s.session_id)
      if (d.url) window.open(d.url, '_blank')
    } catch {
      /* ignore */
    } finally {
      setShadowBusy(false)
    }
  }

  return (
    <tr className={!isOwn ? 'opacity-90' : ''}>
      <td className="border-b border-[var(--border)] px-4 py-3">
        <a href={s.client_url} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)]">
          {shortId}
        </a>
      </td>
      <td className="border-b border-[var(--border)] px-4 py-3">{s.session_type}</td>
      <td className="border-b border-[var(--border)] px-4 py-3">{hostCol}</td>
      <td className="border-b border-[var(--border)] px-4 py-3">{s.username}</td>
      <td className={`border-b border-[var(--border)] px-4 py-3 ${isOwn ? 'text-[var(--text-muted)]' : 'font-bold text-[var(--accent)]'}`}>{s.created_by || ''}</td>
      <td className={`border-b border-[var(--border)] px-4 py-3 status-${s.status}`}>{s.status}</td>
      <td className="border-b border-[var(--border)] px-4 py-3">{String(s.active_connections)}</td>
      <td className="border-b border-[var(--border)] px-4 py-3">
        {isActive && isOwn ? (
          <a href={s.client_url} target="_blank" rel="noreferrer" className="btn-small">
            open
          </a>
        ) : canShadow ? (
          <a
            href="#"
            className={`text-sm font-bold ${shadowBusy ? 'pointer-events-none opacity-60' : ''}`}
            style={{ color: 'var(--status-pending)' }}
            onClick={onShadow}
          >
            {shadowBusy ? 'minting...' : 'shadow'}
          </a>
        ) : null}
      </td>
      <td className="border-b border-[var(--border)] px-4 py-3">
        {canDelete ? (
          <button
            type="button"
            className="btn-small"
            onClick={() => {
              void deleteSession(s.session_id).then(onRefresh)
            }}
          >
            delete
          </button>
        ) : null}
      </td>
    </tr>
  )
}
