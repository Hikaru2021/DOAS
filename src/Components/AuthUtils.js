import { supabase } from "../library/supabaseClient";

/**
 * Check if the current user is authenticated
 * @returns {Promise<{isAuthenticated: boolean, user: Object|null}>}
 */
export const checkAuthentication = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    return {
      isAuthenticated: !!user,
      user
    };
  } catch (error) {
    console.error("Authentication check error:", error);
    return {
      isAuthenticated: false,
      user: null
    };
  }
};

/**
 * Get the user's role
 * @param {string} userId - The user ID
 * @returns {Promise<{role: number|null, error: string|null}>}
 */
export const getUserRole = async (userId) => {
  try {
    if (!userId) return { role: null, error: "No user ID provided" };
    
    const { data, error } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    
    return {
      role: data.role_id,
      error: null
    };
  } catch (error) {
    console.error("Error getting user role:", error);
    return {
      role: null,
      error: error.message || "Failed to get user role"
    };
  }
};

/**
 * Check if user has the required role(s)
 * @param {number} userRole - The user's role ID
 * @param {number[]} allowedRoles - Array of allowed role IDs
 * @returns {boolean} True if user has permission
 */
export const hasRequiredRole = (userRole, allowedRoles = []) => {
  if (allowedRoles.length === 0) return true; // No role restriction
  return allowedRoles.includes(userRole);
};

/**
 * Convert role ID to role name
 * @param {number} roleId - The role ID
 * @returns {string} The role name
 */
export const getRoleName = (roleId) => {
  switch (roleId) {
    case 1: return 'Admin';
    case 2: return 'Manager';
    case 3: return 'User';
    default: return 'Unknown';
  }
};

/**
 * Get the allowed roles as a readable string
 * @param {number[]} allowedRoles - Array of allowed role IDs
 * @returns {string} Comma-separated list of role names
 */
export const getAllowedRolesString = (allowedRoles = []) => {
  if (allowedRoles.length === 0) return "All roles";
  
  return allowedRoles
    .map(roleId => getRoleName(roleId))
    .join(' or ');
}; 