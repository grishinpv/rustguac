import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AddressBookEntry, JumpHost } from '../../types/api'
import {
  createEntry,
  deleteEntry,
  probeHostKey,
  updateEntry,
} from '@/services'
import { buildEntryPayload, defaultEntryForm, populateFormFromEntry, type EntryFormState } from './entryForm'

type HopRow = JumpHost & { expanded: boolean }

function Pw({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-wrap flex gap-1">
      <input type={show ? 'text' : 'password'} className="min-w-0 flex-1" value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="btn-small flex-shrink-0 px-2" onClick={() => setShow(!show)} title="Show/hide">
        {show ? '\u25CB' : '\u25CF'}
      </button>
    </div>
  )
}

function Collapse({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
      <button type="button" className="w-full cursor-pointer border-none bg-transparent p-0 text-left font-bold" style={{ color: 'var(--accent)' }} onClick={onToggle}>
        <span>{open ? '\u25BC' : '\u25B6'}</span> {label}
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}

type EntryPanelTab = 'general' | 'connection' | 'session' | 'jump' | 'more'

const ENTRY_PANEL_TABS: { id: EntryPanelTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'connection', label: 'Connection' },
  { id: 'session', label: 'Session' },
  { id: 'jump', label: 'Jump hosts' },
  { id: 'more', label: 'More' },
]

function jumpHostsApplicable(type: EntryFormState['type']) {
  return type === 'ssh' || type === 'rdp' || type === 'vnc' || type === 'web'
}

function flowDiagram(form: EntryFormState, hops: HopRow[]) {
  if (hops.length === 0) return null
  let targetHost = '???'
  let targetPort = ''
  const t = form.type
  if (t === 'ssh') {
    targetHost = form.hostname || '???'
    targetPort = form.port || '22'
  } else if (t === 'rdp') {
    targetHost = form.rdpHostname || '???'
    targetPort = form.rdpPort || '3389'
  } else if (t === 'vnc') {
    targetHost = form.vncHostname || '???'
    targetPort = form.vncPort || '5900'
  } else if (t === 'web') {
    try {
      const u = new URL(form.url)
      targetHost = u.hostname || '???'
      targetPort = u.port || (u.protocol === 'https:' ? '443' : '80')
    } catch {
      targetHost = '???'
      targetPort = '80'
    }
  }
  const parts = ['You', ...hops.map((h) => h.hostname || '???'), `${targetHost}:${targetPort} ${t.toUpperCase()}`]
  return (
    <div className="mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
      {parts.join(' \u2192 ')}
      {t === 'web' && hops.length > 0 ? (
        <div className="mt-1 text-xs" style={{ color: 'var(--primary)' }}>
          Note: The URL will be rewritten to 127.0.0.1:{'{tunnel_port}'} inside the headless browser. TLS certificate errors are expected if the target uses HTTPS.
        </div>
      ) : null}
    </div>
  )
}

export interface EntryModalProps {
  open: boolean
  onClose: () => void
  driveConfigured: boolean
  loginScripts: string[]
  selectedScope: string
  selectedFolderPath: string
  editTarget: null | { mode: 'edit' | 'clone'; scope: string; folder: string; entry: AddressBookEntry }
  moveFolderOptions: { key: string; label: string }[]
  onSaved: () => void
}

export function EntryModal({
  open,
  onClose,
  driveConfigured,
  loginScripts,
  selectedScope,
  selectedFolderPath,
  editTarget,
  moveFolderOptions,
  onSaved,
}: EntryModalProps) {
  const [form, setForm] = useState<EntryFormState>(() => defaultEntryForm())
  const [entryName, setEntryName] = useState('')
  const [moveKey, setMoveKey] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [hopRows, setHopRows] = useState<HopRow[]>([])

  const [auto, setAuto] = useState(false)
  const [autofill, setAutofill] = useState(false)
  const [domainsOpen, setDomainsOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<EntryPanelTab>('general')

  useEffect(() => {
    if (!open) return
    setPanelTab('general')
    setErr('')
    setMoveKey('')
    if (!editTarget) {
      setForm(defaultEntryForm())
      setEntryName('')
      setHopRows([])
      return
    }
    const base = populateFormFromEntry(defaultEntryForm(), editTarget.entry)
    setForm(base)
    if (editTarget.mode === 'clone') {
      setEntryName(`${editTarget.entry.name}-copy`)
    } else {
      setEntryName(editTarget.entry.name)
    }
    setHopRows(
      (editTarget.entry.jump_hosts || []).map((h) => ({
        hostname: h.hostname || '',
        port: h.port || 22,
        username: h.username || '',
        password: '',
        private_key: h.private_key || '',
        host_key: h.host_key,
        host_key_fingerprint: h.host_key_fingerprint,
        expanded: true,
      })),
    )
  }, [open, editTarget])

  useEffect(() => {
    if (!jumpHostsApplicable(form.type) && panelTab === 'jump') {
      setPanelTab('connection')
    }
  }, [form.type, panelTab])

  const title = useMemo(() => {
    if (!editTarget) return `New Entry in ${selectedFolderPath}`
    if (editTarget.mode === 'clone') return `Clone: ${editTarget.entry.name}`
    return `Edit: ${editTarget.entry.name}`
  }, [editTarget, selectedFolderPath])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const mergedForm: EntryFormState = {
    ...form,
    hops: hopRows.map(({ expanded, ...h }) => h),
  }

  async function onSave() {
    setErr('')
    const name = entryName.trim()
    if (!name || !/^[a-zA-Z0-9_.-]+$/.test(name)) {
      setErr('Name must be alphanumeric, hyphens, underscores, dots only (max 64).')
      return
    }
    const payload = buildEntryPayload(mergedForm, driveConfigured)
    setSaving(true)
    try {
      if (!editTarget || editTarget.mode === 'clone') {
        await createEntry(selectedScope, selectedFolderPath, { name, ...payload })
      } else {
        await updateEntry(editTarget.scope, editTarget.folder, editTarget.entry.name, payload)
        if (moveKey) {
          const sep = moveKey.indexOf('|')
          const targetScope = sep >= 0 ? moveKey.slice(0, sep) : moveKey
          const targetFolder = sep >= 0 ? moveKey.slice(sep + 1) : ''
          const body: Record<string, unknown> = { name: editTarget.entry.name, ...payload }
          await createEntry(targetScope, targetFolder, body)
          await deleteEntry(editTarget.scope, editTarget.folder, editTarget.entry.name)
        }
      }
      onSaved()
      onClose()
    } catch (e) {
      setErr(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function verifyHop(i: number) {
    const hop = hopRows[i]
    if (!hop?.hostname?.trim()) {
      window.alert('Enter a hostname first.')
      return
    }
    try {
      const d = await probeHostKey(hop.hostname.trim(), hop.port || 22)
      const msg = `Host key for ${hop.hostname.trim()}:${hop.port || 22}:\n\n${d.fingerprint} (${d.algorithm})\n\nTrust this key?`
      if (window.confirm(msg)) {
        const next = [...hopRows]
        next[i] = { ...next[i]!, host_key: d.host_key, host_key_fingerprint: d.fingerprint }
        setHopRows(next)
      }
    } catch {
      window.alert('Probe failed.')
    }
  }

  const f = form
  const set = (patch: Partial<EntryFormState>) => setForm((prev) => ({ ...prev, ...patch }))

  return (
    <div className="fixed inset-0 z-[90] flex justify-end" data-entry-sheet role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden onMouseDown={onClose} />
      <aside
        className="rustguac-entry-panel relative z-10 flex h-full w-full max-w-[min(100vw,680px)] flex-col border-l shadow-[0_0_40px_rgba(0,0,0,0.18)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-panel-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <h3 id="entry-panel-title" className="m-0 pr-2 text-base font-bold">
            {title}
          </h3>
          <button type="button" className="btn-cancel shrink-0" onClick={onClose}>
            Close
          </button>
        </header>
        <nav
          className="entry-panel-tablist flex shrink-0 flex-wrap gap-1 border-b px-3 py-2"
          style={{ borderColor: 'var(--border)' }}
          role="tablist"
          aria-label="Entry settings sections"
        >
          {ENTRY_PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`entry-tab-${tab.id}`}
              aria-selected={panelTab === tab.id}
              tabIndex={panelTab === tab.id ? 0 : -1}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                panelTab === tab.id
                  ? 'border-[var(--border)] bg-[var(--input)] text-[var(--text)]'
                  : 'border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--input)] hover:text-[var(--text)]'
              }`}
              onClick={() => setPanelTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
          role="tabpanel"
          id="entry-panel-tabpanel"
          aria-labelledby={`entry-tab-${panelTab}`}
        >
          {panelTab === 'general' ? (
            <div className="space-y-2">
              <label className="mt-0 block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                Entry name
                <input
                  className="mt-1 block w-full"
                  value={entryName}
                  disabled={!!editTarget && editTarget.mode === 'edit'}
                  onChange={(e) => setEntryName(e.target.value)}
                  pattern="[a-zA-Z0-9_.-]+"
                  maxLength={64}
                />
              </label>
              <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                Display name (optional)
                <input
                  className="mt-1 block w-full"
                  value={f.displayName}
                  onChange={(e) => set({ displayName: e.target.value })}
                  placeholder={entryName.trim() || 'Shown in lists; defaults to entry name'}
                />
              </label>
              {editTarget?.mode === 'edit' ? (
                <p className="m-0 text-xs" style={{ color: 'var(--text-dim)' }}>
                  You can change how this entry appears without renaming its technical entry name.
                </p>
              ) : null}
              <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                Type
                <select
                  className="mt-1 block w-full"
                  value={f.type}
                  disabled={!!editTarget && editTarget.mode === 'edit'}
                  onChange={(e) => set({ type: e.target.value as EntryFormState['type'] })}
                >
                  <option value="ssh">SSH</option>
                  <option value="rdp">RDP</option>
                  <option value="vnc">VNC</option>
                  <option value="web">Web</option>
                  <option value="vdi">VDI</option>
                </select>
              </label>
            </div>
          ) : null}

          {panelTab === 'connection' && f.type === 'ssh' ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Host
              <input className="mt-1 block w-full" value={f.hostname} onChange={(e) => set({ hostname: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Port
              <input type="number" className="mt-1 block w-full" value={f.port} onChange={(e) => set({ port: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Username
              <input className="mt-1 block w-full" value={f.username} onChange={(e) => set({ username: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Password
              <div className="mt-1">
                <Pw value={f.password} onChange={(password) => set({ password })} />
              </div>
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Private key
              <textarea className="mt-1 block w-full font-mono text-sm" rows={3} value={f.privateKey} onChange={(e) => set({ privateKey: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.sshPromptCreds} onChange={(e) => set({ sshPromptCreds: e.target.checked })} /> Prompt for credentials at connect time
            </label>
          </div>
        ) : null}

          {panelTab === 'connection' && f.type === 'rdp' ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Host
              <input className="mt-1 block w-full" value={f.rdpHostname} onChange={(e) => set({ rdpHostname: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Port
              <input type="number" className="mt-1 block w-full" value={f.rdpPort} onChange={(e) => set({ rdpPort: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Username
              <input className="mt-1 block w-full" value={f.rdpUsername} onChange={(e) => set({ rdpUsername: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Password
              <div className="mt-1">
                <Pw value={f.rdpPassword} onChange={(rdpPassword) => set({ rdpPassword })} />
              </div>
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Domain
              <input className="mt-1 block w-full" value={f.rdpDomain} onChange={(e) => set({ rdpDomain: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Security
              <select className="mt-1 block w-full" value={f.rdpSecurity} onChange={(e) => set({ rdpSecurity: e.target.value })}>
                <option value="">Default</option>
                <option value="tls">TLS</option>
                <option value="nla">NLA</option>
                <option value="rdp">RDP</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.rdpIgnoreCert} onChange={(e) => set({ rdpIgnoreCert: e.target.checked })} /> Ignore certificate errors
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              NLA Auth Package
              <select className="mt-1 block w-full" value={f.rdpAuthPkg} onChange={(e) => set({ rdpAuthPkg: e.target.value })}>
                <option value="">Server default (NTLM)</option>
                <option value="ntlm">NTLM</option>
                <option value="kerberos">Kerberos</option>
                <option value="negotiate">Negotiate (Kerberos first, NTLM fallback)</option>
              </select>
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              KDC URL (Kerberos only)
              <input className="mt-1 block w-full" value={f.rdpKdcUrl} onChange={(e) => set({ rdpKdcUrl: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.rdpPromptCreds} onChange={(e) => set({ rdpPromptCreds: e.target.checked })} /> Prompt for credentials at connect time
            </label>
          </div>
        ) : null}

          {panelTab === 'connection' && f.type === 'vnc' ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Host
              <input className="mt-1 block w-full" value={f.vncHostname} onChange={(e) => set({ vncHostname: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Port
              <input type="number" className="mt-1 block w-full" value={f.vncPort} onChange={(e) => set({ vncPort: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Password
              <div className="mt-1">
                <Pw value={f.vncPassword} onChange={(vncPassword) => set({ vncPassword })} />
              </div>
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Color depth
              <select className="mt-1 block w-full" value={f.vncColorDepth} onChange={(e) => set({ vncColorDepth: e.target.value })}>
                <option value="">Default (24-bit)</option>
                <option value="8">8-bit</option>
                <option value="16">16-bit</option>
                <option value="24">24-bit</option>
                <option value="32">32-bit</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.vncPromptCreds} onChange={(e) => set({ vncPromptCreds: e.target.checked })} /> Prompt for credentials at connect time
            </label>
          </div>
        ) : null}

          {panelTab === 'connection' && f.type === 'web' ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              URL
              <input className="mt-1 block w-full" value={f.url} onChange={(e) => set({ url: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Banner
              <input className="mt-1 block w-full" value={f.banner} onChange={(e) => set({ banner: e.target.value })} />
            </label>
            <Collapse label="Automation" open={auto} onToggle={() => setAuto(!auto)}>
              <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                Username (substitution / login script)
                <input className="mt-1 block w-full" value={f.webUsername} onChange={(e) => set({ webUsername: e.target.value })} />
              </label>
              <label className="mt-2 block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                Password
                <div className="mt-1">
                  <Pw value={f.webPassword} onChange={(webPassword) => set({ webPassword })} />
                </div>
              </label>
              <label className="mt-2 block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                Login script
                <select className="mt-1 block w-full" value={f.loginScript} onChange={(e) => set({ loginScript: e.target.value })}>
                  <option value="">(none)</option>
                  {loginScripts.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <Collapse label="Autofill" open={autofill} onToggle={() => setAutofill(!autofill)}>
                {f.autofillRows.map((row, i) => (
                  <div key={i} className="mb-2 flex flex-wrap gap-2 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                    <input className="min-w-[120px] flex-1" placeholder="URL" value={row.url} onChange={(e) => {
                      const rows = f.autofillRows.slice()
                      rows[i] = { ...rows[i]!, url: e.target.value }
                      set({ autofillRows: rows })
                    }} />
                    <input className="min-w-[100px] flex-1" value={row.username} onChange={(e) => {
                      const rows = f.autofillRows.slice()
                      rows[i] = { ...rows[i]!, username: e.target.value }
                      set({ autofillRows: rows })
                    }} />
                    <input className="min-w-[100px] flex-1" type="password" value={row.password} onChange={(e) => {
                      const rows = f.autofillRows.slice()
                      rows[i] = { ...rows[i]!, password: e.target.value }
                      set({ autofillRows: rows })
                    }} />
                    <button type="button" className="btn-small" onClick={() => set({ autofillRows: f.autofillRows.filter((_, j) => j !== i) })}>
                      remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-add text-sm" onClick={() => set({ autofillRows: [...f.autofillRows, { url: '', username: '$USERNAME', password: '$PASSWORD' }] })}>
                  + Add site
                </button>
              </Collapse>
              <Collapse label="Allowed Domains" open={domainsOpen} onToggle={() => setDomainsOpen(!domainsOpen)}>
                {f.allowedDomains.map((d, i) => (
                  <div key={i} className="mb-1 flex gap-2">
                    <input className="flex-1" value={d} onChange={(e) => {
                      const next = f.allowedDomains.slice()
                      next[i] = e.target.value
                      set({ allowedDomains: next })
                    }} />
                    <button type="button" className="btn-small" onClick={() => set({ allowedDomains: f.allowedDomains.filter((_, j) => j !== i) })}>
                      remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-add mt-1 text-sm" onClick={() => set({ allowedDomains: [...f.allowedDomains, ''] })}>
                  + Add domain
                </button>
              </Collapse>
            </Collapse>
          </div>
        ) : null}

          {panelTab === 'connection' && f.type === 'vdi' ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Container image
              <input className="mt-1 block w-full" value={f.vdiImage} onChange={(e) => set({ vdiImage: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              CPU limit
              <input type="number" step="0.5" className="mt-1 block w-full" value={f.vdiCpu} onChange={(e) => set({ vdiCpu: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Memory (MB)
              <input type="number" className="mt-1 block w-full" value={f.vdiMemory} onChange={(e) => set({ vdiMemory: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Env (KEY=value per line)
              <textarea className="mt-1 block w-full font-mono text-sm" rows={3} value={f.vdiEnv} onChange={(e) => set({ vdiEnv: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Idle timeout (minutes)
              <input type="number" className="mt-1 block w-full" value={f.vdiIdle} onChange={(e) => set({ vdiIdle: e.target.value })} />
            </label>
            <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              Banner
              <input className="mt-1 block w-full" value={f.vdiBanner} onChange={(e) => set({ vdiBanner: e.target.value })} />
            </label>
          </div>
        ) : null}

          {panelTab === 'session' ? (
            <div className="space-y-4">
              {f.type === 'rdp' ? (
                <div className="space-y-2 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="m-0 text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                    RemoteApp (RAIL)
                  </p>
                  <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                    Remote app
                    <input className="mt-1 block w-full" value={f.remoteApp} onChange={(e) => set({ remoteApp: e.target.value })} />
                  </label>
                  <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                    Working dir
                    <input className="mt-1 block w-full" value={f.remoteAppDir} onChange={(e) => set({ remoteAppDir: e.target.value })} />
                  </label>
                  <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                    Args
                    <input className="mt-1 block w-full" value={f.remoteAppArgs} onChange={(e) => set({ remoteAppArgs: e.target.value })} />
                  </label>
                </div>
              ) : null}

              {f.type === 'ssh' || f.type === 'rdp' ? (
                <div className="space-y-2 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="m-0 text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                    File transfer
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.enableDrive} onChange={(e) => set({ enableDrive: e.target.checked })} /> Enable file transfer
                  </label>
                  {!driveConfigured ? (
                    <div className="text-xs" style={{ color: 'var(--primary)' }}>
                      Server has no [drive] section in config — file transfer will not work.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                <p className="m-0 text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                  Recording
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.overrideRecording} onChange={(e) => set({ overrideRecording: e.target.checked })} /> Override recording settings
                </label>
                {f.overrideRecording ? (
                  <div className="ml-1 space-y-2 sm:ml-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.enableRecording} onChange={(e) => set({ enableRecording: e.target.checked })} /> Enable recording
                    </label>
                    <label className="block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                      Max recordings
                      <input type="number" className="mt-1 w-32" value={f.maxRecordings} onChange={(e) => set({ maxRecordings: e.target.value })} />
                    </label>
                  </div>
                ) : null}
              </div>

              {f.type === 'rdp' ? (
                <div className="space-y-2 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="m-0 text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                    Video performance
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.enableGfx} onChange={(e) => set({ enableGfx: e.target.checked })} /> Enable Graphics Pipeline (GFX)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.enableDesktopComp} onChange={(e) => set({ enableDesktopComp: e.target.checked })} /> Enable Desktop Composition
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.forceLossless} onChange={(e) => set({ forceLossless: e.target.checked })} /> Force Lossless
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.enableH264} onChange={(e) => set({ enableH264: e.target.checked })} /> H.264 Passthrough
                  </label>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="m-0 text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                  Clipboard
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.disableCopy} onChange={(e) => set({ disableCopy: e.target.checked })} /> Disable clipboard copy (server → client)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.disablePaste} onChange={(e) => set({ disablePaste: e.target.checked })} /> Disable clipboard paste (client → server)
                </label>
              </div>
            </div>
          ) : null}

          {panelTab === 'jump' ? (
            jumpHostsApplicable(f.type) ? (
              <div className="space-y-2">
                {flowDiagram(f, hopRows)}
                {hopRows.map((hop, i) => (
                  <div key={i} className="mb-2 border p-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>
                        #{i + 1}
                      </span>
                      <input
                        className="min-w-0 flex-1 font-mono"
                        placeholder="bastion.example.com"
                        value={hop.hostname}
                        onChange={(e) => {
                          const n = hopRows.slice()
                          n[i] = { ...n[i]!, hostname: e.target.value }
                          setHopRows(n)
                        }}
                      />
                      <button type="button" className="btn-small" onClick={() => setHopRows(hopRows.filter((_, j) => j !== i))}>
                        remove
                      </button>
                    </div>
                    {hop.expanded ? (
                      <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                        <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                          Port
                          <input
                            type="number"
                            className="mt-1 block w-full"
                            value={hop.port}
                            onChange={(e) => {
                              const n = hopRows.slice()
                              n[i] = { ...n[i]!, port: parseInt(e.target.value, 10) || 22 }
                              setHopRows(n)
                            }}
                          />
                        </label>
                        <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                          Username
                          <input
                            className="mt-1 block w-full"
                            value={hop.username}
                            onChange={(e) => {
                              const n = hopRows.slice()
                              n[i] = { ...n[i]!, username: e.target.value }
                              setHopRows(n)
                            }}
                          />
                        </label>
                        <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                          Password
                          <input
                            type="password"
                            className="mt-1 block w-full"
                            value={hop.password}
                            onChange={(e) => {
                              const n = hopRows.slice()
                              n[i] = { ...n[i]!, password: e.target.value }
                              setHopRows(n)
                            }}
                          />
                        </label>
                        <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                          Private key
                          <textarea
                            className="mt-1 block w-full font-mono text-sm"
                            rows={2}
                            value={hop.private_key}
                            onChange={(e) => {
                              const n = hopRows.slice()
                              n[i] = { ...n[i]!, private_key: e.target.value }
                              setHopRows(n)
                            }}
                          />
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" className="btn-small" onClick={() => verifyHop(i)}>
                            {hop.host_key ? 'Re-verify' : 'Verify Host Key'}
                          </button>
                          <span className="text-xs" style={{ color: hop.host_key ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {hop.host_key_fingerprint || (hop.host_key ? 'pinned' : 'not pinned')}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="btn-small mt-1 w-full border-t pt-1"
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => {
                        const n = hopRows.slice()
                        n[i] = { ...n[i]!, expanded: !n[i]!.expanded }
                        setHopRows(n)
                      }}
                    >
                      {hop.expanded ? 'collapse' : 'expand'}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add mt-2"
                  onClick={() =>
                    setHopRows([...hopRows, { hostname: '', port: 22, username: '', password: '', private_key: '', expanded: true }])
                  }
                >
                  + Add Jump Host
                </button>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Jump hosts apply to SSH, RDP, VNC, and Web entries. VDI sessions connect directly to a container.
              </p>
            )
          ) : null}

          {panelTab === 'more' ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.allowSharing} onChange={(e) => set({ allowSharing: e.target.checked })} /> Allow read-only session sharing (Share link on active cards)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.autoOpenSingleton} onChange={(e) => set({ autoOpenSingleton: e.target.checked })} /> Auto-open if this is my only visible entry
              </label>
              {editTarget && editTarget.mode === 'edit' ? (
                <label className="mt-1 block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                  Move to folder (optional)
                  <select className="mt-1 block w-full" value={moveKey} onChange={(e) => setMoveKey(e.target.value)}>
                    <option value="">(do not move)</option>
                    {moveFolderOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t px-5 py-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {err ? (
            <div className="mb-3 text-sm" style={{ color: 'var(--primary)' }}>
              {err}
            </div>
          ) : null}
          <div className="modal-actions flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void onSave()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
