import { useState, useEffect } from "react";
import "./CSS/ApplicationSubmittion.css";
import { FaSearch, FaEye, FaDownload, FaChevronDown } from "react-icons/fa";
import { supabase } from "./library/supabaseClient";

const ApplicationSubmittion = () => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status mapping function
  const getStatusName = (statusId) => {
    switch (statusId) {
      case 1: return "Submitted";
      case 2: return "Under Review";
      case 3: return "Needs Revision";
      case 4: return "Approved";
      case 5: return "Rejected";
      default: return "Unknown";
    }
  };

  // Fetch user's applications
  const fetchUserApplications = async () => {
    try {
      setIsLoading(true);
      
      // Get the authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user found');

      // Fetch applications for the authenticated user
      const { data: userApplications, error: applicationsError } = await supabase
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
          applications (
            id,
            title,
            type,
            description,
            application_fee,
            processing_fee
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (applicationsError) throw applicationsError;

      // Transform the data
      const transformedApplications = userApplications.map(app => ({
        id: `APP-${app.id.toString().padStart(6, '0')}`,
        title: app.applications.title,
        created_at: app.created_at,
        status: getStatusName(app.status),
        statusId: app.status,
        description: app.applications.description,
        type: app.applications.type,
        full_name: app.full_name,
        contact_number: app.contact_number,
        address: app.address,
        purpose: app.purpose,
        fees: {
          application: app.applications.application_fee || 0,
          processing: app.applications.processing_fee || 0,
          total: (app.applications.application_fee || 0) + (app.applications.processing_fee || 0)
        }
      }));

      setApplications(transformedApplications);
      setError(null);
    } catch (err) {
      setError(`Error fetching applications: ${err.message}`);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserApplications();
  }, []);

  const applicationsPerPage = 5;
  const filteredApplications = applications.filter(
    (application) => {
      const matchesSearch = 
        (application.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (application.id || "").toString().includes(search);
      
      const matchesStatus = 
        statusFilter === "all" || 
        application.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    }
  );

  const indexOfLastApplication = currentPage * applicationsPerPage;
  const indexOfFirstApplication = indexOfLastApplication - applicationsPerPage;
  const currentApplications = filteredApplications.slice(indexOfFirstApplication, indexOfLastApplication);
  const totalPages = Math.ceil(filteredApplications.length / applicationsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleViewDetails = (application) => {
    setSelectedApplication(application);
    setShowViewModal(true);
  };

  const handleDownload = (application) => {
    // Mock download functionality
    console.log("Downloading application:", application);
    alert(`Downloading application: ${application.title}`);
  };

  return (
    <div className="application-container">

      <div className="filters-container">
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by ID or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="status-filter">
          <label htmlFor="status-filter">Status:</label>
          <div className="select-wrapper">
            <select 
              id="status-filter" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Needs Revision">Needs Revision</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <FaChevronDown className="select-icon" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading applications...</div>
      ) : error ? (
        <div className="error-state">
          {error}
          <button onClick={fetchUserApplications}>Retry</button>
        </div>
      ) : (
        <>
          <div className="application-table">
            <table>
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Title</th>
                  <th>Submission Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentApplications.length > 0 ? (
                  currentApplications.map((application) => (
                    <tr key={application.id}>
                      <td>{application.id}</td>
                      <td>{application.title || "N/A"}</td>
                      <td>
                        {new Date(application.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`status-badge ${application.status.toLowerCase().replace(" ", "-")}`}>
                          {application.status}
                        </span>
                      </td>
                      <td className="action-buttons">
                        <button
                          className="view-btn"
                          onClick={() => handleViewDetails(application)}
                        >
                          <FaEye /> View
                        </button>
                        <button
                          className="download-btn"
                          onClick={() => handleDownload(application)}
                        >
                          <FaDownload /> Download
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="prev-btn"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                ❮ Prev
              </button>
              <span className="page-info">Page {currentPage} of {totalPages}</span>
              <button
                className="next-btn"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next ❯
              </button>
            </div>
          )}
        </>
      )}

      {/* View Application Modal */}
      {showViewModal && selectedApplication && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Application Details</h2>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="detail-group">
                <label>Application ID:</label>
                <span>{selectedApplication.id}</span>
              </div>
              <div className="detail-group">
                <label>Title:</label>
                <span>{selectedApplication.title}</span>
              </div>
              <div className="detail-group">
                <label>Type:</label>
                <span>{selectedApplication.type}</span>
              </div>
              <div className="detail-group">
                <label>Submission Date:</label>
                <span>{new Date(selectedApplication.created_at).toLocaleDateString()}</span>
              </div>
              <div className="detail-group">
                <label>Status:</label>
                <span className={`status-badge ${selectedApplication.status.toLowerCase().replace(" ", "-")}`}>
                  {selectedApplication.status}
                </span>
              </div>
              <div className="detail-group">
                <label>Full Name:</label>
                <span>{selectedApplication.full_name}</span>
              </div>
              <div className="detail-group">
                <label>Contact Number:</label>
                <span>{selectedApplication.contact_number}</span>
              </div>
              <div className="detail-group">
                <label>Address:</label>
                <span>{selectedApplication.address}</span>
              </div>
              <div className="detail-group">
                <label>Purpose:</label>
                <span>{selectedApplication.purpose}</span>
              </div>
              <div className="detail-group">
                <label>Fees:</label>
                <div className="fees-details">
                  <p>Application Fee: ₱{selectedApplication.fees.application.toLocaleString()}</p>
                  <p>Processing Fee: ₱{selectedApplication.fees.processing.toLocaleString()}</p>
                  <p>Total: ₱{selectedApplication.fees.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationSubmittion;
