export type Role = 'admin' | 'poweruser' | 'operator' | 'viewer'

export interface AuthStatus {
  oidc_enabled?: boolean
  site_title?: string
  drive_configured?: boolean
  theme?: ThemePayload
}

export interface ThemePayload {
  presets?: Record<string, Record<string, string>>
  admin_preset?: string
  admin_colors?: Record<string, string>
  logo_url?: string
}

export interface MeResponse {
  name: string
  email: string
  role: Role
  groups?: string[]
  auth_type?: string
  vault_enabled: boolean
  vault_configured: boolean
}

export interface AddressBookFolder {
  name: string
  scope: string
  description?: string
  path?: string
  has_children?: boolean
  entries?: AddressBookEntry[]
}

export interface AddressBookBatch {
  folders: AddressBookFolder[]
}

export interface AddressBookEntry {
  name: string
  display_name?: string
  session_type: 'ssh' | 'rdp' | 'vnc' | 'web' | 'vdi'
  hostname?: string
  port?: number
  username?: string
  url?: string
  domain?: string
  security?: string
  ignore_cert?: boolean
  auth_pkg?: string
  kdc_url?: string
  color_depth?: number
  prompt_credentials?: boolean
  has_credentials?: boolean
  jump_hosts?: JumpHost[]
  enable_drive?: boolean
  disable_copy?: boolean
  disable_paste?: boolean
  autofill?: string | unknown[]
  allowed_domains?: string[]
  login_script?: string
  banner?: string
  container_image?: string
  container_cpu_limit?: number
  container_memory_limit?: number
  container_idle_timeout_mins?: number
  container_env?: Record<string, string>
  remote_app?: string
  remote_app_dir?: string
  remote_app_args?: string
  enable_recording?: boolean | null
  max_recordings?: number
  enable_gfx?: boolean
  enable_desktop_composition?: boolean
  force_lossless?: boolean
  enable_h264?: boolean
  allow_sharing?: boolean
  auto_open_if_singleton?: boolean
}

export interface JumpHost {
  hostname: string
  port?: number
  username?: string
  password?: string
  private_key?: string
  host_key?: string
  host_key_fingerprint?: string
}

export interface SessionInfo {
  session_id: string
  session_type: string
  status: string
  client_url: string
  share_url?: string | null
  hostname?: string
  username?: string
  url?: string
  created_by?: string
  active_connections: number
  entry_display_name?: string
  address_book_entry?: string
  address_book_folder?: string
  thumbnail_url?: string
}

export interface VdiContainer {
  container_name: string
  image?: string
  has_active_session: boolean
  entry_key?: string
  thumbnail_url?: string
}

export interface SearchIndexRow {
  scope: string
  folder_path: string
  entry: AddressBookEntry
}

export interface SearchIndexResponse {
  entries: SearchIndexRow[]
}

export interface CredentialVariablesResponse {
  variables?: Record<string, unknown>
  domains?: Record<string, { name: string; entry_count: number }[]>
}

export interface MyCredentialsResponse {
  credentials?: Record<string, { display?: string }>
}

export interface SystemStatus {
  version: string
  sessions: { active: number; pending: number; total_current: number }
  users: { count: number }
  history: { total_sessions: number }
  recordings: { count: number; size_mb: number; disk_usage_pct: number }
  vault: { configured: boolean; connected: boolean }
  features: { oidc: boolean; drive: boolean; tls: boolean }
}

export interface OidcUser {
  email: string
  name: string
  role: Role
  oidc_groups?: string
  disabled?: boolean
  last_login_at?: string | null
}

export interface GroupMapping {
  id: number
  oidc_group: string
  role: Role
  created_at?: string
}

export interface UserTokenRow {
  id: number
  email?: string
  name: string
  max_role?: string | null
  expires_at?: string | null
  created_at?: string | null
  last_used_at?: string | null
  disabled?: boolean
}

export interface TokenAuditRow {
  created_at?: string
  user_email?: string
  token_name?: string
  action?: string
  ip_addr?: string
  details?: string
}

export interface AddressbookAuditRow {
  created_at?: string
  user_email?: string
  action?: string
  scope?: string
  folder_path?: string
  entry_name?: string
  ip_addr?: string
  details?: string
}

export interface RecordingRow {
  name: string
  user?: string
  session_type?: string
  folder?: string
  entry_display_name?: string
  address_book_entry?: string
  size_bytes: number
  modified?: string
  created_at?: string
}

export interface ReportsSummary {
  total_sessions?: number
  total_hours?: number
  unique_users?: number
  active_now?: number
}

export interface HistorySession {
  created_by?: string
  username?: string
  entry_display_name?: string
  address_book_entry?: string
  address_book_folder?: string
  session_type?: string
  hostname?: string
  started_at?: string
  duration_secs?: number
  status?: string
  recording_file?: string | null
}

export interface ReportsSessionsPage {
  sessions: HistorySession[]
  total: number
  limit: number
  offset: number
}

export interface DocSection {
  slug: string
  title: string
  html: string
}

export interface CreateSessionResponse {
  session_id: string
  client_url: string
  share_url?: string
}

export interface ShadowResponse {
  url: string
}
