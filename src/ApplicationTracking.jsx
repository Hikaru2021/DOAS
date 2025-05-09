import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle, FaClock, FaFileAlt, FaTimes, FaFile, FaTimesCircle, FaExclamationCircle, FaSearch, FaMoneyBillWave, FaClipboardList } from 'react-icons/fa';
import { supabase } from './library/supabaseClient';
import './CSS/ApplicationTracking.css';

// Custom icon: Document with magnifying glass
const DocumentMagnifyIcon = () => (
  <span style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22
  }}>
    <FaFileAlt style={{ fontSize: 20, color: '#43a047' }} />
  </span>
);

const ApplicationTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [comments, setComments] = useState([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = React.useRef(null);

  // Supabase storage configuration
  const STORAGE_BUCKET = 'guidelines';

  // Helper function to convert HTML tags to plain text
  const convertHtmlToText = (html) => {
    if (!html) return '';
    // Create a temporary DOM element
    const tempElement = document.createElement('div');
    // Set its HTML content to the input string
    tempElement.innerHTML = html;
    // Return the text content
    return tempElement.textContent || tempElement.innerText || '';
  };

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        if (user) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role_id')
            .eq('id', user.id)
            .single();

          if (userError) throw userError;
          setUserRole(userData.role_id);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchUserRole();
  }, []);

  // Format date and time helper function
  const formatDateTime = (dateString) => {
    if (!dateString) return { date: '', time: '' };
    const date = new Date(dateString);
    // Format time as 12-hour with AM/PM
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return {
      date: date.toLocaleDateString(),
      time: `${hours}:${minutes} ${ampm}`
    };
  };

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the application details with only applications join
        const { data: applicationData, error: applicationError } = await supabase
          .from('user_applications')
          .select(`
            *,
            applications (
              id,
              title,
              type,
              description,
              requirements,
              application_fee,
              processing_fee
            )
          `)
          .eq('id', id)
          .single();

        if (applicationError) throw applicationError;
        if (!applicationData) throw new Error('Application not found');

        // Fetch comments for this application
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('user_applications_id', id)
          .order('comment_date', { ascending: false });

        if (commentsError) throw commentsError;
        
        // Fetch status history
        const { data: statusHistoryData, error: statusHistoryError } = await supabase
          .from('application_status_history')
          .select('*')
          .eq('user_application_id', id)
          .order('changed_at', { ascending: false });
          
        if (statusHistoryError) throw statusHistoryError;
        
        // Get status name based on status ID
        const getStatusName = (statusId) => {
          switch (statusId) {
            case 1: return 'Submitted';
            case 2: return 'Under Review';
            case 3: return 'Needs Revision';
            case 4: return 'Approved';
            case 5: return 'Rejected';
            case 6: return 'Payment Pending';
            case 7: return 'Payment Recieved';
            case 8: return 'Payment Failed';
            case 9: return 'Inspecting';
            case 10: return 'Completed';
            default: return 'Unknown';
          }
        };

        // Format the comments from database
        const formattedComments = commentsData
          ? commentsData.flatMap(comment => {
              const arr = [];
              if (comment.official_comment) {
                arr.push({
                  id: comment.id,
                  user: "DENR Admin",
                  role: "admin",
                  timestamp: new Date(comment.comment_date).toLocaleString(),
                  isOfficial: true,
                  type: 'official-comment',
                  message: comment.official_comment
                });
              }
              if (comment.revision_comment) {
                arr.push({
          id: comment.id,
          user: "DENR Admin",
          role: "admin",
          timestamp: new Date(comment.comment_date).toLocaleString(),
          isOfficial: true,
                  type: 'revision-request',
                  message: comment.revision_comment
                });
              }
              return arr;
            })
          : [];

        // Determine if there's a revision instruction from comments
        const revisionComment = commentsData?.find(comment => comment.revision_comment);
        const revisionInstructions = revisionComment ? revisionComment.revision_comment : 
                                    (applicationData.status === 3 ? "Please update the required documents" : "");

        // Create timeline from status history
        let timeline = statusHistoryData?.map(history => {
          const statusName = getStatusName(history.status_id);
          const { date, time } = formatDateTime(history.changed_at);
          
          return {
            status: statusName,
            date,
            time,
            description: history.remarks || `Application status changed to ${statusName}`,
            isDone: true,
            current: applicationData.status === history.status_id,
            additionalInfo: history.status_id === 4 ? {
              recipient: applicationData.full_name,
              approvedDate: date
            } : null
          };
        }) || [];
        
        // If no history records exist, create an initial 'Submitted' entry
        if (timeline.length === 0) {
          const { date, time } = formatDateTime(applicationData.created_at);
          timeline = [{
            status: "Submitted",
            date,
            time,
            description: "Application has been successfully submitted",
            isDone: true,
            current: applicationData.status === 1
          }];
        }

        // Get formatted submission date and time
        const { date: submissionDate, time: submissionTime } = formatDateTime(applicationData.created_at);

        // Format the application data
        const formattedApplication = {
          id: applicationData.id,
          title: applicationData.applications.title,
          referenceNumber: `REF-${String(applicationData.id).padStart(6, '0')}`,
          type: applicationData.applications.type,
          status: getStatusName(applicationData.status),
          submissionDate,
          submissionTime,
          lastUpdated: formatDateTime(applicationData.created_at).date,
          description: applicationData.applications.description,
          comments: formattedComments,
          timeline: timeline,
          needsRevision: applicationData.status === 3,
          revisionInstructions: revisionInstructions,
          // Add application details
          full_name: applicationData.full_name,
          contact_number: applicationData.contact_number,
          address: applicationData.address,
          purpose: applicationData.purpose,
          application_fee: applicationData.applications.application_fee,
          processing_fee: applicationData.applications.processing_fee,
          statusId: applicationData.status
        };

        setApplication(formattedApplication);
        setComments(formattedComments);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchApplication();
  }, [id]);

  const handleBack = () => {
    navigate('/MyApplication');
  };

  // Handle file selection
  const handleFileSelect = (files) => {
    const newFiles = Array.from(files);
    setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
  };

  // Handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Handle browse button click
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };

  // Remove a file from selection
  const handleRemoveFile = (index) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  // Handle file upload and submission
  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsUploading(true);
    setIsSubmitting(true);
    setUploadProgress(0);
    
    try {
      console.log("Starting file upload process...");
      
      // First, get existing documents for this application
      console.log(`Fetching existing documents for application ${application.id}...`);
      const { data: existingDocs, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_submissions', parseInt(application.id));
        
      if (fetchError) {
        console.error("Error fetching existing documents:", fetchError);
        throw new Error(`Failed to fetch existing documents: ${fetchError.message}`);
      }
      
      console.log(`Found ${existingDocs?.length || 0} existing documents`);
      
      // Delete existing documents from storage if they exist
      if (existingDocs && existingDocs.length > 0) {
        console.log("Removing existing documents from storage and database...");
        
        // First remove from storage - extract file paths from URLs
        const filesToDelete = existingDocs.map(doc => {
          // Extract path from URL if it exists
          if (doc.file_link) {
            const urlParts = doc.file_link.split('/');
            // Get last parts of URL which should be the path
            return `private/${application.id}/${urlParts[urlParts.length - 1]}`;
          }
          return null;
        }).filter(path => path !== null);
        
        if (filesToDelete.length > 0) {
          console.log(`Removing ${filesToDelete.length} files from storage:`, filesToDelete);
          const { error: deleteStorageError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove(filesToDelete);
            
          if (deleteStorageError) {
            console.warn("Error removing some files from storage:", deleteStorageError);
            // Continue anyway since we still want to upload new files
          }
        }
        
        // Then delete document records from database
        const { error: deleteDbError } = await supabase
          .from('documents')
          .delete()
          .eq('user_submissions', parseInt(application.id));
          
        if (deleteDbError) {
          console.error("Error deleting document records:", deleteDbError);
          throw new Error(`Failed to delete document records: ${deleteDbError.message}`);
        }
        
        console.log("Successfully removed existing documents");
      }
      
      // Array to store all document records
      const documentRecords = [];
      
      // Upload each file to Supabase storage
      for (let i = 0; i < selectedFiles.length; i++) {
        try {
          const file = selectedFiles[i];
          console.log(`Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);
          
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
          // Using private folder to comply with existing RLS policy
          const filePath = `private/${application.id}/${fileName}`;
          
          console.log(`Uploading to path: ${filePath}`);
          
          // Upload file to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true, // Changed to true to overwrite if exists
            });
            
          if (uploadError) {
            console.error("File upload error:", uploadError);
            throw new Error(`File upload failed: ${uploadError.message}`);
          }
          
          console.log("File uploaded successfully:", uploadData);
          
          // Get the public URL
          const { data } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);
            
          if (!data || !data.publicUrl) {
            throw new Error("Failed to get public URL for uploaded file");
          }
          
          console.log("Public URL generated:", data.publicUrl);
          
          // Prepare document record for database
          documentRecords.push({
            file_name: file.name,
            file_type: file.type,
            file_link: data.publicUrl,
            user_submissions: parseInt(application.id)
          });
          
          // Update progress
          setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
        } catch (fileError) {
          console.error(`Error processing file ${i + 1}:`, fileError);
          throw fileError;
        }
      }
      
      console.log("All files uploaded successfully, saving records to database...");
      console.log("Document records to insert:", documentRecords);
      
      // Insert all document records in the database
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert(documentRecords)
        .select();
        
      if (documentError) {
        console.error("Error inserting document records:", documentError);
        throw new Error(`Database error: ${documentError.message}`);
      }
      
      console.log("Document records inserted successfully:", documentData);
      
      // Update application status
      const { data: appData, error: statusError } = await supabase
        .from('user_applications')
        .update({ 
          status: 1, 
          last_updated: new Date().toISOString() 
        })
        .eq('id', application.id)
        .select();
        
      if (statusError) {
        console.error("Error updating application status:", statusError);
        throw new Error(`Status update failed: ${statusError.message}`);
      }
      
      console.log("Application status updated to Submitted:", appData);
      
      // Add a new status history record
      const { data: historyData, error: historyError } = await supabase
        .from('application_status_history')
        .insert({
          user_application_id: parseInt(application.id),
          status_id: 1,
          remarks: `Application resubmitted with ${documentRecords.length} revised document(s)`,
          changed_at: new Date().toISOString()
        })
        .select();
        
      if (historyError) {
        console.error("Error adding status history:", historyError);
        throw new Error(`History update failed: ${historyError.message}`);
      }
      
      console.log("Status history added successfully:", historyData);
      
      // Update local application state
      setApplication(prev => ({
        ...prev,
        status: 'Submitted',
        statusId: 1,
        needsRevision: false,
        lastUpdated: new Date().toLocaleString()
      }));
      
      // Reset files after successful upload
      setSelectedFiles([]);
      
      // Show success message
      alert('Your application has been successfully resubmitted with the revised documents!');
      
      // Reload the page to show updated status
      window.location.reload();
      
    } catch (error) {
      console.error('Error uploading files and resubmitting application:', error);
      alert(`Failed to resubmit your application: ${error.message}. Please try again or contact support.`);
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="tracking-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading application details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tracking-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleBack}>Go Back</button>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="tracking-page">
        <div className="error-container">
          <h2>Application Not Found</h2>
          <p>The requested application could not be found.</p>
          <button onClick={handleBack}>Go Back</button>
        </div>
      </div>
    );
  }

  // 5-step progress logic
  const statusId = application.statusId;
  const isRejected = statusId === 5;
  const isCompleted = statusId === 10;

  // Step mapping with icons and status-based classes
  const stepMap = [
    { label: 'Submitted', ids: [1], icon: <FaClock />, className: 'submitted' },
    { label: 'Under Review / Needs Revision', ids: [2, 3], icon: null, className: '' },
    { label: 'Payment', ids: [6, 7, 8], icon: null, className: '' },
    { label: 'Inspecting', ids: [9], icon: <FaSearch />, className: 'inspecting' },
    { label: 'Approved', ids: [4], icon: <FaCheckCircle />, className: 'approved' },
  ];

  // Determine current step
  let currentStep = 0;
  for (let i = 0; i < stepMap.length; i++) {
    if (stepMap[i].ids.includes(statusId)) {
      currentStep = i;
      break;
    }
  }

  return (
    <div className="tracking-page">
      <div className="tracking-page-header">
        <div className="header-left">
          <button className="back-button" onClick={handleBack}>
            <FaArrowLeft /> Back to Applications
          </button>
        </div>
      </div>

      <div className="tracking-page-content">
        <div className="application-header">
          <div className="header-main">
            <h1>{application.title}</h1>
            <div className="header-meta">
              <p className="reference-number">Reference Number: {application.referenceNumber}</p>
              <div className={`status-badge ${application.status.toLowerCase().replace(' ', '-')}`}>
                {application.status}
              </div>
            </div>
          </div>
          <div className="submission-info">
            <p>Submitted on {application.submissionDate} at {application.submissionTime}</p>
          </div>
        </div>

        {/* Progress Bar or Message */}
        {isRejected ? (
        <div className="progress-section">
            <div className="progress-message rejected">This application has been <b>Rejected</b>.</div>
              </div>
        ) : isCompleted ? (
          <div className="progress-section">
            <div className="progress-message completed">This application process is <b>Completed</b>.</div>
            </div>
        ) : (
          <div className="progress-section">
            <div className="progress-bar five-steps">
              {stepMap.map((step, idx) => {
                const isCompleted = currentStep > idx;
                const isLastCompleted = isCompleted && currentStep === idx + 1;
                let label = step.label;
                let icon = step.icon;
                let stepClass = step.className;
                // Assign label, icon, and class based on statusId
                if (step.label === 'Under Review / Needs Revision') {
                  if (statusId === 3) {
                    label = 'Needs Revision';
                    icon = <FaExclamationCircle />;
                    stepClass = 'needs-revision';
                  } else {
                    label = 'Under Review';
                    icon = <DocumentMagnifyIcon />;
                    stepClass = 'under-review';
                  }
                }
                if (step.label === 'Payment') {
                  if (statusId === 6) {
                    label = 'Payment Pending';
                    icon = <FaMoneyBillWave />;
                    stepClass = 'payment-pending';
                  } else if (statusId === 7) {
                    label = 'Payment Recieved';
                    icon = <FaCheckCircle />;
                    stepClass = 'payment-recieved';
                  } else if (statusId === 8) {
                    label = 'Payment Failed';
                    icon = <FaTimesCircle />;
                    stepClass = 'payment-failed';
                  } else {
                    label = 'Payment';
                    icon = <FaMoneyBillWave />;
                    stepClass = 'payment';
                  }
                }
                // Compose className for the step
                const stepClassName = `progress-step five-step${isCompleted ? ' completed' : ''}${currentStep === idx ? ' current' : ''}${isLastCompleted ? ' last-completed' : ''} ${stepClass}`;
                return (
                  <div
                    key={step.label}
                    className={stepClassName}
            >
              <div className="step-circle">
                      {/* Show check icon for all completed steps, including 'Submitted' */}
                      {isCompleted ? <FaCheckCircle /> : icon}
              </div>
                    <div className={`step-label${label.split(' ').length === 2 ? ' two-line' : ''}`}>{label}</div>
              </div>
                );
              })}
            </div>
          </div>
        )}

          <div className="progress-timeline">
            <div className="timeline-list">
              {application.timeline.map((item, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-date">
                    <div className="date">{item.date}</div>
                    <div className="time">{item.time}</div>
                  </div>
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <p>{item.description}</p>
                    {item.additionalInfo && (
                      <div className="additional-info">
                        <p>Recipient: {item.additionalInfo.recipient}</p>
                        <p>Approved Date: {item.additionalInfo.approvedDate}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="comments-section">
          <h2>Official Comments</h2>
          <div className="comments-list">
            {application.comments
              .filter(comment => comment.type === 'official-comment' && comment.message && comment.message.trim())
              .slice(0, showAllComments ? application.comments.filter(comment => comment.type === 'official-comment' && comment.message && comment.message.trim()).length : 2)
              .map((comment, index) => (
                <div 
                  key={index} 
                  className={`comment-item admin ${
                    application.status === 'Rejected' ? 'rejected' : ''
                  }`}
                >
                  <div className="comment-header">
                    <span className="comment-user">Deparment of Environent and Natural Resources Office</span>
                    <span className="comment-timestamp">{comment.timestamp}</span>
                  </div>
                  <div className="comment-content">
                    <p>{convertHtmlToText(comment.message)}</p>
                  </div>
                </div>
            ))}
            {application.comments.filter(comment => comment.type === 'official-comment' && comment.message && comment.message.trim()).length === 0 && (
              <div className="no-comments">
                <p>No official comments yet.</p>
              </div>
            )}
            {!showAllComments && application.comments.filter(comment => comment.type === 'official-comment' && comment.message && comment.message.trim()).length > 2 && (
              <button 
                className="show-more-comments" 
                onClick={() => setShowAllComments(true)}
              >
                Show More Comments ({application.comments.filter(comment => comment.type === 'official-comment' && comment.message && comment.message.trim()).length - 2} more)
              </button>
            )}
            {showAllComments && application.comments.filter(comment => comment.type === 'official-comment' && comment.message && comment.message.trim()).length > 2 && (
              <button 
                className="show-less-comments" 
                onClick={() => setShowAllComments(false)}
              >
                Show Less
              </button>
            )}
          </div>
        </div>

        {application.needsRevision && (
          <div className="resubmission-area">
            <div className="resubmission-header">
              <h3>Revision Required</h3>
              <p>Please review the revision instructions below and resubmit your application with the necessary changes.</p>
            </div>
            <div className="revision-instructions">
              {application.comments
                .filter(comment => comment.type === 'revision-request')
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 1)
                .map((comment, index) => (
                  <div 
                    key={index} 
                    className="comment-item revision"
                  >
                    <div className="comment-header">
                      <span className="comment-user">DENR Admin</span>
                      <span className="comment-timestamp">{comment.timestamp}</span>
                    </div>
                    <div className="comment-content">
                      <h4>Revision Instructions:</h4>
                      <p>{convertHtmlToText(comment.message)}</p>
                    </div>
                  </div>
              ))}
              {application.comments.filter(comment => comment.type === 'revision-request').length === 0 && (
                <div className="no-comments">
                  <p>{convertHtmlToText(application.revisionInstructions) || "Please update your application as required."}</p>
                </div>
              )}
            </div>
            
            {/* File Upload UI */}
            <div className="file-upload-section">
              <h4>Upload Revised Documents</h4>
              <div 
                className={`file-upload-container ${isDragging ? 'dragging' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleBrowseClick}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  className="file-upload-input"
                  multiple
                />
                <div className="upload-icon">
                  <FaFileAlt />
                </div>
                <p className="upload-text">Drag & drop files here or click to browse</p>
                <button type="button" className="browse-button">Browse Files</button>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="selected-files-container">
                  <h4>Selected Files ({selectedFiles.length})</h4>
                  <ul className="selected-files-list">
                    {selectedFiles.map((file, index) => (
                      <li key={index} className="selected-file-item">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">({(file.size / 1024).toFixed(2)} KB)</span>
                        <button
                          className="remove-file-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                        >
                          <FaTimes />
                        </button>
                      </li>
                    ))}
                  </ul>
                  
                  <button 
                    className="resubmit-button"
                    onClick={handleUploadFiles}
                    disabled={isUploading || isSubmitting || selectedFiles.length === 0}
                  >
                    {isUploading ? `Uploading... ${uploadProgress}%` : 
                     isSubmitting ? 'Resubmitting application...' : 
                     'Resubmit Application with Documents'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApplicationTracking;
