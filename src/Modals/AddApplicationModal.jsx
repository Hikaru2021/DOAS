import { useState, useCallback } from "react";
import { FaTimes, FaCloudUploadAlt, FaPlus, FaTrash } from "react-icons/fa";
import { supabase } from "../library/supabaseClient";
import "../CSS/ApplicationSubmissionList.css";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useDropzone } from 'react-dropzone';
import { convert } from 'html-to-text';
import PropTypes from 'prop-types';

const STORAGE_BUCKET = 'guidelines';
const PRIVATE_FOLDER = 'private';
const FORMS_FOLDER = 'Forms';

const AddApplicationModal = ({ isOpen, onClose, onApplicationAdded }) => {
  const [newApplication, setNewApplication] = useState({
    title: "",
    type: "",
    description: "",
    application_fee: "",
    processing_fee: "",
    requirements: [],
    guidelinesFile: null,
    applicationFormFile: null
  });
  const [newRequirement, setNewRequirement] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({
    guidelines: 0,
    applicationForm: 0
  });
  const [uploadedGuidelinesUrl, setUploadedGuidelinesUrl] = useState(null);

  // Rich text editor modules configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  // Rich text editor formats
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewApplication(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDescriptionChange = (content) => {
    setNewApplication(prev => ({
      ...prev,
      description: content
    }));
  };

  // Guidelines file upload
  const onGuidelinesDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setNewApplication(prev => ({
        ...prev,
        guidelinesFile: file
      }));
      // Reset progress when new file is uploaded
      setUploadProgress(prev => ({
        ...prev,
        guidelines: 0
      }));
      setUploadedGuidelinesUrl(null);
    }
  }, []);

  const { getRootProps: getGuidelinesRootProps, getInputProps: getGuidelinesInputProps } = useDropzone({
    onDrop: onGuidelinesDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  // Application form file upload
  const onApplicationFormDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setNewApplication(prev => ({
        ...prev,
        applicationFormFile: file
      }));
      // Reset progress when new file is uploaded
      setUploadProgress(prev => ({
        ...prev,
        applicationForm: 0
      }));
    }
  }, []);

  const { getRootProps: getApplicationFormRootProps, getInputProps: getApplicationFormInputProps } = useDropzone({
    onDrop: onApplicationFormDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setNewApplication(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }));
      setNewRequirement("");
    }
  };

  const handleRemoveRequirement = (index) => {
    setNewApplication(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const uploadGuidelinesFile = async (applicationId) => {
    if (!newApplication.guidelinesFile) return null;
    
    try {
      const file = newApplication.guidelinesFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${applicationId}_guidelines.${fileExt}`;
      // Store in private folder to match the storage policy
      const filePath = `${PRIVATE_FOLDER}/${fileName}`;
      
      // Upload file to Supabase Storage
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const calculatedProgress = (progress.loaded / progress.total) * 100;
            setUploadProgress(prev => ({
              ...prev,
              guidelines: calculatedProgress
            }));
          },
        });
      
      if (error) throw error;
      
      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
      
      setUploadedGuidelinesUrl(publicUrl);
      
      // Insert document reference into the documents table
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert([
          { 
            file_name: file.name,
            file_type: file.type,
            file_link: publicUrl,
            application_id: applicationId
          }
        ])
        .select();
      
      if (documentError) {
        console.error('Error inserting document record:', documentError);
        throw documentError;
      }
      
      return {
        path: filePath,
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        document_id: documentData[0].id
      };
    } catch (error) {
      console.error('Error uploading guidelines file:', error);
      throw error;
    }
  };

  const uploadApplicationFormFile = async (applicationId) => {
    if (!newApplication.applicationFormFile) return null;
    
    try {
      const file = newApplication.applicationFormFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${applicationId}_application_form.${fileExt}`;
      // Store in Forms folder 
      const filePath = `${PRIVATE_FOLDER}/${FORMS_FOLDER}/${fileName}`;
      
      // Upload file to Supabase Storage (same bucket, different folder)
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const calculatedProgress = (progress.loaded / progress.total) * 100;
            setUploadProgress(prev => ({
              ...prev,
              applicationForm: calculatedProgress
            }));
          },
        });
      
      if (error) throw error;
      
      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
      
      // Insert document reference into the documents table
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert([
          { 
            file_name: file.name,
            file_type: file.type,
            file_link: publicUrl,
            application_id: applicationId
          }
        ])
        .select();
      
      if (documentError) {
        console.error('Error inserting document record:', documentError);
        throw documentError;
      }
      
      return {
        path: filePath,
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        document_id: documentData[0].id
      };
    } catch (error) {
      console.error('Error uploading application form file:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      // Validate required fields
      if (!newApplication.title || !newApplication.type || !newApplication.description || 
          !newApplication.application_fee || !newApplication.processing_fee) {
        throw new Error('Please fill in all required fields');
      }

      // Convert HTML to plain text for description
      const plainTextDescription = convert(newApplication.description, {
        wordwrap: false,
        preserveNewlines: true
      });

      // Insert application into database
      const { data: applicationData, error: applicationError } = await supabase
        .from('applications')
        .insert([{
          title: newApplication.title,
          type: newApplication.type,
          description: plainTextDescription,
          application_fee: newApplication.application_fee,
          processing_fee: newApplication.processing_fee,
          requirements: newApplication.requirements
        }])
        .select();

      if (applicationError) {
        throw applicationError;
      }

      const applicationId = applicationData[0].id;
      
      // Upload guidelines file if provided
      let guidelinesFileData = null;
      if (newApplication.guidelinesFile) {
        guidelinesFileData = await uploadGuidelinesFile(applicationId);
      }
      
      // Upload application form file if provided
      let applicationFormData = null;
      if (newApplication.applicationFormFile) {
        applicationFormData = await uploadApplicationFormFile(applicationId);
      }

      // Add file metadata to the response object
      const completeApplicationData = {
        ...applicationData[0],
        files: {
          guidelines: guidelinesFileData,
          applicationForm: applicationFormData
        }
      };

      // Pass the complete data to parent component
      onApplicationAdded(completeApplicationData);
      onClose();
    } catch (err) {
      setFormError(err.message);
      console.error('Error submitting application:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container add-application-modal" style={{ borderRadius: '12px' }}>
        <div className="modal-header">
          <h2>Create New Application</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {formError && <div className="form-error">{formError}</div>}

          <form onSubmit={handleSubmit} className="application-form">
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={newApplication.title}
                onChange={handleInputChange}
                required
                placeholder="Enter application title"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                name="type"
                value={newApplication.type}
                onChange={handleInputChange}
                required
                className="form-input"
              >
                <option value="">Select application type</option>
                <option value="Permit">Permit</option>
                <option value="Certificate">Certificate</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <div className="rich-text-editor">
                <ReactQuill
                  theme="snow"
                  value={newApplication.description}
                  onChange={handleDescriptionChange}
                  modules={modules}
                  formats={formats}
                  placeholder="Provide a detailed description"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="applicationFee">Application Fee (₱)</label>
              <input
                type="number"
                id="application_fee"
                name="application_fee"
                value={newApplication.application_fee}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="Enter application fee"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="processingFee">Processing Fee (₱)</label>
              <input
                type="number"
                id="processing_fee"
                name="processing_fee"
                value={newApplication.processing_fee}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="Enter processing fee"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Requirements</label>
              <div className="requirements-container">
                <div className="requirement-input-group">
                  <input
                    type="text"
                    className="form-input"
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    placeholder="Enter a requirement"
                  />
                  <button
                    type="button"
                    className="add-requirement-button"
                    onClick={handleAddRequirement}
                    disabled={!newRequirement.trim()}
                  >
                    <FaPlus />
                  </button>
                </div>
                <div className="requirements-list">
                  {newApplication.requirements.map((requirement, index) => (
                    <div key={index} className="requirement-item">
                      <span>{requirement}</span>
                      <button
                        type="button"
                        className="remove-requirement-button"
                        onClick={() => handleRemoveRequirement(index)}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Upload Guidelines</label>
              <div {...getGuidelinesRootProps()} className="file-upload-area">
                <input {...getGuidelinesInputProps()} />
                <FaCloudUploadAlt className="upload-icon" />
                <p>Drag & drop guidelines file here, or click to select</p>
                <span className="file-info">
                  {newApplication.guidelinesFile ? (
                    <>
                      {newApplication.guidelinesFile.name}
                      {uploadProgress.guidelines > 0 && uploadProgress.guidelines < 100 && (
                        <div className="upload-progress">
                          <div 
                            className="progress-bar" 
                            style={{ width: `${uploadProgress.guidelines}%` }}
                          />
                        </div>
                      )}
                      {uploadedGuidelinesUrl && (
                        <div className="upload-success">
                          File ready for upload
                        </div>
                      )}
                    </>
                  ) : (
                    "Supported formats: PDF, DOC, DOCX"
                  )}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Upload Application Form</label>
              <div {...getApplicationFormRootProps()} className="file-upload-area">
                <input {...getApplicationFormInputProps()} />
                <FaCloudUploadAlt className="upload-icon" />
                <p>Drag & drop application form here, or click to select</p>
                <span className="file-info">
                  {newApplication.applicationFormFile ? (
                    <>
                      {newApplication.applicationFormFile.name}
                      {uploadProgress.applicationForm > 0 && uploadProgress.applicationForm < 100 && (
                        <div className="upload-progress">
                          <div 
                            className="progress-bar" 
                            style={{ width: `${uploadProgress.applicationForm}%` }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    "Supported formats: PDF, DOC, DOCX"
                  )}
                </span>
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button 
            type="button"
            className="cancel-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="button"
            className="submit-button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Application"}
          </button>
        </div>
      </div>
    </div>
  );
};

AddApplicationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApplicationAdded: PropTypes.func.isRequired
};

export default AddApplicationModal;