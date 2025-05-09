import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner";
import AccessDenied from "./AccessDenied";
import { checkAuthentication, getUserRole, hasRequiredRole } from "./AuthUtils";

const RoleProtectedRoute = ({ 
  element, 
  allowedRoles = [], 
  redirectTo = "/login",
  errorMessage 
}) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        // Check if user is authenticated
        const { isAuthenticated, user } = await checkAuthentication();
        setIsAuthenticated(isAuthenticated);
        setUser(user);

        if (!isAuthenticated) {
          setLoading(false);
          return;
        }

        // Get user role
        const { role } = await getUserRole(user.id);
        setUserRole(role);
        
        // Check if user has required role
        const hasAccess = hasRequiredRole(role, allowedRoles);
        setHasPermission(hasAccess);
      } catch (error) {
        console.error("Access verification error:", error);
      } finally {
        setLoading(false);
      }
    };

    verifyAccess();
  }, [allowedRoles]);

  if (loading) {
    return <LoadingSpinner message="Checking permissions..." />;
  }

  // If user is not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // If user has permission
  if (hasPermission) {
    return element;
  }

  // If user doesn't have required role
  return <AccessDenied requiredRoles={allowedRoles} customMessage={errorMessage} />;
};

export default RoleProtectedRoute; 