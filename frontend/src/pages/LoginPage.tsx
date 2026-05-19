import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { fetchAuthStatus, fetchMe, validateApiKey, getErrorMessage } from '@/services'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent dark:from-primary/10" />
      <div className="relative z-[1] mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/80 bg-card shadow-sm">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex items-center gap-3">
          <img id="site-logo" src="/logo.svg" alt="" className="h-8 w-auto opacity-90" />
          <h1 className="text-xl font-semibold tracking-tight">{siteTitle}</h1>
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">Privileged access workspace — remote sessions with audit-ready controls.</p>
      </div>

      <Card className="relative z-[1] w-full max-w-[400px] border-border/80 shadow-lg">
        <CardHeader className="space-y-1 border-b border-border/60 pb-4">
          <CardTitle className="text-base">Sign in</CardTitle>
          <CardDescription className="text-xs">Authenticate to open the operator console.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {oidcEnabled ? (
            <Button type="button" className="h-10 w-full text-sm font-medium" onClick={() => (window.location.href = '/auth/login')}>
              Continue with SSO
            </Button>
          ) : null}

          {oidcEnabled ? (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setShowApiForm(!showApiForm)}
            >
              <span className={cn('transition-transform', showApiForm && 'rotate-90')}>›</span>
              Sign in with API key
            </button>
          ) : null}

          <form
            onSubmit={onSubmit}
            className={cn('space-y-4', !showApiForm && oidcEnabled && 'hidden')}
          >
            <div className="space-y-2">
              <Label htmlFor="api-key">API key</Label>
              <Input
                id="api-key"
                type="password"
                autoComplete="current-password"
                placeholder="Paste bearer API key"
                required
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
            </div>
            <Button type="submit" className="h-10 w-full" disabled={busy}>
              {busy ? 'Verifying…' : 'Enter console'}
            </Button>
            {err ? <p className="text-center text-xs font-medium text-destructive">{err}</p> : null}
          </form>
        </CardContent>
      </Card>

      <p className="relative z-[1] mt-8 text-[11px] text-muted-foreground">Sessions are recorded and governed per your organization policy.</p>
    </div>
  )
}
