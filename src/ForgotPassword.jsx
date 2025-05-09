import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaArrowLeft } from 'react-icons/fa';
import './CSS/Login.css';
import { supabase } from './library/supabaseClient';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Simple email validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    // Supabase password recovery
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setError(error.message || 'Failed to send reset email.');
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError('An unexpected error occurred.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft />
        </button>
        <div className="auth-header">
          <h1>Forgot Password</h1>
          <p>Enter your email to reset your password</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        {submitted ? (
          <div className="success-message">
            If this email is registered, you will receive a password reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="forgot-email">Email</label>
              <div className="input-group">
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  id="forgot-email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <button type="submit" className="auth-submit-button">Send Reset Link</button>
          </form>
        )}
        <div className="auth-footer">
          <p>
            Remembered your password?{' '}
            <Link to="/login" className="auth-link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 