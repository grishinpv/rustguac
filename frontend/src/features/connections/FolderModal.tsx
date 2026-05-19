import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFolder, fetchKnownGroups, updateFolder } from '@/services'

export interface FolderEditState {
  scope: string
  folderPath: string
  description: string
  allowed_groups: string[]
  inherit_from_parent: boolean
}

export function FolderModal({
  open,
  onClose,
  variant,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  variant:
    | { kind: 'create'; defaultScope: 'shared' | 'instance' }
    | { kind: 'subfolder'; parentScope: string; parentPath: string }
    | { kind: 'edit'; folder: FolderEditState }
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'shared' | 'instance'>('shared')
  const [desc, setDesc] = useState('')
  const [inherit, setInherit] = useState(true)
  const [groups, setGroups] = useState<string[]>([])
  const [groupInput, setGroupInput] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: known = [] } = useQuery({
    queryKey: ['known-groups'],
    queryFn: async () => fetchKnownGroups(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setErr('')
    setGroupInput('')
    if (variant.kind === 'edit') {
      const f = variant.folder
      setName(f.folderPath.split('/').pop() || f.folderPath)
      setScope(f.scope === 'instance' ? 'instance' : 'shared')
      setDesc(f.description)
      setInherit(f.inherit_from_parent)
      setGroups(f.allowed_groups.slice())
    } else if (variant.kind === 'create') {
      setName('')
      setScope(variant.defaultScope)
      setDesc('')
      setInherit(true)
      setGroups([])
    } else {
      setName('')
      setScope(variant.parentScope === 'instance' ? 'instance' : 'shared')
      setDesc('')
      setInherit(true)
      setGroups([])
    }
  }, [open, variant])

  if (!open) return null

  const title =
    variant.kind === 'edit' ? `Edit folder: ${variant.folder.folderPath}` : variant.kind === 'subfolder' ? 'New subfolder' : 'New folder'

  function addGroup(g: string) {
    const t = g.trim()
    if (!t || groups.includes(t)) return
    setGroups([...groups, t])
    setGroupInput('')
  }

  async function save() {
    setErr('')
    const n = name.trim()
    if (!n || !/^[a-zA-Z0-9_.-]+$/.test(n)) {
      setErr('Name must be alphanumeric, hyphens, underscores, dots only.')
      return
    }
    setSaving(true)
    try {
      if (variant.kind === 'edit') {
        await updateFolder(variant.folder.scope, variant.folder.folderPath, {
          allowed_groups: groups,
          description: desc.trim(),
          inherit_from_parent: inherit,
        })
      } else if (variant.kind === 'create') {
        await createFolder({
          name: n,
          scope,
          allowed_groups: groups,
          description: desc.trim(),
          inherit_from_parent: inherit,
        })
      } else {
        const fullPath = `${variant.parentPath}/${n}`
        await createFolder({
          name: fullPath,
          scope: variant.parentScope,
          allowed_groups: groups,
          description: desc.trim(),
          inherit_from_parent: inherit,
        })
      }
      onSaved()
      onClose()
    } catch (e) {
      setErr(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay active fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal w-full max-w-md rounded border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h3 className="mt-0">{title}</h3>
        <label className="mt-2 block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
          Name
          <input className="mt-1 block w-full" value={name} disabled={variant.kind === 'edit'} onChange={(e) => setName(e.target.value)} />
        </label>
        {variant.kind === 'create' ? (
          <label className="mt-2 block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
            Scope
            <select className="mt-1 block w-full" value={scope} onChange={(e) => setScope(e.target.value as 'shared' | 'instance')}>
              <option value="shared">shared</option>
              <option value="instance">instance</option>
            </select>
          </label>
        ) : null}
        <label className="mt-2 block text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
          Description
          <input className="mt-1 block w-full" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inherit} onChange={(e) => setInherit(e.target.checked)} /> Inherit group restrictions from parent
        </label>
        <div className="mt-3">
          <div className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
            Allowed OIDC groups
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {groups.map((g) => (
              <span key={g} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                {g}
                <button type="button" className="border-none bg-transparent p-0" style={{ color: 'var(--text-muted)' }} onClick={() => setGroups(groups.filter((x) => x !== g))}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="min-w-0 flex-1"
              list="known-groups-list"
              placeholder="Group name"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addGroup(groupInput)
                }
              }}
            />
            <datalist id="known-groups-list">
              {known.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <button type="button" className="btn-add" onClick={() => addGroup(groupInput)}>
              Add
            </button>
          </div>
        </div>
        {err ? (
          <div className="mt-2 text-sm" style={{ color: 'var(--primary)' }}>
            {err}
          </div>
        ) : null}
        <div className="modal-actions mt-4 flex gap-2">
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
