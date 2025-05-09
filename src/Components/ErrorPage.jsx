import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../library/supabaseClient";
import "../CSS/ErrorPage.css";

const ErrorPage = ({ statusCode = 404, message }) => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndGetProfile();
  }, []);

  const checkAuthAndGetProfile = async () => {
    try {
      // Get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;

      if (user) {
        setIsAuthenticated(true);
        
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
      setIsAuthenticated(false);
    }
  };

  const getRoleName = (roleId) => {
    switch (roleId) {
      case 1: return 'Admin';
      case 2: return 'Manager';
      case 3: return 'User';
      default: return 'Unknown';
    }
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
        <h1 className="error-code">{statusCode}</h1>
        <h2 className="error-title">
          {statusCode === 404 ? "Page Not Found" : "Access Forbidden"}
        </h2>
        
        <p className="error-message">
          {message || (statusCode === 404 
            ? "The page you are looking for doesn't exist or has been moved." 
            : `You don't have permission to access this page. This area is restricted to ${
                statusCode === 403 && message ? message : "higher permission levels"
              }.`
          )}
        </p>
        <div className="error-actions">
          <button onClick={handleGoBack} className="btn btn-secondary">
            Go Back
          </button>
          {isAuthenticated && (
            <button onClick={handleGoToDashboard} className="btn btn-primary">
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorPage; 