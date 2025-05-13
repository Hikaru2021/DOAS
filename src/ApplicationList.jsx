import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaSearch, FaFilter, FaSort, FaEye, FaChartLine, FaTrash, FaDownload, FaCalendarAlt, FaFile, FaIdCard, FaUser, FaMapMarkerAlt, FaEnvelope, FaPhone, FaFileAlt, FaClipboardList, FaMoneyBillWave, FaInfoCircle, FaTags, FaClock, FaFileContract, FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaFileArchive, FaFileCode, FaCog, FaEdit, FaTimes } from "react-icons/fa";
import "./CSS/ApplicationList.css";
import "./CSS/SharedTable.css";
import ApplicationSubmissionForm from "./Modals/ApplicationSubmissionForm";
import ManageApplicationModal from "./Modals/ManageApplicationModal";
import { supabase } from "./library/supabaseClient";
import JSZip from 'jszip';

// Supabase storage constants
const STORAGE_BUCKET = 'guidelines';

function formatDateMMDDYYYY(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

function formatTime12hr(date) {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

function DraggableTitle({ children }) {
  const ref = useRef(null);
  // Use refs to store drag state
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const onMouseDown = (e) => {
    isDownRef.current = true;
    startXRef.current = e.pageX - ref.current.offsetLeft;
    scrollLeftRef.current = ref.current.scrollLeft;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!isDownRef.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = x - startXRef.current;
    ref.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const onMouseUp = () => {
    isDownRef.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <span
      className="application-title draggable-title"
      ref={ref}
      onMouseDown={onMouseDown}
      tabIndex={0}
      style={{ userSelect: 'none' }}
    >
      {children}
    </span>
  );
}

function ApplicationList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter || "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [applicationTypes, setApplicationTypes] = useState([]);
  const [downloadingDocId, setDownloadingDocId] = useState(null);
  const [documents, setDocuments] = useState({});
  const [isDownloadingAllDocs, setIsDownloadingAllDocs] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAppId, setDeletingAppId] = useState(null);
  const [deletingRowId, setDeletingRowId] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Get filterById from navigation state
  const filterById = location.state?.filterById;

  // Status mapping function
  const getStatusName = (statusId) => {
    switch (statusId) {
      case 1: return "Submitted";
      case 2: return "Under Review";
      case 3: return "Needs Revision";
      case 4: return "Approved";
      case 5: return "Rejected";
      case 6: return "Payment Pending";
      case 7: return "Payment Recieved";
      case 8: return "Payment Failed";
      case 9: return "Inspecting";
      case 10: return "Completed";
      case 11: return "Inspected";
      default: return "Unknown";
    }
  };

  // Fetch document details
  const fetchDocuments = async (userAppId) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_submissions', userAppId);

      if (error) throw error;

      if (data && data.length > 0) {
        return data;
      }
      return [];
    } catch (err) {
      console.error('Error fetching documents:', err);
      return [];
    }
  };

  // Fetch all user applications
  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const { data: user_applications, error } = await supabase
        .from('user_applications')
        .select(`
          id,
          created_at,
          status,
          approved_date,
          full_name,
          contact_number,
          address,
          purpose,
          email_address,
          applications (
            id,
            title,
            type,
            description,
            application_fee,
            processing_fee
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our component's expected format
      const transformedApplications = user_applications.map(app => ({
        id: app.id,
        referenceNumber: `REF-${app.id.toString().padStart(6, '0')}`,
        application_id: `REF-${app.id.toString().padStart(6, '0')}`,
        applicant_name: app.full_name,
        title: app.applications.title,
        type: app.applications.type,
        submitted_at: app.created_at,
        status: getStatusName(app.status),
        statusId: app.status,
        description: app.applications.description,
        notes: "",
        // User details
        fullName: app.full_name,
        email: app.email_address,
        contactNumber: app.contact_number,
        address: app.address,
        purpose: app.purpose,
        // Fees
        fees: {
          application: app.applications.application_fee || 0,
          processing: app.applications.processing_fee || 0,
          total: (app.applications.application_fee || 0) + (app.applications.processing_fee || 0)
        }
      }));

      setApplications(transformedApplications);
      
      // Extract unique application types
      const types = [...new Set(transformedApplications.map(app => app.type))];
      setApplicationTypes(types);
      
      setError(null);
    } catch (err) {
      setError(`Error fetching applications: ${err.message}`);
      console.error('Error fetching applications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Update status filter when location state changes
  useEffect(() => {
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter);
    }
  }, [location.state]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle type filter change
  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle sort change
  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Filter and sort applications
  const filteredAndSortedApplications = applications
    .filter(app => {
      // If filterById is set, only show that application
      if (filterById) {
        // Accept both numeric and string IDs
        return app.id === filterById || app.referenceNumber === filterById || app.application_id === filterById || app.id === Number(filterById);
      }
      // Search filter
      const matchesSearch = 
        app.title.toLowerCase().includes(search.toLowerCase()) ||
        app.applicant_name.toLowerCase().includes(search.toLowerCase()) ||
        app.application_id.toLowerCase().includes(search.toLowerCase());
      // Status filter
      let matchesStatus = false;
      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (Array.isArray(statusFilter)) {
        matchesStatus = statusFilter.includes(app.statusId);
      } else {
        matchesStatus = app.statusId === statusFilter;
      }
      // Type filter
      const matchesType = typeFilter === "all" || app.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch(sortBy) {
        case "newest":
          comparison = new Date(b.submitted_at) - new Date(a.submitted_at);
          break;
        case "oldest":
          comparison = new Date(a.submitted_at) - new Date(b.submitted_at);
          break;
        case "applicant":
          comparison = a.applicant_name.localeCompare(b.applicant_name);
          break;
        case "status":
          comparison = a.statusId - b.statusId;
          break;
        default:
          comparison = b.id - a.id; // Default sort by ID descending
      }
      
      return comparison;
    });

  // Calculate pagination values
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredAndSortedApplications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAndSortedApplications.length / itemsPerPage);

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Handle view application
  const handleViewApplication = async (application) => {
    try {
      const docs = await fetchDocuments(application.id);
      if (docs && docs.length > 0) {
        setDocuments({ ...documents, [application.id]: docs });
      }
      setSelectedApplication(application);
      setShowViewModal(true);
    } catch (err) {
      console.error('Error retrieving documents for viewing:', err);
    }
  };

  // Handle manage application
  const handleManageApplication = (application) => {
    setSelectedApplication(application);
    setShowManageModal(true);
  };

  // Handle edit application
  const handleEditApplication = (application) => {
    setSelectedApplication({...application});
    setShowEditModal(true);
  };

  // Handle delete application
  const handleDeleteClick = (id) => {
    const app = applications.find(a => a.id === id);
    if (!app || app.status === "Approved" || app.status === "Under Review") {
      setShowDeleteModal(false);
      setDeletingAppId(null);
      return;
    }
    setDeletingAppId(id);
    setShowDeleteModal(true);
  };

  // Toast auto-dismiss effect
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ ...toast, show: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Update handleDeleteApplication to show toast
  const handleDeleteApplication = async () => {
    const app = applications.find(a => a.id === deletingAppId);
    if (!app || app.status === "Approved" || app.status === "Under Review") {
      setShowDeleteModal(false);
      setDeletingAppId(null);
      setDeletingRowId(null);
      return;
    }
    if (!deletingAppId) return;
    try {
      setIsLoading(true);
      setDeletingRowId(deletingAppId);
      await new Promise((resolve) => setTimeout(resolve, 400));
      // 1. Delete application status history records first
      const { error: historyError } = await supabase
        .from("application_status_history")
        .delete()
        .eq("user_application_id", deletingAppId);
      if (historyError) throw historyError;
      // 2. Get all documents related to this application to delete them from storage
      const { data: documents, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("user_submissions", deletingAppId);
      if (docError) throw docError;
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          const fileUrl = doc.file_link;
          if (fileUrl) {
            const filePath = fileUrl.split('/storage/v1/object/public/')[1];
            if (filePath) {
              const bucketName = filePath.split('/')[0];
              const path = filePath.substring(bucketName.length + 1);
              const { error: storageError } = await supabase.storage
                .from(bucketName)
                .remove([decodeURIComponent(path)]);
              if (storageError) {
                console.error(`Error deleting file from storage: ${storageError.message}`);
              }
            }
          }
        }
        const { error: docDeleteError } = await supabase
          .from('documents')
          .delete()
          .eq('user_submissions', deletingAppId);
        if (docDeleteError) throw docDeleteError;
      }
      // 4. Delete all comments related to this application
      const { error: commentsError } = await supabase
        .from("comments")
        .delete()
        .eq("user_applications_id", deletingAppId);
      if (commentsError) throw commentsError;
      // 5. Finally delete the application itself
      const { error } = await supabase
        .from('user_applications')
        .delete()
        .eq('id', deletingAppId);
      if (error) throw error;
      setApplications(applications.filter(app => app.id !== deletingAppId));
      setShowDeleteModal(false);
      setDeletingAppId(null);
      setDeletingRowId(null);
      // Show success toast
      setToast({ show: true, message: "Application deleted successfully!", type: "success" });
    } catch (err) {
      setError(`Error deleting application: ${err.message}`);
      setShowDeleteModal(false);
      setDeletingAppId(null);
      setDeletingRowId(null);
      console.error("Error deleting application:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle download application (all documents as ZIP)
  const handleDownloadApplication = async (application) => {
    try {
      setIsDownloadingAllDocs(true);
      
      // Fetch documents for this application
      const docs = await fetchDocuments(application.id);
      
      if (!docs || docs.length === 0) {
        alert('No documents available for this application');
        return;
      }
      
      // Create new ZIP file
      const zip = new JSZip();
      
      // Download each file and add to ZIP
      const downloadPromises = docs.map(async (doc) => {
        try {
          // Extract the filepath from the document
          let filePath = doc.file_link;
          
          // If it's a public URL, extract just the path part
          if (filePath.includes('https://')) {
            const pathRegex = new RegExp(`${STORAGE_BUCKET}/(.+)`, 'i');
            const match = filePath.match(pathRegex);
            if (match && match[1]) {
              filePath = match[1];
            } else {
              throw new Error('Invalid file path format');
            }
          }
          
          // Download the file from storage
          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(filePath);
            
          if (error) throw error;
          
          // Add file to zip
          zip.file(doc.file_name || `document_${doc.id}.pdf`, data);
          return true;
        } catch (err) {
          console.error(`Error downloading document ${doc.id}:`, err);
          return false;
        }
      });
      
      // Wait for all downloads to complete
      await Promise.all(downloadPromises);
      
      // Generate ZIP file
      const zipContent = await zip.generateAsync({ type: 'blob' });
      
      // Create download link for the zip
      const url = URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${application.application_id}_documents.zip`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error('Error downloading all documents:', err);
      alert(`Error downloading documents: ${err.message}`);
    } finally {
      setIsDownloadingAllDocs(false);
    }
  };

  // Handle download specific document
  const handleDownloadDocument = async (document) => {
    try {
      setDownloadingDocId(document.id);
      
      // Extract the filepath from the document
      let filePath = document.file_link;
      
      // If it's a public URL, extract just the path part
      if (filePath.includes('https://')) {
        // Extract the path portion after the bucket name
        const pathRegex = new RegExp(`${STORAGE_BUCKET}/(.+)`, 'i');
        const match = filePath.match(pathRegex);
        if (match && match[1]) {
          filePath = match[1];
        } else {
          throw new Error('Invalid file path format');
        }
      }
      
      // Download the file from storage
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(filePath);
        
      if (error) throw error;
      
      // Create a download link for the file
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.file_name || 'download';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error('Error downloading document:', err);
      alert(`Error downloading document: ${err.message}`);
    } finally {
      setDownloadingDocId(null);
    }
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case "submitted":
        return "status-badge submitted";
      case "under review":
        return "status-badge in-review";
      case "needs revision":
        return "status-badge revision";
      case "approved":
        return "status-badge approved";
      case "rejected":
        return "status-badge rejected";
      case "payment pending":
        return "status-badge payment-pending";
      case "payment recieved":
        return "status-badge payment-recieved";
      case "payment failed":
        return "status-badge payment-failed";
      case "inspected":
        return "status-badge inspected";
      case "completed":
        return "status-badge completed";
      default:
        return "status-badge";
    }
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    try {
      // Simulate API call delay
      setTimeout(() => {
        setApplications(applications.map(app => 
          app.id === selectedApplication.id ? selectedApplication : app
        ));
      setShowEditModal(false);
      }, 500);
    } catch (err) {
      console.error('Error updating application:', err);
      alert(`Error updating application: ${err.message}`);
    }
  };

  // Handle start application
  const handleStartApplication = (application) => {
    setSelectedApplication(application);
    setShowSubmissionForm(true);
  };

  // Handle application submitted
  const handleApplicationSubmitted = (submittedData) => {
    // Create a new application object with the submitted data
    const newApplication = {
      id: applications.length + 1,
      application_id: `APP-${new Date().getFullYear()}-${String(applications.length + 1).padStart(3, '0')}`,
      applicant_name: submittedData.fullName,
      title: selectedApplication.title,
      type: selectedApplication.type,
      submitted_at: new Date().toISOString(),
      status: "pending",
      description: selectedApplication.description,
      notes: "New application submitted",
      // User submitted details
      fullName: submittedData.fullName,
      email: submittedData.email,
      contactNumber: submittedData.contactNumber,
      address: submittedData.address,
      purpose: submittedData.purpose,
      documents: submittedData.documents,
      fees: {
        application: 1000,
        processing: 500,
        total: 1500
      }
    };

    // Add the new application to the list
    setApplications(prev => [...prev, newApplication]);
    setShowSubmissionForm(false);
    setSelectedApplication(null);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(currentPage + 1);
  };

  // Add this function inside the ApplicationList component
  const getFileIcon = (fileName) => {
    if (!fileName) return <FaFile />;
    
    const extension = fileName.split('.').pop().toLowerCase();
    
    switch(extension) {
      case 'pdf':
        return <FaFilePdf className="document-icon pdf" />;
      case 'doc':
      case 'docx':
        return <FaFileWord className="document-icon doc" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FaFileExcel className="document-icon xls" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return <FaFileImage className="document-icon jpg" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FaFileArchive className="document-icon" />;
      case 'html':
      case 'css':
      case 'js':
      case 'jsx':
      case 'php':
        return <FaFileCode className="document-icon" />;
      default:
        return <FaFile className="document-icon" />;
    }
  };

  // Handle status update from ManageApplicationModal
  const handleUpdateStatus = async (statusUpdate) => {
    try {
      // Update the application status in the local state
      const updatedApplications = applications.map(app => {
        if (app.id === selectedApplication.id) {
          return {
            ...app,
            status: statusUpdate.status,
            statusId: statusUpdate.statusId,
            notes: statusUpdate.comment?.message || app.notes
          };
        }
        return app;
      });
      
      setApplications(updatedApplications);
      console.log(`Application ${selectedApplication.id} status updated to ${statusUpdate.status}`);
    } catch (err) {
      console.error('Error updating application status:', err);
      alert(`Error updating status: ${err.message}`);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="application-list-container">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}
      <div className="application-list-header">
        <h1 className="application-list-title" style={{ fontSize: '32px', fontWeight: 'bold' }}><FaClipboardList style={{marginRight: '10px'}}/>Application List</h1>
        <p className="application-list-subtitle">Manage and track all submitted applications</p>
      </div>

      <div className="application-list-filters">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by ID, applicant name, or title..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="filter-container">
          <div className="filter-item">
            <label>Status:</label>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={handleStatusFilterChange}
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Needs Revision">Needs Revision</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Payment Pending">Payment Pending</option>
              <option value="Payment Recieved">Payment Recieved</option>
              <option value="Payment Failed">Payment Failed</option>
              <option value="Inspected">Inspected</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          
          <div className="filter-item">
            <label>Type:</label>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={handleTypeFilterChange}
            >
              <option value="all">All Types</option>
              {applicationTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-item">
            <label>Sort By:</label>
            <select
              className="filter-select"
              value={sortBy}
              onChange={handleSortChange}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="applicant">Applicant Name</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading applications...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={fetchApplications}>
            Retry
          </button>
        </div>
      ) : (
        isMobileView ? (
          <div className="application-cards-mobile">
            {filteredAndSortedApplications.length === 0 ? (
              <div className="empty-state">
                <p>No applications found. {search || statusFilter !== "all" || typeFilter !== "all" ? "Try adjusting your filters." : ""}</p>
              </div>
            ) : (
              filteredAndSortedApplications.map((application) => (
                <div key={application.id} className="application-card-mobile">
                  <div><strong>Reference #:</strong> {application.referenceNumber}</div>
                  <div><strong>Applicant:</strong> {application.applicant_name}</div>
                  <div><strong>Email:</strong> {application.email}</div>
                  <div><strong>Title:</strong> {application.title}</div>
                  <div><strong>Type:</strong> {application.type}</div>
                  <div><strong>Status:</strong> <span className={`status-badge ${application.status.toLowerCase().replace(' ', '-')}`}>{application.status}</span></div>
                  <div><strong>Submitted Date:</strong> {formatDateMMDDYYYY(application.submitted_at)}</div>
                  <div className="action-buttons">
                    <button 
                      className="action-button view-button" 
                      onClick={() => handleViewApplication(application)}
                      title="View Details"
                    >
                      <FaEye />
                    </button>
                    <button 
                      className="action-button manage-button" 
                      onClick={() => handleManageApplication(application)}
                      title="Manage Application"
                    >
                      <FaCog />
                    </button>
                    <button 
                      className="action-button download-button" 
                      onClick={() => handleDownloadApplication(application)}
                      title="Download All Documents"
                      disabled={isDownloadingAllDocs}
                    >
                      <FaDownload />
                    </button>
                    {application.status !== "Approved" && application.status !== "Under Review" && (
                      <button
                        className="action-button delete-button"
                        onClick={() => handleDeleteClick(application.id)}
                        title="Delete Application"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="shared-table">
              <thead>
                <tr>
                  <th className="ref-col">Reference #</th>
                  <th>Applicant</th>
                  <th className="title-col">Title</th>
                  <th className="th-center">Type</th>
                  <th className="th-center">Submitted Date</th>
                  <th className="th-center">Status</th>
                  <th className="th-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">No applications found</td>
                  </tr>
                ) : (
                  currentItems.map((application) => (
                    <tr key={application.id} className={deletingRowId === application.id ? 'fade-out-row' : ''}>
                      <td className="ref-col">{application.referenceNumber}</td>
                      <td>{application.applicant_name}</td>
                      <td className="title-col"><DraggableTitle>{application.title}</DraggableTitle></td>
                      <td className="td-center">{application.type}</td>
                      <td className="td-center">{formatDateMMDDYYYY(application.submitted_at)}</td>
                      <td className="td-center">
                        <span className={`status-badge ${application.status.toLowerCase().replace(' ', '-')}`}>
                          {application.status}
                        </span>
                      </td>
                      <td className="td-center">
                        <div className="action-buttons" style={{ display: 'inline-flex', gap: 0 }}>
                          <button 
                            className="action-button view-button" 
                            onClick={() => handleViewApplication(application)}
                            title="View Details"
                            style={{ margin: '0 2px 0 0' }}
                          >
                            <FaEye />
                          </button>
                          <button 
                            className="action-button manage-button" 
                            onClick={() => handleManageApplication(application)}
                            title="Manage Application"
                            style={{ margin: '0 2px 0 0' }}
                          >
                            <FaCog />
                          </button>
                          <button 
                            className="action-button download-button" 
                            onClick={() => handleDownloadApplication(application)}
                            title="Download All Documents"
                            disabled={isDownloadingAllDocs}
                            style={{ margin: '0 2px 0 0' }}
                          >
                            <FaDownload />
                          </button>
                          {application.status !== "Approved" && application.status !== "Under Review" && (
                            <button
                              className="action-button delete-button"
                              onClick={() => handleDeleteClick(application.id)}
                              title="Delete Application"
                              style={{ margin: '0' }}
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
      )}
          
          {/* Fixed pagination container */}
      {!isMobileView && (
          <div className="pagination-container">
            <div className="pagination">
              <button
                className="pagination-button nav-button"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                ❮ Prev
              </button>
              <div className="pagination-pages">
                {(() => {
                  const pageNumbers = [];
                  
                  if (totalPages <= 5) {
                    // If 5 or fewer pages, show all page numbers
                    for (let i = 1; i <= Math.max(1, totalPages); i++) {
                      pageNumbers.push(i);
                    }
                  } else {
                    // Always show first page
                    pageNumbers.push(1);
                    
                    // For current pages near the start
                    if (currentPage <= 3) {
                      pageNumbers.push(2, 3, 4);
                      pageNumbers.push('ellipsis');
                      pageNumbers.push(totalPages);
                    } 
                    // For current pages near the end
                    else if (currentPage >= totalPages - 2) {
                      pageNumbers.push('ellipsis');
                      pageNumbers.push(totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                    } 
                    // For current pages in the middle
                    else {
                      pageNumbers.push('ellipsis');
                      pageNumbers.push(currentPage - 1, currentPage, currentPage + 1);
                      pageNumbers.push('ellipsis2');
                      pageNumbers.push(totalPages);
                    }
                  }
                  
                  return pageNumbers.map((pageNumber, index) => {
                    if (pageNumber === 'ellipsis' || pageNumber === 'ellipsis2') {
                      return (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                      );
                    }
                    
                    return (
                      <button
                        key={pageNumber}
                        className={`pagination-button ${currentPage === pageNumber ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                className="pagination-button nav-button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next ❯
              </button>
            </div>
          </div>
      )}

      {/* View Application Modal with enhanced UI */}
      {showViewModal && selectedApplication && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Application Details</h2>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-section">
                <h3><FaIdCard /> Reference #</h3>
                <p>{selectedApplication.application_id}</p>
              </div>
              <div className="modal-section">
                <h3><FaUser /> Applicant Information</h3>
                <p><strong>Name:</strong> {selectedApplication.fullName}</p>
                <p><strong>Email:</strong> {selectedApplication.email}</p>
                <p><strong>Contact:</strong> {selectedApplication.contactNumber}</p>
                <p><strong>Address:</strong> {selectedApplication.address}</p>
                <p><strong>Purpose:</strong> {selectedApplication.purpose}</p>
              </div>
              <div className="modal-section">
                <h3><FaFileContract /> Application Type</h3>
                <p>{selectedApplication.title} ({selectedApplication.type})</p>
              </div>
              <div className="modal-section">
                <h3><FaTags /> Status</h3>
                <span className={getStatusBadgeClass(selectedApplication.status)}>
                  {selectedApplication.status}
                </span>
              </div>
              
              {/* Document download section - Modified to use file-type icons */}
              <div className="modal-section">
                <h3><FaFileAlt /> Documents</h3>
                {documents[selectedApplication.id] && documents[selectedApplication.id].length > 0 ? (
                  <ul className="documents-list">
                    {documents[selectedApplication.id].map(doc => (
                      <li key={doc.id} className="document-item">
                        <div className="document-info">
                          {getFileIcon(doc.file_name)}
                          <span className="document-name">{doc.file_name}</span>
                        </div>
                        <button 
                          className="download-document-btn"
                          onClick={() => handleDownloadDocument(doc)}
                          disabled={downloadingDocId === doc.id}
                        >
                          {downloadingDocId === doc.id ? 'Downloading...' : <FaDownload />}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-documents">No documents available for this application</p>
                )}
              </div>
              
              <div className="modal-section">
                <h3><FaMoneyBillWave /> Fees</h3>
                <div className="fees-details">
                  <p><strong>Application Fee:</strong> <span>₱{Number(selectedApplication.fees?.application || 0).toLocaleString()}</span></p>
                  <p><strong>Processing Fee:</strong> <span>₱{Number(selectedApplication.fees?.processing || 0).toLocaleString()}</span></p>
                  <p><strong>Total:</strong> <span>₱{(Number(selectedApplication.fees?.application || 0) + Number(selectedApplication.fees?.processing || 0)).toLocaleString()}</span></p>
                </div>
              </div>
              <div className="modal-section">
                <h3><FaClock /> Submitted Date</h3>
                <p>{formatDateMMDDYYYY(selectedApplication.submitted_at)} at {formatTime12hr(selectedApplication.submitted_at)}</p>
              </div>
              {selectedApplication.notes && (
                <div className="modal-section">
                  <h3><FaInfoCircle /> Notes</h3>
                  <p>{selectedApplication.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-button" onClick={() => setShowViewModal(false)}>Close</button>
              <button
                className="modal-button primary"
                onClick={() => {
                  setShowViewModal(false);
                  handleManageApplication(selectedApplication);
                }}
              >
                <FaCog /> Manage Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Application Modal */}
      {showEditModal && selectedApplication && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit Application</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form className="edit-form">
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status" 
                    value={selectedApplication.status} 
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      status: e.target.value
                    })}
                  >
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Needs Revision">Needs Revision</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Payment Pending">Payment Pending</option>
                    <option value="Payment Recieved">Payment Recieved</option>
                    <option value="Payment Failed">Payment Failed</option>
                    <option value="Inspected">Inspected</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes" 
                    value={selectedApplication.notes || ''} 
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      notes: e.target.value
                    })}
                    rows="4"
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="modal-button" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button 
                className="modal-button primary" 
                onClick={handleSaveChanges}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Submission Form */}
      {showSubmissionForm && selectedApplication && (
        <ApplicationSubmissionForm
          isOpen={showSubmissionForm}
          onClose={() => {
            setShowSubmissionForm(false);
            setSelectedApplication(null);
          }}
          application={selectedApplication}
          onApplicationSubmitted={handleApplicationSubmitted}
        />
      )}

      {/* Add ManageApplicationModal */}
      {showManageModal && selectedApplication && (
        <ManageApplicationModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          application={selectedApplication}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2>Delete Application</h2>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}><FaTimes /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this application?</p>
              <p className="warning-message">This action cannot be undone.</p>
            </div>
            <div className="form-actions">
              <button className="cancel-button" onClick={() => setShowDeleteModal(false)} disabled={isLoading}>Cancel</button>
              <button className="delete-button" onClick={handleDeleteApplication} disabled={isLoading}>{isLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApplicationList;