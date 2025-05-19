import { useState, useCallback, useEffect, useRef } from "react";
import { FaTimes, FaCloudUploadAlt, FaInfoCircle, FaFileAlt, FaMoneyBillWave, FaListUl, FaTrash } from "react-icons/fa";
import { useDropzone } from "react-dropzone";
import { supabase } from "../library/supabaseClient";
import "../CSS/ApplicationSubmissionList.css";
import "../CSS/forms.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "../CSS/ApplicationCatalog.css";

// Supabase storage constants
const STORAGE_BUCKET = 'guidelines';

// Add a utility function at the top
function formatFee(value) {
  if (value === undefined || value === null || value === "") return "";
  const num = Number(value);
  if (isNaN(num)) return value;
  return Number.isInteger(num) ? num : num.toFixed(2);
}

// Fix for default marker icons in react-leaflet
if (L.Icon.Default && L.Icon.Default.prototype) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

// Add a function to fetch address from coordinates
async function fetchAddressFromCoords(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    return data.display_name || '';
  } catch (e) {
    return '';
  }
}

// CenterMapToMarker component
function CenterMapToMarker({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

const ApplicationSubmissionForm = ({ isOpen, onClose, application, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    contact_number: "",
    address: "",
    purpose: "",
    documents: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeStep, setActiveStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [location, setLocation] = useState({ lat: 10.6781, lng: 124.8006 }); // Default: Baybay City
  const [addressManuallyEdited, setAddressManuallyEdited] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressInputRef = useRef();
  let addressFetchTimeout = useRef();

  // Add useEffect for fetching user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('No authenticated user found');

        const { data: userData, error: userDataError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userDataError) throw userDataError;
        if (userData) {
          setFormData(prev => ({
            ...prev,
            email: userData.email || ''
          }));
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        setFormError('Error loading user data');
      }
    };

    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen]);

  // Try to auto-locate with GPS on first open of step 2
  useEffect(() => {
    if (isOpen && activeStep === 2) {
      if (navigator.geolocation) {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          if (!addressManuallyEdited) {
            const fetchedAddress = await fetchAddressFromCoords(lat, lng);
            setFormData(prev => ({ ...prev, address: fetchedAddress }));
          }
          setLocating(false);
        }, () => {
          setLocating(false); // If denied or error, just stop
        });
      }
    }
  }, [isOpen, activeStep, addressManuallyEdited]);

  // Fetch address suggestions from Nominatim (restricted to Leyte)
  const fetchAddressSuggestions = async (query) => {
    if (!query) {
      setAddressSuggestions([]);
      return;
    }
    try {
      // Leyte bounding box: viewbox=124.2,11.6,125.5,10.2 (left,top,right,bottom)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&viewbox=124.2,11.6,125.5,10.2&bounded=1`
      );
      const data = await response.json();
      setAddressSuggestions(data);
    } catch (e) {
      setAddressSuggestions([]);
    }
  };

  // Handle address input change (with debounce)
  const handleAddressInputChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, address: value }));
    setAddressManuallyEdited(true);
    setShowSuggestions(true);
    if (addressFetchTimeout.current) clearTimeout(addressFetchTimeout.current);
    addressFetchTimeout.current = setTimeout(() => {
      fetchAddressSuggestions(value);
    }, 400);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({ ...prev, address: suggestion.display_name }));
    setLocation({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  // Close suggestions on blur (with delay to allow click)
  const handleAddressBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const onDrop = useCallback((acceptedFiles) => {
    // Add preview URLs for display
    const filesWithPreview = acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file),
      id: `${file.name}-${Date.now()}`, // Add a unique ID for tracking
      status: 'pending' // pending, uploading, success, error
    }));
    
    setUploadedFiles(prev => [...prev, ...filesWithPreview]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateStep2 = () => {
    const errors = {};
    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
      setFieldErrors(errors);
      return false;
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
      setFieldErrors(errors);
      return false;
    }
    // Simple email regex for validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
      setFieldErrors(errors);
      return false;
    }
    if (!formData.contact_number.trim()) {
      errors.contact_number = 'Contact number is required';
      setFieldErrors(errors);
      return false;
    }
    if (!formData.address.trim()) {
      errors.address = 'Address is required';
      setFieldErrors(errors);
      return false;
    }
    if (!formData.purpose.trim()) {
      errors.purpose = 'Purpose is required';
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleNextStep = () => {
    setFormError(null);
    setFieldErrors({});
    if (activeStep === 2) {
      if (!validateStep2()) {
        return;
      }
    }
    setActiveStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setFormError(null);
    setActiveStep(prev => prev - 1);
  };

  const handleRemoveFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    
    // Clean up the file preview URL
    const fileToRemove = uploadedFiles.find(file => file.id === fileId);
    if (fileToRemove && fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const uploadFilesToStorage = async (userId, applicationId) => {
    setUploadingFiles(true);
    const uploadedFileData = [];
    
    try {
      // Upload each file to Supabase Storage
      for (const file of uploadedFiles) {
        // Update this file's status to uploading
        setUploadedFiles(prev => 
          prev.map(f => f.id === file.id ? {...f, status: 'uploading'} : f)
        );
        
        // Create a unique file path: private/{userId}/{applicationId}/{timestamp}-{filename}
        const timestamp = Date.now();
        const filePath = `private/${userId}/${applicationId}/${timestamp}-${file.name}`;
        
        // Upload to storage
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            onUploadProgress: (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setUploadProgress(prev => ({ ...prev, [file.id]: percent }));
            }
          });
          
        if (error) {
          console.error('Error uploading file:', error);
          setUploadedFiles(prev => 
            prev.map(f => f.id === file.id ? {...f, status: 'error'} : f)
          );
          throw error;
        }
        
        // Get public URL (or path if private)
        const { data: fileUrl } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(filePath);
          
        const fileData = {
          file_name: file.name,
          file_type: file.type,
          file_link: fileUrl?.publicUrl || filePath,
          user_submissions: applicationId
        };
        
        uploadedFileData.push(fileData);
        
        // Update this file's status to success
        setUploadedFiles(prev => 
          prev.map(f => f.id === file.id ? {...f, status: 'success'} : f)
        );
      }
      
      // Insert all file records into the documents table
      if (uploadedFileData.length > 0) {
        const { error: insertError } = await supabase
          .from('documents')
          .insert(uploadedFileData);
          
        if (insertError) {
          console.error('Error inserting document records:', insertError);
          throw insertError;
        }
      }
      
      return uploadedFileData;
    } catch (err) {
      console.error('Error in file upload process:', err);
      setFormError(`File upload error: ${err.message}`);
      throw err;
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Only process submit if we're on the final step
    if (activeStep !== 4) {
      handleNextStep();
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) throw new Error('You must be logged in to submit an application');

      // Insert into user_applications table
      const { data: applicationData, error: applicationError } = await supabase
        .from('user_applications')
        .insert([{
          user_id: user.id, // Use the authenticated user's ID
          application_id: application.id,
          status: 1, // Initial status (Submitted)
          full_name: formData.full_name,
          contact_number: formData.contact_number,
          address: formData.address,
          purpose: formData.purpose,
          location: `${location.lat},${location.lng}` // Save as string
        }])
        .select();

      if (applicationError) throw applicationError;
      
      // Add record to application_status_history table
      const now = new Date();
      const formattedNow = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const { error: historyError } = await supabase
        .from('application_status_history')
        .insert([{
          user_application_id: applicationData[0].id,
          status_id: 1, // Submitted status
          remarks: `Application submitted on ${formattedNow}. Review will begin shortly.`
        }]);
        
      if (historyError) {
        console.error('Error adding status history:', historyError);
        // Continue with the process even if history record fails
      }
      
      // Upload documents if any were added
      if (uploadedFiles.length > 0) {
        await uploadFilesToStorage(user.id, applicationData[0].id);
      }

      // Call onSuccess prop if provided
      if (onSuccess) onSuccess();
      onClose();
      return;
    } catch (err) {
      setFormError(err.message);
      console.error('Error submitting application:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // When marker is moved or map is clicked, update location and auto-fill address
  const handleLocationChange = async (lat, lng) => {
    setLocation({ lat, lng });
    const fetchedAddress = await fetchAddressFromCoords(lat, lng);
    setFormData(prev => ({ ...prev, address: fetchedAddress }));
  };

  if (!isOpen || !application) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container application-submission-form" style={{ borderRadius: '12px' }}>
        <div className="modal-header">
          <div className="modal-title-section">
            <h2>Application Submission</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {formError && (
            <div className="form-error">
              <FaInfoCircle /> {formError}
            </div>
          )}

          <div className="content-section">
            <div className="section-header">
              <FaInfoCircle className="section-icon" />
              <h3>{application.title}</h3>
            </div>
            <div className="section-content">
              <div className="description-content">
                {application.description}
              </div>
            </div>
          </div>

          <div className="steps-indicator">
            <div className={`step ${activeStep >= 1 ? 'active' : ''}`}>
              <span>1</span>
              <p>Requirements</p>
            </div>
            <div className={`step ${activeStep >= 2 ? 'active' : ''}`}>
              <span>2</span>
              <p>Personal Info</p>
            </div>
            <div className={`step ${activeStep >= 3 ? 'active' : ''}`}>
              <span>3</span>
              <p>Documents</p>
            </div>
            <div className={`step ${activeStep >= 4 ? 'active' : ''}`}>
              <span>4</span>
              <p>Review</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="submission-form">
            {activeStep === 1 && (
              <div className="form-step">
                <div className="content-section">
                  <div className="section-header">
                    <FaListUl className="section-icon" />
                    <h3>Requirements</h3>
                  </div>
                  <div className="section-content">
                    <div className="requirements-grid">
                      {application.requirements && application.requirements.map((requirement, index) => (
                        <div key={index} className="requirement-card">
                          <div className="requirement-number">{index + 1}</div>
                          <div className="requirement-text">{requirement}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="content-section">
                  <div className="section-header">
                    <FaMoneyBillWave className="section-icon" />
                    <h3>Fees Breakdown</h3>
                  </div>
                  <div className="section-content">
                    <div className="fees-container">
                      <div className="fee-row">
                        <div className="fee-info">
                          <span className="fee-label">Application Fee</span>
                          <span className="fee-description">One-time payment for application processing</span>
                        </div>
                        <span className="fee-amount">₱{formatFee(application.application_fee)}</span>
                      </div>
                      <div className="fee-row">
                        <div className="fee-info">
                          <span className="fee-label">Processing Fee</span>
                          <span className="fee-description">Additional processing and handling charges</span>
                        </div>
                        <span className="fee-amount">₱{formatFee(application.processing_fee)}</span>
                      </div>
                      <div className="fee-total-row">
                        <span className="total-label">Total Amount</span>
                        <span className="total-amount">
                          ₱{formatFee(
                            (Number(application.application_fee) || 0) + (Number(application.processing_fee) || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="form-step" style={{ width: '100%' }}>
                <div className="content-section" style={{ width: '100%' }}>
                  <div className="section-header">
                    <FaInfoCircle className="section-icon" />
                    <h3>Personal Information</h3>
                  </div>
                  <div className="section-content" style={{ width: '100%' }}>
                    <div className="form-group" style={{ width: '100%' }}>
                      <label htmlFor="full_name">Full Name</label>
                      <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter your full name"
                        className={`form-input${fieldErrors.full_name ? ' input-error' : ''}`}
                        autoComplete="off"
                      />
                      {fieldErrors.full_name && (
                        <div className="error-tooltip">{fieldErrors.full_name}</div>
                      )}
                    </div>
                    <div className="form-group" style={{ width: '100%' }}>
                      <label htmlFor="email">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        readOnly
                        disabled
                        className="form-input"
                        style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                      />
                    </div>
                    <div className="form-group" style={{ width: '100%' }}>
                      <label htmlFor="contact_number">Contact Number</label>
                      <input
                        type="tel"
                        id="contact_number"
                        name="contact_number"
                        value={formData.contact_number}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter your contact number"
                        className={`form-input${fieldErrors.contact_number ? ' input-error' : ''}`}
                        autoComplete="off"
                      />
                      {fieldErrors.contact_number && (
                        <div className="error-tooltip">{fieldErrors.contact_number}</div>
                      )}
                    </div>
                    <div className="form-group" style={{ position: 'relative', zIndex: 2000, width: '100%' }}>
                      <label htmlFor="address">Address</label>
                      <textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleAddressInputChange}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={handleAddressBlur}
                        ref={addressInputRef}
                        required
                        placeholder="Enter your complete address"
                        rows="3"
                        className={`form-input${fieldErrors.address ? ' input-error' : ''}`}
                        autoComplete="off"
                        style={{ resize: 'vertical' }}
                      />
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <ul style={{
                          position: 'absolute',
                          zIndex: 2000,
                          background: 'white',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          width: '100%',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          margin: 0,
                          padding: 0,
                          listStyle: 'none',
                          top: '100%'
                        }}>
                          {addressSuggestions.map((s, idx) => (
                            <li
                              key={s.place_id}
                              style={{ padding: '8px', cursor: 'pointer', borderBottom: idx !== addressSuggestions.length - 1 ? '1px solid #eee' : 'none' }}
                              onMouseDown={() => handleSuggestionClick(s)}
                            >
                              {s.display_name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {fieldErrors.address && (
                        <div className="error-tooltip">{fieldErrors.address}</div>
                      )}
                    </div>
                    <div style={{ margin: "1rem 0", width: '100%' }}>
                      <label style={{ fontWeight: 500, marginBottom: 4, display: "block" }}>Select Location on Map</label>
                      <div style={{ height: "250px", borderRadius: "8px", overflow: "hidden" }}>
                        {locating && (
                          <div style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>Locating your position...</div>
                        )}
                        <MapContainer
                          center={[location.lat, location.lng]}
                          zoom={15}
                          style={{ height: "100%", width: "100%" }}
                          scrollWheelZoom={false}
                          whenCreated={map => {
                            map.on('click', async function(e) {
                              await handleLocationChange(e.latlng.lat, e.latlng.lng);
                            });
                          }}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          <CenterMapToMarker lat={location.lat} lng={location.lng} />
                          <Marker
                            position={[location.lat, location.lng]}
                            draggable={true}
                            eventHandlers={{
                              dragend: async (e) => {
                                const marker = e.target;
                                const { lat, lng } = marker.getLatLng();
                                await handleLocationChange(lat, lng);
                              }
                            }}
                          />
                        </MapContainer>
                        <div style={{ fontSize: "0.9em", color: "#555", marginTop: 4 }}>
                          Selected: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                        </div>
                      </div>
                    </div>
                    <div className="form-group" style={{ width: '100%' }}>
                      <label htmlFor="purpose">Purpose of Application</label>
                      <textarea
                        id="purpose"
                        name="purpose"
                        value={formData.purpose}
                        onChange={handleInputChange}
                        required
                        placeholder="Describe the purpose of your application"
                        rows="3"
                        className={`form-input${fieldErrors.purpose ? ' input-error' : ''}`}
                        autoComplete="off"
                      />
                      {fieldErrors.purpose && (
                        <div className="error-tooltip">{fieldErrors.purpose}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="form-step">
                <div className="content-section">
                  <div className="section-header">
                    <FaCloudUploadAlt className="section-icon" />
                    <h3>Document Upload</h3>
                  </div>
                  <div className="section-content">
                    <div className="upload-section">
                      <div 
                        {...getRootProps()} 
                        className={`upload-area ${isDragActive ? 'active' : ''}`}
                      >
                        <input {...getInputProps()} />
                        <FaCloudUploadAlt className="upload-icon" />
                        <p>Drag & drop files here, or click to select files</p>
                        <span className="file-info">
                          Supported formats: PDF, DOC, DOCX, JPG, PNG
                          <br />
                          Maximum file size: 5MB
                        </span>
                      </div>

                      {uploadedFiles.length > 0 && (
                        <div className="uploaded-files">
                          <h5>Uploaded Files</h5>
                          <div className="files-grid">
                            {uploadedFiles.map((file, index) => (
                              <div key={file.id} className="file-card">
                                <FaFileAlt className="file-icon" />
                                <div className="file-details">
                                  <span className="file-name">{file.name}</span>
                                  <span className="file-size">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </span>
                                  {uploadProgress[file.id] && file.status === 'uploading' && (
                                    <div className="upload-progress">
                                      <div 
                                        className="progress-bar" 
                                        style={{width: `${uploadProgress[file.id]}%`}}
                                      ></div>
                                      <span className="progress-text">{uploadProgress[file.id]}%</span>
                                    </div>
                                  )}
                                </div>
                                <button 
                                  type="button" 
                                  className="remove-file-btn"
                                  onClick={() => handleRemoveFile(file.id)}
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 4 && (
              <div className="form-step">
                <div className="content-section">
                  <div className="section-header">
                    <FaInfoCircle className="section-icon" />
                    <h3>Application Review</h3>
                  </div>
                  <div className="section-content">
                    <div className="review-grid">
                      <div className="review-card">
                        <h4>Personal Information</h4>
                        <div className="review-item">
                          <span className="review-label">Name:</span>
                          <span className="review-value">{formData.full_name}</span>
                        </div>
                        <div className="review-item">
                          <span className="review-label">Email:</span>
                          <span className="review-value">{formData.email}</span>
                        </div>
                        <div className="review-item">
                          <span className="review-label">Contact:</span>
                          <span className="review-value">{formData.contact_number}</span>
                        </div>
                        <div className="review-item">
                          <span className="review-label">Address:</span>
                          <span className="review-value">{formData.address}</span>
                        </div>
                        <div className="review-item">
                          <span className="review-label">Purpose:</span>
                          <span className="review-value">{formData.purpose}</span>
                        </div>
                      </div>

                      <div className="review-card">
                        <h4>Uploaded Documents</h4>
                        <div className="files-grid">
                          {uploadedFiles.length > 0 ? (
                            uploadedFiles.map((file, index) => (
                              <div key={file.id} className="file-card">
                                <FaFileAlt className="file-icon" />
                                <div className="file-details">
                                  <span className="file-name">{file.name}</span>
                                  <span className="file-size">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="no-files-message">No documents uploaded</p>
                          )}
                        </div>
                      </div>

                      <div className="review-card">
                        <h4>Fees Summary</h4>
                        <div className="fees-container">
                          <div className="fee-row">
                            <div className="fee-info">
                              <span className="fee-label">Application Fee</span>
                            </div>
                            <span className="fee-amount">₱{formatFee(application.application_fee)}</span>
                          </div>
                          <div className="fee-row">
                            <div className="fee-info">
                              <span className="fee-label">Processing Fee</span>
                            </div>
                            <span className="fee-amount">₱{formatFee(application.processing_fee)}</span>
                          </div>
                          <div className="fee-total-row">
                            <span className="total-label">Total Amount</span>
                            <span className="total-amount">
                              ₱{formatFee(
                                (Number(application.application_fee) || 0) + (Number(application.processing_fee) || 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-navigation">
              {activeStep > 1 && (
                <button
                  type="button"
                  className="modal-button secondary"
                  onClick={handlePrevStep}
                  disabled={isSubmitting || uploadingFiles}
                >
                  Previous
                </button>
              )}

              {activeStep < 4 ? (
                <button
                  type="button"
                  className="modal-button primary"
                  onClick={handleNextStep}
                  disabled={isSubmitting || uploadingFiles}
                >
                  {isSubmitting ? "Saving..." : "Next"}
                </button>
              ) : (
                <button
                  type="button"
                  className="modal-button primary"
                  onClick={handleSubmit}
                  disabled={isSubmitting || uploadingFiles}
                >
                  {isSubmitting ? "Submitting..." : uploadingFiles ? "Uploading Files..." : "Submit Application"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApplicationSubmissionForm; 