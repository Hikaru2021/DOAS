import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './CSS/Authorization.css';
import { FaUser } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { supabase } from './library/supabaseClient'; // Ensure you have supabaseClient.js set up

function Authorization() {
  const [action, setAction] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const navigate = useNavigate();

  const registerLink = () => {
    setAction('active');
    console.log('Register clicked, new state: active');
  };

  const loginLink = () => {
    setAction('');
    console.log('Login clicked, new state: inactive');
  };

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  
    if (error) {
      console.error('Login error:', error);
      alert(`Login failed: ${error.message}`); // Show error to user
    } else {
      console.log('Login successful:', data);
      navigate('/Dashboard');
    }
  };
  

  const handleRegister = async (e) => {
    e.preventDefault();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    }, {
      data: { full_name: fullName }
    });

    if (signUpError) {
      console.error('Registration error:', signUpError.message);
    } else {
      console.log('Registration successful:', signUpData);

      const userId = signUpData.user.id;

      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert([
          { id: userId, full_name: fullName },
        ])
        .select();

      if (insertError) {
        console.error('Insert error:', insertError.message);
      } else {
        console.log('Insert successful:', insertData);
        navigate('/Dashboard');
      }
    }
  };

  return (
    <div className='authorization-body'>
      <div className={`wrapper ${action}`}> 
        {/* Login Form */}
        <div className='form-box login'>
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <h1>Login</h1>
            <div className='input-box'>
              <input 
                type="email" 
                placeholder='Email' 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {/* <FaUser className='icon' /> */}
            </div>
            <div className='input-box'>
              <input 
                type="password" 
                placeholder='Password' 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* <FaKey className='icon' /> */}
            </div>
            <div className='remember-forgot'>
              <label>
                <input type='checkbox' /> Remember me 
              </label>
              <Link to="#">Forgot Password?</Link>
            </div>
            <button type='submit'>Login</button>
            <div className="register-link">
              <p>Don`t have an account? <Link to="#" onClick={registerLink}>Register</Link></p>
            </div>
          </form>
        </div>

        {/* Register Form */}
        <div className='form-box register'>
          <form onSubmit={handleRegister}>
            <h1>Register</h1>
            <div className='input-box'>
              <input 
                type="text" 
                placeholder='Full Name' 
                required 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <FaUser className='icon' />
            </div>
            <div className='input-box'>
              <input 
                type="email" 
                placeholder='Email' 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <MdEmail className='icon' />
            </div>
            <div className='input-box'>
              <input 
                type="password" 
                placeholder='Password' 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* <FaKey className='icon' /> */}
            </div>
            <div className='remember-forgot'>
              <label>
                <input type='checkbox' /> I agree to the terms & conditions
              </label>
            </div>
            <button type='submit'>Register</button>
            <div className="register-link">
              <p>Already have an account? <Link to="#" onClick={loginLink}>Login</Link></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Authorization;