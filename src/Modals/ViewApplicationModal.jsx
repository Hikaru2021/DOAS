import { FaTimes, FaFileAlt, FaMoneyBillWave, FaListUl, FaInfoCircle, FaDownload, FaFilePdf, FaFileWord } from "react-icons/fa";
import DOMPurify from 'dompurify';
import "../CSS/ApplicationSubmissionList.css";
import { useState, useEffect } from "react";
import { supabase } from "../library/supabaseClient";
import PropTypes from 'prop-types';

const ViewApplicationModal = ({ isOpen, onClose, application, onStartApplication }) => {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch documents for the application when modal opens and application data is available
    if (isOpen && application?.id) {
      fetchDocuments(application.id);
    }
  }, [isOpen, application]);

  const fetchDocuments = async (applicationId) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('application_id', applicationId);
        
      if (error) {
        console.error('Error fetching documents:', error);
        return;
      }
      
      // Filter to only show application documents (forms and guidelines)
      const applicationDocs = data ? data.filter(doc => {
        // Only show documents that are guidelines or application forms
        return (
          // Application forms are in the Forms folder
          doc.file_link?.includes('/Forms/') ||
          // Guidelines documents should be explicitly marked or in guidelines folder
          doc.file_link?.includes('/guidelines/') ||
          // Check for document type labels
          doc.document_type === 'guidelines' ||
          doc.document_type === 'application-form'
        );
      }) : [];
      
      setDocuments(applicationDocs);
    } catch (error) {
      console.error('Error in fetchDocuments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) {
      return <FaFilePdf className="file-icon pdf" />;
    } else if (fileType?.includes('word') || fileType?.includes('doc')) {
      return <FaFileWord className="file-icon doc" />;
    } else {
      return <FaFileAlt className="file-icon" />;
    }
  };

  const getDocumentType = (doc) => {
    // First check if document_type is explicitly set
    if (doc.document_type) {
      return doc.document_type;
    }
    
    // Otherwise check file path
    if (doc.file_link?.includes('/Forms/')) {
      return 'application-form';
    } else if (doc.file_link?.includes('/guidelines/')) {
      return 'guidelines';
    } else {
      // Default for documents without clear type 
      return 'other';
    }
  };

  const getDocumentLabel = (docType) => {
    switch(docType) {
      case 'guidelines':
        return 'Guidelines';
      case 'application-form':
        return 'Application Form';
      default:
        return 'Document';
    }
  };

  if (!isOpen || !application) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  // Sanitize and prepare description content
  const sanitizedDescription = application.description ? DOMPurify.sanitize(application.description) : '';

  return (
    <div className="modal-overlay">
      <div className="modal-container view-application-modal" style={{ borderRadius: '12px' }}>
        {/* Header Section */}
        <div className="modal-header">
          <div className="modal-title-section">
            <h2 style={{ textAlign: 'justify' }}>{application.title}</h2>
            <div className="header-meta">
              <span className="application-type-badge">{application.type}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        <div className="modal-body">
          {/* Description Section */}
          <div className="content-section">
            <div className="section-header">
              <FaInfoCircle className="section-icon" />
              <h3>Description</h3>
            </div>
            <div 
              className="section-content description-content"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          </div>

          {/* Documents Section */}
          <div className="content-section">
            <div className="section-header">
              <FaFileAlt className="section-icon" />
              <h3>Documents</h3>
            </div>
            <div className="section-content">
              {isLoading ? (
                <div className="loading-indicator">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="no-documents">No documents available</div>
              ) : (
                <div className="documents-grid">
                  {documents.map((doc) => {
                    const documentType = getDocumentType(doc);
                    // Skip any documents that aren't guidelines or application forms
                    if (documentType === 'other') return null;
                    
                    return (
                      <div key={doc.id} className="document-card">
                        <div className="document-icon">
                          {getFileIcon(doc.file_type)}
                        </div>
                        <div className="document-info">
                          <div className="document-name" title={doc.file_name}>
                            {doc.file_name}
                          </div>
                          <div className="document-type">{doc.file_type}</div>
                          <div className={`document-type-label ${documentType}`}>
                            {getDocumentLabel(documentType)}
                          </div>
                        </div>
                        <a 
                          href={doc.file_link} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="download-button"
                          download
                        >
                          <FaDownload />
                          <span className="download-text">Download</span>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Requirements Section */}
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

          {/* Fees Section */}
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
                  <span className="fee-amount">{formatCurrency(application.application_fee)}</span>
                </div>
                <div className="fee-row">
                  <div className="fee-info">
                    <span className="fee-label">Processing Fee</span>
                    <span className="fee-description">Additional processing and handling charges</span>
                  </div>
                  <span className="fee-amount">{formatCurrency(application.processing_fee)}</span>
                </div>
                <div className="fee-total-row">
                  <span className="total-label">Total Amount</span>
                  <span className="total-amount">
                    {formatCurrency(
                      parseFloat(application.application_fee) + 
                      parseFloat(application.processing_fee)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Section */}
        <div className="modal-footer">
          <button 
            className="modal-button secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="modal-button primary"
            onClick={() => {
              onStartApplication(application);
              onClose();
            }}
          >
            Start Application Process
          </button>
        </div>
      </div>
    </div>
  );
};

ViewApplicationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  application: PropTypes.shape({
    id: PropTypes.number,
    title: PropTypes.string,
    type: PropTypes.string,
    description: PropTypes.string,
    application_fee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    processing_fee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    requirements: PropTypes.arrayOf(PropTypes.string)
  }),
  onStartApplication: PropTypes.func.isRequired
};

export default ViewApplicationModal; 