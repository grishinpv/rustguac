import { useEffect, useRef } from 'react'

export function ShareModal({ url, open, onClose }: { url: string | null; open: boolean; onClose: () => void }) {
  const codeRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (!open || !url || !codeRef.current) return
    try {
      const range = document.createRange()
      range.selectNodeContents(codeRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    } catch {
      /* ignore */
    }
  }, [open, url])

  if (!open || !url) return null

  return (
    <div
      className="modal-overlay active fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal max-w-lg rounded border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h3 className="mt-0">Share session (read-only)</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Copy this URL for a read-only viewer. They cannot control the session.
        </p>
        <div className="share-url-box mt-2 flex gap-2">
          <pre
            ref={codeRef}
            className="m-0 block flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded border p-2 font-mono text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
          >
            {url}
          </pre>
          <button
            type="button"
            className="btn-add flex-shrink-0"
            onClick={() => {
              void navigator.clipboard.writeText(url).catch(() => {
                const ta = document.createElement('textarea')
                ta.value = url
                ta.style.position = 'fixed'
                ta.style.opacity = '0'
                document.body.appendChild(ta)
                ta.select()
                try {
                  document.execCommand('copy')
                } catch {
                  /* ignore */
                }
                document.body.removeChild(ta)
              })
            }}
          >
            Copy
          </button>
        </div>
        <div className="share-warning mt-3 flex gap-2 rounded border p-2 text-sm" style={{ borderColor: 'var(--status-pending)', color: 'var(--status-pending)' }}>
          <span>&#9888;</span>
          <span>Anyone with this link and network access to this server can watch the session until it ends.</span>
        </div>
        <div className="modal-actions mt-4">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
