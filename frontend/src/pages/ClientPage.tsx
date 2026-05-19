import { useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import './clientSession.css'
import { GUAC_CLIENT_SCRIPTS, loadGuacamoleChain, loadScriptOnce } from '../lib/guacamoleScripts'

export function ClientPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [search] = useSearchParams()
  const booted = useRef(false)

  useEffect(() => {
    booted.current = false
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || booted.current) return
    booted.current = true
    let cancelled = false

    ;(async () => {
      try {
        await loadGuacamoleChain(GUAC_CLIENT_SCRIPTS)
        if (cancelled) return
        await loadScriptOnce('/rustguac-session-client.js')
      } catch (e) {
        console.error(e)
        const st = document.getElementById('status')
        if (st) st.textContent = 'Failed to load session client scripts.'
      }
    })()

    return () => {
      cancelled = true
      const c = (window as unknown as { __guac_client?: { disconnect?: () => void } }).__guac_client
      if (c?.disconnect) {
        try {
          c.disconnect()
        } catch {
          /* ignore */
        }
      }
    }
  }, [sessionId])

  const token = search.get('token') || ''
  const name = search.get('name') || ''

  return (
    <>
      <div id="disconnected-overlay">
        <div id="disconnected-box">
          <h2 id="disconnected-title">Session Ended</h2>
          <p id="disconnected-message">The remote session has been disconnected.</p>
          <div>
            <button type="button" id="btn-reconnect">
              Reconnect
            </button>
            <button type="button" id="btn-close-session">
              Close
            </button>
          </div>
        </div>
      </div>
      <div id="banner-overlay">
        <div id="banner-box">
          <div id="banner-text" />
          <button type="button" id="banner-continue">
            Continue
          </button>
        </div>
      </div>
      <div id="status">Loading...</div>
      <div id="display" />
      {/* Hidden markers for devtools — session params also in URL for legacy script */}
      {token ? <span data-share-token={token} style={{ display: 'none' }} /> : null}
      {name ? <span data-entry-name={name} style={{ display: 'none' }} /> : null}
    </>
  )
}
