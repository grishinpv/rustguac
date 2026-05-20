import './connectionsPage.css'
import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import type { AddressBookEntry, AddressBookFolder, Role } from '../../types/api'
import {
  connectEntryResult,
  deleteEntry,
  deleteFolder,
  fetchAddressBook,
  fetchAuthStatus,
  fetchEntries,
  fetchFolderConfig,
  fetchLoginScripts,
  fetchMe,
  fetchSearchIndex,
  fetchSubfolders,
} from '../../services/services'
import { MyCredentialsModal } from '../../components/MyCredentialsModal'
import { EntryModal, type EntryModalProps } from '../../features/connections/EntryModal'
import { FolderModal, type FolderEditState } from '../../features/connections/FolderModal'
import { OnboardingModal, shouldAutoOpenOnboarding } from '../../features/connections/OnboardingModal'
const EXPANDED_KEY = 'rustguac_connections_expanded'
const SELECTED_KEY = 'rustguac_connections_selected'

export interface TreeFolder {
  name: string
  scope: string
  description: string
  path: string
  has_children: boolean
}

function folderKey(scope: string, path: string) {
  return `${scope}|${path}`
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function ConnectionsPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const { data: auth } = useQuery({ queryKey: ['auth-status'], queryFn: fetchAuthStatus })

  const driveConfigured = !!auth?.drive_configured

  const [vaultBlock, setVaultBlock] = useState<'none' | 'no-vault' | 'unavailable'>('none')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => loadJson(EXPANDED_KEY, {}))
  const [subcache, setSubcache] = useState<Record<string, TreeFolder[]>>({})
  const [selected, setSelected] = useState<TreeFolder | null>(null)
  const [folderEntries, setFolderEntries] = useState<Record<string, AddressBookEntry[]>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [entries, setEntries] = useState<AddressBookEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [globalErr, setGlobalErr] = useState('')

  const [searchQ, setSearchQ] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [myCredsOpen, setMyCredsOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [entryModal, setEntryModal] = useState<EntryModalProps['editTarget']>(null)
  const [entryOpen, setEntryOpen] = useState(false)
  const [folderModal, setFolderModal] = useState<
    null | { kind: 'create' | 'subfolder' | 'edit'; edit?: FolderEditState; parent?: { scope: string; path: string } }
  >(null)

  const [cred, setCred] = useState<null | { scope: string; folder: string; entry: AddressBookEntry }>(null)
  const [credUser, setCredUser] = useState('')
  const [credPass, setCredPass] = useState('')
  const [credDomain, setCredDomain] = useState('')
  const [credErr, setCredErr] = useState('')

  /** Right-click / ⋯ menu for a folder in the tree (admin). */
  const [folderMenu, setFolderMenu] = useState<null | { folder: TreeFolder; left: number; top: number }>(null)
  const folderMenuRef = useRef<HTMLDivElement>(null)
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState<TreeFolder | null>(null)

  const isAdmin = me?.role === 'admin'

  const abQuery = useQuery({
    queryKey: ['addressbook'],
    queryFn: fetchAddressBook,
    retry: false,
    enabled: !!me?.vault_enabled,
  })

  const searchIdx = useQuery({
    queryKey: ['search-index'],
    queryFn: fetchSearchIndex,
    enabled: !!me?.vault_enabled && abQuery.isSuccess,
  })

  const loginScriptsQ = useQuery({
    queryKey: ['login-scripts'],
    queryFn: fetchLoginScripts,
    enabled: entryOpen,
  })

  const topFolders: TreeFolder[] = useMemo(() => {
    const folders = abQuery.data?.folders || []
    return folders.map((f: AddressBookFolder) => ({
      name: f.name,
      scope: f.scope,
      description: f.description || '',
      path: f.path || f.name,
      has_children: !!f.has_children,
    }))
  }, [abQuery.data])

  useEffect(() => {
    if (!me) return
    if (!me.vault_enabled) {
      if (me.vault_configured) {
        setVaultBlock('unavailable')
        const t = window.setTimeout(() => {
          void qc.invalidateQueries({ queryKey: ['me'] })
        }, 15000)
        return () => clearTimeout(t)
      }
      setVaultBlock('no-vault')
      return
    }
    setVaultBlock('none')
  }, [me, qc])

  useEffect(() => {
    if (!me?.vault_enabled) return
    const err = abQuery.error as AxiosError | undefined
    const st = err?.response?.status
    if (abQuery.isError && st === 503) {
      setVaultBlock('unavailable')
      const t = window.setTimeout(() => {
        void abQuery.refetch()
      }, 15000)
      return () => clearTimeout(t)
    }
    if (abQuery.isError && st !== 503) {
      setGlobalErr('Failed to load folders.')
    }
  }, [me?.vault_enabled, abQuery.isError, abQuery.error, abQuery.refetch])

  useEffect(() => {
    if (!abQuery.isSuccess || !me?.vault_enabled) return
    setVaultBlock('none')
    const folders = abQuery.data?.folders || []
    const fe: Record<string, AddressBookEntry[]> = {}
    const cn: Record<string, number> = {}
    for (const f of folders) {
      const path = f.path || f.name
      const key = folderKey(f.scope, path)
      fe[key] = f.entries || []
      cn[key] = (f.entries || []).length
    }
    setFolderEntries((prev) => ({ ...prev, ...fe }))
    setCounts((prev) => ({ ...prev, ...cn }))
    setSelected((prev) => {
      if (prev) return prev
      if (!folders.length) return null
      const saved = loadJson<{ scope: string; path: string } | null>(SELECTED_KEY, null)
      const mapped: TreeFolder[] = folders.map((f: AddressBookFolder) => ({
        name: f.name,
        scope: f.scope,
        description: f.description || '',
        path: f.path || f.name,
        has_children: !!f.has_children,
      }))
      const fromSaved = saved ? mapped.find((x) => x.scope === saved.scope && x.path === saved.path) : null
      return fromSaved || mapped[0] || null
    })
    const feOnly: Record<string, AddressBookEntry[]> = {}
    for (const f of folders) {
      const path = f.path || f.name
      feOnly[folderKey(f.scope, path)] = f.entries || []
    }
    maybeAutoOpenSingleton(feOnly)
  }, [abQuery.isSuccess, abQuery.data, me?.vault_enabled])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q === null) return
    setSearchQ(q)
    setSearchActive(!!q.trim())
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const tour = searchParams.get('tour')
    const cred = searchParams.get('credentials')
    if (cred === '1') {
      setMyCredsOpen(true)
      searchParams.delete('credentials')
      setSearchParams(searchParams, { replace: true })
    }
    if (tour === '1') {
      localStorage.removeItem('rustguac_onboarding_dismissed')
      setOnboardOpen(true)
      searchParams.delete('tour')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!me || vaultBlock !== 'none' || !abQuery.isSuccess) return
    if (shouldAutoOpenOnboarding()) setOnboardOpen(true)
  }, [me, vaultBlock, abQuery.isSuccess])

  const loadEntriesFor = useCallback(
    async (folder: TreeFolder, force: boolean, cache?: Record<string, AddressBookEntry[]>) => {
      const key = folderKey(folder.scope, folder.path)
      const c = cache || folderEntries
      if (!force && c[key]) {
        setEntries(c[key] || [])
        return
      }
      setEntriesLoading(true)
      try {
        const list = await fetchEntries(folder.scope, folder.path)
        setFolderEntries((prev) => ({ ...prev, [key]: list }))
        setCounts((prev) => ({ ...prev, [key]: list.length }))
        setEntries(list)
      } catch (e) {
        setGlobalErr(String(e))
      } finally {
        setEntriesLoading(false)
      }
    },
    [folderEntries],
  )

  useEffect(() => {
    if (selected) {
      saveJson(SELECTED_KEY, { scope: selected.scope, path: selected.path })
      void loadEntriesFor(selected, false)
    }
  }, [selected?.scope, selected?.path, loadEntriesFor])

  function findFolder(scope: string, path: string): TreeFolder | null {
    const hit = topFolders.find((f) => f.scope === scope && f.path === path)
    if (hit) return hit
    for (const k of Object.keys(subcache)) {
      const arr = subcache[k]
      const f = arr?.find((x) => x.scope === scope && x.path === path)
      if (f) return f
    }
    return null
  }

  async function ensureSubfolders(scope: string, path: string) {
    const key = folderKey(scope, path)
    if (subcache[key]) return
    try {
      const data = await fetchSubfolders(scope, path)
      const mapped: TreeFolder[] = (data || []).map((sf) => ({
        name: sf.name,
        scope: sf.scope,
        description: sf.description || '',
        path: sf.path || `${path}/${sf.name}`,
        has_children: !!sf.has_children,
      }))
      setSubcache((prev) => ({ ...prev, [key]: mapped }))
    } catch {
      setSubcache((prev) => ({ ...prev, [key]: [] }))
    }
  }

  function toggleExpand(f: TreeFolder) {
    const key = folderKey(f.scope, f.path)
    const willExpand = !expanded[key]
    const next = { ...expanded, [key]: willExpand }
    setExpanded(next)
    saveJson(EXPANDED_KEY, next)
    if (willExpand) void ensureSubfolders(f.scope, f.path)
  }

  useEffect(() => {
    const keys = Object.keys(expanded).filter((k) => expanded[k])
    keys.sort((a, b) => (a.split('|')[1] || '').split('/').length - (b.split('|')[1] || '').split('/').length)
    let cancelled = false
    ;(async () => {
      for (const key of keys) {
        if (cancelled) return
        const sep = key.indexOf('|')
        if (sep < 0) continue
        const scope = key.slice(0, sep)
        const path = key.slice(sep + 1)
        if (!findFolder(scope, path)) {
          const next = { ...expanded }
          delete next[key]
          setExpanded(next)
          saveJson(EXPANDED_KEY, next)
          continue
        }
        await ensureSubfolders(scope, path)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [expanded, topFolders])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = document.activeElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (
        document.querySelector('.modal-overlay') ||
        document.querySelector('[data-entry-sheet]') ||
        document.querySelector('[data-folder-ctx-menu]')
      )
        return
      e.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!folderDeleteConfirm) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFolderDeleteConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [folderDeleteConfirm])

  useEffect(() => {
    if (!folderMenu) return
    function onDocMouseDown(e: MouseEvent) {
      const el = folderMenuRef.current
      if (el && el.contains(e.target as Node)) return
      setFolderMenu(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFolderMenu(null)
    }
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocMouseDown, true)
      document.addEventListener('keydown', onKey, true)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDocMouseDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [folderMenu])

  function openFolderMenuAt(f: TreeFolder, clientX: number, clientY: number) {
    const mw = 220
    const mh = 200
    const left = Math.max(8, Math.min(clientX, window.innerWidth - mw - 8))
    const top = Math.max(8, Math.min(clientY, window.innerHeight - mh - 8))
    setFolderMenu({ folder: f, left, top })
  }

  async function openEditFolderModal(f: TreeFolder) {
    setFolderMenu(null)
    try {
      const cfg = await fetchFolderConfig(f.scope, f.path)
      setFolderModal({
        kind: 'edit',
        edit: {
          scope: f.scope,
          folderPath: f.path,
          description: f.description,
          allowed_groups: cfg.allowed_groups || [],
          inherit_from_parent: !!cfg.inherit_from_parent,
        },
      })
    } catch (e) {
      setGlobalErr(String(e))
    }
  }

  function requestFolderDelete(f: TreeFolder) {
    setFolderMenu(null)
    setFolderDeleteConfirm(f)
  }

  async function confirmFolderDelete() {
    const f = folderDeleteConfirm
    if (!f) return
    setFolderDeleteConfirm(null)
    try {
      await deleteFolder(f.scope, f.path)
      if (selected?.scope === f.scope && selected?.path === f.path) setSelected(null)
      void abQuery.refetch()
    } catch (e) {
      setGlobalErr(String(e))
    }
  }

  function openNewEntryForFolder(f: TreeFolder) {
    setFolderMenu(null)
    setSelected(f)
    setEntryModal(null)
    setEntryOpen(true)
  }

  function maybeAutoOpenSingleton(cache: Record<string, AddressBookEntry[]>) {
    try {
      if (sessionStorage.getItem('rustguac_auto_opened') === '1') return
    } catch {
      return
    }
    const all: { key: string; entry: AddressBookEntry }[] = []
    for (const [key, list] of Object.entries(cache)) {
      for (const entry of list) all.push({ key, entry })
    }
    if (all.length !== 1) return
    const hit = all[0]!
    if (!hit.entry.auto_open_if_singleton) return
    const sep = hit.key.indexOf('|')
    if (sep < 0) return
    const scope = hit.key.slice(0, sep)
    const path = hit.key.slice(sep + 1)
    void (async () => {
      const res = await connectEntryResult(scope, path, hit.entry.name, {
        width: window.innerWidth,
        height: window.innerHeight,
        dpi: Math.round((window.devicePixelRatio || 1) * 96),
      })
      if (res.ok && res.data.session_id) {
        try {
          sessionStorage.setItem('rustguac_auto_opened', '1')
        } catch {
          /* ignore */
        }
        const label = encodeURIComponent(hit.entry.display_name || hit.entry.name)
        window.location.href = `/client/${res.data.session_id}?name=${label}`
      }
    })()
  }

  async function doConnect(scope: string, folder: string, entry: AddressBookEntry, extra?: Record<string, unknown>) {
    const body: Record<string, unknown> = {
      width: window.innerWidth,
      height: window.innerHeight,
      dpi: Math.round((window.devicePixelRatio || 1) * 96),
      ...extra,
    }
    const res = await connectEntryResult(scope, folder, entry.name, body)
    if (res.ok) {
      const url = `${res.data.client_url}?name=${encodeURIComponent(entry.name)}`
      window.open(url, '_blank')
      return
    }
    if (res.status === 412 && 'missing_variables' in res) {
      setGlobalErr(`Missing credentials: ${res.missing_variables.join(', ')}. Set them in My Credentials (Settings).`)
      setMyCredsOpen(true)
      return
    }
    setGlobalErr('message' in res ? res.message : 'Connect failed')
  }

  function onConnectClick(entry: AddressBookEntry, scope: string, folder: string) {
    setGlobalErr('')
    const needsPrompt = (entry.prompt_credentials || !entry.has_credentials) && entry.session_type !== 'web' && entry.session_type !== 'vdi'
    if (needsPrompt) {
      setCred({ scope, folder, entry })
      setCredUser(entry.username || '')
      setCredPass('')
      setCredDomain(entry.domain || '')
      setCredErr('')
    } else {
      void doConnect(scope, folder, entry)
    }
  }

  function renderFolderRow(f: TreeFolder, depth: number, showScope: boolean) {
    const key = folderKey(f.scope, f.path)
    const isSel = selected?.scope === f.scope && selected?.path === f.path
    const isEx = !!expanded[key]
    const kids = subcache[key]
    return (
      <li key={key} data-scope={f.scope} data-path={f.path} className={isSel ? 'selected' : ''}>
        <div
          className="folder-row"
          onClick={() => setSelected(f)}
          onContextMenu={
            isAdmin
              ? (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openFolderMenuAt(f, e.clientX, e.clientY)
                }
              : undefined
          }
        >
          <span
            className={`tree-chevron ${f.has_children ? '' : 'leaf'} ${isEx ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (f.has_children) toggleExpand(f)
            }}
          >
            {f.has_children ? (isEx ? '\u25BE' : '\u25B8') : '\u25B8'}
          </span>
          <div className="folder-row-main">
            <div className="folder-name-row">
              <span>{f.name}</span>
              {showScope ? (
                <span
                  className="folder-scope"
                  data-scope={f.scope}
                  title={f.scope === 'shared' ? 'Shared — visible across all rustguac instances' : 'Instance — this server only'}
                />
              ) : null}
            </div>
            {counts[key] !== undefined ? <span className="folder-count">{counts[key]} entries</span> : null}
            {f.description ? <span className="folder-desc">{f.description}</span> : null}
          </div>
          {isAdmin ? (
            <div className="folder-row-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="entry-action-btn entry-action-btn--edit entry-action-btn--compact"
                title="Edit folder"
                aria-label={`Edit folder ${f.path}`}
                onClick={() => void openEditFolderModal(f)}
              >
                <Pencil className="entry-action-icon" aria-hidden />
              </button>
              <button
                type="button"
                className="entry-action-btn entry-action-btn--more entry-action-btn--compact"
                title="Folder actions"
                aria-label="Open folder menu"
                aria-haspopup="menu"
                aria-expanded={folderMenu?.folder.scope === f.scope && folderMenu?.folder.path === f.path}
                onClick={(e) => {
                  e.stopPropagation()
                  const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                  openFolderMenuAt(f, r.left, r.bottom + 4)
                }}
              >
                <MoreHorizontal className="entry-action-icon" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
        {f.has_children && isEx ? (
          <ul className="tree-children">
            {!kids ? (
              <li style={{ color: 'var(--text-dim)', padding: '0.3em 0.5em', cursor: 'default' }}>Loading…</li>
            ) : kids.length === 0 ? (
              <li style={{ color: 'var(--text-dim)', padding: '0.3em 0.5em', cursor: 'default', fontSize: '0.85em' }}>(empty)</li>
            ) : (
              kids.map((ch) => renderFolderRow(ch, depth + 1, false))
            )}
          </ul>
        ) : null}
      </li>
    )
  }

  const moveOptions = useMemo(() => {
    const out: { key: string; label: string }[] = []
    function walk(list: TreeFolder[], prefix: string) {
      for (const f of list) {
        const label = `${prefix}${f.scope}: ${f.path}`
        out.push({ key: folderKey(f.scope, f.path), label })
        const k = folderKey(f.scope, f.path)
        const kids = subcache[k]
        if (kids?.length) walk(kids, prefix + '  ')
      }
    }
    walk(topFolders, '')
    return out
  }, [topFolders, subcache])

  const filteredSearch = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q || !searchIdx.data?.entries) return []
    const tokens = q.split(/\s+/).filter(Boolean)
    type Row = { scope: string; folderPath: string; entry: AddressBookEntry; label: string; host: string; hay: string }
    const rows: Row[] = searchIdx.data.entries.map((r) => {
      const e = r.entry
      const label = e.display_name || e.name
      const hostBase =
        e.session_type === 'web' ? e.url || '' : e.session_type === 'vdi' ? e.container_image || '' : e.hostname || ''
      const host =
        e.port && e.session_type !== 'web' && e.session_type !== 'vdi' ? `${hostBase}:${e.port}` : hostBase
      const hay = [label, e.name, host, r.folder_path, e.session_type, e.username].join(' ').toLowerCase()
      return { scope: r.scope, folderPath: r.folder_path, entry: e, label, host, hay }
    })
    const matches: { row: Row; score: number }[] = []
    const first = tokens[0] || ''
    for (const row of rows) {
      if (!tokens.every((t) => row.hay.includes(t))) continue
      let score = 0
      const lcLabel = row.label.toLowerCase()
      const lcName = row.entry.name.toLowerCase()
      if (lcLabel.startsWith(first) || lcName.startsWith(first)) score += 100
      else if (lcLabel.includes(first) || lcName.includes(first)) score += 50
      if ((row.host || '').toLowerCase().includes(first)) score += 20
      if (row.folderPath.toLowerCase().includes(first)) score += 10
      matches.push({ row, score })
    }
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.row.folderPath !== b.row.folderPath) return a.row.folderPath.localeCompare(b.row.folderPath)
      return a.row.label.localeCompare(b.row.label)
    })
    return matches
  }, [searchQ, searchIdx.data])

  if (!me) return <div className="p-8">Loading…</div>

  if (vaultBlock === 'no-vault') {
    return (
      <div className="no-vault rounded border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        Connections is not configured. A Vault/OpenBao backend is required.
        <br />
        <a href="/docs" className="text-[var(--accent)]">
          Docs
        </a>
      </div>
    )
  }

  if (vaultBlock === 'unavailable') {
    return (
      <div className="no-vault rounded border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <strong>Connections is temporarily unavailable.</strong>
        <br />
        Cannot reach the Vault server. Retrying…
      </div>
    )
  }

  return (
    <div>
      <div id="global-error" className="mb-3 text-sm font-bold" style={{ color: 'var(--primary)' }}>
        {globalErr}
      </div>

      {topFolders.length === 0 && isAdmin ? (
        <div className="empty-state mb-8 rounded border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h3 className="mt-0">No folders yet</h3>
          <p style={{ color: 'var(--text-muted)' }}>Create a folder to start organising connection entries.</p>
          <button type="button" className="btn-connect mt-4" onClick={() => setFolderModal({ kind: 'create' })}>
            Create First Folder
          </button>
        </div>
      ) : (
        <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <strong>Folders</strong>
            {isAdmin ? (
              <button
                type="button"
                className="btn-add text-sm"
                title="Create a top-level folder"
                onClick={() => setFolderModal({ kind: 'create' })}
              >
                + root folder
              </button>
            ) : null}
          </div>
          <input
            ref={searchInputRef}
            id="connections-search"
            type="search"
            className="mb-3 w-full rounded border px-2 py-2 font-mono"
            style={{ borderColor: 'var(--border)', background: 'var(--input)', color: 'var(--text)' }}
            placeholder="Quick find…"
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value)
              setSearchActive(!!e.target.value.trim())
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (searchQ) {
                  setSearchQ('')
                  setSearchActive(false)
                } else (e.target as HTMLInputElement).blur()
                e.stopPropagation()
              }
            }}
          />
          <ul className="folder-list">{topFolders.map((f) => renderFolderRow(f, 0, true))}</ul>
        </aside>
        <main className="main">
          {selected ? (
            <>
              <div className="folder-actions">
                <strong>{selected.path}</strong>
                {selected.description ? <span className="desc">{selected.description}</span> : null}
                <span className="flex-1" />
                {isAdmin ? (
                  <button
                    type="button"
                    className="btn-add"
                    onClick={() => {
                      setEntryModal(null)
                      setEntryOpen(true)
                    }}
                  >
                    + entry
                  </button>
                ) : null}
              </div>
              {entriesLoading ? <p className="empty">Loading…</p> : null}
              {!entriesLoading ? (
                <EntriesTable
                  admin={isAdmin}
                  searchActive={searchActive}
                  matches={filteredSearch}
                  entries={entries}
                  scope={selected.scope}
                  folder={selected.path}
                  searchQ={searchQ}
                  onEmptyAdd={() => {
                    setEntryModal(null)
                    setEntryOpen(true)
                  }}
                  onConnect={onConnectClick}
                  onDelete={(name, sc, fo) => {
                    void deleteEntry(sc, fo, name).then(() => {
                      void abQuery.refetch()
                      void searchIdx.refetch()
                      if (selected && selected.scope === sc && selected.path === fo) void loadEntriesFor(selected, true)
                    })
                  }}
                  onEdit={(e, sc, fo) => {
                    setEntryModal({ mode: 'edit', scope: sc, folder: fo, entry: e })
                    setEntryOpen(true)
                  }}
                  onClone={(e, sc, fo) => {
                    setEntryModal({ mode: 'clone', scope: sc, folder: fo, entry: e })
                    setEntryOpen(true)
                  }}
                  onOpenFolder={(scope, path) => {
                    setSearchQ('')
                    setSearchActive(false)
                    const f = findFolder(scope, path)
                    if (f) setSelected(f)
                  }}
                />
              ) : null}
            </>
          ) : (
            <p className="empty" style={{ color: 'var(--text-dim)' }}>
              Select a folder.
            </p>
          )}
        </main>
      </div>
      )}

      {folderMenu && isAdmin ? (
        <div
          ref={folderMenuRef}
          data-folder-ctx-menu
          className="folder-ctx-menu fixed z-[85] min-w-[210px] rounded border py-1 shadow-lg"
          style={{
            left: folderMenu.left,
            top: folderMenu.top,
            background: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="folder-ctx-menu-label border-b px-3 py-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {folderMenu.folder.path}
          </div>
          <button
            type="button"
            className="folder-ctx-menu-item"
            role="menuitem"
            onClick={() => {
              const f = folderMenu.folder
              setFolderMenu(null)
              setFolderModal({ kind: 'subfolder', parent: { scope: f.scope, path: f.path } })
            }}
          >
            New subfolder
          </button>
          <button
            type="button"
            className="folder-ctx-menu-item"
            role="menuitem"
            onClick={() => void openEditFolderModal(folderMenu.folder)}
          >
            Edit folder…
          </button>
          <button
            type="button"
            className="folder-ctx-menu-item folder-ctx-menu-item-danger"
            role="menuitem"
            onClick={() => requestFolderDelete(folderMenu.folder)}
          >
            Remove folder…
          </button>
          <button
            type="button"
            className="folder-ctx-menu-item border-t"
            style={{ borderColor: 'var(--border)' }}
            role="menuitem"
            onClick={() => openNewEntryForFolder(folderMenu.folder)}
          >
            New entry…
          </button>
        </div>
      ) : null}

      {folderDeleteConfirm ? (
        <div
          className="modal-overlay active fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="folder-delete-title"
          onMouseDown={(e) => e.target === e.currentTarget && setFolderDeleteConfirm(null)}
        >
          <div className="modal w-full max-w-md rounded border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 id="folder-delete-title" className="mt-0">
              Remove folder?
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <strong className="font-mono text-[var(--text)]">{folderDeleteConfirm.path}</strong>
              {folderDeleteConfirm.has_children ? (
                <>
                  {' '}
                  and <strong>all subfolders</strong> will be removed permanently, along with every connection entry they contain.
                </>
              ) : (
                <> All connection entries in this folder will be removed permanently.</>
              )}
            </p>
            <div className="modal-actions mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-cancel" onClick={() => setFolderDeleteConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="btn-danger-solid" onClick={() => void confirmFolderDelete()}>
                Remove folder
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MyCredentialsModal open={myCredsOpen} onClose={() => setMyCredsOpen(false)} />
      <OnboardingModal open={onboardOpen} onClose={() => setOnboardOpen(false)} role={(me.role || 'viewer') as Role} />
      <EntryModal
        open={entryOpen}
        onClose={() => {
          setEntryOpen(false)
          setEntryModal(null)
        }}
        driveConfigured={driveConfigured}
        loginScripts={loginScriptsQ.data || []}
        selectedScope={selected?.scope || ''}
        selectedFolderPath={selected?.path || ''}
        editTarget={entryModal}
        moveFolderOptions={moveOptions.filter((o) => selected && o.key !== folderKey(selected.scope, selected.path))}
        onSaved={() => {
          void abQuery.refetch()
          if (selected) void loadEntriesFor(selected, true)
          void searchIdx.refetch()
        }}
      />
      {folderModal ? (
        <FolderModal
          open
          onClose={() => setFolderModal(null)}
          variant={
            folderModal.kind === 'create'
              ? { kind: 'create', defaultScope: 'shared' }
              : folderModal.kind === 'subfolder' && folderModal.parent
                ? { kind: 'subfolder', parentScope: folderModal.parent.scope, parentPath: folderModal.parent.path }
                : folderModal.kind === 'edit' && folderModal.edit
                  ? { kind: 'edit', folder: folderModal.edit }
                  : { kind: 'create', defaultScope: 'shared' }
          }
          onSaved={() => {
            void abQuery.refetch()
            void searchIdx.refetch()
            setFolderModal(null)
          }}
        />
      ) : null}

      {cred ? (
        <div
          className="modal-overlay active fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setCred(null)}
        >
          <div className="modal w-full max-w-md rounded border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="mt-0">Credentials for {cred.entry.display_name || cred.entry.name}</h3>
            {cred.entry.session_type !== 'vnc' ? (
              <label className="mt-2 block text-sm">
                Username
                <input className="mt-1 block w-full" autoComplete="username" value={credUser} onChange={(e) => setCredUser(e.target.value)} />
              </label>
            ) : null}
            <label className="mt-2 block text-sm">
              Password
              <input
                type="password"
                className="mt-1 block w-full"
                autoComplete="current-password"
                value={credPass}
                onChange={(e) => setCredPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('cred-go')?.click()}
              />
            </label>
            {cred.entry.session_type === 'rdp' ? (
              <label className="mt-2 block text-sm">
                Domain
                <input className="mt-1 block w-full" value={credDomain} onChange={(e) => setCredDomain(e.target.value)} />
              </label>
            ) : null}
            {credErr ? (
              <div className="mt-2 text-sm" style={{ color: 'var(--primary)' }}>
                {credErr}
              </div>
            ) : null}
            <div className="modal-actions mt-4 flex gap-2">
              <button
                type="button"
                id="cred-go"
                className="btn-connect"
                onClick={() => {
                  if (!credPass.trim()) {
                    setCredErr('Password is required.')
                    return
                  }
                  const body: Record<string, unknown> = { password: credPass }
                  const u = credUser.trim()
                  if (u) body.username = u
                  const d = credDomain.trim()
                  if (d) body.domain = d
                  const { scope, folder, entry } = cred
                  setCred(null)
                  void doConnect(scope, folder, entry, body)
                }}
              >
                Connect
              </button>
              <button type="button" className="btn-cancel" onClick={() => setCred(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EntryRowAdminActions({
  entryName,
  onEdit,
  onClone,
  onDelete,
}: {
  entryName: string
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
}) {
  return (
    <div className="entry-actions" role="group" aria-label="Entry actions">
      <button type="button" className="entry-action-btn entry-action-btn--edit" title="Edit entry" aria-label={`Edit entry ${entryName}`} onClick={onEdit}>
        <Pencil className="entry-action-icon" aria-hidden />
      </button>
      <button type="button" className="entry-action-btn entry-action-btn--clone" title="Clone entry" aria-label={`Clone entry ${entryName}`} onClick={onClone}>
        <Copy className="entry-action-icon" aria-hidden />
      </button>
      <button
        type="button"
        className="entry-action-btn entry-action-btn--delete"
        title="Delete entry"
        aria-label={`Delete entry ${entryName}`}
        onClick={onDelete}
      >
        <Trash2 className="entry-action-icon" aria-hidden />
      </button>
    </div>
  )
}

function EntriesTable({
  admin,
  searchActive,
  matches,
  entries,
  scope,
  folder,
  searchQ,
  onEmptyAdd,
  onConnect,
  onDelete,
  onEdit,
  onClone,
  onOpenFolder,
}: {
  admin: boolean
  searchActive: boolean
  matches: { row: { scope: string; folderPath: string; entry: AddressBookEntry; label: string; host: string }; score: number }[]
  entries: AddressBookEntry[]
  scope: string
  folder: string
  searchQ: string
  onEmptyAdd: () => void
  onConnect: (e: AddressBookEntry, scope: string, folder: string) => void
  onDelete: (name: string, scope: string, folder: string) => void
  onEdit: (e: AddressBookEntry, scope: string, folder: string) => void
  onClone: (e: AddressBookEntry, scope: string, folder: string) => void
  onOpenFolder: (scope: string, path: string) => void
}) {
  if (searchActive) {
    const max = 50
    const shown = matches.slice(0, max)
    const more = matches.length - max
    if (!shown.length) {
      return (
        <div className="empty-state p-8">
          <p style={{ color: 'var(--text-dim)' }}>No matches for {searchQ}</p>
        </div>
      )
    }
    return (
      <>
        <table className="entries-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Host</th>
              <th>User</th>
              <th>Folder</th>
              <th>Connect</th>
              <th />
              {admin ? <th>Manage</th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ row: r }) => {
              const e = r.entry
              const needsPrompt =
                (e.prompt_credentials || !e.has_credentials) && e.session_type !== 'web' && e.session_type !== 'vdi'
              const label = needsPrompt ? 'Login…' : 'Connect'
              return (
                <tr key={`${r.scope}/${r.folderPath}/${e.name}`}>
                  <td>{r.label}</td>
                  <td>
                    <span className={`type-badge type-${e.session_type}`}>{e.session_type.toUpperCase()}</span>
                  </td>
                  <td>{r.host}</td>
                  <td>{e.username || ''}</td>
                  <td>
                    <span className="search-folder-cell">
                      {r.scope === 'shared' ? '⊕' : '▣'} {r.folderPath}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn-connect" onClick={() => onConnect(e, r.scope, r.folderPath)}>
                      {label}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="search-open-folder text-[var(--accent)]" onClick={() => onOpenFolder(r.scope, r.folderPath)}>
                      ↗ open folder
                    </button>
                  </td>
                  {admin ? (
                    <td>
                      <EntryRowAdminActions
                        entryName={e.name}
                        onEdit={() => onEdit(e, r.scope, r.folderPath)}
                        onClone={() => onClone(e, r.scope, r.folderPath)}
                        onDelete={() => {
                          if (!confirm(`Delete entry "${e.name}"?`)) return
                          onDelete(e.name, r.scope, r.folderPath)
                        }}
                      />
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
        {more > 0 ? (
          <div className="search-more mt-2 text-sm" style={{ color: 'var(--text-dim)' }}>
            +{more} more matches — refine your search
          </div>
        ) : null}
      </>
    )
  }

  if (!entries.length) {
    return admin ? (
      <div className="empty-state p-8">
        <p style={{ color: 'var(--text-muted)' }}>No entries in this folder.</p>
        <button type="button" className="btn-add mt-2" onClick={onEmptyAdd}>
          + Add First Entry
        </button>
      </div>
    ) : (
      <p className="empty">No entries in this folder.</p>
    )
  }

  return (
    <table className="entries-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Host</th>
          <th>User</th>
          <th>Connect</th>
          {admin ? <th>Manage</th> : null}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const label = e.display_name || e.name
          const hostBase = e.session_type === 'web' ? e.url || '' : e.session_type === 'vdi' ? e.container_image || '' : e.hostname || ''
          let host = hostBase
          if (e.port && e.session_type !== 'web' && e.session_type !== 'vdi') host += `:${e.port}`
          const hops = e.jump_hosts?.length
            ? ` via ${e.jump_hosts.map((h) => h.hostname).join(' \u2192 ')}`
            : ''
          const needsPrompt =
            (e.prompt_credentials || !e.has_credentials) && e.session_type !== 'web' && e.session_type !== 'vdi'
          const connectLabel = needsPrompt ? 'Login…' : 'Connect'
          return (
            <tr key={e.name}>
              <td>{label}</td>
              <td>
                <span className={`type-badge type-${e.session_type}`}>
                  {e.session_type.toUpperCase()}
                  {e.auth_pkg ? <span className="text-xs text-[#888]"> ({e.auth_pkg})</span> : null}
                </span>
              </td>
              <td>
                {host}
                {hops ? <span className="text-xs text-[#888]">{hops}</span> : null}
              </td>
              <td>
                {e.username || ''}
                {needsPrompt ? <span className="text-xs text-[#888]"> [prompt]</span> : null}
              </td>
              <td>
                <button type="button" className="btn-connect" onClick={() => onConnect(e, scope, folder)}>
                  {connectLabel}
                </button>
              </td>
              {admin ? (
                <td>
                  <EntryRowAdminActions
                    entryName={e.name}
                    onEdit={() => onEdit(e, scope, folder)}
                    onClone={() => onClone(e, scope, folder)}
                    onDelete={() => {
                      if (!confirm(`Delete entry "${e.name}"?`)) return
                      onDelete(e.name, scope, folder)
                    }}
                  />
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
