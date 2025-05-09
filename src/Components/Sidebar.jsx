import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../library/supabaseClient";
import "../CSS/Sidebar.css";
import "../CSS/SidebarProfile.css";
import { FaChevronDown, FaTachometerAlt, FaUsers, FaClipboardList, FaChartBar, FaSignOutAlt, FaFolderOpen, FaList, FaUser, FaBook, FaMapMarkedAlt } from "react-icons/fa";

const STORAGE_BUCKET = 'guidelines';

const Sidebar = () => {
  const [isApplicationsOpen, setIsApplicationsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Minimize sidebar by default on mobile view
    if (window.innerWidth <= 768) {
      setMinimized(true);
    }
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

        setUserProfile({
          email: userData.email,
          user_name: userData.user_name,
          role_id: userData.role_id,
          profile_link: userData.profile_link
        });

        // Set profile image URL if available
        if (userData.profile_link) {
          setProfileImageUrl(userData.profile_link);
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout failed:", error.message);
      } else {
        navigate("/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/login");
    }
  };

  const handleProfileClick = () => {
    navigate('/Settings');
  };

  if (profileLoading) {
    return null;
  }

  return (
    <>
      {/* Floating Hamburger Button for Mobile */}
      {minimized && (
        <button
          className="sidebar-hamburger-btn"
          onClick={() => setMinimized(false)}
          aria-label="Open sidebar"
        >
          &#9776;
        </button>
      )}
      <div className={`sidebar${minimized ? ' minimized' : ''}`}>
        {/* Mobile Minimize Button (only show when not minimized) */}
        {!minimized && (
          <button 
            className="sidebar-minimize-btn"
            onClick={() => setMinimized(true)}
            aria-label="Minimize sidebar"
          >
            ×
          </button>
        )}
        <div className="sidebar-header">
          <img src="/Logo1.png" alt="DENR GreenCertify" className="sidebar-logo" />
          <h2 className="sidebar-title">DENR</h2>
          <h2 className="sidebar-title">GREENCERTIFY</h2>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-title">MAIN MENU</p>
          <ul className="sidebar-menu">
            <li>
              <NavLink to="/Dashboard">
                <FaTachometerAlt className="sidebar-icon" />
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <button
                className={`dropdown-btn ${isApplicationsOpen ? 'open' : ''}`}
                onClick={() => setIsApplicationsOpen(!isApplicationsOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <FaClipboardList className="sidebar-icon" />
                  <span>Applications</span>
                </div>
                <FaChevronDown className="dropdown-icon" />
              </button>
              {isApplicationsOpen && (
                <ul className={`dropdown-menu ${isApplicationsOpen ? 'open' : ''}`}>
                  <li>
                    <NavLink to="/ApplicationCatalog">
                      <FaBook className="sidebar-icon" />
                      <span>Application Catalog</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/MyApplication">
                      <FaFolderOpen className="sidebar-icon" />
                      <span>My Applications</span>
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </div>

        {/* Only show Manage section if user's role is not 3 */}
        {userProfile?.role_id !== 3 && (
          <div className="sidebar-section">
            <p className="sidebar-section-title">MANAGE</p>
            <ul className="sidebar-menu">
              {/* Only show Users management to admins (role_id = 1) */}
              {userProfile?.role_id === 1 && (
                <li>
                  <NavLink to="/User">
                    <FaUsers className="sidebar-icon" />
                    <span>Users</span>
                  </NavLink>
                </li>
              )}
              {/* Hide Application List for role_id 3 and inspector (role_id 4) */}
              {userProfile?.role_id !== 3 && userProfile?.role_id !== 4 && (
                <li>
                  <NavLink to="/ApplicationList">
                    <FaClipboardList className="sidebar-icon" />
                    <span>Application List</span>
                  </NavLink>
                </li>
              )}
              <li>
                <NavLink to="/Maps">
                  <FaMapMarkedAlt className="sidebar-icon" />
                  <span>Maps</span>
                </NavLink>
              </li>
              {/* Hide Reports for role_id 3 and inspector (role_id 4) */}
              {userProfile?.role_id !== 3 && userProfile?.role_id !== 4 && (
                <li>
                  <NavLink to="/Reports">
                    <FaChartBar className="sidebar-icon" />
                    <span>Reports</span>
                  </NavLink>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* User Profile Section at Bottom */}
        <div className="sidebar-profile">
          <div className="profile-info" onClick={handleProfileClick}>
            <div className="profile-avatar">
              {profileImageUrl ? (
                <img 
                  src={profileImageUrl} 
                  alt="Profile" 
                  className="profile-image" 
                />
              ) : (
                <FaUser className="avatar-icon" />
              )}
            </div>
            <div className="profile-details">
              <p className="profile-name">{userProfile?.user_name || 'User'}</p>
              <p className="profile-email">{userProfile?.email || 'user@example.com'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <FaSignOutAlt />
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
