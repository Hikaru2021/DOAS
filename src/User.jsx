import React, { useState, useEffect } from "react";
import "./CSS/User.css";
import "./CSS/SharedTable.css";
import { FaSearch, FaTimes, FaFilter, FaSort, FaTrash, FaUser } from "react-icons/fa";
import { supabase } from "./library/supabaseClient";

const STATUS_MAPPING = {
  1: { label: 'Active', class: 'status-active' },
  2: { label: 'Blocked', class: 'status-blocked' }
};

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

const User = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth <= 768 ? 1000 : 6);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("role");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleChangeData, setRoleChangeData] = useState(null);
  const [isRoleUpdating, setIsRoleUpdating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusChangeData, setStatusChangeData] = useState(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  useEffect(() => {
  async function fetchUsers() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          created_at,
          user_name,
          email,
          role_id,
          status,
          profile_link,
          user_status (
            id,
            user_status
          )
        `)
          .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      setError(`Error fetching users: ${error.message}`);
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  }
    fetchUsers();
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobileView(mobile);
      setItemsPerPage(mobile ? 1000 : 6);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(currentPage + 1);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const getStatusBadgeClass = (statusId) => {
    return STATUS_MAPPING[statusId]?.class || 'status-pending';
  };

  const getStatusText = (statusId) => {
    return STATUS_MAPPING[statusId]?.label || 'Pending';
  };

  const handleStatusChangeClick = (userId, currentStatus, newStatus) => {
    setStatusChangeData({
      userId,
      currentStatus: getStatusText(currentStatus),
      newStatus: getStatusText(parseInt(newStatus)),
      newStatusId: parseInt(newStatus)
    });
    setShowStatusModal(true);
  };

  const handleStatusChangeConfirm = async () => {
    if (!statusChangeData) return;
    
    setIsStatusUpdating(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ status: statusChangeData.newStatusId })
        .eq('id', statusChangeData.userId)
        .select();

      if (error) throw error;

      // Update the local state to reflect the change
      setUsers(users.map(user => 
        user.id === statusChangeData.userId ? { ...user, status: statusChangeData.newStatusId } : user
      ));
      setShowStatusModal(false);
    } catch (err) {
      setError(`Error updating status: ${err.message}`);
      console.error('Error updating status:', err);
    } finally {
      setIsStatusUpdating(false);
      setStatusChangeData(null);
    }
  };

  const getRolePermission = (roleId) => {
    switch (roleId) {
      case 1: return 'Admin';
      case 2: return 'Manager';
      case 3: return 'User';
      case 4: return 'Inspector';
      default: return 'Unknown';
    }
  };

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

  const filteredUsers = users.filter(
    (user) => {
      const matchesSearch = 
        (user.user_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || 
        user.status === parseInt(statusFilter);
      
      return matchesSearch && matchesStatus;
    }
  ).sort((a, b) => {
    switch (sortBy) {
      case "role":
        return a.role_id - b.role_id;
      case "newest":
        return new Date(b.created_at) - new Date(a.created_at);
      case "oldest":
        return new Date(a.created_at) - new Date(b.created_at);
      case "name":
        return (a.user_name || "").localeCompare(b.user_name || "");
      default:
        return 0;
    }
  });

  const handleDeleteClick = (user) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    
    setIsDeleting(true);
    try {
      // First, find all user_applications for this user to get their IDs
      const { data: userApplications, error: fetchError } = await supabase
        .from("user_applications")
        .select("id")
        .eq("user_id", deletingUser.id);
      
      if (fetchError) throw fetchError;
      
      // If user has applications, delete associated records
      if (userApplications && userApplications.length > 0) {
        const applicationIds = userApplications.map(app => app.id);
        
        // Delete application status history records
        const { error: historyError } = await supabase
          .from("application_status_history")
          .delete()
          .in("user_application_id", applicationIds);
          
        if (historyError) throw historyError;
        
        // Delete all documents related to user's applications
        const { error: documentsError } = await supabase
          .from("documents")
          .delete()
          .in("user_submissions", applicationIds);
          
        if (documentsError) throw documentsError;
        
        // Delete all comments related to user's applications
        const { error: commentsError } = await supabase
          .from("comments")
          .delete()
          .in("user_applications_id", applicationIds);
          
        if (commentsError) throw commentsError;
      }
      
      // Delete all user_applications for this user
      const { error: applicationsError } = await supabase
        .from("user_applications")
        .delete()
        .eq("user_id", deletingUser.id);
        
      if (applicationsError) throw applicationsError;
      
      // Finally delete the user
      const { error: userError } = await supabase
        .from("users")
        .delete()
        .eq("id", deletingUser.id);

      if (userError) throw userError;

      setUsers(users.filter(user => user.id !== deletingUser.id));
      setShowDeleteModal(false);
      setDeletingUser(null);
    } catch (err) {
      setError(`Error deleting user: ${err.message}`);
      console.error("Error deleting user:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleChangeClick = (userId, currentRole, newRole) => {
    setRoleChangeData({
      userId,
      currentRole: getRolePermission(currentRole),
      newRole: getRolePermission(parseInt(newRole)),
      newRoleId: parseInt(newRole)
    });
    setShowRoleModal(true);
  };

  const handleRoleChangeConfirm = async () => {
    if (!roleChangeData) return;
    
    setIsRoleUpdating(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ role_id: roleChangeData.newRoleId })
        .eq('id', roleChangeData.userId)
        .select();

      if (error) throw error;

      // Update the local state to reflect the change
      setUsers(users.map(user => 
        user.id === roleChangeData.userId ? { ...user, role_id: roleChangeData.newRoleId } : user
      ));
      setShowRoleModal(false);
    } catch (err) {
      setError(`Error updating role: ${err.message}`);
      console.error('Error updating role:', err);
    } finally {
      setIsRoleUpdating(false);
      setRoleChangeData(null);
    }
  };

  // 2. Calculate current page users
  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = isMobileView
    ? filteredUsers
    : filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = isMobileView ? 1 : Math.ceil(filteredUsers.length / itemsPerPage);

  return (
    <div className="my-application-container">
      <div className="application-list-header">
        <h1 className="application-list-title" style={{ fontSize: '32px', fontWeight: 'bold' }}><FaUser style={{marginRight: '10px'}}/>User Management</h1>
        <p className="application-list-subtitle">Manage and track all registered users</p>
      </div>

      <div className="my-application-filters">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
              <option value="all">All Status</option>
              {Object.entries(STATUS_MAPPING).map(([id, { label }]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-by">Sort By:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={handleSortChange}
              className="filter-select"
            >
              <option value="role">Role Permission</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={fetchUsers}>
            Retry
          </button>
        </div>
      ) : (
        isMobileView ? (
          <div className="user-cards-mobile">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div key={user.id} className="user-card-mobile">
                  <div className="profile-picture-container">
                    {user.profile_link ? (
                      <img 
                        src={user.profile_link} 
                        alt={`${user.user_name}'s profile`} 
                        className="profile-picture"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '';
                        }}
                      />
                    ) : (
                      <div className="profile-picture-placeholder">
                        <FaUser />
                      </div>
                    )}
                  </div>
                  <div className="user-info-section">
                    <div className="user-name">{user.user_name || "N/A"}</div>
                    <div className="user-email">{user.email || "N/A"}</div>
                  </div>
                  <hr className="divider" />
                  <div className="user-info-section">
                    <span className="user-label">Role:</span> <span className="user-role">{getRolePermission(user.role_id)}</span>
                  </div>
                  <div className="user-info-section">
                    <span className="user-label">Status:</span> <span className={`status-badge ${getStatusBadgeClass(user.status)}`}>{getStatusText(user.status)}</span>
                  </div>
                  <div className="user-info-section">
                    <span className="user-label">Created:</span> <span className="user-created">{formatDateMMDDYYYY(user.created_at)}</span>
                  </div>
                  <div className="action-buttons">
                    <button
                      className="action-button delete-button"
                      onClick={() => handleDeleteClick(user)}
                      title="Delete User"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1.2em' }}>
                        <FaTrash size={20} />
                      </span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                No users found. {searchTerm ? "Try adjusting your search." : ""}
              </div>
            )}
          </div>
        ) : (
          <div className="table-pagination-wrapper">
            <div className="table-container">
          <table className="shared-table user-table">
            <thead>
              <tr>
                <th className="profile-picture-col"></th>
                <th className="user-name-col">Username</th>
                <th className="title-col">Email</th>
                <th className="th-center">Role Permission</th>
                <th className="created-at-col">Created At</th>
                <th className="th-center">Status</th>
                <th className="th-center">Actions</th>
              </tr>
            </thead>
            <tbody>
                  {currentUsers.length > 0 ? (
                    currentUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="profile-picture-col">
                      <div className="profile-picture-container">
                        {user.profile_link ? (
                          <img 
                            src={user.profile_link} 
                            alt={`${user.user_name}'s profile`} 
                            className="profile-picture"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '';
                            }}
                          />
                        ) : (
                          <div className="profile-picture-placeholder">
                            <FaUser />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="user-name-col">{user.user_name || "N/A"}</td>
                    <td className="title-col">{user.email || "N/A"}</td>
                    <td className="td-center">
                      <select
                        value={user.role_id || ""}
                        onChange={(e) => handleRoleChangeClick(user.id, user.role_id, e.target.value)}
                        className="role-select"
                      >
                        <option value="1">Admin</option>
                        <option value="2">Manager</option>
                        <option value="4">Inspector</option>
                        <option value="3">User</option>
                      </select>
                    </td>
                    <td className="created-at-col">{formatDateMMDDYYYY(user.created_at)}</td>
                    <td className="td-center">
                      <select
                        value={user.status || ""}
                        onChange={(e) => handleStatusChangeClick(user.id, user.status, e.target.value)}
                        className={`status-select ${getStatusBadgeClass(user.status)}`}
                      >
                        {Object.entries(STATUS_MAPPING).map(([id, { label }]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="td-center">
                      <div className="action-buttons" style={{ gap: 0 }}>
                        <button
                          className="action-button delete-button"
                          onClick={() => handleDeleteClick(user)}
                          title="Delete User"
                        >
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1.2em' }}>
                                <FaTrash size={20} />
                              </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No users found. {searchTerm ? "Try adjusting your search." : ""}
                  </td>
                </tr>
              )}
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
            {/* Add page numbers */}
            {Array.from({ length: Math.min(5, Math.max(1, totalPages || 1)) }, (_, i) => {
              // Display current page and two pages before/after when possible
              let pageToShow;
              if (totalPages <= 5) {
                pageToShow = i + 1;
              } else if (currentPage <= 3) {
                pageToShow = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageToShow = totalPages - 4 + i;
              } else {
                pageToShow = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageToShow}
                  className={`pagination-button ${currentPage === pageToShow ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageToShow)}
                >
                  {pageToShow}
                </button>
              );
            })}
          </div>
          <button
            className="pagination-button nav-button"
            onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
          >
            Next ❯
          </button>
        </div>
      </div>
          </div>
        )
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingUser && (
        <div className="modal-overlay">
          <div className="modal-container role-modal">
            <div className="modal-header">
              <h2>Delete User</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirmation-message">
                Are you sure you want to delete user{' '}
                <strong>{deletingUser.user_name}</strong> with email{' '}
                <strong>{deletingUser.email}</strong>?
              </p>
              <p className="warning-message">
                This action cannot be undone. The user will lose all access to the system.
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingUser(null);
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="delete-button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {showRoleModal && roleChangeData && (
        <div className="modal-overlay">
          <div className="modal-container role-modal">
            <div className="modal-header">
              <h2>Change Role Permission</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowRoleModal(false);
                  setRoleChangeData(null);
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirmation-message">
                Are you sure you want to change this user's role from{' '}
                <strong>{roleChangeData.currentRole}</strong> to{' '}
                <strong>{roleChangeData.newRole}</strong>?
              </p>
              <p className="warning-message">
                This will modify the user's permissions and access levels.
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowRoleModal(false);
                    setRoleChangeData(null);
                  }}
                  disabled={isRoleUpdating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="submit-button"
                  onClick={handleRoleChangeConfirm}
                  disabled={isRoleUpdating}
                >
                  {isRoleUpdating ? "Updating..." : "Confirm Change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {showStatusModal && statusChangeData && (
        <div className="modal-overlay">
          <div className="modal-container role-modal">
            <div className="modal-header">
              <h2>Change User Status</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusChangeData(null);
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirmation-message">
                Are you sure you want to change this user's status from{' '}
                <strong>{statusChangeData.currentStatus}</strong> to{' '}
                <strong>{statusChangeData.newStatus}</strong>?
              </p>
              <p className="warning-message">
                {statusChangeData.newStatusId === 2 
                  ? "This will prevent the user from accessing the system."
                  : "This will allow the user to access the system."}
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusChangeData(null);
                  }}
                  disabled={isStatusUpdating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="submit-button"
                  onClick={handleStatusChangeConfirm}
                  disabled={isStatusUpdating}
                >
                  {isStatusUpdating ? "Updating..." : "Confirm Change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default User;