import { useState, useEffect } from 'react';
import { FaTimes, FaComments, FaEdit, FaHistory, FaRegClock } from 'react-icons/fa';
import { supabase } from '../library/supabaseClient';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../CSS/ApplicationSubmissionList.css';

const ManageApplicationModal = ({ isOpen, onClose, application, onUpdateStatus }) => {
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  const [revisionInstructions, setRevisionInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [userApplication, setUserApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [revisionDeadline, setRevisionDeadline] = useState('');
  const [applicantName, setApplicantName] = useState('');

  console.log("Application received by modal:", application);

  // Status name mapping
  const statusNames = {
    1: 'Submitted',
    2: 'Under Review',
    3: 'Needs Revision',
    4: 'Approved',
    5: 'Rejected',
    6: 'Payment Pending',
    7: 'Payment Recieved',
    8: 'Payment Failed',
    9: 'Inspecting',
    10: 'Completed'
  };

  // Status remarks mapping
  const statusRemarks = {
    1: 'Application submitted on [date_now with time]. Review will begin shortly.',
    2: 'Application is under review as of [date_now with time].',
    3: 'Revision required. Please submit the revised application by [revision_deadline]',
    4: 'Approved on [date_now with time]. Further instructions will be sent.',
    5: 'Your application has been rejected. If you have any questions, please contact us.',
    6: 'Payment pending. Please complete the payment by [payment_deadline].',
    7: 'Payment confirmed on [date_now with time]. Next steps will follow.',
    8: 'Payment failed. Please complete the payment by [insert deadline date].',
    9: 'Inspection scheduled. Please be prepared and ensure all necessary documents are available for the inspection.',
    10: 'Process completed on [date_now with time].'
  };

  // Helper to format date as 'MMM DD, YYYY, HH:mm'
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format time as 12-hour with AM/PM
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    // Format: 'MMM DD, YYYY, HH:MM AM/PM'
    const datePart = date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
    return `${datePart}, ${hours}:${minutes} ${ampm}`;
  };

  // Get dynamic status remarks
  const getStatusRemarks = (statusId) => {
    let remark = statusRemarks[statusId] || '';
    const now = formatDateTime(new Date());
    remark = remark.replace(/\[date_now with time\]/g, now);
    remark = remark.replace(/\[payment_deadline\]/g, deadline ? formatDateTime(deadline) : '[payment_deadline]');
    remark = remark.replace(/\[newpayment_deadline\]/g, newDeadline ? formatDateTime(newDeadline) : '[newpayment_deadline]');
    remark = remark.replace(/\[revision_deadline\]/g, revisionDeadline ? formatDateTime(revisionDeadline) : '[revision_deadline]');
    return remark;
  };

  // Get status name helper function
  const getStatusName = (statusId) => {
    return statusNames[statusId] || 'Unknown';
  };

  // Get status ID from status name
  const getStatusId = (statusName) => {
    if (!statusName) return null;
    
    // Convert to lowercase for case-insensitive matching
    const normalizedName = statusName.toLowerCase();
    
    for (const [id, name] of Object.entries(statusNames)) {
      if (name.toLowerCase() === normalizedName) {
        return parseInt(id, 10);
      }
    }
    
    return null;
  };

  useEffect(() => {
    if (isOpen && application) {
      fetchUserApplication();
    }
  }, [isOpen, application]);

  const fetchUserApplication = async () => {
    setLoading(true);
    try {
      if (application.id) {
        console.log("Fetching user application with ID:", application.id);

        // Fetch the latest user application data from Supabase
        const { data: dbApp, error: dbError } = await supabase
          .from('user_applications')
          .select('*')
          .eq('id', application.id)
          .single();

        if (dbError) {
          throw dbError;
        }

        // Set deadlines from dbApp
        setDeadline(dbApp.payment_deadline ? dbApp.payment_deadline.slice(0, 16) : '');
        setNewDeadline(dbApp.newpayment_deadline ? dbApp.newpayment_deadline.slice(0, 16) : '');
        setRevisionDeadline(dbApp.revision_deadline ? dbApp.revision_deadline.slice(0, 16) : '');

        // Fetch the applicant's name from the users table using user_id
        let applicantNameValue = dbApp.full_name || dbApp.applicant_name || dbApp.fullName || '';
        if (dbApp.user_id) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', dbApp.user_id)
            .single();
          if (!userError && userData && userData.full_name) {
            applicantNameValue = userData.full_name;
          }
        }
        setUserApplication(dbApp);
        setApplicantName(applicantNameValue);
        await fetchComments(application.id);
      } else {
        console.warn('No valid application ID provided');
      }
    } catch (err) {
      console.error('Error processing application data:', err);
      setFormError('Error loading application data');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (applicationId) => {
    if (!applicationId) return;
    
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('user_applications_id', applicationId)
        .order('comment_date', { ascending: false });

      if (error) {
        throw error;
      }

      console.log('Comments loaded:', data);
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Rich text editor configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline',
    'list', 'bullet'
  ];

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    // Reset revision instructions if status is not "Needs Revision" (status 3)
    if (e.target.value !== '3') {
      setRevisionInstructions('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (!status) {
        throw new Error('Please select a status');
      }

      if (status === '3' && !revisionInstructions.trim()) {
        throw new Error('Please provide revision instructions');
      }

      // Official comment is now optional (nullable)

      // Convert status to integer for database
      const numericStatus = parseInt(status, 10);

      if (!userApplication || !userApplication.id) {
        throw new Error('User application not found or invalid');
      }

      // 1. Save revision comment to the comments table if status is 3
      if (numericStatus === 3) {
        const { data: revisionCommentData, error: revisionCommentError } = await supabase
          .from('comments')
          .insert([
            {
              user_applications_id: userApplication.id,
              revision_comment: revisionInstructions,
              comment_date: new Date().toISOString()
            }
          ])
          .select();
        if (revisionCommentError) {
          throw new Error(`Error saving revision comment: ${revisionCommentError.message}`);
        }
      }

      // 2. First, save the comment to the comments table
      const commentData = {
        user_applications_id: userApplication.id,
        official_comment: comment,
        revision_comment: status === '3' ? revisionInstructions : null,
        comment_date: new Date().toISOString()
      };

      const { data: commentResult, error: commentError } = await supabase
        .from('comments')
        .insert(commentData)
        .select();

      if (commentError) {
        throw new Error(`Error saving comment: ${commentError.message}`);
      }

      console.log('Comment saved successfully:', commentResult);

      // 3. Insert record into application_status_history table with predefined remarks
      const historyData = {
        user_application_id: userApplication.id,
        status_id: numericStatus,
        remarks: getStatusRemarks(numericStatus),
      };

      const { data: historyResult, error: historyError } = await supabase
        .from('application_status_history')
        .insert(historyData)
        .select();

      if (historyError) {
        console.error('Error saving status history:', historyError);
      } else {
        console.log('Status history saved successfully:', historyResult);
      }

      // 4. Update application status and deadlines
      const updateData = { 
        status: numericStatus 
      };
      if (numericStatus === 4) {
        updateData.approved_date = new Date().toISOString();
      }
      if (numericStatus === 6) {
        updateData.payment_deadline = deadline ? new Date(deadline).toISOString() : null;
      }
      if (numericStatus === 8) {
        updateData.newpayment_deadline = newDeadline ? new Date(newDeadline).toISOString() : null;
      }
      if (numericStatus === 3) {
        updateData.revision_deadline = revisionDeadline ? new Date(revisionDeadline).toISOString() : null;
      }

      // Update the user_applications table
      const { data, error } = await supabase
        .from('user_applications')
        .update(updateData)
        .eq('id', userApplication.id)
        .select();

      if (error) throw error;

      console.log('Status updated successfully:', data);

      // 5. Refresh comments list
      await fetchComments(userApplication.id);

      // Create status update object for the parent component
      const statusUpdate = {
        status: getStatusName(numericStatus),
        statusId: numericStatus,
        comment: {
          message: comment,
          timestamp: new Date().toISOString(),
          isOfficial: true
        }
      };

      if (status === '3') {
        statusUpdate.revisionInstructions = revisionInstructions;
      }

      // Call the onUpdateStatus prop to update the UI
      await onUpdateStatus(statusUpdate);
      
      // Clear form inputs after successful submission
      setComment('');
      setRevisionInstructions('');
    } catch (err) {
      setFormError(err.message);
      console.error('Error updating application status:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container manage-application-modal" style={{ borderRadius: '12px', maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>Manage Application</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-indicator">Loading application data...</div>
          ) : (
            <>
              {formError && <div className="form-error">{formError}</div>}

              <form onSubmit={handleSubmit} className="application-form">
                <div className="form-group">
                  <label>Application ID</label>
                  <input
                    type="text"
                    value={userApplication ? `REF-${String(userApplication.id).padStart(6, '0')}` : 'Unknown ID'}
                    readOnly
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label>Applicant Name</label>
                  <input
                    type="text"
                    value={applicantName || 'Unknown'}
                    readOnly
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="currentStatus">Current Status</label>
                  <input
                    type="text"
                    id="currentStatus"
                    value={userApplication?.status ? statusNames[userApplication.status] || 'Unknown' : 'Unknown'}
                    readOnly
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newStatus">Update Status</label>
                  <select
                    id="newStatus"
                    value={status}
                    onChange={handleStatusChange}
                    required
                    className="form-input"
                  >
                    <option value="">Select new status</option>
                    <option value="1">Submitted</option>
                    <option value="2">Under Review</option>
                    <option value="3">Needs Revision</option>
                    <option value="6">Payment Pending</option>
                    <option value="7">Payment Recieved</option>
                    <option value="8">Payment Failed</option>
                    <option value="9">Inspecting</option>
                    <option value="4">Approved</option>
                    <option value="5">Rejected</option>
                    <option value="10">Completed</option>
                  </select>
                </div>

                {/* Deadline UI for Payment Pending and Payment Failed */}
                {status === '6' && (
                  <div className="form-group">
                    <label htmlFor="deadline">Deadline</label>
                    <input
                      type="datetime-local"
                      id="deadline"
                      className="form-input"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                    />
                  </div>
                )}
                {status === '8' && (
                  <>
                    <div className="form-group">
                      <label>Previous Deadline</label>
                      <div className="form-input readonly" style={{ padding: '0.5rem 0.75rem', background: '#f5f5f5', borderRadius: '4px' }}>
                        {deadline ? new Date(deadline).toLocaleString() : 'No previous deadline set'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="new-deadline">New Deadline</label>
                      <input
                        type="datetime-local"
                        id="new-deadline"
                        className="form-input"
                        value={newDeadline}
                        onChange={e => setNewDeadline(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {status === '3' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="revision-deadline">Revision Deadline</label>
                      <input
                        type="datetime-local"
                        id="revision-deadline"
                        className="form-input"
                        value={revisionDeadline}
                        onChange={e => setRevisionDeadline(e.target.value)}
                      />
                    </div>
                  <div className="form-group">
                      <label htmlFor="revisionInstructions">Revision Instructions</label>
                    <div className="rich-text-editor">
                      <ReactQuill
                        theme="snow"
                        value={revisionInstructions}
                        onChange={setRevisionInstructions}
                        modules={modules}
                        formats={formats}
                        placeholder="Provide detailed instructions for revision"
                      />
                    </div>
                  </div>
                  </>
                )}

                <div className="form-group">
                  <label htmlFor="comment">
                    <FaComments style={{ marginRight: '8px' }} />
                    Official Comment
                  </label>
                  <div className="rich-text-editor">
                    <ReactQuill
                      theme="snow"
                      value={comment}
                      onChange={setComment}
                      modules={modules}
                      formats={formats}
                      placeholder="Add an official comment about this status update"
                    />
                  </div>
                </div>
              </form>

              {/* Comments History Section */}
              <div className="comments-history-section">
                <h3>
                  <FaHistory style={{ marginRight: '8px' }} />
                  Comments History
                </h3>
                
                {commentsLoading ? (
                  <div className="loading-indicator">Loading comments...</div>
                ) : comments.length > 0 ? (
                  <div className="comments-list">
                    {comments.map(comment => (
                      <div key={comment.id} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-date">
                            <FaRegClock style={{ marginRight: '5px' }} />
                            {formatDate(comment.comment_date)}
                          </span>
                        </div>
                        {comment.official_comment && comment.official_comment.trim() && (
                          <div className="comment-content">
                            <h4>Official Comment:</h4>
                            <div 
                              className="comment-text"
                              dangerouslySetInnerHTML={{ __html: comment.official_comment }}
                            />
                          </div>
                        )}
                        {comment.revision_comment && (
                          <div className="revision-content">
                            <h4>Revision Instructions:</h4>
                            <div 
                              className="revision-text"
                              dangerouslySetInnerHTML={{ __html: comment.revision_comment }}
                            />
                          </div>
                        )}
                      </div>
                    )).filter(commentElement => commentElement.props.children.some(child => child && child.props && ((child.props.children && child.props.children[1] && child.props.children[1].props && child.props.children[1].props.dangerouslySetInnerHTML && child.props.children[1].props.dangerouslySetInnerHTML.__html.trim()) || (child.props.children && child.props.children[2] && child.props.children[2].props && child.props.children[2].props.dangerouslySetInnerHTML && child.props.children[2].props.dangerouslySetInnerHTML.__html.trim()))))}
                  </div>
                ) : (
                  <div className="no-comments">No comments available for this application</div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button 
            type="button"
            className="cancel-button"
            onClick={onClose}
            disabled={isSubmitting || loading}
          >
            Cancel
          </button>
          <button 
            type="button"
            className={`submit-button ${status === '5' ? 'reject' : ''}`}
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? "Updating..." : "Update Status"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageApplicationModal; 