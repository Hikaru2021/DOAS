import React from "react";
import "../CSS/LoadingSpinner.css";

const LoadingSpinner = ({ size = "medium", message = "Loading..." }) => {
  const sizeClass = size === "small" ? "spinner-small" : size === "large" ? "spinner-large" : "spinner-medium";
  
  return (
    <div className="spinner-container">
      <div className={`spinner ${sizeClass}`}></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner; 