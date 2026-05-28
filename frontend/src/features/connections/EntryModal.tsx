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

function EyeOnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function Pw({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex gap-1.5">
      <input
        type={show ? 'text' : 'password'}
        className="min-w-0 flex-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
      />
      <button
        type="button"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors"
        style={{ borderColor: 'var(--border)', background: 'var(--input)', color: 'var(--text-muted)' }}
        onClick={() => setShow((s) => !s)}
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOffIcon /> : <EyeOnIcon />}
        <span>{show ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  )
}

function Collapse({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="mt-3 overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 border-none px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors hover:brightness-95"
        style={{ background: 'var(--input)', color: 'var(--text-muted)' }}
        onClick={onToggle}
      >
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
          <ChevronRightIcon />
        </span>
        {label}
      </button>
      {open ? (
        <div className="border-t px-3 pb-3 pt-2.5" style={{ borderColor: 'var(--border)' }}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
    </div>
  )
}

const lbl = 'block text-[10px] font-semibold uppercase tracking-wide mb-1'
const lblStyle = { color: 'var(--text-muted)' }

type EntryPanelTab = 'general' | 'connection' | 'session' | 'jump' | 'more'

const ENTRY_PANEL_TABS: { id: EntryPanelTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'connection', label: 'Connection' },
  { id: 'session', label: 'Session' },
  { id: 'jump', label: 'Jump hosts' },
  { id: 'more', label: 'More' },
]

const TYPE_OPTIONS: { value: EntryFormState['type']; label: string }[] = [
  { value: 'ssh', label: 'SSH' },
  { value: 'rdp', label: 'RDP' },
  { value: 'vnc', label: 'VNC' },
  { value: 'web', label: 'Web' },
  { value: 'vdi', label: 'VDI' },
]

function jumpHostsApplicable(type: EntryFormState['type']) {
  return type === 'ssh' || type === 'rdp' || type === 'vnc' || type === 'web'
}

function FlowDiagram({ form, hops }: { form: EntryFormState; hops: HopRow[] }) {
  if (hops.length === 0) return null
  let targetHost = '???'
  let targetPort = ''
  const t = form.type
  if (t === 'ssh') { targetHost = form.hostname || '???'; targetPort = form.port || '22' }
  else if (t === 'rdp') { targetHost = form.rdpHostname || '???'; targetPort = form.rdpPort || '3389' }
  else if (t === 'vnc') { targetHost = form.vncHostname || '???'; targetPort = form.vncPort || '5900' }
  else if (t === 'web') {
    try {
      const u = new URL(form.url)
      targetHost = u.hostname || '???'
      targetPort = u.port || (u.protocol === 'https:' ? '443' : '80')
    } catch { targetHost = '???'; targetPort = '80' }
  }
  const nodes = ['You', ...hops.map((h) => h.hostname || '???'), `${targetHost}:${targetPort}`]
  return (
    <div className="mb-3 rounded-md border p-3" style={{ borderColor: 'var(--border)', background: 'var(--input)' }}>
      <div className="flex flex-wrap items-center gap-1.5">
        {nodes.map((node, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span
              className="rounded border px-2 py-0.5 font-mono text-xs"
              style={{
                background: i === nodes.length - 1 ? 'var(--accent)' : 'var(--surface)',
                color: i === nodes.length - 1 ? '#fff' : 'var(--text)',
                borderColor: i === nodes.length - 1 ? 'var(--accent)' : 'var(--border)',
              }}
            >
              {node}
            </span>
            {i < nodes.length - 1 ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span> : null}
          </span>
        ))}
      </div>
      {t === 'web' && hops.length > 0 ? (
        <p className="mb-0 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          URL rewrites to <code className="rounded px-1 font-mono" style={{ background: 'var(--surface)' }}>127.0.0.1:{'{tunnel_port}'}</code> inside the headless browser. TLS errors expected for HTTPS targets.
        </p>
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
    setEntryName(editTarget.mode === 'clone' ? `${editTarget.entry.name}-copy` : editTarget.entry.name)
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
    if (!jumpHostsApplicable(form.type) && panelTab === 'jump') setPanelTab('connection')
  }, [form.type, panelTab])

  const title = useMemo(() => {
    if (!editTarget) return `New entry in ${selectedFolderPath}`
    if (editTarget.mode === 'clone') return `Clone: ${editTarget.entry.name}`
    return `Edit: ${editTarget.entry.name}`
  }, [editTarget, selectedFolderPath])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const mergedForm: EntryFormState = { ...form, hops: hopRows.map(({ expanded, ...h }) => h) }

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
          await createEntry(targetScope, targetFolder, { name: editTarget.entry.name, ...payload })
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
    if (!hop?.hostname?.trim()) { window.alert('Enter a hostname first.'); return }
    try {
      const d = await probeHostKey(hop.hostname.trim(), hop.port || 22)
      if (window.confirm(`Host key for ${hop.hostname.trim()}:${hop.port || 22}:\n\n${d.fingerprint} (${d.algorithm})\n\nTrust this key?`)) {
        const next = [...hopRows]
        next[i] = { ...next[i]!, host_key: d.host_key, host_key_fingerprint: d.fingerprint }
        setHopRows(next)
      }
    } catch { window.alert('Probe failed.') }
  }

  const f = form
  const set = (patch: Partial<EntryFormState>) => setForm((prev) => ({ ...prev, ...patch }))
  const isEdit = editTarget?.mode === 'edit'

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
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex shrink-0 items-center gap-3 border-b px-5 py-3.5" style={{ borderColor: 'var(--border)' }}>
          <span className={`type-badge type-${f.type} shrink-0`}>{f.type.toUpperCase()}</span>
          <h3 id="entry-panel-title" className="m-0 min-w-0 flex-1 truncate text-sm font-bold">
            {title}
          </h3>
          <button type="button" className="btn-cancel shrink-0" onClick={onClose}>Close</button>
        </header>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <nav
          className="flex shrink-0 border-b"
          style={{ borderColor: 'var(--border)' }}
          role="tablist"
          aria-label="Entry settings sections"
        >
          {ENTRY_PANEL_TABS.map((tab) => {
            const active = panelTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`entry-tab-${tab.id}`}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                className="flex-1 cursor-pointer border-none bg-transparent px-2 py-3 text-xs font-medium transition-colors sm:px-3"
                style={{
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
                onClick={() => setPanelTab(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
          role="tabpanel"
          id="entry-panel-tabpanel"
          aria-labelledby={`entry-tab-${panelTab}`}
        >

          {/* General */}
          {panelTab === 'general' ? (
            <div className="space-y-5">
              <div>
                <label className={lbl} style={lblStyle}>
                  Entry name
                  {isEdit ? <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: 'var(--text-dim)' }}>· locked in edit mode</span> : null}
                </label>
                <input
                  className="block w-full"
                  value={entryName}
                  disabled={isEdit}
                  onChange={(e) => setEntryName(e.target.value)}
                  pattern="[a-zA-Z0-9_.-]+"
                  maxLength={64}
                  placeholder="prod-server-01"
                />
                <p className="mt-1 mb-0 text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Alphanumeric, hyphens, underscores, dots · max 64 chars
                </p>
              </div>

              <div>
                <label className={lbl} style={lblStyle}>
                  Display name <span className="normal-case tracking-normal font-normal" style={{ color: 'var(--text-dim)' }}>(optional)</span>
                </label>
                <input
                  className="block w-full"
                  value={f.displayName}
                  onChange={(e) => set({ displayName: e.target.value })}
                  placeholder={entryName.trim() || 'Shown in lists — defaults to entry name'}
                />
              </div>

              <div>
                <label className={lbl} style={lblStyle}>
                  Connection type
                  {isEdit ? <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: 'var(--text-dim)' }}>· locked in edit mode</span> : null}
                </label>
                <div className={`mt-1 grid grid-cols-5 gap-2 ${isEdit ? 'pointer-events-none' : ''}`}>
                  {TYPE_OPTIONS.map((opt) => {
                    const selected = f.type === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isEdit}
                        onClick={() => set({ type: opt.value })}
                        aria-pressed={selected}
                        className={`type-badge type-${opt.value} cursor-pointer py-2.5 text-xs font-semibold transition-all disabled:cursor-default ${
                          selected ? '' : 'opacity-30 hover:opacity-60'
                        }`}
                        style={selected ? { outline: '2px solid var(--accent)', outlineOffset: '2px' } : undefined}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Connection — SSH */}
          {panelTab === 'connection' && f.type === 'ssh' ? (
            <div className="space-y-5">
              <div>
                <SectionDivider label="Target" />
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className={lbl} style={lblStyle}>Host</span>
                    <input className="block w-full" value={f.hostname} onChange={(e) => set({ hostname: e.target.value })} placeholder="ssh.example.com" />
                  </label>
                  <label className="w-24">
                    <span className={lbl} style={lblStyle}>Port</span>
                    <input type="number" className="block w-full" value={f.port} onChange={(e) => set({ port: e.target.value })} />
                  </label>
                </div>
              </div>
              <div>
                <SectionDivider label="Credentials" />
                <div className="space-y-3">
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Username</span>
                    <input className="block w-full" value={f.username} onChange={(e) => set({ username: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Password</span>
                    <Pw value={f.password} onChange={(password) => set({ password })} />
                  </label>
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Private key (PEM)</span>
                    <textarea className="block w-full font-mono text-sm" rows={3} value={f.privateKey} onChange={(e) => set({ privateKey: e.target.value })} placeholder="-----BEGIN PRIVATE KEY-----" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.sshPromptCreds} onChange={(e) => set({ sshPromptCreds: e.target.checked })} />
                    Prompt for credentials at connect time
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {/* Connection — RDP */}
          {panelTab === 'connection' && f.type === 'rdp' ? (
            <div className="space-y-5">
              <div>
                <SectionDivider label="Target" />
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className={lbl} style={lblStyle}>Host</span>
                    <input className="block w-full" value={f.rdpHostname} onChange={(e) => set({ rdpHostname: e.target.value })} placeholder="rdp.example.com" />
                  </label>
                  <label className="w-24">
                    <span className={lbl} style={lblStyle}>Port</span>
                    <input type="number" className="block w-full" value={f.rdpPort} onChange={(e) => set({ rdpPort: e.target.value })} />
                  </label>
                </div>
              </div>
              <div>
                <SectionDivider label="Credentials" />
                <div className="space-y-3">
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Username</span>
                    <input className="block w-full" value={f.rdpUsername} onChange={(e) => set({ rdpUsername: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Password</span>
                    <Pw value={f.rdpPassword} onChange={(rdpPassword) => set({ rdpPassword })} />
                  </label>
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Domain</span>
                    <input className="block w-full" value={f.rdpDomain} onChange={(e) => set({ rdpDomain: e.target.value })} placeholder="CORP" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.rdpPromptCreds} onChange={(e) => set({ rdpPromptCreds: e.target.checked })} />
                    Prompt for credentials at connect time
                  </label>
                </div>
              </div>
              <div>
                <SectionDivider label="Security" />
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className={lbl} style={lblStyle}>Protocol</span>
                      <select className="block w-full" value={f.rdpSecurity} onChange={(e) => set({ rdpSecurity: e.target.value })}>
                        <option value="">Default</option>
                        <option value="tls">TLS</option>
                        <option value="nla">NLA</option>
                        <option value="rdp">RDP</option>
                      </select>
                    </label>
                    <label className="flex-1">
                      <span className={lbl} style={lblStyle}>NLA Auth Package</span>
                      <select className="block w-full" value={f.rdpAuthPkg} onChange={(e) => set({ rdpAuthPkg: e.target.value })}>
                        <option value="">Server default (NTLM)</option>
                        <option value="ntlm">NTLM</option>
                        <option value="kerberos">Kerberos</option>
                        <option value="negotiate">Negotiate</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.rdpIgnoreCert} onChange={(e) => set({ rdpIgnoreCert: e.target.checked })} />
                    Ignore certificate errors
                  </label>
                  {(f.rdpAuthPkg === 'kerberos' || f.rdpAuthPkg === 'negotiate') ? (
                    <label className="block">
                      <span className={lbl} style={lblStyle}>KDC URL</span>
                      <input className="block w-full" value={f.rdpKdcUrl} onChange={(e) => set({ rdpKdcUrl: e.target.value })} placeholder="kdc.example.com:88" />
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Connection — VNC */}
          {panelTab === 'connection' && f.type === 'vnc' ? (
            <div className="space-y-5">
              <div>
                <SectionDivider label="Target" />
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className={lbl} style={lblStyle}>Host</span>
                    <input className="block w-full" value={f.vncHostname} onChange={(e) => set({ vncHostname: e.target.value })} placeholder="vnc.example.com" />
                  </label>
                  <label className="w-24">
                    <span className={lbl} style={lblStyle}>Port</span>
                    <input type="number" className="block w-full" value={f.vncPort} onChange={(e) => set({ vncPort: e.target.value })} />
                  </label>
                </div>
              </div>
              <div>
                <SectionDivider label="Credentials" />
                <div className="space-y-3">
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Password</span>
                    <Pw value={f.vncPassword} onChange={(vncPassword) => set({ vncPassword })} />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.vncPromptCreds} onChange={(e) => set({ vncPromptCreds: e.target.checked })} />
                    Prompt for credentials at connect time
                  </label>
                </div>
              </div>
              <div>
                <SectionDivider label="Display" />
                <label className="block">
                  <span className={lbl} style={lblStyle}>Color depth</span>
                  <select className="block w-full" value={f.vncColorDepth} onChange={(e) => set({ vncColorDepth: e.target.value })}>
                    <option value="">Default (24-bit)</option>
                    <option value="8">8-bit</option>
                    <option value="16">16-bit</option>
                    <option value="24">24-bit</option>
                    <option value="32">32-bit</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {/* Connection — Web */}
          {panelTab === 'connection' && f.type === 'web' ? (
            <div className="space-y-5">
              <div>
                <SectionDivider label="Target" />
                <div className="space-y-3">
                  <label className="block">
                    <span className={lbl} style={lblStyle}>URL</span>
                    <input className="block w-full" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://app.example.com" />
                  </label>
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Banner <span className="normal-case font-normal tracking-normal" style={{ color: 'var(--text-dim)' }}>(optional)</span></span>
                    <input className="block w-full" value={f.banner} onChange={(e) => set({ banner: e.target.value })} placeholder="Shown on the connection card" />
                  </label>
                </div>
              </div>
              <Collapse label="Automation" open={auto} onToggle={() => setAuto(!auto)}>
                <div className="space-y-3">
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Username</span>
                    <input className="block w-full" value={f.webUsername} onChange={(e) => set({ webUsername: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Password</span>
                    <Pw value={f.webPassword} onChange={(webPassword) => set({ webPassword })} />
                  </label>
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Login script</span>
                    <select className="block w-full" value={f.loginScript} onChange={(e) => set({ loginScript: e.target.value })}>
                      <option value="">(none)</option>
                      {loginScripts.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <Collapse label="Autofill sites" open={autofill} onToggle={() => setAutofill(!autofill)}>
                    {f.autofillRows.length > 0 ? (
                      <div className="mb-1.5 grid grid-cols-[1fr_1fr_1fr_1.5rem] gap-x-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        <span>URL</span><span>Username</span><span>Password</span><span />
                      </div>
                    ) : null}
                    {f.autofillRows.map((row, i) => (
                      <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_1fr_1.5rem] items-center gap-2">
                        <input className="min-w-0" placeholder="URL" value={row.url} onChange={(e) => { const rows = f.autofillRows.slice(); rows[i] = { ...rows[i]!, url: e.target.value }; set({ autofillRows: rows }) }} />
                        <input className="min-w-0" value={row.username} onChange={(e) => { const rows = f.autofillRows.slice(); rows[i] = { ...rows[i]!, username: e.target.value }; set({ autofillRows: rows }) }} />
                        <input className="min-w-0" type="password" value={row.password} onChange={(e) => { const rows = f.autofillRows.slice(); rows[i] = { ...rows[i]!, password: e.target.value }; set({ autofillRows: rows }) }} />
                        <button type="button" className="btn-small btn-danger flex items-center justify-center p-0" onClick={() => set({ autofillRows: f.autofillRows.filter((_, j) => j !== i)})}>×</button>
                      </div>
                    ))}
                    <button type="button" className="btn-add text-sm" onClick={() => set({ autofillRows: [...f.autofillRows, { url: '', username: '$USERNAME', password: '$PASSWORD' }] })}>+ Add site</button>
                  </Collapse>
                  <Collapse label="Allowed domains" open={domainsOpen} onToggle={() => setDomainsOpen(!domainsOpen)}>
                    {f.allowedDomains.map((d, i) => (
                      <div key={i} className="mb-2 flex gap-2">
                        <input className="flex-1" value={d} onChange={(e) => { const next = f.allowedDomains.slice(); next[i] = e.target.value; set({ allowedDomains: next }) }} />
                        <button type="button" className="btn-small btn-danger" onClick={() => set({ allowedDomains: f.allowedDomains.filter((_, j) => j !== i) })}>×</button>
                      </div>
                    ))}
                    <button type="button" className="btn-add mt-1 text-sm" onClick={() => set({ allowedDomains: [...f.allowedDomains, ''] })}>+ Add domain</button>
                  </Collapse>
                </div>
              </Collapse>
            </div>
          ) : null}

          {/* Connection — VDI */}
          {panelTab === 'connection' && f.type === 'vdi' ? (
            <div className="space-y-5">
              <div>
                <SectionDivider label="Container" />
                <div className="space-y-3">
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Image</span>
                    <input className="block w-full" value={f.vdiImage} onChange={(e) => set({ vdiImage: e.target.value })} placeholder="registry/image:tag" />
                  </label>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className={lbl} style={lblStyle}>CPU limit</span>
                      <input type="number" step="0.5" className="block w-full" value={f.vdiCpu} onChange={(e) => set({ vdiCpu: e.target.value })} placeholder="2" />
                    </label>
                    <label className="flex-1">
                      <span className={lbl} style={lblStyle}>Memory (MB)</span>
                      <input type="number" className="block w-full" value={f.vdiMemory} onChange={(e) => set({ vdiMemory: e.target.value })} placeholder="2048" />
                    </label>
                    <label className="w-28">
                      <span className={lbl} style={lblStyle}>Idle (min)</span>
                      <input type="number" className="block w-full" value={f.vdiIdle} onChange={(e) => set({ vdiIdle: e.target.value })} />
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <SectionDivider label="Environment" />
                <label className="block">
                  <span className={lbl} style={lblStyle}>Env variables <span className="normal-case font-normal tracking-normal" style={{ color: 'var(--text-dim)' }}>(KEY=value, one per line)</span></span>
                  <textarea className="block w-full font-mono text-sm" rows={4} value={f.vdiEnv} onChange={(e) => set({ vdiEnv: e.target.value })} placeholder="DATABASE_URL=postgres://..." />
                </label>
              </div>
              <div>
                <SectionDivider label="Display" />
                <label className="block">
                  <span className={lbl} style={lblStyle}>Banner <span className="normal-case font-normal tracking-normal" style={{ color: 'var(--text-dim)' }}>(optional)</span></span>
                  <input className="block w-full" value={f.vdiBanner} onChange={(e) => set({ vdiBanner: e.target.value })} />
                </label>
              </div>
            </div>
          ) : null}

          {/* Session */}
          {panelTab === 'session' ? (
            <div className="space-y-5">
              {f.type === 'rdp' ? (
                <section>
                  <SectionDivider label="RemoteApp (RAIL)" />
                  <div className="space-y-3">
                    <label className="block">
                      <span className={lbl} style={lblStyle}>Remote app</span>
                      <input className="block w-full" value={f.remoteApp} onChange={(e) => set({ remoteApp: e.target.value })} placeholder="||Explorer" />
                    </label>
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <span className={lbl} style={lblStyle}>Working dir</span>
                        <input className="block w-full" value={f.remoteAppDir} onChange={(e) => set({ remoteAppDir: e.target.value })} />
                      </label>
                      <label className="flex-1">
                        <span className={lbl} style={lblStyle}>Args</span>
                        <input className="block w-full" value={f.remoteAppArgs} onChange={(e) => set({ remoteAppArgs: e.target.value })} />
                      </label>
                    </div>
                  </div>
                </section>
              ) : null}

              {(f.type === 'ssh' || f.type === 'rdp') ? (
                <section>
                  <SectionDivider label="File transfer" />
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.enableDrive} onChange={(e) => set({ enableDrive: e.target.checked })} />
                    Enable file transfer
                  </label>
                  {!driveConfigured ? (
                    <p className="mt-1.5 mb-0 text-xs" style={{ color: 'var(--status-pending)' }}>
                      Server has no [drive] section in config — file transfer will not work.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <section>
                <SectionDivider label="Recording" />
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.overrideRecording} onChange={(e) => set({ overrideRecording: e.target.checked })} />
                    Override recording settings
                  </label>
                  {f.overrideRecording ? (
                    <div className="ml-5 space-y-2 border-l-2 pl-3" style={{ borderColor: 'var(--border)' }}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={f.enableRecording} onChange={(e) => set({ enableRecording: e.target.checked })} />
                        Enable recording
                      </label>
                      <label className="block">
                        <span className={lbl} style={lblStyle}>Max recordings</span>
                        <input type="number" className="w-32" value={f.maxRecordings} onChange={(e) => set({ maxRecordings: e.target.value })} />
                      </label>
                    </div>
                  ) : null}
                </div>
              </section>

              {f.type === 'rdp' ? (
                <section>
                  <SectionDivider label="Video performance" />
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.enableGfx} onChange={(e) => set({ enableGfx: e.target.checked })} />
                      Enable Graphics Pipeline (GFX)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.enableDesktopComp} onChange={(e) => set({ enableDesktopComp: e.target.checked })} />
                      Enable Desktop Composition
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.forceLossless} onChange={(e) => set({ forceLossless: e.target.checked })} />
                      Force Lossless
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.enableH264} onChange={(e) => set({ enableH264: e.target.checked })} />
                      H.264 Passthrough
                    </label>
                  </div>
                </section>
              ) : null}

              <section>
                <SectionDivider label="Clipboard" />
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.disableCopy} onChange={(e) => set({ disableCopy: e.target.checked })} />
                    Disable clipboard copy (server → client)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.disablePaste} onChange={(e) => set({ disablePaste: e.target.checked })} />
                    Disable clipboard paste (client → server)
                  </label>
                </div>
              </section>
            </div>
          ) : null}

          {/* Jump hosts */}
          {panelTab === 'jump' ? (
            jumpHostsApplicable(f.type) ? (
              <div className="space-y-3">
                <FlowDiagram form={f} hops={hopRows} />
                {hopRows.map((hop, i) => (
                  <div key={i} className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--input)' }}>
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                      >
                        {i + 1}
                      </span>
                      <input
                        className="min-w-0 flex-1 font-mono text-sm"
                        placeholder="bastion.example.com"
                        value={hop.hostname}
                        onChange={(e) => { const n = hopRows.slice(); n[i] = { ...n[i]!, hostname: e.target.value }; setHopRows(n) }}
                      />
                      <button
                        type="button"
                        className="btn-small px-2"
                        onClick={() => { const n = hopRows.slice(); n[i] = { ...n[i]!, expanded: !n[i]!.expanded }; setHopRows(n) }}
                      >
                        {hop.expanded ? '▲' : '▼'}
                      </button>
                      <button
                        type="button"
                        className="btn-small btn-danger px-2"
                        onClick={() => setHopRows(hopRows.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </div>
                    {hop.expanded ? (
                      <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex gap-2">
                          <label className="w-24">
                            <span className={lbl} style={lblStyle}>Port</span>
                            <input type="number" className="block w-full" value={hop.port} onChange={(e) => { const n = hopRows.slice(); n[i] = { ...n[i]!, port: parseInt(e.target.value, 10) || 22 }; setHopRows(n) }} />
                          </label>
                          <label className="flex-1">
                            <span className={lbl} style={lblStyle}>Username</span>
                            <input className="block w-full" value={hop.username} onChange={(e) => { const n = hopRows.slice(); n[i] = { ...n[i]!, username: e.target.value }; setHopRows(n) }} />
                          </label>
                        </div>
                        <label className="block">
                          <span className={lbl} style={lblStyle}>Password</span>
                          <input type="password" className="block w-full" value={hop.password} onChange={(e) => { const n = hopRows.slice(); n[i] = { ...n[i]!, password: e.target.value }; setHopRows(n) }} />
                        </label>
                        <label className="block">
                          <span className={lbl} style={lblStyle}>Private key (PEM)</span>
                          <textarea className="block w-full font-mono text-sm" rows={2} value={hop.private_key} onChange={(e) => { const n = hopRows.slice(); n[i] = { ...n[i]!, private_key: e.target.value }; setHopRows(n) }} />
                        </label>
                        <div className="flex items-center gap-3">
                          <button type="button" className="btn-small" onClick={() => verifyHop(i)}>
                            {hop.host_key ? 'Re-verify host key' : 'Verify host key'}
                          </button>
                          <span className="font-mono text-xs" style={{ color: hop.host_key ? 'var(--accent)' : 'var(--text-dim)' }}>
                            {hop.host_key_fingerprint || (hop.host_key ? 'pinned' : 'not pinned')}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add w-full"
                  onClick={() => setHopRows([...hopRows, { hostname: '', port: 22, username: '', password: '', private_key: '', expanded: true }])}
                >
                  + Add Jump Host
                </button>
              </div>
            ) : (
              <div className="rounded-md border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Jump hosts apply to SSH, RDP, VNC, and Web entries.
                <br />
                VDI sessions connect directly to a container.
              </div>
            )
          ) : null}

          {/* More */}
          {panelTab === 'more' ? (
            <div className="space-y-5">
              <section>
                <SectionDivider label="Session sharing" />
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" className="mt-0.5 shrink-0" checked={f.allowSharing} onChange={(e) => set({ allowSharing: e.target.checked })} />
                  <span>
                    Allow read-only session sharing
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>Share link shown on active session cards</span>
                  </span>
                </label>
              </section>

              <section>
                <SectionDivider label="Behavior" />
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" className="mt-0.5 shrink-0" checked={f.autoOpenSingleton} onChange={(e) => set({ autoOpenSingleton: e.target.checked })} />
                  <span>
                    Auto-open if singleton
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>Automatically connects when this is the only visible entry</span>
                  </span>
                </label>
              </section>

              {editTarget?.mode === 'edit' ? (
                <section>
                  <SectionDivider label="Move entry" />
                  <label className="block">
                    <span className={lbl} style={lblStyle}>Target folder</span>
                    <select className="block w-full" value={moveKey} onChange={(e) => setMoveKey(e.target.value)}>
                      <option value="">(do not move)</option>
                      {moveFolderOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </label>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="shrink-0 border-t px-5 py-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {err ? (
            <div
              className="mb-3 rounded-md border-l-4 px-3 py-2.5 text-sm"
              style={{
                borderLeftColor: 'var(--status-error)',
                background: 'color-mix(in srgb, var(--status-error) 8%, var(--surface))',
                color: 'var(--status-error)',
                border: '1px solid color-mix(in srgb, var(--status-error) 30%, transparent)',
                borderLeftWidth: '4px',
              }}
            >
              {err}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void onSave()}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create entry'}
            </button>
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
