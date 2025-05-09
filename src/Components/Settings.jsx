import React, { useState, useEffect } from 'react';
import { supabase } from '../library/supabaseClient';
import '../CSS/Settings.css';
import { FaUser, FaEnvelope, FaLock, FaCamera, FaSave } from 'react-icons/fa';

const STORAGE_BUCKET = 'guidelines';
const PROFILE_PICS_FOLDER = 'private/profile-pictures';

const Settings = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;

      if (authUser) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (userError) throw userError;

        setUser(userData);
        setFormData(prev => ({
          ...prev,
          full_name: userData.user_name || '',
          email: userData.email || '',
        }));
        
        if (userData.profile_link) {
          setPreviewUrl(userData.profile_link);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadProfileImage = async (userId, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `${PROFILE_PICS_FOLDER}/${fileName}`;
      
      // Check if there's a previous profile image to delete
      if (user.profile_link) {
        try {
          // Extract the file path from the URL
          const previousUrl = user.profile_link;
          const previousPath = previousUrl.split('/storage/v1/object/public/guidelines/')[1];
          
          if (previousPath) {
            // Delete the previous profile image
            const { error: deleteError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .remove([decodeURIComponent(previousPath)]);
            
            if (deleteError) {
              console.error('Error deleting previous profile image:', deleteError);
            } else {
              console.log('Previous profile image deleted successfully');
            }
          }
        } catch (deleteError) {
          console.error('Error processing previous image deletion:', deleteError);
          // Continue with upload even if deletion fails
        }
      }
      
      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (progress) => {
            const calculatedProgress = (progress.loaded / progress.total) * 100;
            setUploadProgress(calculatedProgress);
          },
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadProgress(0);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let profileLink = user?.profile_link;

      // Upload new profile image if selected
      if (profileImage) {
        profileLink = await uploadProfileImage(user.id, profileImage);
      }

      // Update user profile in users table
      const { error: updateError } = await supabase
        .from('users')
        .update({
          user_name: formData.full_name,
          profile_link: profileLink
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update password if provided
      if (formData.new_password) {
        if (formData.new_password !== formData.confirm_password) {
          throw new Error('New passwords do not match');
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.new_password
        });

        if (passwordError) throw passwordError;
      }

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));

      // Refresh user data
      await fetchUserProfile();

      alert('Settings updated successfully!');
      
      // Reload the page after successful save
      window.location.reload();
    } catch (error) {
      console.error('Error updating settings:', error.message);
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="settings-loading">Loading...</div>;
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account settings and preferences</p>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="settings-section">
          <h2>Profile Information</h2>
          <div className="profile-image-section">
            <div className="profile-image-container">
              {previewUrl ? (
                <>
                  <img 
                    src={previewUrl} 
                    alt="Profile" 
                    className="profile-image"
                  />
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="upload-progress-overlay">
                      <div 
                        className="progress-circle" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <FaUser className="default-avatar" />
              )}
              <label className="image-upload-label">
                <FaCamera />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <p>Click the camera icon to change your profile picture</p>
          </div>

          <div className="form-group">
            <label>
              <FaUser /> User Name
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label>
              <FaEnvelope /> Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              disabled
            />
          </div>
        </div>

        <div className="settings-section">
          <h2>Security</h2>
          <div className="form-group">
            <label>
              <FaLock /> Current Password
            </label>
            <input
              type="password"
              name="current_password"
              value={formData.current_password}
              onChange={handleInputChange}
              placeholder="Enter current password"
            />
          </div>

          <div className="form-group">
            <label>
              <FaLock /> New Password
            </label>
            <input
              type="password"
              name="new_password"
              value={formData.new_password}
              onChange={handleInputChange}
              placeholder="Enter new password"
            />
          </div>

          <div className="form-group">
            <label>
              <FaLock /> Confirm New Password
            </label>
            <input
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleInputChange}
              placeholder="Confirm new password"
            />
          </div>
        </div>

        <div className="settings-actions">
          <button type="submit" className="save-button" disabled={saving}>
            <FaSave /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings; 