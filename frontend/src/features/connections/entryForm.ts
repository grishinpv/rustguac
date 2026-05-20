import type { AddressBookEntry, JumpHost } from '../../types/api'

export interface EntryFormState {
  name: string
  displayName: string
  type: 'ssh' | 'rdp' | 'vnc' | 'web' | 'vdi'
  // ssh
  hostname: string
  port: string
  username: string
  password: string
  privateKey: string
  sshPromptCreds: boolean
  // rdp
  rdpHostname: string
  rdpPort: string
  rdpUsername: string
  rdpPassword: string
  rdpDomain: string
  rdpSecurity: string
  rdpIgnoreCert: boolean
  rdpAuthPkg: string
  rdpKdcUrl: string
  rdpPromptCreds: boolean
  // vnc
  vncHostname: string
  vncPort: string
  vncPassword: string
  vncColorDepth: string
  vncPromptCreds: boolean
  // web
  url: string
  banner: string
  webUsername: string
  webPassword: string
  loginScript: string
  autofillRows: { url: string; username: string; password: string }[]
  allowedDomains: string[]
  // vdi
  vdiImage: string
  vdiCpu: string
  vdiMemory: string
  vdiEnv: string
  vdiIdle: string
  vdiBanner: string
  // shared
  enableDrive: boolean
  remoteApp: string
  remoteAppDir: string
  remoteAppArgs: string
  overrideRecording: boolean
  enableRecording: boolean
  maxRecordings: string
  enableGfx: boolean
  enableDesktopComp: boolean
  forceLossless: boolean
  enableH264: boolean
  disableCopy: boolean
  disablePaste: boolean
  allowSharing: boolean
  autoOpenSingleton: boolean
  hops: JumpHost[]
}

export function defaultEntryForm(): EntryFormState {
  return {
    name: '',
    displayName: '',
    type: 'ssh',
    hostname: '',
    port: '22',
    username: '',
    password: '',
    privateKey: '',
    sshPromptCreds: false,
    rdpHostname: '',
    rdpPort: '3389',
    rdpUsername: '',
    rdpPassword: '',
    rdpDomain: '',
    rdpSecurity: '',
    rdpIgnoreCert: false,
    rdpAuthPkg: '',
    rdpKdcUrl: '',
    rdpPromptCreds: false,
    vncHostname: '',
    vncPort: '5900',
    vncPassword: '',
    vncColorDepth: '',
    vncPromptCreds: false,
    url: '',
    banner: '',
    webUsername: '',
    webPassword: '',
    loginScript: '',
    autofillRows: [],
    allowedDomains: [],
    vdiImage: '',
    vdiCpu: '',
    vdiMemory: '',
    vdiEnv: '',
    vdiIdle: '',
    vdiBanner: '',
    enableDrive: false,
    remoteApp: '',
    remoteAppDir: '',
    remoteAppArgs: '',
    overrideRecording: false,
    enableRecording: true,
    maxRecordings: '0',
    enableGfx: false,
    enableDesktopComp: false,
    forceLossless: false,
    enableH264: false,
    disableCopy: false,
    disablePaste: false,
    allowSharing: false,
    autoOpenSingleton: false,
    hops: [],
  }
}

export function buildEntryPayload(s: EntryFormState, driveConfigured: boolean): Record<string, unknown> {
  void driveConfigured
  const type = s.type
  const entry: Record<string, unknown> = { type }
  // Always send so PUT merges do not drop an existing display_name when the field is cleared.
  const dn = s.displayName.trim()
  entry.display_name = dn.length > 0 ? dn : null

  if (type === 'ssh') {
    const h = s.hostname.trim()
    if (h) entry.hostname = h
    const p = parseInt(s.port, 10)
    if (p) entry.port = p
    const u = s.username.trim()
    if (u) entry.username = u
    if (s.password) entry.password = s.password
    const pk = s.privateKey.trim()
    if (pk) entry.private_key = pk
    if (s.sshPromptCreds) entry.prompt_credentials = true
  } else if (type === 'rdp') {
    const h = s.rdpHostname.trim()
    if (h) entry.hostname = h
    const p = parseInt(s.rdpPort, 10)
    if (p) entry.port = p
    const u = s.rdpUsername.trim()
    if (u) entry.username = u
    if (s.rdpPassword) entry.password = s.rdpPassword
    const dom = s.rdpDomain.trim()
    if (dom) entry.domain = dom
    const sec = s.rdpSecurity
    if (sec) entry.security = sec
    entry.ignore_cert = s.rdpIgnoreCert
    const authPkg = s.rdpAuthPkg
    if (authPkg) entry.auth_pkg = authPkg
    const kdcUrl = s.rdpKdcUrl.trim()
    if (kdcUrl) entry.kdc_url = kdcUrl
    if (s.rdpPromptCreds) entry.prompt_credentials = true
  } else if (type === 'vnc') {
    const h = s.vncHostname.trim()
    if (h) entry.hostname = h
    const p = parseInt(s.vncPort, 10)
    if (p) entry.port = p
    if (s.vncPassword) entry.password = s.vncPassword
    const cd = s.vncColorDepth
    if (cd) entry.color_depth = parseInt(cd, 10)
    if (s.vncPromptCreds) entry.prompt_credentials = true
  } else if (type === 'web') {
    const url = s.url.trim()
    if (url) entry.url = url
    const bn = s.banner.trim()
    if (bn) entry.banner = bn
    const wu = s.webUsername.trim()
    if (wu) entry.username = wu
    if (s.webPassword) entry.password = s.webPassword
    const ls = s.loginScript.trim()
    if (ls) entry.login_script = ls
    const afValid = s.autofillRows.filter((r) => r.url && r.url.trim())
    if (afValid.length > 0) entry.autofill = JSON.stringify(afValid)
    const adValid = s.allowedDomains.filter((d) => d && d.trim())
    if (adValid.length > 0) entry.allowed_domains = adValid
  } else if (type === 'vdi') {
    const img = s.vdiImage.trim()
    if (img) entry.container_image = img
    const cpu = parseFloat(s.vdiCpu)
    if (cpu > 0) entry.container_cpu_limit = cpu
    const mem = parseInt(s.vdiMemory, 10)
    if (mem > 0) entry.container_memory_limit = mem
    const envText = s.vdiEnv.trim()
    if (envText) {
      const envMap: Record<string, string> = {}
      envText.split('\n').forEach((line) => {
        const eq = line.indexOf('=')
        if (eq > 0) envMap[line.substring(0, eq).trim()] = line.substring(eq + 1)
      })
      if (Object.keys(envMap).length > 0) entry.container_env = envMap
    }
    const idleT = parseInt(s.vdiIdle, 10)
    if (idleT > 0) entry.container_idle_timeout_mins = idleT
    const vbn = s.vdiBanner.trim()
    if (vbn) entry.banner = vbn
  }

  if (type === 'ssh' || type === 'rdp') {
    entry.enable_drive = s.enableDrive
  }

  if (type === 'rdp') {
    const ra = s.remoteApp.trim()
    const raDir = s.remoteAppDir.trim()
    const raArgs = s.remoteAppArgs.trim()
    if (ra) entry.remote_app = ra
    if (raDir) entry.remote_app_dir = raDir
    if (raArgs) entry.remote_app_args = raArgs
  }

  if (s.overrideRecording) {
    entry.enable_recording = s.enableRecording
    const maxRec = parseInt(s.maxRecordings, 10) || 0
    if (maxRec > 0) entry.max_recordings = maxRec
  }

  if (type === 'rdp') {
    if (s.enableGfx) entry.enable_gfx = true
    if (s.enableDesktopComp) entry.enable_desktop_composition = true
    if (s.forceLossless) entry.force_lossless = true
    if (s.enableH264) entry.enable_h264 = true
  }

  if (s.disableCopy) entry.disable_copy = true
  if (s.disablePaste) entry.disable_paste = true
  if (s.allowSharing) entry.allow_sharing = true
  if (s.autoOpenSingleton) entry.auto_open_if_singleton = true

  if (type === 'ssh' || type === 'rdp' || type === 'vnc' || type === 'web') {
    const hops = s.hops.filter((h) => h.hostname && h.hostname.trim())
    if (hops.length > 0) {
      entry.jump_hosts = hops.map((h) => {
        const hop: Record<string, unknown> = {
          hostname: h.hostname.trim(),
          port: h.port || 22,
          username: h.username || '',
        }
        if (h.password) hop.password = h.password
        if (h.private_key) hop.private_key = h.private_key
        if (h.host_key) hop.host_key = h.host_key
        return hop
      })
    }
  }

  return entry
}

export function populateFormFromEntry(s: EntryFormState, e: AddressBookEntry): EntryFormState {
  const next = { ...s, name: e.name, displayName: e.display_name ?? '' }
  const t = e.session_type
  next.type = t
  if (t === 'ssh') {
    next.hostname = e.hostname || ''
    next.port = String(e.port || 22)
    next.username = e.username || ''
    next.sshPromptCreds = !!e.prompt_credentials
  } else if (t === 'rdp') {
    next.rdpHostname = e.hostname || ''
    next.rdpPort = String(e.port || 3389)
    next.rdpUsername = e.username || ''
    next.rdpDomain = e.domain || ''
    next.rdpSecurity = e.security || ''
    next.rdpIgnoreCert = !!e.ignore_cert
    next.rdpAuthPkg = e.auth_pkg || ''
    next.rdpKdcUrl = e.kdc_url || ''
    next.rdpPromptCreds = !!e.prompt_credentials
  } else if (t === 'vnc') {
    next.vncHostname = e.hostname || ''
    next.vncPort = String(e.port || 5900)
    next.vncColorDepth = e.color_depth ? String(e.color_depth) : ''
    next.vncPromptCreds = !!e.prompt_credentials
  } else if (t === 'web') {
    next.url = e.url || ''
    next.banner = e.banner || ''
    next.loginScript = e.login_script || ''
    next.webUsername = e.username || ''
    if (e.autofill) {
      try {
        const af = typeof e.autofill === 'string' ? JSON.parse(e.autofill) : e.autofill
        if (Array.isArray(af)) {
          next.autofillRows = af.map((r: { url?: string; username?: string; password?: string }) => ({
            url: r.url || '',
            username: r.username || '$USERNAME',
            password: r.password || '$PASSWORD',
          }))
        }
      } catch {
        /* ignore */
      }
    }
    if (e.allowed_domains?.length) next.allowedDomains = e.allowed_domains.slice()
  } else if (t === 'vdi') {
    next.vdiImage = e.container_image || ''
    next.vdiCpu = e.container_cpu_limit != null ? String(e.container_cpu_limit) : ''
    next.vdiMemory = e.container_memory_limit != null ? String(e.container_memory_limit) : ''
    if (e.container_env) {
      next.vdiEnv = Object.keys(e.container_env)
        .map((k) => `${k}=${e.container_env![k]}`)
        .join('\n')
    }
    next.vdiIdle = e.container_idle_timeout_mins != null ? String(e.container_idle_timeout_mins) : ''
    next.vdiBanner = e.banner || ''
  }
  if (t === 'ssh' || t === 'rdp') {
    next.enableDrive = !!e.enable_drive
  }
  if (t === 'rdp' && (e.remote_app || e.remote_app_dir || e.remote_app_args)) {
    next.remoteApp = e.remote_app || ''
    next.remoteAppDir = e.remote_app_dir || ''
    next.remoteAppArgs = e.remote_app_args || ''
  }
  if (e.enable_recording !== null && e.enable_recording !== undefined) {
    next.overrideRecording = true
    next.enableRecording = e.enable_recording !== false
    next.maxRecordings = String(e.max_recordings || 0)
  } else if (e.max_recordings) {
    next.overrideRecording = true
    next.enableRecording = true
    next.maxRecordings = String(e.max_recordings)
  }
  if (t === 'rdp') {
    next.enableGfx = !!e.enable_gfx
    next.enableDesktopComp = !!e.enable_desktop_composition
    next.forceLossless = !!e.force_lossless
    next.enableH264 = !!e.enable_h264
  }
  next.disableCopy = !!e.disable_copy
  next.disablePaste = !!e.disable_paste
  next.allowSharing = !!e.allow_sharing
  next.autoOpenSingleton = !!e.auto_open_if_singleton
  if (e.jump_hosts?.length) {
    next.hops = e.jump_hosts.map((h) => ({
      hostname: h.hostname || '',
      port: h.port || 22,
      username: h.username || '',
      password: '',
      private_key: '',
      host_key: h.host_key,
      host_key_fingerprint: h.host_key_fingerprint,
    }))
  } else {
    next.hops = []
  }
  return next
}
