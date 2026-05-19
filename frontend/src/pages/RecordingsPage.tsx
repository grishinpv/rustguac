import './recordingsPage.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { deleteRecording, fetchRecordings } from '../api/services'
import type { RecordingRow } from '../types/api'
import { GUAC_RECORDING_SCRIPTS, loadGuacamoleChain } from '../lib/guacamoleScripts'
import { useAuthStore } from '../stores/authStore'

declare global {
  interface Window {
    Guacamole?: {
      StaticHTTPTunnel: new (url: string, bidirectional: boolean, headers: Record<string, string>) => GuacamoleTunnel
      SessionRecording: new (tunnel: GuacamoleTunnel) => GuacamoleSessionRecording
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GuacamoleTunnel = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GuacamoleSessionRecording = any

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatTime(ms: number) {
  const secs = Math.floor(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function RecordingsPage() {
  const qc = useQueryClient()
  const apiKey = useAuthStore((s) => s.apiKey)
  const { data: recs = [] } = useQuery({ queryKey: ['recordings'], queryFn: fetchRecordings, refetchInterval: 15000 })
  const [q, setQ] = useState('')
  const [sortCol, setSortCol] = useState<keyof RecordingRow>('modified')
  const [sortAsc, setSortAsc] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playingName, setPlayingName] = useState<string | null>(null)
  const displayRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recRef = useRef<GuacamoleSessionRecording | null>(null)
  const [duration, setDuration] = useState(0)
  const [pos, setPos] = useState(0)
  const [seeking, setSeeking] = useState(false)
  const [playLabel, setPlayLabel] = useState('Play')
  const sliderRef = useRef<HTMLInputElement>(null)

  const filtered = !q.trim()
    ? recs
    : recs.filter((r) => {
        const t = q.toLowerCase()
        return (
          (r.name || '').toLowerCase().includes(t) ||
          (r.user || '').toLowerCase().includes(t) ||
          (r.entry_display_name || '').toLowerCase().includes(t) ||
          (r.address_book_entry || '').toLowerCase().includes(t) ||
          (r.folder || '').toLowerCase().includes(t) ||
          (r.session_type || '').toLowerCase().includes(t)
        )
      })

  const sorted = [...filtered].sort((a, b) => {
    const va = (a[sortCol] ?? '') as string | number
    const vb = (b[sortCol] ?? '') as string | number
    if (sortCol === 'size_bytes') return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va)
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1 : -1
    return 0
  })

  const closePlayer = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.pause()
      } catch {
        /* ignore */
      }
      recRef.current = null
    }
    if (displayRef.current) displayRef.current.innerHTML = ''
    setPlayerOpen(false)
    setPlayingName(null)
    setPlayLabel('Play')
    setDuration(0)
    setPos(0)
    if (sliderRef.current) sliderRef.current.value = '0'
  }, [])

  useEffect(() => () => closePlayer(), [closePlayer])

  function rebuildHistogram(recording: GuacamoleSessionRecording, dur: number) {
    const canvas = canvasRef.current
    const wrap = canvas?.parentElement
    if (!canvas || !wrap || dur <= 0) return
    const frameData = recording.getFrames?.() || []
    if (!frameData.length) return
    const rect = wrap.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const bucketCount = Math.min(Math.floor(rect.width / 2), 200)
    if (bucketCount <= 0) return
    const buckets = new Array(bucketCount).fill(0)
    const bucketDuration = dur / bucketCount
    for (let i = 0; i < frameData.length; i++) {
      const idx = Math.min(Math.floor(frameData[i].timestamp / bucketDuration), bucketCount - 1)
      if (idx >= 0) buckets[idx] += frameData[i].size
    }
    const sortedB = buckets.slice().sort((a, b) => a - b)
    const maxVal = sortedB[Math.floor(sortedB.length * 0.95)] || 1
    const barWidth = canvas.width / bucketCount
    for (let i = 0; i < bucketCount; i++) {
      const h = Math.min(buckets[i] / maxVal, 1) * canvas.height * 0.85
      ctx.fillStyle = 'rgba(91, 192, 190, 0.35)'
      ctx.fillRect(i * barWidth, canvas.height - h, barWidth - 0.5, h)
    }
  }

  async function playRecording(name: string) {
    closePlayer()
    setPlayingName(name)
    setPlayerOpen(true)
    await loadGuacamoleChain(GUAC_RECORDING_SCRIPTS)
    const G = window.Guacamole
    if (!G || !displayRef.current) return
    const headers: Record<string, string> = {}
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const tunnel = new G.StaticHTTPTunnel(`/api/recordings/${encodeURIComponent(name)}`, false, headers)
    const recording = new G.SessionRecording(tunnel)
    recRef.current = recording
    const display = recording.getDisplay()
    displayRef.current.appendChild(display.getElement())
    function scaleRecordingDisplay() {
      const w = display.getWidth()
      const h = display.getHeight()
      if (w > 0 && h > 0) {
        const cw = displayRef.current?.clientWidth || 1080
        display.scale(Math.min(cw / w, 1))
      }
    }
    display.onresize = scaleRecordingDisplay
    let dur = 0
    recording.onprogress = (millis: number) => {
      dur = millis
      setDuration(millis)
      rebuildHistogram(recording, millis)
    }
    recording.onplay = () => setPlayLabel('Pause')
    recording.onpause = () => setPlayLabel('Play')
    recording.onseek = (position: number) => {
      setPos(position)
      if (!seeking && dur > 0 && sliderRef.current) {
        sliderRef.current.value = String(Math.round((position / dur) * 1000))
      }
    }
    recording.connect()
  }

  async function downloadBlob(name: string) {
    const headers: Record<string, string> = {}
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const res = await api.get(`/api/recordings/${encodeURIComponent(name)}`, { responseType: 'blob', headers })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2 className="mb-4">Recordings</h2>
      <div id="player-section" className={playerOpen ? 'rec-active' : ''}>
        <div id="player-header">
          <span id="player-title">{playingName || ''}</span>
          <button type="button" id="player-close" className="border-none bg-transparent" style={{ color: 'var(--text-muted)' }} onClick={closePlayer}>
            × close
          </button>
        </div>
        <div id="player-display" ref={displayRef} />
        <div id="player-controls">
          <button
            id="play-btn"
            type="button"
            className="btn-primary min-w-[90px]"
            onClick={() => {
              const r = recRef.current
              if (!r) return
              if (r.isPlaying?.()) r.pause()
              else r.play?.()
            }}
          >
            {playLabel}
          </button>
          <div id="seek-container">
            <canvas id="histogram" ref={canvasRef} />
            <input
              ref={sliderRef}
              id="seek-slider"
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onInput={(e) => {
                const r = recRef.current
                const dur = duration
                if (!r || dur <= 0) return
                const v = parseInt((e.target as HTMLInputElement).value, 10)
                r.seek((v / 1000) * dur)
              }}
            />
          </div>
          <span id="player-time" className="whitespace-nowrap text-sm" style={{ color: 'var(--text-muted)' }}>
            {formatTime(pos)} / {formatTime(duration)}
          </span>
        </div>
      </div>
      <input
        type="search"
        className="mb-4 w-full max-w-3xl rounded border px-3 py-2 font-mono"
        style={{ borderColor: 'var(--border)', background: 'var(--input)', color: 'var(--text)' }}
        placeholder="Search recordings (user, entry, folder...)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!sorted.length ? (
        <p className="empty">No recordings found.</p>
      ) : (
        <table className="w-full border-collapse border" style={{ borderColor: 'var(--border)' }}>
          <thead>
            <tr>
              <th className="cursor-pointer border-b p-3 text-left text-sm uppercase" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }} onClick={() => { if (sortCol === 'entry_display_name') setSortAsc(!sortAsc); else { setSortCol('entry_display_name'); setSortAsc(true) } }}>Entry{sortCol === 'entry_display_name' ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}</th>
              <th className="cursor-pointer border-b p-3 text-left text-sm uppercase" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }} onClick={() => { if (sortCol === 'user') setSortAsc(!sortAsc); else { setSortCol('user'); setSortAsc(true) } }}>User{sortCol === 'user' ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}</th>
              <th className="cursor-pointer border-b p-3 text-left text-sm uppercase" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }} onClick={() => { if (sortCol === 'session_type') setSortAsc(!sortAsc); else { setSortCol('session_type'); setSortAsc(true) } }}>Type{sortCol === 'session_type' ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}</th>
              <th className="cursor-pointer border-b p-3 text-left text-sm uppercase" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }} onClick={() => { if (sortCol === 'folder') setSortAsc(!sortAsc); else { setSortCol('folder'); setSortAsc(true) } }}>Folder{sortCol === 'folder' ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}</th>
              <th className="cursor-pointer border-b p-3 text-left text-sm uppercase" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }} onClick={() => { if (sortCol === 'size_bytes') setSortAsc(!sortAsc); else { setSortCol('size_bytes'); setSortAsc(true) } }}>Size{sortCol === 'size_bytes' ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}</th>
              <th className="cursor-pointer border-b p-3 text-left text-sm uppercase" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }} onClick={() => { if (sortCol === 'modified') setSortAsc(!sortAsc); else { setSortCol('modified'); setSortAsc(true) } }}>Date{sortCol === 'modified' ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}</th>
              <th className="border-b p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
              <th className="border-b p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
              <th className="border-b p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const date = r.modified ? new Date(r.modified).toLocaleString() : r.created_at ? new Date(r.created_at).toLocaleString() : ''
              const entryName = r.entry_display_name || r.address_book_entry || r.name
              return (
                <tr key={r.name}>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }} title={r.name}>
                    {entryName}
                  </td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                    {r.user || ''}
                  </td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: `var(--type-${r.session_type}-fg, var(--accent))` }}>{r.session_type}</span>
                  </td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                    {r.folder || ''}
                  </td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                    {formatBytes(r.size_bytes)}
                  </td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>{date}</td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                    <button type="button" className="btn-small" onClick={() => void playRecording(r.name)}>
                      play
                    </button>
                  </td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                    <button type="button" className="btn-small" onClick={() => void downloadBlob(r.name)}>
                      download
                    </button>
                  </td>
                  <td className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      className="btn-small btn-delete"
                      onClick={() => {
                        if (!confirm(`Delete recording ${r.name}?`)) return
                        void deleteRecording(r.name).then(() => {
                          if (playingName === r.name) closePlayer()
                          void qc.invalidateQueries({ queryKey: ['recordings'] })
                        })
                      }}
                    >
                      delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
