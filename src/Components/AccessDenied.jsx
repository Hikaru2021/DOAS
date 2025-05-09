import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../library/supabaseClient";
import { getRoleName } from "./AuthUtils";
import "../CSS/ErrorPage.css";
import { FaLock, FaArrowLeft, FaTachometerAlt } from "react-icons/fa";

const AccessDenied = ({ requiredRoles, customMessage }) => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    getUserProfile();
  }, []);

  const getUserProfile = async () => {
    try {
      // Get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;

      if (user) {
        // Fetch user data from public.users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;

        setUserProfile(userData);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const getRequiredRolesText = () => {
    if (!requiredRoles || requiredRoles.length === 0) return "appropriate";
    
    return requiredRoles
      .map(roleId => getRoleName(roleId))
      .join(" or ");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoToDashboard = () => {
    navigate("/Dashboard");
  };

  return (
    <div className="error-page-container">
      <div className="error-content">
        <div className="error-icon">
          <FaLock size={50} color="#ff5555" />
        </div>
        <h1 className="error-code">403</h1>
        <h2 className="error-title">Access Denied</h2>
        
        <p className="error-message">
          {customMessage || `You don't have permission to access this page. This area requires ${getRequiredRolesText()} role privileges.`}
        </p>

        <div className="error-actions">
          <button onClick={handleGoBack} className="btn btn-secondary">
            <FaArrowLeft className="btn-icon" /> Go Back
          </button>
          <button onClick={handleGoToDashboard} className="btn btn-primary">
            <FaTachometerAlt className="btn-icon" /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied; 