import { useMemo, useState } from 'react'
import type { Role } from '../../types/api'
import { roleLevel as roleLevelMap } from '../../lib/roles'

const ONBOARD_STEPS: { title: string; minRole: number; html: string }[] = [
  {
    title: 'Welcome to rustguac',
    minRole: 1,
    html:
      'This is your remote access gateway. Browse connection entries organised by folder, then click <span class="onboard-hl">Connect</span> to launch a session in a new browser tab.' +
      '<br><br>This quick tour covers the essentials &mdash; you can dismiss it at any time.',
  },
  {
    title: 'Navigation',
    minRole: 1,
    html:
      'The nav bar at the top links to:' +
      '<br>&bull; <span class="onboard-hl">Connections</span> &mdash; your connection entries' +
      '<br>&bull; <span class="onboard-hl">Sessions</span> &mdash; active and recent sessions' +
      '<br>&bull; <span class="onboard-hl">Recordings</span> &mdash; session playback' +
      '<br>&bull; <span class="onboard-hl">Docs</span> &mdash; built-in documentation' +
      '<br><br>The <span class="onboard-hl">Settings</span> menu (top right) has theme selection, credential management, and this tour.',
  },
  {
    title: 'My Credentials',
    minRole: 2,
    html:
      'Some entries use credential variables like <code>$domain_username</code>. Before connecting, set your personal credentials:' +
      '<br><br>Click <span class="onboard-hl">Settings</span> &rarr; <span class="onboard-hl">My Credentials</span> to fill in your values. They are stored securely in Vault and applied automatically when you connect.',
  },
  {
    title: 'Connect vs Login',
    minRole: 2,
    html:
      'Connections entries have two connection modes:' +
      '<br><br>&bull; <span class="onboard-hl">Connect</span> &mdash; launches the session directly using the saved settings.' +
      '<br>&bull; <span class="onboard-hl">Login</span> &mdash; runs an automated login script after connecting (e.g. filling in a web login form). If an entry shows Login, the admin has configured an auto-login workflow for it.',
  },
  {
    title: 'Clipboard',
    minRole: 2,
    html:
      '<span class="onboard-key">Ctrl</span>+<span class="onboard-key">V</span> pastes from your browser clipboard into the remote session automatically.' +
      '<br><br>For advanced use (copy from remote, send arbitrary text), press <span class="onboard-key">Ctrl</span>+<span class="onboard-key">Alt</span>+<span class="onboard-key">Shift</span> or click the <span class="onboard-hl">Clipboard</span> tab on the left edge of the session window.',
  },
  {
    title: 'File Transfer',
    minRole: 2,
    html:
      'RDP sessions with drive redirection enabled show a <span class="onboard-hl">Files</span> tab on the right edge of the session window.' +
      '<br><br>Use it to upload and download files via a shared virtual drive. SSH sessions support SFTP file transfer instead.' +
      '<br><br>Toggle the file panel with <span class="onboard-key">Ctrl</span>+<span class="onboard-key">Alt</span>+<span class="onboard-key">F</span>.',
  },
  {
    title: 'Ad-hoc Sessions',
    minRole: 3,
    html:
      'As a power user, you can create one-off sessions from the <span class="onboard-hl">Sessions</span> page &mdash; useful for quick connections that aren\'t in the connections.' +
      '<br><br>Choose SSH, RDP, VNC, or Web and enter connection details directly.',
  },
  {
    title: 'Managing the Connections',
    minRole: 4,
    html:
      'As an admin, you can:' +
      '<br>&bull; Create and edit <span class="onboard-hl">folders</span> with OIDC group permissions' +
      '<br>&bull; Add, edit, clone, and delete <span class="onboard-hl">entries</span>' +
      '<br>&bull; Configure credential variables, login scripts, and recording overrides per entry' +
      '<br>&bull; Manage users and API tokens from the <span class="onboard-hl">Admin</span> page',
  },
]

export function OnboardingModal({
  open,
  onClose,
  role,
}: {
  open: boolean
  onClose: () => void
  role: Role
}) {
  const [idx, setIdx] = useState(0)
  const [dismiss, setDismiss] = useState(false)
  const level = roleLevelMap[role] ?? 1
  const steps = useMemo(() => ONBOARD_STEPS.filter((s) => s.minRole <= level), [level])

  if (!open || steps.length === 0) return null

  const step = steps[idx]!
  const last = idx >= steps.length - 1

  return (
    <div
      className="modal-overlay active fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (dismiss) localStorage.setItem('rustguac_onboarding_dismissed', '1')
        onClose()
      }}
    >
      <div className="modal min-w-[380px] max-w-lg rounded border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="m-0">{step.title}</h3>
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
            {idx + 1} / {steps.length}
          </span>
        </div>
        <div className="min-h-[5rem] text-[0.92em] leading-relaxed" style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: step.html }} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-cancel" style={{ display: idx === 0 ? 'none' : undefined }} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
            Back
          </button>
          <button
            type="button"
            className="btn-connect"
            onClick={() => {
              if (last) {
                localStorage.setItem('rustguac_onboarding_dismissed', '1')
                onClose()
              } else setIdx((i) => i + 1)
            }}
          >
            {last ? 'Done' : 'Next'}
          </button>
          <span className="flex-1" />
          <label className="flex cursor-pointer items-center gap-1 text-xs whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={dismiss} onChange={(e) => setDismiss(e.target.checked)} className="m-0" /> Don&apos;t show again
          </label>
        </div>
      </div>
    </div>
  )
}

export function shouldAutoOpenOnboarding(): boolean {
  return !localStorage.getItem('rustguac_onboarding_dismissed')
}
