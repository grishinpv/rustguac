import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchAuthStatus, fetchMe, validateApiKey } from '../api/services'
import { useAuthStore } from '../stores/authStore'
import { getErrorMessage } from '../api/client'

export function LoginPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const apiKey = useAuthStore((s) => s.apiKey)
  const setApiKey = useAuthStore((s) => s.setApiKey)
  const [oidcEnabled, setOidcEnabled] = useState(false)
  const [siteTitle, setSiteTitle] = useState('rustguac')
  const [showApiForm, setShowApiForm] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (search.get('sso_error')) {
      setErr('SSO login failed — please try again.')
      window.history.replaceState(null, '', '/')
    }
  }, [search])

  useEffect(() => {
    fetchAuthStatus()
      .then((d) => {
        setOidcEnabled(!!d.oidc_enabled)
        if (d.site_title) setSiteTitle(d.site_title)
        if (d.oidc_enabled) setShowApiForm(false)
        else setShowApiForm(true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (apiKey) {
      navigate('/connections', { replace: true })
      return
    }
    fetchMe()
      .then(() => navigate('/connections', { replace: true }))
      .catch(() => {})
  }, [apiKey, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await validateApiKey(keyInput)
      setApiKey(keyInput)
      navigate('/connections')
    } catch (er) {
      setErr(getErrorMessage(er) || 'Invalid API key')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center" style={{ fontFamily: 'monospace' }}>
      <div className="mt-8 flex items-center gap-3">
        <img id="site-logo" src="/logo.svg" alt="" className="h-9 w-auto" />
        <h1 className="m-0 text-3xl font-bold" style={{ color: 'var(--primary)' }}>
          {siteTitle}
        </h1>
      </div>
      <div className="mt-6 w-full max-w-[380px] px-4">
        {oidcEnabled ? (
          <div className="mb-5">
            <button
              type="button"
              className="h-[54px] w-full cursor-pointer rounded border-0 text-lg font-bold"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              onClick={() => {
                window.location.href = '/auth/login'
              }}
            >
              Sign in with SSO
            </button>
          </div>
        ) : null}
        {oidcEnabled ? (
          <div
            className="mt-3 cursor-pointer text-base select-none"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setShowApiForm(!showApiForm)}
            onKeyDown={(e) => e.key === 'Enter' && setShowApiForm(!showApiForm)}
            role="button"
            tabIndex={0}
          >
            <span
              className="mr-1 inline-block transition-transform"
              style={{ transform: showApiForm ? 'rotate(90deg)' : undefined }}
            >
              &#9654;
            </span>{' '}
            Sign in with API key
          </div>
        ) : null}
        <form
          onSubmit={onSubmit}
          className="mt-2 rounded border p-5"
          style={{ display: showApiForm || !oidcEnabled ? 'block' : 'none', background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <strong>Login</strong>
          <label className="mt-3 block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            API Key
            <input
              type="password"
              className="mt-1 box-border block w-full rounded border px-2"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--text)', height: 'var(--ctl-md)' }}
              placeholder="Bearer API key"
              required
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-5 h-[54px] w-full cursor-pointer rounded border-0 text-lg font-bold disabled:opacity-60"
            style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}
          >
            {busy ? 'Checking...' : 'Login'}
          </button>
          {err ? (
            <div className="mt-2" style={{ color: 'var(--primary)' }}>
              {err}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}
