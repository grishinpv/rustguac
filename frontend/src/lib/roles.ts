import type { Role } from '../types/api'

export const roleLevel: Record<Role, number> = {
  admin: 4,
  poweruser: 3,
  operator: 2,
  viewer: 1,
}

export function hasRole(userRole: Role | string | undefined, min: Role): boolean {
  if (!userRole) return false
  const r = userRole as Role
  return (roleLevel[r] ?? 0) >= roleLevel[min]
}
