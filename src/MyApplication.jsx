import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaSearch, FaFilter, FaSort, FaChartLine, FaDownload, FaTrash, FaTimes, FaClock, FaEye, FaFolderOpen } from "react-icons/fa";
import "./CSS/MyApplication.css"; 
import "./CSS/SharedTable.css";
import { supabase } from "./library/supabaseClient";
import ApplicationTracking from './ApplicationTracking';

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

function MyApplication() {
  const navigate = useNavigate();
  const location = useLocation();
  // Detect mobile view
  const isMobile = window.innerWidth <= 768;
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter || "all");
  const [sortBy, setSortBy] = useState("newest");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editApplication, setEditApplication] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(isMobile ? 4 : 6);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAppId, setDeletingAppId] = useState(null);
  const [deletingRowId, setDeletingRowId] = useState(null);
  // Track mobile view for responsive rendering
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Update itemsPerPage on resize
  useEffect(() => {
    const handleResize = () => {
      const newItemsPerPage = window.innerWidth <= 768 ? 4 : 6;
      setItemsPerPage(prev => {
        if (prev !== newItemsPerPage) {
          setCurrentPage(prevPage => {
            const firstVisibleIndex = (prevPage - 1) * prev;
            const newPage = Math.floor(firstVisibleIndex / newItemsPerPage) + 1;
            const totalPages = Math.ceil(filteredApplications.length / newItemsPerPage);
            return Math.min(newPage, Math.max(totalPages, 1));
          });
        }
        return newItemsPerPage;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [filteredApplications.length]);

  // Clamp currentPage to valid range when data or page size changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredApplications.length / itemsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredApplications.length, itemsPerPage]);

  // Track mobile view for responsive rendering
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      default: return "Unknown";
    }
  };

  // Fetch user's applications
  useEffect(() => {
    const fetchApplications = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error('No authenticated user found');

        const { data: user_applications, error } = await supabase
          .from('user_applications')
          .select(`
            id,
            created_at,
            status,
            applications (
              id,
              title,
              type,
              description
            ),
            full_name,
            contact_number,
            address,
            purpose,
            approved_date
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform the data to match our component's expected format
        const transformedApplications = user_applications.map(app => ({
          id: app.id,
          title: app.applications.title,
          type: app.applications.type,
          status: getStatusName(app.status),
          statusId: app.status,
          submissionDate: new Date(app.created_at).toISOString(),
          lastUpdated: app.approved_date ? new Date(app.approved_date).toISOString() : new Date(app.created_at).toISOString(),
          referenceNumber: `REF-${app.id.toString().padStart(6, '0')}`,
          description: app.applications.description,
          fullName: app.full_name,
          contactNumber: app.contact_number,
          address: app.address,
          purpose: app.purpose
        }));

        setApplications(transformedApplications);
        setFilteredApplications(transformedApplications);
      } catch (err) {
        setError(`Error fetching applications: ${err.message}`);
        console.error('Error fetching applications:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplications();
  }, []);

  // Filter and sort applications when filters change
  useEffect(() => {
    let result = [...applications];
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(app => 
        app.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      if (Array.isArray(statusFilter)) {
        result = result.filter(app => statusFilter.includes(app.status));
      } else {
        result = result.filter(app => app.status === statusFilter);
      }
    }
    
    // Apply sorting
    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
    } else if (sortBy === "oldest") {
      result.sort((a, b) => new Date(a.submissionDate) - new Date(b.submissionDate));
    } else if (sortBy === "status") {
      result.sort((a, b) => a.statusId - b.statusId);
    }
    
    setFilteredApplications(result);
  }, [applications, searchTerm, statusFilter, sortBy]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
  };

  // Handle sort change
  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Get sort icon class
  const getSortIconClass = (field) => {
    if (sortBy !== field) return "sort-icon";
    return `sort-icon ${sortOrder}`;
  };

  // Update view details handler to use navigation
  const handleViewDetails = (application) => {
    navigate(`/application/${application.id}`);
  };

  // Edit application
  const handleEditApplication = (application) => {
    setEditApplication({...application});
    setShowEditModal(true);
  };

  // Update handleDeleteApplication to use modal and animation
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
      // ... original delete logic ...
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

  // Handle edit form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    
    try {
      // In a real application, you would update in Supabase
      // const { error } = await supabase
      //   .from('applications')
      //   .update({
      //     title: editApplication.title,
      //     description: editApplication.description
      //   })
      //   .eq('id', editApplication.id);
      
      // if (error) throw error;
      
      // For now, just update the state
      setApplications(applications.map(app => 
        app.id === editApplication.id ? {...editApplication, lastUpdated: new Date().toISOString().split('T')[0]} : app
      ));
      
      setShowEditModal(false);
    } catch (err) {
      setFormError(`Error updating application: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit form input change
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditApplication(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Submitted":
        return "status-pending";
      case "Under Review":
        return "status-review";
      case "Needs Revision":
        return "status-revision";
      case "Approved":
        return "status-approved";
      case "Rejected":
        return "status-denied";
      case "Payment Pending":
        return "status-badge payment-pending";
      case "Payment Recieved":
        return "status-badge payment-recieved";
      case "Payment Failed":
        return "status-badge payment-failed";
      case "Inspecting":
        return "status-badge inspecting";
      case "Completed":
        return "status-badge completed";
      default:
        return "";
    }
  };

  // Add function to get action text based on status
  const getActionText = (status) => {
    switch (status) {
      case "Submitted":
      case "Under Review":
      case "Needs Revision":
        return "Track";
      case "Approved":
      case "Rejected":
        return "View";
      default:
        return "Track";
    }
  };

  // Format date with time
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Calculate pagination values
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  // For mobile, show all filtered applications; for desktop, paginate
  const currentItems = isMobileView
    ? filteredApplications
    : filteredApplications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll back to the top of the table when changing pages
    document.querySelector('.table-container')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      document.querySelector('.table-container')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      document.querySelector('.table-container')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Function to generate pagination buttons with ellipsis for many pages
  const renderPaginationButtons = () => {
    const pageNumbers = [];
    
    // Handle the case when there are no pages
    if (totalPages <= 0) {
      return [
        <button
          key={1}
          className="pagination-button active"
          onClick={() => handlePageChange(1)}
        >
          1
        </button>
      ];
    }
    
    if (totalPages <= 5) {
      // If 5 or fewer pages, show all page numbers
      for (let i = 1; i <= totalPages; i++) {
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
  };

  // Update status filter when location state changes
  useEffect(() => {
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter);
    }
  }, [location.state]);

  return (
    <div className="my-application-container">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}
      <div className="application-list-header">
        <h1 className="application-list-title" style={{ fontSize: '32px', fontWeight: 'bold' }}><FaFolderOpen style={{marginRight: '10px'}}/>My Applications</h1>
        <p className="application-list-subtitle" style={{ fontSize: '14px', color: 'gray' }}>Track and manage your permit applications</p>
      </div>
      
      <div className="my-application-content">
        <div className="my-application-filters">
          <div className="search-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>

          <div className="filter-container">
            <div className="filter-group">
              <label htmlFor="status-filter">Status:</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="filter-select"
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
                <option value="Inspecting">Inspecting</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-by">Sort By:</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="filter-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading your applications...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button className="retry-button" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="empty-state">
            <p>No applications found. {searchTerm || statusFilter !== "all" ? "Try adjusting your filters." : ""}</p>
          </div>
        ) : (
          <>
            {isMobileView ? (
              <div className="application-cards-mobile">
                {currentItems.map((application) => (
                  <div key={application.id} className="application-card-mobile">
                    <div><strong>Reference #:</strong> {application.referenceNumber}</div>
                    <div><strong>Title:</strong> <span className="application-title">{application.title}</span></div>
                    <div><strong>Type:</strong> {application.type}</div>
                    <div><strong>Status:</strong> <span className={`status-badge ${application.status.toLowerCase().replace(' ', '-')}`}>{application.status}</span></div>
                    <div><strong>Submission Date:</strong> {formatDateMMDDYYYY(application.submissionDate)}</div>
                    <div className="action-buttons">
                      <button 
                        className={`action-button ${application.status === "Approved" || application.status === "Denied" ? 'view-button' : 'track-button'}`}
                        onClick={() => handleViewDetails(application)}
                        title={`${getActionText(application.status)} Application`}
                      >
                        {application.status === "Approved" || application.status === "Denied" ? <FaEye /> : <FaChartLine />}
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
                ))}
              </div>
            ) : (
              <div className="table-pagination-wrapper">
                <div className="table-container">
                  <table className="shared-table one-line-table">
                    <thead>
                      <tr>
                        <th className="ref-col">Reference #</th>
                        <th className="title-col">Title</th>
                        <th className="type-col">Type</th>
                        <th className="status-col th-center">Status</th>
                        <th className="submission-date-col th-center">Submission Date</th>
                        <th className="th-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((application) => (
                        <tr key={application.id} className={deletingRowId === application.id ? 'fade-out-row' : ''}>
                          <td className="ref-col"><span className="nowrap-text">{application.referenceNumber}</span></td>
                          <td className="title-col"><DraggableTitle>{application.title}</DraggableTitle></td>
                          <td className="type-col">{application.type}</td>
                          <td className="status-col td-center">
                            <span className={`status-badge ${application.status.toLowerCase().replace(' ', '-')}`}>{application.status}</span>
                          </td>
                          <td className="submission-date-col td-center">{formatDateMMDDYYYY(application.submissionDate)}</td>
                          <td className="td-center">
                            <div className="action-buttons">
                              <button 
                                className={`action-button ${application.status === "Approved" || application.status === "Denied" ? 'view-button' : 'track-button'}`}
                                onClick={() => handleViewDetails(application)}
                                title={`${getActionText(application.status)} Application`}
                              >
                                {application.status === "Approved" || application.status === "Denied" ? <FaEye /> : <FaChartLine />}
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                      {renderPaginationButtons()}
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
              </div>
            )}
          </>
        )}

        {/* Edit Application Modal */}
        {showEditModal && editApplication && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h2>Edit Application</h2>
                <button className="modal-close" onClick={() => setShowEditModal(false)}>
                  <FaTimes />
                </button>
              </div>
              <div className="modal-body">
                {formError && <div className="form-error">{formError}</div>}
                <form onSubmit={handleEditSubmit}>
                  <div className="form-group">
                    <label htmlFor="edit-title">Title</label>
                    <input
                      type="text"
                      id="edit-title"
                      name="title"
                      value={editApplication.title}
                      onChange={handleEditInputChange}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-description">Description</label>
                    <textarea
                      id="edit-description"
                      name="description"
                      value={editApplication.description}
                      onChange={handleEditInputChange}
                      required
                      className="form-textarea"
                      rows={5}
                    />
                  </div>
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowEditModal(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
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
    </div>
  );
}

export default MyApplication;