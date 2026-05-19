import { api, getErrorMessage } from './client'
import type {
  AddressBookBatch,
  AddressBookEntry,
  AuthStatus,
  CreateSessionResponse,
  CredentialVariablesResponse,
  DocSection,
  GroupMapping,
  HistorySession,
  MeResponse,
  MyCredentialsResponse,
  OidcUser,
  RecordingRow,
  ReportsSessionsPage,
  ReportsSummary,
  SearchIndexResponse,
  SessionInfo,
  ShadowResponse,
  SystemStatus,
  TokenAuditRow,
  AddressbookAuditRow,
  UserTokenRow,
  VdiContainer,
} from '../types/api'

export async function fetchAuthStatus() {
  const { data } = await api.get<AuthStatus>('/api/auth/status')
  return data
}

export async function fetchMe() {
  const { data } = await api.get<MeResponse>('/api/me')
  return data
}

export async function fetchAddressBook() {
  const { data } = await api.get<AddressBookBatch>('/api/addressbook')
  return data
}

export async function fetchSubfolders(scope: string, path: string) {
  const { data } = await api.get(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(path)}/subfolders`)
  return data as Array<{ name: string; scope: string; description?: string; path?: string; has_children?: boolean }>
}

export async function fetchFolderConfig(scope: string, folderPath: string) {
  const { data } = await api.get(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(folderPath)}/config`)
  return data as { allowed_groups?: string[]; inherit_from_parent?: boolean }
}

export async function fetchEntries(scope: string, folder: string) {
  const { data } = await api.get(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(folder)}/entries`)
  return data as AddressBookEntry[]
}

export async function fetchSearchIndex() {
  const { data } = await api.get<SearchIndexResponse>('/api/addressbook/search-index')
  return data
}

export async function fetchLoginScripts() {
  const { data } = await api.get<{ scripts: string[] }>('/api/login-scripts')
  return data.scripts || []
}

export async function fetchKnownGroups() {
  const { data } = await api.get<{ groups: string[] }>('/api/auth/known-groups')
  return data.groups || []
}

export async function connectEntry(
  scope: string,
  folder: string,
  entry: string,
  body: Record<string, unknown>,
) {
  return api.post(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(folder)}/entries/${encodeURIComponent(entry)}/connect`, body)
}

export type ConnectEntrySuccess = { ok: true; data: CreateSessionResponse }
export type ConnectEntryMissingCreds = { ok: false; status: 412; missing_variables: string[] }
export type ConnectEntryFailure = { ok: false; status: number; message: string }

export async function connectEntryResult(
  scope: string,
  folder: string,
  entry: string,
  body: Record<string, unknown>,
): Promise<ConnectEntrySuccess | ConnectEntryMissingCreds | ConnectEntryFailure> {
  try {
    const { data } = await api.post<CreateSessionResponse>(
      `/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(folder)}/entries/${encodeURIComponent(entry)}/connect`,
      body,
    )
    return { ok: true, data }
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: unknown } }
    const status = err.response?.status
    if (status === 412) {
      const d = err.response?.data as { missing_variables?: string[] } | undefined
      return { ok: false, status: 412, missing_variables: d?.missing_variables || [] }
    }
    return { ok: false, status: status || 0, message: getErrorMessage(e) }
  }
}

export async function deleteEntry(scope: string, folder: string, entry: string) {
  await api.delete(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(folder)}/entries/${encodeURIComponent(entry)}`)
}

export async function createEntry(scope: string, folder: string, body: Record<string, unknown>) {
  await api.post(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(folder)}/entries`, body)
}

export async function updateEntry(scope: string, folder: string, entry: string, body: Record<string, unknown>) {
  await api.put(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(folder)}/entries/${encodeURIComponent(entry)}`, body)
}

export async function createFolder(body: Record<string, unknown>) {
  await api.post('/api/addressbook/folders', body)
}

export async function updateFolder(scope: string, path: string, body: Record<string, unknown>) {
  await api.put(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(path)}`, body)
}

export async function deleteFolder(scope: string, path: string) {
  const { data } = await api.delete(`/api/addressbook/folders/${encodeURIComponent(scope)}/${encodeURIComponent(path)}`)
  return data as { entries_deleted?: number; subfolders_deleted?: number } | null
}

export async function fetchSessionsList(all?: boolean) {
  const { data } = await api.get<SessionInfo[]>('/api/sessions', { params: all ? { all: 'true' } : undefined })
  return data
}

export async function deleteSession(id: string) {
  await api.delete(`/api/sessions/${id}`)
}

export async function shadowSession(id: string) {
  const { data } = await api.post<ShadowResponse>(`/api/sessions/${id}/shadow`)
  return data
}

export async function createAdhocSession(body: Record<string, unknown>) {
  const { data } = await api.post<CreateSessionResponse>('/api/sessions', body)
  return data
}

export async function fetchVdiContainers() {
  const { data } = await api.get<VdiContainer[]>('/api/vdi/containers')
  return data
}

export async function probeHostKey(hostname: string, port: number) {
  const { data } = await api.post<{ fingerprint: string; algorithm: string; host_key: string }>('/api/ssh/probe-host-key', {
    hostname,
    port,
  })
  return data
}

export async function fetchCredentialVariables() {
  const { data } = await api.get<CredentialVariablesResponse>('/api/credential-variables')
  return data
}

export async function fetchMyCredentials() {
  const { data } = await api.get<MyCredentialsResponse>('/api/me/credentials')
  return data
}

export async function saveMyCredentials(credentials: Record<string, string>) {
  await api.put('/api/me/credentials', { credentials })
}

export async function fetchRecordings() {
  const { data } = await api.get<RecordingRow[]>('/api/recordings')
  return data
}

export async function deleteRecording(name: string) {
  await api.delete(`/api/recordings/${encodeURIComponent(name)}`)
}

export async function fetchReportsSummary() {
  const { data } = await api.get<ReportsSummary>('/api/reports/summary')
  return data
}

export async function fetchReportsSessions(limit: number, offset: number) {
  const { data } = await api.get<ReportsSessionsPage>('/api/reports/sessions', { params: { limit, offset } })
  return data
}

export async function fetchTopConnections() {
  const { data } = await api.get('/api/reports/top-connections')
  return data as Array<{
    name?: string
    address_book_entry?: string
    session_type?: string
    session_count?: number
    total_hours?: number
  }>
}

export async function fetchTopUsers() {
  const { data } = await api.get('/api/reports/top-users')
  return data as Array<{ user: string; session_count?: number; total_hours?: number; last_session?: string }>
}

export async function fetchReportsCsv() {
  const { data } = await api.get<string>('/api/reports/sessions/csv', { responseType: 'text' })
  return data
}

export async function fetchDocs() {
  const { data } = await api.get<DocSection[]>('/api/docs')
  return data
}

export async function fetchMyTokens() {
  const { data } = await api.get('/api/me/tokens')
  return data as Array<{
    id: number
    name: string
    max_role?: string | null
    expires_at?: string | null
    created_at?: string | null
    last_used_at?: string | null
    disabled?: boolean
  }>
}

export async function createMyToken(body: { name: string; max_role?: string; expires_at?: string }) {
  const { data } = await api.post<{ token: string }>('/api/me/tokens', body)
  return data
}

export async function revokeMyToken(id: number) {
  await api.delete(`/api/me/tokens/${id}`)
}

export async function fetchSystemStatus() {
  const { data } = await api.get<SystemStatus>('/api/system/status')
  return data
}

export async function fetchUsers() {
  const { data } = await api.get<OidcUser[]>('/api/users')
  return data
}

export async function setUserRole(email: string, role: string) {
  await api.put(`/api/users/${encodeURIComponent(email)}/role`, { role })
}

export async function deleteUser(email: string) {
  await api.delete(`/api/users/${encodeURIComponent(email)}`)
}

export async function disableUser(email: string) {
  await api.post(`/api/users/${encodeURIComponent(email)}/disable`)
}

export async function enableUser(email: string) {
  await api.post(`/api/users/${encodeURIComponent(email)}/enable`)
}

export async function forceLogoutUser(email: string) {
  const { data } = await api.delete(`/api/users/${encodeURIComponent(email)}/sessions`)
  return data as { sessions_revoked?: number }
}

export async function fetchGroupMappings() {
  const { data } = await api.get<GroupMapping[]>('/api/admin/group-mappings')
  return data
}

export async function createGroupMapping(group: string, role: string) {
  await api.post('/api/admin/group-mappings', { group, role })
}

export async function updateGroupMapping(id: number, group: string, role: string) {
  await api.put(`/api/admin/group-mappings/${id}`, { group, role })
}

export async function deleteGroupMapping(id: number) {
  await api.delete(`/api/admin/group-mappings/${id}`)
}

export async function fetchAdminTokens() {
  const { data } = await api.get<UserTokenRow[]>('/api/admin/user-tokens')
  return data
}

export async function createAdminToken(body: {
  email: string
  name: string
  max_role?: string
  expires_at?: string
}) {
  const { data } = await api.post<{ token: string }>('/api/admin/user-tokens', body)
  return data
}

export async function revokeAdminToken(id: number) {
  await api.delete(`/api/admin/user-tokens/${id}`)
}

export async function fetchTokenAudit(email?: string) {
  const { data } = await api.get<TokenAuditRow[]>('/api/admin/token-audit', {
    params: { limit: 50, ...(email ? { email } : {}) },
  })
  return data
}

export async function fetchAddressbookAudit(email?: string) {
  const { data } = await api.get<AddressbookAuditRow[]>('/api/admin/addressbook-audit', {
    params: { limit: 100, ...(email ? { email } : {}) },
  })
  return data
}

export async function validateApiKey(key: string) {
  await api.get('/api/sessions', { headers: { Authorization: `Bearer ${key}` } })
}

export async function logout() {
  await api.get('/auth/logout')
}

export type { HistorySession }
