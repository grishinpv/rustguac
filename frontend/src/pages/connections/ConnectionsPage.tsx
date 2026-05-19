import './connectionsPage.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import type { AddressBookEntry, AddressBookFolder, Role, SessionInfo, VdiContainer } from '../../types/api'
import {
  connectEntryResult,
  deleteEntry,
  deleteFolder,
  deleteSession,
  fetchAddressBook,
  fetchAuthStatus,
  fetchEntries,
  fetchFolderConfig,
  fetchLoginScripts,
  fetchMe,
  fetchSearchIndex,
  fetchSessionsList,
  fetchSubfolders,
  fetchVdiContainers,
} from '../../services/services'
import { MyCredentialsModal } from '../../components/MyCredentialsModal'
import { EntryModal, type EntryModalProps } from '../../features/connections/EntryModal'
import { FolderModal, type FolderEditState } from '../../features/connections/FolderModal'
import { OnboardingModal, shouldAutoOpenOnboarding } from '../../features/connections/OnboardingModal'
import { ShareModal } from '../../features/connections/ShareModal'

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

  const [shareUrl, setShareUrl] = useState<string | null>(null)
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
      if (document.querySelector('.modal-overlay')) return
      e.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const { data: activeSessions = [] } = useQuery({
    queryKey: ['sessions', 'strip'],
    queryFn: () => fetchSessionsList(false),
    refetchInterval: 10000,
    enabled: !!me?.vault_enabled && vaultBlock === 'none',
  })
  const { data: vdiList = [] } = useQuery({
    queryKey: ['vdi', 'containers'],
    queryFn: fetchVdiContainers,
    refetchInterval: 10000,
    enabled: !!me?.vault_enabled && vaultBlock === 'none',
  })

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
        <div className="folder-row" onClick={() => setSelected(f)}>
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

      <div className="active-sessions mb-8">
        <ActiveSessionsStrip
          sessions={activeSessions}
          vdi={vdiList}
          onShare={(u) => setShareUrl(u)}
          onTerminate={(id) => {
            void deleteSession(id).then(() => void qc.invalidateQueries({ queryKey: ['sessions'] }))
          }}
          onRefresh={() => void qc.invalidateQueries({ queryKey: ['sessions'] })}
        />
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
              <button type="button" className="btn-add text-sm" onClick={() => setFolderModal({ kind: 'create' })}>
                + folder
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
                  <>
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
                    <button
                      type="button"
                      className="btn-add"
                      onClick={() => setFolderModal({ kind: 'subfolder', parent: { scope: selected.scope, path: selected.path } })}
                    >
                      + subfolder
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={async () => {
                        const cfg = await fetchFolderConfig(selected.scope, selected.path)
                        setFolderModal({
                          kind: 'edit',
                          edit: {
                            scope: selected.scope,
                            folderPath: selected.path,
                            description: selected.description,
                            allowed_groups: cfg.allowed_groups || [],
                            inherit_from_parent: !!cfg.inherit_from_parent,
                          },
                        })
                      }}
                    >
                      edit folder
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => {
                        if (
                          !confirm(
                            selected.has_children
                              ? `Delete folder "${selected.path}" AND all subfolders and entries?`
                              : `Delete folder "${selected.path}" and all entries?`,
                          )
                        )
                          return
                        void deleteFolder(selected.scope, selected.path).then(() => {
                          setSelected(null)
                          void abQuery.refetch()
                        })
                      }}
                    >
                      delete folder
                    </button>
                  </>
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
                  onDelete={(name) => {
                    void deleteEntry(selected.scope, selected.path, name).then(() => void loadEntriesFor(selected, true))
                  }}
                  onEdit={(e) => {
                    setEntryModal({ mode: 'edit', scope: selected.scope, folder: selected.path, entry: e })
                    setEntryOpen(true)
                  }}
                  onClone={(e) => {
                    setEntryModal({ mode: 'clone', scope: selected.scope, folder: selected.path, entry: e })
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

      <ShareModal open={!!shareUrl} url={shareUrl} onClose={() => setShareUrl(null)} />
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

function ActiveSessionsStrip({
  sessions,
  vdi,
  onShare,
  onTerminate,
  onRefresh,
}: {
  sessions: SessionInfo[]
  vdi: VdiContainer[]
  onShare: (url: string) => void
  onTerminate: (id: string) => void
  onRefresh: () => void
}) {
  const active = sessions.filter((s) => s.status === 'active' || s.status === 'pending')
  const activeContainers: Record<string, boolean> = {}
  active.forEach((s) => {
    if (s.session_type === 'vdi' && s.hostname) activeContainers[s.hostname] = true
  })
  const dormant = vdi.filter((c) => !c.has_active_session && !activeContainers[c.container_name])
  const total = active.length + dormant.length
  if (total === 0) return null
  return (
    <section>
      <div className="mb-2 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
        Active sessions <span style={{ color: 'var(--text-muted)' }}>({total})</span>
      </div>
      <div className="session-grid">
        {active.map((s) => {
          const thumb = s.thumbnail_url || ''
          const name = s.entry_display_name || s.hostname || s.url || '?'
          const share = s.share_url ? `${window.location.origin}${s.share_url}` : ''
          return (
            <div
              key={s.session_id}
              className="session-card"
              onClick={() => s.client_url && window.open(s.client_url, '_blank')}
              onKeyDown={(e) => e.key === 'Enter' && s.client_url && window.open(s.client_url, '_blank')}
              role="button"
              tabIndex={0}
            >
              <img className="session-card-thumb" src={thumb ? `${thumb}?t=${Date.now()}` : ''} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
              <div className="session-card-info">
                <div className="card-name">{name}</div>
                <div className="card-meta">
                  <span className={`type-badge type-${s.session_type}`}>{s.session_type}</span> <span>{s.username || ''}</span>
                </div>
              </div>
              <div className="card-actions">
                {share ? (
                  <button
                    type="button"
                    className="btn-add"
                    onClick={(e) => {
                      e.stopPropagation()
                      onShare(share)
                    }}
                  >
                    Share
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-add btn-danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!confirm(`Terminate session "${name}"?`)) return
                    onTerminate(s.session_id)
                    onRefresh()
                  }}
                >
                  Terminate
                </button>
              </div>
            </div>
          )
        })}
        {dormant.map((c) => (
          <div
            key={c.container_name}
            className="session-card dormant"
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!c.entry_key) return
              const parts = c.entry_key.split('/')
              if (parts.length !== 3) return
              const [scope, folder, entry] = parts as [string, string, string]
              void connectEntryResult(scope, folder, entry, { width: window.innerWidth, height: window.innerHeight }).then((r) => {
                if (r.ok && r.data.session_id) window.open(`/client/${r.data.session_id}`, '_blank')
              })
            }}
          >
            <img className="session-card-thumb" src={c.thumbnail_url ? `${c.thumbnail_url}?t=${Date.now()}` : ''} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
            <div className="session-card-info">
              <div className="card-name">{c.image || c.container_name}</div>
              <div className="card-meta">
                <span className="type-badge type-vdi">vdi</span> <span>dormant</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
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
  onDelete: (name: string) => void
  onEdit: (e: AddressBookEntry) => void
  onClone: (e: AddressBookEntry) => void
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
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ row: r }) => {
              const e = r.entry
              const needsPrompt = (e.prompt_credentials || !e.has_credentials) && e.session_type !== 'web'
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
          <th />
          {admin ? (
            <>
              <th />
              <th />
              <th />
            </>
          ) : null}
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
          const needsPrompt = (e.prompt_credentials || !e.has_credentials) && e.session_type !== 'web'
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
                <>
                  <td>
                    <button type="button" className="btn-small" onClick={() => onEdit(e)}>
                      edit
                  </button>
                  </td>
                  <td>
                    <button type="button" className="btn-small" onClick={() => onClone(e)}>
                      clone
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => {
                        if (!confirm(`Delete entry "${e.name}"?`)) return
                        onDelete(e.name)
                      }}
                    >
                      delete
                    </button>
                  </td>
                </>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
