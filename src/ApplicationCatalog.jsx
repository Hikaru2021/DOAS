import { useState, useEffect } from "react";
import { FaSearch, FaFilter, FaPlus, FaSort, FaEdit, FaTrash, FaCheck, FaTimes, FaBook } from "react-icons/fa";
import "./CSS/ApplicationCatalog.css";
import { supabase } from "./library/supabaseClient";
import AddApplicationModal from "./Modals/AddApplicationModal";
import EditApplicationModal from "./Modals/EditApplicationModal";
import ViewApplicationModal from "./Modals/ViewApplicationModal";
import ApplicationSubmissionForm from "./Modals/ApplicationSubmissionForm";

function ApplicationCatalog() {
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editApplication, setEditApplication] = useState(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [selectedApplicationForSubmission, setSelectedApplicationForSubmission] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [visibleModal, setVisibleModal] = useState(null);
  const [sorting, setSorting] = useState("latest");
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Fetch applications from Supabase
  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*');
        
      if (error) {
        throw error;
      }
      
      setApplications(data || []);
    } catch (err) {
      setError(`Error fetching applications: ${err.message}`);
      console.error('Error fetching applications:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch user role
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

  useEffect(() => {
    fetchApplications();
    fetchUserRole();
  }, []);

  // Toast auto-dismiss effect
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ ...toast, show: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // Handle type filter change
  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
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

  // Handle application added
  const handleApplicationAdded = (newApplication) => {
    setApplications(prev => [...prev, newApplication]);
    setShowAddModal(false);
  };

  // Handle application updated
  const handleApplicationUpdated = (updatedApplication) => {
    setApplications(prev => 
      prev.map(app => app.id === updatedApplication.id ? updatedApplication : app)
    );
    setShowEditModal(false);
    setEditApplication(null);
  };

  // Handle edit click
  const handleEditClick = (application, e) => {
    e.stopPropagation();
    setEditApplication(application);
    setShowEditModal(true);
  };

  // Filter and sort applications
  const filteredAndSortedApplications = applications
    .filter(app => {
      const matchesSearch = app.title.toLowerCase().includes(search.toLowerCase()) ||
                         app.description.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || app.type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "date") {
        comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      } else if (sortBy === "title") {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === "type") {
        comparison = a.type.localeCompare(b.type);
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Handle view click
  const handleViewClick = (application) => {
    setSelectedApplication(application);
    setShowModal(true);
  };

  // Handle start application
  const handleStartApplication = (application) => {
    setSelectedApplicationForSubmission(application);
    setShowSubmissionForm(true);
  };

  // Handle selection of all applications
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedApplications(applications.map(app => app.id));
    } else {
      setSelectedApplications([]);
    }
  };

  // Handle selection of single application
  const handleSelectApplication = (id) => {
    if (selectedApplications.includes(id)) {
      setSelectedApplications(selectedApplications.filter(appId => appId !== id));
    } else {
      setSelectedApplications([...selectedApplications, id]);
    }
  };

  // Handle delete applications
  const handleDeleteApplications = async () => {
    try {
      setIsLoading(true);
      
      // For each application being deleted, fetch related documents
      for (const appId of selectedApplications) {
        // 1. Fetch documents related to this application
        const { data: documents, error: docFetchError } = await supabase
          .from('documents')
          .select('*')
          .eq('application_id', appId);
        
        if (docFetchError) throw docFetchError;
        
        // 2. Delete files from storage for each document
        if (documents && documents.length > 0) {
          for (const doc of documents) {
            // Extract the file path from the URL
            const fileUrl = doc.file_link;
            if (fileUrl) {
              // Get the path by removing the base storage URL
              const filePath = fileUrl.split('/storage/v1/object/public/guidelines/')[1];
              if (filePath) {
                // Delete the file from storage
                const { error: storageError } = await supabase.storage
                  .from('guidelines')
                  .remove([decodeURIComponent(filePath)]);
                
                if (storageError) {
                  console.error(`Error deleting file from storage: ${storageError.message}`);
                }
              }
            }
          }
          
          // 3. Delete document records from the documents table
          const { error: docDeleteError } = await supabase
            .from('documents')
            .delete()
            .eq('application_id', appId);
          
          if (docDeleteError) throw docDeleteError;
        }
      }
      
      // 4. Finally delete the applications
      const { error } = await supabase
        .from('applications')
        .delete()
        .in('id', selectedApplications);

      if (error) throw error;
      
      // Refresh applications list
      await fetchApplications();
      setSelectedApplications([]);
      setShowDeleteConfirmModal(false);
      // Show success toast
      setToast({ show: true, message: "Selected applications and related documents have been deleted successfully!", type: "success" });
    } catch (error) {
      console.error("Error deleting applications:", error.message);
      alert("Error deleting applications: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="catalog-container">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}
      <div className="catalog-wrapper">
        <div className="catalog-header">
          <h1 className="catalog-title" style={{ fontSize: '32px', fontWeight: 'bold' }}><FaBook style={{marginRight: '10px'}}/>Application Catalog</h1>
          <p className="catalog-subtitle" style={{ fontSize: '14px', color: 'gray' }}>Browse and apply for available permits and certificates</p>
        </div>

        <div className="catalog-filters">
          <div className="search-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search applications..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <div className="filter-container">
            <div className="filter-group">
              <label htmlFor="type-filter">Type:</label>
              <select
                id="type-filter"
                className="filter-select"
                value={typeFilter}
                onChange={handleTypeFilterChange}
              >
                <option value="all">All Types</option>
                <option value="Permit">Permit</option>
                <option value="Certificate">Certificate</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="sort-by">Sort by:</label>
              <select
                id="sort-by"
                className="filter-select"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="type">Type</option>
              </select>
            </div>
          </div>
          <div className="action-buttons">
            {(userRole === 1 || userRole === 2) && (
              <>
                {selectedApplications.length > 0 && (
                  <button 
                    className="delete-button"
                    onClick={() => setShowDeleteConfirmModal(true)}
                  >
                    <FaTrash /> Delete Application
                  </button>
                )}
                <button className="add-button" onClick={() => setShowAddModal(true)}>
                  <FaPlus /> Add New Application
                </button>
              </>
            )}
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
            <button className="retry-button" onClick={fetchApplications}>Retry</button>
          </div>
        ) : filteredAndSortedApplications.length === 0 ? (
          <div className="empty-state">
            <p>No applications found. Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="applications-header">
              <div className="applications-count">
                {filteredAndSortedApplications.length} available applications
              </div>
              {(userRole === 1 || userRole === 2) && filteredAndSortedApplications.length > 0 && (
                <div className="select-all">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={selectedApplications.length === filteredAndSortedApplications.length}
                      onChange={handleSelectAll}
                    />
                    <span className="checkmark"></span>
                    Select All
                  </label>
                </div>
              )}
            </div>
            <div className="catalog-grid">
              {filteredAndSortedApplications.map((application) => (
                <div
                  key={application.id}
                  className={`catalog-card ${selectedApplications.includes(application.id) ? 'selected' : ''}`}
                  onClick={() => handleViewClick(application)}
                >
                  {(userRole === 1 || userRole === 2) && (
                    <div className="card-actions">
                      <label 
                        className="checkbox-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedApplications.includes(application.id)}
                          onChange={(e) => handleSelectApplication(application.id)}
                        />
                        <span className="checkmark"></span>
                      </label>
                      <button 
                        className="edit-button"
                        onClick={(e) => handleEditClick(application, e)}
                        title="Edit Application"
                      >
                        <FaEdit />
                      </button>
                    </div>
                  )}
                  <div className="card-header">
                    <h3 className="card-title">{application.title}</h3>
                    <span className={`card-type ${application.type.toLowerCase()}`}>
                      {application.type}
                    </span>
                  </div>
                  <p className="card-description">{application.description}</p>
                  <div className="card-footer">
                    <button 
                      className="apply-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartApplication(application);
                      }}
                    >
                      Apply Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Modals */}
        <ViewApplicationModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedApplication(null);
          }}
          application={selectedApplication}
          onStartApplication={handleStartApplication}
        />

        <AddApplicationModal 
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onApplicationAdded={handleApplicationAdded}
        />

        <EditApplicationModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditApplication(null);
          }}
          onApplicationUpdated={handleApplicationUpdated}
          application={editApplication}
        />

        <ApplicationSubmissionForm
          isOpen={showSubmissionForm}
          onClose={() => {
            setShowSubmissionForm(false);
            setSelectedApplicationForSubmission(null);
          }}
          application={selectedApplicationForSubmission}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal && (
          <div className="modal-overlay">
            <div className="modal-container delete-confirm-modal">
              <div className="modal-header">
                <h2>Confirm Delete</h2>
                <button className="modal-close" onClick={() => setShowDeleteConfirmModal(false)}>
                  <FaTimes />
                </button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete {selectedApplications.length} selected application(s)?</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              <div className="modal-footer">
                <button
                  className="cancel-button"
                  onClick={() => setShowDeleteConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="delete-button"
                  onClick={handleDeleteApplications}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApplicationCatalog; 