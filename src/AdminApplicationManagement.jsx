import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheck, FaTimes } from 'react-icons/fa';
import './CSS/AdminApplicationManagement.css';

function AdminApplicationManagement({ application, onClose, onUpdateStatus }) {
  const [selectedStatus, setSelectedStatus] = useState(application.status);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revisionInstructions, setRevisionInstructions] = useState('');

  const statusOptions = [
    { value: 'Pending', label: 'Pending Review' },
    { value: 'Document Verification', label: 'Document Verification' },
    { value: 'On Review', label: 'Under Review' },
    { value: 'Final Assessment', label: 'Final Assessment' },
    { value: 'Needs Revision', label: 'Needs Revision' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      alert('Please add a comment explaining the status change.');
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real app, this would be an API call
      const statusUpdate = {
        status: selectedStatus,
        comment: {
          id: Date.now(),
          user: 'Admin', // This would come from auth context
          role: 'admin',
          message: comment,
          timestamp: new Date().toLocaleString(),
          isOfficial: true
        },
        revisionInstructions: selectedStatus === 'Needs Revision' ? revisionInstructions : null
      };

      await onUpdateStatus(statusUpdate);
      onClose();
    } catch (error) {
      alert('Error updating application status: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-management-overlay">
      <div className="admin-management-modal">
        <div className="admin-modal-header">
          <h2>Update Application Status</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="admin-modal-content">
          <div className="application-info">
            <h3>Application Details</h3>
            <p><strong>Reference:</strong> {application.referenceNumber}</p>
            <p><strong>Title:</strong> {application.title}</p>
            <p><strong>Current Status:</strong> {application.status}</p>
          </div>

          <form onSubmit={handleSubmit} className="status-update-form">
            <div className="form-group">
              <label htmlFor="status">New Status:</label>
              <select
                id="status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="status-select"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedStatus === 'Needs Revision' && (
              <div className="form-group">
                <label htmlFor="revisionInstructions">Revision Instructions:</label>
                <textarea
                  id="revisionInstructions"
                  value={revisionInstructions}
                  onChange={(e) => setRevisionInstructions(e.target.value)}
                  placeholder="Provide detailed instructions for the required revisions..."
                  rows={4}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="comment">Official Comment:</label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Provide a comment explaining the status change..."
                rows={4}
                required
              />
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                <FaTimes /> Cancel
              </button>
              <button 
                type="submit" 
                className="submit-button"
                disabled={isSubmitting}
              >
                <FaCheck /> {isSubmitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminApplicationManagement; 