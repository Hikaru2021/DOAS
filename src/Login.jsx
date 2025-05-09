import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import { supabase } from './library/supabaseClient';
import './CSS/Login.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    setFieldErrors(prev => ({ ...prev, [name]: '' })); // Clear field error on change
    setError(''); // Clear general error
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setShowSuccessModal(true);
    setError('');
    setFieldErrors({ email: '', password: '' });

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFieldErrors(prev => ({ ...prev, email: 'Invalid email' }));
      setIsLoading(false);
      setShowSuccessModal(false);
      return;
    }

    try {
      // Check if email exists in users table
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', formData.email);
      if (checkError) throw checkError;
      if (!existingUsers || existingUsers.length === 0) {
        setFieldErrors(prev => ({ ...prev, email: 'Email not found' }));
        setIsLoading(false);
        setShowSuccessModal(false);
        return;
      }

      // Try to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setFieldErrors(prev => ({ ...prev, password: 'Incorrect password' }));
        setIsLoading(false);
        setShowSuccessModal(false);
        return;
      }

      // Fetch user status from the database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('status')
        .eq('email', formData.email)
        .single();

      if (userError) {
        setError('Unable to verify user status');
        setIsLoading(false);
        setShowSuccessModal(false);
        return;
      }

      if (userData.status === 2) {
        setFieldErrors(prev => ({ ...prev, email: 'Your account is blocked. Contact DENR admin.' }));
        setIsLoading(false);
        setShowSuccessModal(false);
        return;
      }

      // Show loading for 1 second before showing checkmark
      setTimeout(() => {
        setIsLoading(false);
        // Navigate after showing checkmark for 1.5 seconds
        setTimeout(() => {
          navigate('/Dashboard');
        }, 1500);
      }, 1000);

    } catch (error) {
      setError('An error occurred during login');
      setIsLoading(false);
      setShowSuccessModal(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          <FaArrowLeft />
        </button>
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Please login to your account</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {location.state?.message && (
          <div className="success-message">{location.state.message}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-group">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>
            {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
          </div>

          <div className="forgot-password-link" style={{ textAlign: 'right', marginBottom: '1rem' }}>
            <Link to="/forgot-password" className="auth-link">Forgot Password?</Link>
          </div>

          <button 
            type="submit" 
            className={`auth-submit-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Success Modal */}
      <div className={`success-modal ${showSuccessModal ? 'show' : ''}`}>
        <div className="success-modal-content">
          {isLoading ? (
            <div className="loading-circle"></div>
          ) : (
            <div className={`success-checkmark ${!isLoading ? 'show' : ''}`}>
              <svg viewBox="0 0 52 52">
                <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
              </svg>
            </div>
          )}
          <div className="success-modal-text">
            {isLoading ? 'Logging in...' : 'Successfully logged in!'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 