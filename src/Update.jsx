import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaLock, FaArrowLeft } from 'react-icons/fa';
import { supabase } from './library/supabaseClient';
import './CSS/Login.css';

const Update = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Only allow access if the URL hash contains type=recovery
    if (window.location.hash.includes('type=recovery')) {
      setAllowed(true);
    } else {
      setAllowed(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ email, password });
      if (error) {
        setError(error.message || 'Failed to update credentials.');
        setIsLoading(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError('An unexpected error occurred.');
    }
    setIsLoading(false);
  };

  if (!allowed) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Access Denied</h1>
            <p>This page can only be accessed from the password reset link in your email.</p>
          </div>
          <button className="auth-submit-button" onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    );
  }

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
          <h1>Update Credentials</h1>
          <p>Enter your new email and password below</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Credentials updated successfully!</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter new email"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>
          </div>
          <button type="submit" className="auth-submit-button" disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Credentials'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Update; 