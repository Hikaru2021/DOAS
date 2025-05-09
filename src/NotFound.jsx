import React from "react";
import { useNavigate } from "react-router-dom";
import "./CSS/ErrorPage.css";

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="error-page-container">
      <div className="error-content">
        <h1 className="error-code">404</h1>
        <h2 className="error-title">Page Not Found</h2>
        <p className="error-message">
          Sorry, the page you are looking for doesn't exist or has been moved.
        </p>
        <div className="error-actions">
          <button onClick={handleGoBack} className="btn btn-secondary">
            Go Back
          </button>
          <button onClick={handleGoHome} className="btn btn-primary">
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 