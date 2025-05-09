import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import { supabase } from './library/supabaseClient';
import './CSS/Login.css';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '', confirmPassword: '' });
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
    setFieldErrors({ email: '', password: '', confirmPassword: '' });

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFieldErrors(prev => ({ ...prev, email: `Email address [${formData.email}] is invalid` }));
      setIsLoading(false);
      setShowSuccessModal(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      setIsLoading(false);
      setShowSuccessModal(false);
      return;
    }

    // Password must be at least 6 characters, contain only letters and digits, and have at least one letter and one digit
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!passwordRegex.test(formData.password)) {
      setFieldErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters, contain letters and digits, and have at least one letter and one digit' }));
      setIsLoading(false);
      setShowSuccessModal(false);
      return;
    }

    try {
      // Check if email already exists in users table
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', formData.email);
      if (checkError) throw checkError;
      if (existingUsers && existingUsers.length > 0) {
        setFieldErrors(prev => ({ ...prev, email: 'Email already exists' }));
        setIsLoading(false);
        setShowSuccessModal(false);
        return;
      }

      // 1. Sign up the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert user data into public.users table
        const { error: dbError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              user_name: formData.username,
              email: formData.email,
              role_id: 3, // Default role_id for new signups
              status: 1 // Status 1 = active (numeric value instead of string)
            }
          ]);

        if (dbError) {
          // If there's an error inserting into public.users, we should handle it
          console.error('Error inserting into public.users:', dbError);
          throw new Error('Failed to create user profile');
        }

        // Show loading for 1 second before showing checkmark
        setTimeout(() => {
          setIsLoading(false);
          // Navigate after showing checkmark for 1.5 seconds
          setTimeout(() => {
            navigate('/login', { 
              state: { message: 'Registration successful! Please login to continue.' }
            });
          }, 1500);
        }, 1000);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError(error.message || 'An error occurred during signup');
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
          <h1>Create Account</h1>
          <p>Please fill in your details to sign up</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-group">
              <FaUser className="input-icon" />
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

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
                placeholder="Create a password"
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
              />
            </div>
            {fieldErrors.confirmPassword && <small className="field-error">{fieldErrors.confirmPassword}</small>}
          </div>

          <button 
            type="submit" 
            className={`auth-submit-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Signing up' : 'Sign Up'}
          </button>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Login
              </Link>
            </p>
          </div>
        </form>
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
            {isLoading ? 'Creating your account...' : 'Successfully signed up!'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup; 