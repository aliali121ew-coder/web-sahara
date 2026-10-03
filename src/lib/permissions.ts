import { CompanyScope, UserRole } from '../types';

export interface UserSession {
  id: string;
  name: string;
  role: UserRole;
  allowedScope?: CompanyScope; // if assigned to single company
}

/**
 * 🔒 Security Guard: Checks whether a specific user role has permission
 * to read/view data belonging to a given company scope.
 */
export function hasCompanyScopeAccess(
  userRole: UserRole,
  targetScope: CompanyScope
): boolean {
  // Admins and supervisors have full organizational access across both companies
  if (userRole === 'admin' || userRole === 'supervisor') {
    return true;
  }

  // Operators are strictly bounded to their assigned company
  if (userRole === 'sahara_operator' && targetScope === 'sahara') {
    return true;
  }

  if (userRole === 'etihad_operator' && targetScope === 'etihad') {
    return true;
  }

  // Any other role is strictly blocked
  return false;
}

/**
 * 🔒 Return all company scopes accessible by the current role
 */
export function getAllowedScopes(userRole: UserRole): CompanyScope[] {
  if (userRole === 'admin' || userRole === 'supervisor') {
    return ['sahara', 'etihad'];
  }
  if (userRole === 'sahara_operator') {
    return ['sahara'];
  }
  if (userRole === 'etihad_operator') {
    return ['etihad'];
  }
  return [];
}

/**
 * 🔒 Operation Level Permissions (Read, Create, Update, Delete, Export)
 */
export function canPerformOperation(
  userRole: UserRole,
  scope: CompanyScope,
  action: 'read' | 'create' | 'update' | 'delete' | 'export'
): boolean {
  if (!hasCompanyScopeAccess(userRole, scope)) {
    return false;
  }

  if (userRole === 'admin') return true;

  // Supervisors can read & export
  if (userRole === 'supervisor') {
    return action === 'read' || action === 'export';
  }

  // Operators can read, create, update within their scope
  if (action === 'delete') {
    // Only admins or supervisors can delete
    return false;
  }

  return true;
}
