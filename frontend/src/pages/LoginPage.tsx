import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Shield, Loader2, Eye, EyeOff, KeyRound, Building2, ChevronDown } from 'lucide-react'
import { fetchAuthStatus, fetchMe, validateApiKey, getErrorMessage } from '@/services'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const schema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const storedKey = useAuthStore((s) => s.apiKey)
  const setApiKey = useAuthStore((s) => s.setApiKey)
  const [oidcEnabled, setOidcEnabled] = useState(false)
  const [siteTitle, setSiteTitle] = useState('rustguac')
  const [showApiForm, setShowApiForm] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [serverErr, setServerErr] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (search.get('sso_error')) {
      setServerErr('SSO login failed — please try again.')
      window.history.replaceState(null, '', '/')
    }
  }, [search])

  useEffect(() => {
    fetchAuthStatus()
      .then((d) => {
        setOidcEnabled(!!d.oidc_enabled)
        if (d.site_title) setSiteTitle(d.site_title)
        setShowApiForm(!d.oidc_enabled)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (storedKey) {
      navigate('/connections', { replace: true })
      return
    }
    fetchMe()
      .then(() => navigate('/connections', { replace: true }))
      .catch(() => {})
  }, [storedKey, navigate])

  async function onSubmit({ apiKey }: FormData) {
    setServerErr('')
    try {
      await validateApiKey(apiKey)
      setApiKey(apiKey)
      navigate('/connections')
    } catch (er) {
      setServerErr(getErrorMessage(er) || 'Invalid API key')
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 px-4 py-16">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent dark:from-primary/10" />

      {/* Brand */}
      <div className="relative z-10 mb-10 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
          <Shield className="h-5 w-5 text-foreground" aria-hidden />
        </div>
        <div>
          <div className="flex items-center justify-center gap-2.5">
            <img
              src="/logo.svg"
              alt=""
              className="h-7 w-auto opacity-80"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h1 className="text-[22px] font-bold tracking-tight">{siteTitle}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Privileged access workspace</p>
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[380px]">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl shadow-black/5 dark:shadow-black/20">
          {/* Card header */}
          <div className="border-b border-border/50 px-6 py-5">
            <h2 className="text-[15px] font-semibold text-card-foreground">Sign in</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {oidcEnabled
                ? 'Use your organization account to continue.'
                : 'Enter your API key to access the operator console.'}
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            {/* Error banner — shown for both SSO and API key errors */}
            {serverErr && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
                <span className="mt-px shrink-0">⚠</span>
                <span>{serverErr}</span>
              </div>
            )}

            {/* OIDC / SSO button */}
            {oidcEnabled && (
              <Button
                type="button"
                className="h-10 w-full gap-2 text-sm font-medium"
                onClick={() => (window.location.href = '/auth/login')}
              >
                <Building2 className="h-4 w-4" />
                Continue with SSO
              </Button>
            )}

            {/* "Or API key" separator + expand toggle */}
            {oidcEnabled && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <button
                  type="button"
                  onClick={() => setShowApiForm((v) => !v)}
                  className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  API key
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform duration-200',
                      showApiForm && '-rotate-180',
                    )}
                  />
                </button>
                <div className="h-px flex-1 bg-border/60" />
              </div>
            )}

            {/* API key form */}
            {showApiForm && (
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="api-key" className="text-xs font-medium">
                    API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="api-key"
                      type={showKey ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Paste bearer token"
                      className={cn(
                        'h-9 pr-9 font-mono text-xs',
                        errors.apiKey && 'border-destructive focus-visible:ring-destructive/50',
                      )}
                      {...register('apiKey')}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowKey((v) => !v)}
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                    >
                      {showKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {errors.apiKey && (
                    <p className="text-[11px] text-destructive">{errors.apiKey.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="h-10 w-full gap-2 text-sm font-medium"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Sign in
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/60">
          Sessions are recorded and governed per your organization policy.
        </p>
      </div>
    </div>
  )
}
