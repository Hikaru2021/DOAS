import { useState, useCallback, useEffect } from "react";
import { FaTimes, FaCloudUploadAlt, FaPlus, FaTrash } from "react-icons/fa";
import { supabase } from "../library/supabaseClient";
import "../CSS/ApplicationSubmissionList.css";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useDropzone } from 'react-dropzone';
import { convert } from 'html-to-text';

const STORAGE_BUCKET = 'guidelines';
const PRIVATE_FOLDER = 'private';
const FORMS_FOLDER = 'Forms';

const EditApplicationModal = ({ isOpen, onClose, onApplicationUpdated, application }) => {
  const [editedApplication, setEditedApplication] = useState({
    id: null,
    application_date: null,
    title: "",
    type: "",
    description: "",
    application_fee: "0",
    processing_fee: "0",
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
  const [documents, setDocuments] = useState([]);
  const [existingGuidelineDoc, setExistingGuidelineDoc] = useState(null);
  const [existingFormDoc, setExistingFormDoc] = useState(null);

  // Update form when application prop changes
  useEffect(() => {
    if (application) {
      console.log('Received application data:', application); // Debug log
      setEditedApplication({
        id: application.id,
        application_date: application.application_date,
        title: application.title || "",
        type: application.type || "",
        description: application.description || "",
        application_fee: application.application_fee ? application.application_fee.toString() : "0",
        processing_fee: application.processing_fee ? application.processing_fee.toString() : "0",
        requirements: application.requirements || [],
        guidelinesFile: null,
        applicationFormFile: null
      });
      
      // Fetch existing documents for this application
      fetchApplicationDocuments(application.id);
    }
  }, [application]);
  
  // Fetch application documents
  const fetchApplicationDocuments = async (applicationId) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('application_id', applicationId);
        
      if (error) throw error;
      
      setDocuments(data || []);
      
      // Identify guidelines and form documents
      const guidelineDoc = data?.find(doc => doc.file_link && !doc.file_link.includes('/Forms/'));
      const formDoc = data?.find(doc => doc.file_link && doc.file_link.includes('/Forms/'));
      
      setExistingGuidelineDoc(guidelineDoc);
      setExistingFormDoc(formDoc);
      
      console.log('Existing documents:', { guidelineDoc, formDoc });
    } catch (error) {
      console.error('Error fetching application documents:', error);
    }
  };

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
    // For fee fields, ensure we store as string but validate as number
    if (name === 'application_fee' || name === 'processing_fee') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        setEditedApplication(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else {
      setEditedApplication(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleDescriptionChange = (content) => {
    setEditedApplication(prev => ({
      ...prev,
      description: content
    }));
  };

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setEditedApplication(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }));
      setNewRequirement("");
    }
  };

  const handleRemoveRequirement = (index) => {
    setEditedApplication(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  // Function to delete a document from storage
  const deleteDocumentFromStorage = async (doc) => {
    if (!doc || !doc.file_link) return;
    
    try {
      // Extract the file path from the URL
      const fileUrl = doc.file_link;
      const filePath = fileUrl.split('/storage/v1/object/public/guidelines/')[1];
      
      if (filePath) {
        console.log('Deleting file:', filePath);
        // Delete the file from storage
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([decodeURIComponent(filePath)]);
        
        if (error) {
          console.error('Error deleting file from storage:', error);
          return false;
        }
        
        // Delete the document record
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id);
          
        if (deleteError) {
          console.error('Error deleting document record:', deleteError);
          return false;
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error in deleteDocumentFromStorage:', error);
      return false;
    }
    
    return false;
  };

  // Guidelines file upload
  const onGuidelinesDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setEditedApplication(prev => ({
        ...prev,
        guidelinesFile: file
      }));
      setUploadProgress(prev => ({
        ...prev,
        guidelines: 0
      }));
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
      setEditedApplication(prev => ({
        ...prev,
        applicationFormFile: file
      }));
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

  // Upload guidelines file
  const uploadGuidelinesFile = async (applicationId) => {
    if (!editedApplication.guidelinesFile) return null;
    
    try {
      // Delete existing guideline file if it exists
      if (existingGuidelineDoc) {
        await deleteDocumentFromStorage(existingGuidelineDoc);
      }
      
      const file = editedApplication.guidelinesFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${applicationId}_guidelines.${fileExt}`;
      const filePath = `${PRIVATE_FOLDER}/${fileName}`;
      
      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (progress) => {
            const calculatedProgress = (progress.loaded / progress.total) * 100;
            setUploadProgress(prev => ({
              ...prev,
              guidelines: calculatedProgress
            }));
          },
        });
      
      if (uploadError) throw uploadError;
      
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
      console.error('Error uploading guidelines file:', error);
      throw error;
    }
  };

  // Upload application form file
  const uploadApplicationFormFile = async (applicationId) => {
    if (!editedApplication.applicationFormFile) return null;
    
    try {
      // Delete existing application form file if it exists
      if (existingFormDoc) {
        await deleteDocumentFromStorage(existingFormDoc);
      }
      
      const file = editedApplication.applicationFormFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${applicationId}_application_form.${fileExt}`;
      const filePath = `${PRIVATE_FOLDER}/${FORMS_FOLDER}/${fileName}`;
      
      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (progress) => {
            const calculatedProgress = (progress.loaded / progress.total) * 100;
            setUploadProgress(prev => ({
              ...prev,
              applicationForm: calculatedProgress
            }));
          },
        });
      
      if (uploadError) throw uploadError;
      
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
    if (!application?.id) return;

    setIsSubmitting(true);
    setFormError(null);
    
    try {
      // Validate required fields
      if (!editedApplication.title || !editedApplication.type || !editedApplication.description) {
        throw new Error('Please fill in all required fields');
      }

      // Validate fees
      const appFee = parseFloat(editedApplication.application_fee);
      const procFee = parseFloat(editedApplication.processing_fee);
      if (isNaN(appFee) || isNaN(procFee) || appFee < 0 || procFee < 0) {
        throw new Error('Please enter valid fees');
      }

      // Convert HTML to plain text
      const plainTextDescription = convert(editedApplication.description, {
        wordwrap: false,
        preserveNewlines: true
      });

      // Prepare update data
      const updateData = {
        title: editedApplication.title,
        type: editedApplication.type,
        description: plainTextDescription,
        application_fee: editedApplication.application_fee,
        processing_fee: editedApplication.processing_fee,
        requirements: editedApplication.requirements || [] // Ensure requirements is always an array
      };

      console.log('Updating with data:', updateData); // Debug log

      const { data, error } = await supabase
        .from('applications')
        .update(updateData)
        .eq('id', application.id)
        .select();
      
      if (error) throw error;
      
      let guidelinesFileData = null;
      let applicationFormData = null;
      
      // Upload guidelines file if provided
      if (editedApplication.guidelinesFile) {
        guidelinesFileData = await uploadGuidelinesFile(application.id);
      }
      
      // Upload application form file if provided
      if (editedApplication.applicationFormFile) {
        applicationFormData = await uploadApplicationFormFile(application.id);
      }

      // Add file metadata to the response object
      const completeApplicationData = {
        ...data[0],
        files: {
          guidelines: guidelinesFileData || (existingGuidelineDoc ? {
            name: existingGuidelineDoc.file_name,
            type: existingGuidelineDoc.file_type,
            url: existingGuidelineDoc.file_link,
            document_id: existingGuidelineDoc.id
          } : null),
          applicationForm: applicationFormData || (existingFormDoc ? {
            name: existingFormDoc.file_name,
            type: existingFormDoc.file_type,
            url: existingFormDoc.file_link,
            document_id: existingFormDoc.id
          } : null)
        }
      };
      
      onApplicationUpdated(completeApplicationData);
      onClose();
      
    } catch (err) {
      setFormError(err.message);
      console.error('Error updating application:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container edit-application-modal" style={{ borderRadius: '12px' }}>
        <div className="modal-header">
          <h2>Edit Application</h2>
          <div className="application-meta">
            <span className="application-date">
              Created: {editedApplication.application_date ? new Date(editedApplication.application_date).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        <div className="modal-body">
          {formError && <div className="form-error">{formError}</div>}
          
          <form onSubmit={handleSubmit} className="application-form">
            <div className="form-group">
              <label htmlFor="edit-title">Title</label>
              <input
                type="text"
                id="edit-title"
                name="title"
                value={editedApplication.title}
                onChange={handleInputChange}
                required
                placeholder="Enter application title"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="edit-type">Type</label>
              <select
                id="edit-type"
                name="type"
                value={editedApplication.type}
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
              <label htmlFor="edit-description">Description</label>
              <div className="rich-text-editor">
                <ReactQuill
                  theme="snow"
                  value={editedApplication.description}
                  onChange={handleDescriptionChange}
                  modules={modules}
                  formats={formats}
                  placeholder="Provide a detailed description"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="edit-applicationFee">Application Fee (₱)</label>
              <input
                type="number"
                id="edit-application_fee"
                name="application_fee"
                value={editedApplication.application_fee}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="Enter application fee"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-processingFee">Processing Fee (₱)</label>
              <input
                type="number"
                id="edit-processing_fee"
                name="processing_fee"
                value={editedApplication.processing_fee}
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
                  {editedApplication.requirements.map((requirement, index) => (
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
                <p>
                  {existingGuidelineDoc 
                    ? "Current file: " + existingGuidelineDoc.file_name + ". Drop new file to replace it." 
                    : "Drag & drop guidelines file here, or click to select"
                  }
                </p>
                <span className="file-info">
                  {editedApplication.guidelinesFile ? (
                    <>
                      {editedApplication.guidelinesFile.name}
                      {uploadProgress.guidelines > 0 && uploadProgress.guidelines < 100 && (
                        <div className="upload-progress">
                          <div 
                            className="progress-bar" 
                            style={{ width: `${uploadProgress.guidelines}%` }}
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

            <div className="form-group">
              <label>Upload Application Form</label>
              <div {...getApplicationFormRootProps()} className="file-upload-area">
                <input {...getApplicationFormInputProps()} />
                <FaCloudUploadAlt className="upload-icon" />
                <p>
                  {existingFormDoc 
                    ? "Current file: " + existingFormDoc.file_name + ". Drop new file to replace it." 
                    : "Drag & drop application form here, or click to select"
                  }
                </p>
                <span className="file-info">
                  {editedApplication.applicationFormFile ? (
                    <>
                      {editedApplication.applicationFormFile.name}
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
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditApplicationModal; 