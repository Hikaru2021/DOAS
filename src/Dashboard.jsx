import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./CSS/Dashboard.css"; // CSS file for styling
import { FaUser, FaFileAlt, FaCheckCircle, FaTimesCircle, FaClock, FaChevronRight, FaCalendarAlt, FaChevronLeft, FaTimes, FaTachometerAlt, FaChartBar } from "react-icons/fa";
import { supabase } from "./library/supabaseClient";
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Sparklines, SparklinesLine } from 'react-sparklines';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

function getStatusClassName(status) {
  return status
    .toLowerCase()
    .replace(/ /g, '-')
    .replace('payment recieved', 'payment-recieved')
    .replace('payment pending', 'payment-pending')
    .replace('payment failed', 'payment-failed');
}

function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [userApplications, setUserApplications] = useState([]);
  const [showApplicationsModal, setShowApplicationsModal] = useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    needsRevision: 0,
    approved: 0,
    rejected: 0,
    payments: 0,
    inspecting: 0,
    completed: 0
  });
  const [totalApplications, setTotalApplications] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [statusTrends, setStatusTrends] = useState({
    total: [],
    pending: [],
    needsRevision: [],
    approved: [],
    rejected: [],
    payments: [],
    inspecting: [],
    completed: [],
  });
  const [allApplications, setAllApplications] = useState([]);

  // Fetch user and role information
  useEffect(() => {
    const fetchUserAndRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setCurrentUser(user);
          
          // Fetch user role from the users table
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role_id')
            .eq('id', user.id)
            .single();
          
          if (userError) throw userError;
          
          if (userData) {
            setUserRole(userData.role_id);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    
    fetchUserAndRole();
  }, []);

  // Fetch application status analytics based on user role
  useEffect(() => {
    const fetchApplicationAnalytics = async () => {
      if (userRole === null) return;

        setIsLoading(true);
      try {
        // Setup query based on user role
        let query = supabase
          .from('user_applications')
          .select('id, status');

        // If user role is 3 (regular user), filter by user_id
        if (userRole === 3 && currentUser) {
          query = query.eq('user_id', currentUser.id);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
          // Count applications by status
          let pending = 0;
          let needsRevision = 0;
          let approved = 0;
          let rejected = 0;
          let payments = 0;
          let inspecting = 0;
          let completed = 0;
          data.forEach(app => {
            switch (app.status) {
              case 1:
              case 2:
                pending++;
                break;
              case 3:
                needsRevision++;
                break;
              case 4:
                approved++;
                break;
              case 5:
                rejected++;
                break;
              case 6:
              case 7:
              case 8:
                payments++;
                break;
              case 9:
                inspecting++;
                break;
              case 10:
                completed++;
                break;
              default:
                break;
            }
          });
          setStatusCounts({
            pending,
            needsRevision,
            approved,
            rejected,
            payments,
            inspecting,
            completed
          });
          setTotalApplications(data.length);
        }
      } catch (error) {
        console.error("Error fetching application analytics:", error);
        // Set mock data for demonstration
        setStatusCounts({
          pending: userRole === 3 ? 4 : 26,
          needsRevision: userRole === 3 ? 0 : 2,
          approved: userRole === 3 ? 1 : 10,
          rejected: userRole === 3 ? 0 : 2,
          payments: userRole === 3 ? 0 : 3,
          inspecting: userRole === 3 ? 0 : 1,
          completed: userRole === 3 ? 0 : 1
        });
        setTotalApplications(userRole === 3 ? 5 : 38);
      } finally {
        setIsLoading(false);
      }
    };

    if (userRole !== null) {
      fetchApplicationAnalytics();
    }
  }, [userRole, currentUser]);

  useEffect(() => {
    const fetchTrendData = async () => {
      let query = supabase
        .from('user_applications')
        .select('created_at, status');

      if (userRole === 3 && currentUser) {
        query = query.eq('user_id', currentUser.id);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching trend data:", error);
        return;
      }

      // Group by week (last 7 weeks)
      const now = new Date();
      const weeks = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - 7 * (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });

      const getWeekIndex = (date) => {
        for (let i = weeks.length - 1; i >= 0; i--) {
          if (date >= weeks[i]) return i;
        }
        return 0;
      };

      const trends = {
        total: Array(7).fill(0),
        pending: Array(7).fill(0),
        needsRevision: Array(7).fill(0),
        approved: Array(7).fill(0),
        rejected: Array(7).fill(0),
        payments: Array(7).fill(0),
        inspecting: Array(7).fill(0),
        completed: Array(7).fill(0),
      };

      data.forEach(app => {
        const date = new Date(app.created_at);
        const idx = getWeekIndex(date);
        trends.total[idx]++;
        switch (app.status) {
          case 1:
          case 2:
            trends.pending[idx]++;
            break;
          case 3:
            trends.needsRevision[idx]++;
            break;
          case 4:
            trends.approved[idx]++;
            break;
          case 5:
            trends.rejected[idx]++;
            break;
          case 6:
          case 7:
          case 8:
            trends.payments[idx]++;
            break;
          case 9:
            trends.inspecting[idx]++;
            break;
          case 10:
            trends.completed[idx]++;
            break;
          default:
            break;
        }
      });

      setStatusTrends(trends);
    };

    if (userRole !== null) {
      fetchTrendData();
    }
  }, [userRole, currentUser]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCardClick = (status) => {
    let statusFilter = status;
    // Map card names to status codes or arrays
    switch (status) {
      case 'Pending':
        statusFilter = [1, 2];
        break;
      case 'Needs Revision':
        statusFilter = [3];
        break;
      case 'Approved':
        statusFilter = [4];
        break;
      case 'Rejected':
        statusFilter = [5];
        break;
      case 'Payments':
        statusFilter = [6, 7, 8];
        break;
      case 'Inspecting':
        statusFilter = [9];
        break;
      case 'Completed':
        statusFilter = [10];
        break;
      case 'all':
        statusFilter = 'all';
        break;
      default:
        statusFilter = status;
    }
    if (userRole === 1 || userRole === 2) {
      navigate('/ApplicationList', { state: { statusFilter } });
    } else {
      navigate('/MyApplication', { state: { statusFilter } });
    }
  };

  // Chart data configuration
  const chartData = {
    labels: ['Pending', 'Needs Revision', 'Approved', 'Rejected', 'Payments', 'Inspecting', 'Completed'],
    datasets: [
      {
        data: [
          statusCounts.pending,
          statusCounts.needsRevision,
          statusCounts.approved,
          statusCounts.rejected,
          statusCounts.payments,
          statusCounts.inspecting,
          statusCounts.completed
        ],
        backgroundColor: [
          '#FFC107', // Pending (amber)
          '#FF7043', // Needs Revision (deep orange)
          '#43A047', // Approved (green)
          '#E53935', // Rejected (red)
          '#00897B', // Payments (teal)
          '#1976D2', // Inspecting (blue)
          '#8E24AA'  // Completed (purple)
        ],
        borderColor: [
          '#FFA000', // Pending
          '#F4511E', // Needs Revision
          '#2E7D32', // Approved
          '#B71C1C', // Rejected
          '#00695C', // Payments
          '#0D47A1', // Inspecting
          '#6A1B9A'  // Completed
        ],
        borderWidth: 1,
        hoverOffset: 4
      }
    ]
  };

  // Sparkline data for each card (mock/hardcoded for now)
  const sparklineData = statusTrends;

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateScale: true,
      animateRotate: true,
      duration: 800
    },
    cutout: '70%', // Make the donut hole larger
    plugins: {
      legend: {
        display: false, // Hide the legend as we have our own status items below
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Calendar helper functions
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const handlePrevYear = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setFullYear(newDate.getFullYear() - 1);
      return newDate;
    });
  };

  const handleNextYear = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setFullYear(newDate.getFullYear() + 1);
      return newDate;
    });
  };

  const handleDateClick = async (day) => {
    const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(selectedDate);
    setIsLoadingApplications(true);
    setShowApplicationsModal(true);
    
    try {
      // Fetch user applications for the selected date based on user role
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      let query = supabase
        .from('user_applications')
        .select(`
          id,
          created_at,
          user_id,
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
            description
          )
        `)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      // If user role is 3 (regular user), filter by user_id
      if (userRole === 3 && currentUser) {
        query = query.eq('user_id', currentUser.id);
      }
      
      const { data: user_applications, error } = await query;
      
      if (error) {
        console.error('Error fetching user applications:', error);
        // If no data, create mock data for demonstration
        const mockData = [
          {
            id: 1,
            created_at: selectedDate.toISOString(),
            full_name: "John Smith",
            applications: { title: "Environmental Compliance Certificate", type: "Permit" },
            status: 1,
            purpose: "New business operation"
          },
          {
            id: 2,
            created_at: selectedDate.toISOString(),
            full_name: "Jane Doe",
            applications: { title: "Tree Cutting Permit", type: "Permit" },
            status: 2,
            purpose: "Land development"
          }
        ];
        
        // For regular users, filter the mock data
        setUserApplications(userRole === 3 ? mockData.filter((_, index) => index === 0) : mockData);
      } else {
        setUserApplications(user_applications || []);
      }
    } catch (error) {
      console.error('Error:', error);
      // Set mock data for demonstration
      const mockData = [
        {
          id: 1,
          created_at: selectedDate.toISOString(),
          full_name: "John Smith",
          applications: { title: "Environmental Compliance Certificate", type: "Permit" },
          status: 1,
          purpose: "New business operation"
        },
        {
          id: 2,
          created_at: selectedDate.toISOString(),
          full_name: "Jane Doe",
          applications: { title: "Tree Cutting Permit", type: "Permit" },
          status: 2,
          purpose: "Land development"
        }
      ];
      
      // For regular users, filter the mock data
      setUserApplications(userRole === 3 ? mockData.filter((_, index) => index === 0) : mockData);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const closeApplicationsModal = () => {
    setShowApplicationsModal(false);
    setUserApplications([]);
    setSelectedDate(null);
  };

  const handleApplicationClick = (application) => {
    // Route to different components based on user role
    if (userRole === 1 || userRole === 2) {
      // Admin or Manager: Navigate to ApplicationList
      navigate('/ApplicationList', { state: { selectedApplicationId: application.id } });
    } else {
      // Regular User: Navigate to MyApplication
      navigate('/MyApplication', { state: { selectedApplicationId: application.id } });
    }
  };

  const getStatusText = (statusId) => {
    switch (statusId) {
      case 1:
      case 2:
        return "Pending";
      case 3:
        return "Needs Revision";
      case 4:
        return "Approved";
      case 5:
        return "Rejected";
      case 6:
      case 7:
      case 8:
        return "Payments";
      case 9:
        return "Inspecting";
      case 10:
        return "Completed";
      default:
        return "Unknown";
    }
  };

  const getStatusClass = (statusId) => {
    switch (statusId) {
      case 1:
      case 2:
        return "dashboard-status-pending";
      case 3:
        return "dashboard-status-needs-revision";
      case 4:
        return "dashboard-status-approved";
      case 5:
        return "dashboard-status-rejected";
      case 6:
      case 7:
      case 8:
        return "dashboard-status-payments";
      case 9:
        return "dashboard-status-inspecting";
      case 10:
        return "dashboard-status-completed";
      default:
        return "";
    }
  };

  // Render calendar days
  const renderCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // Empty cells for days before the 1st of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Get today's date for highlighting
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    const currentDay = today.getDate();
    
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday = isCurrentMonth && i === currentDay;
      days.push(
        <div 
          key={`day-${i}`} 
          className={`calendar-day ${isToday ? 'current-day' : ''}`}
          onClick={() => handleDateClick(i)}
        >
          {i}
        </div>
      );
    }
    
    // Empty cells to complete the grid (if needed)
    const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
    for (let i = firstDayOfMonth + daysInMonth; i < totalCells; i++) {
      days.push(<div key={`empty-end-${i}`} className="calendar-day empty"></div>);
    }
    
    return days;
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long' });
  };

  const formatDateString = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getViewAllDestination = () => {
    // Return the appropriate route based on user role
    return userRole === 1 || userRole === 2 ? '/ApplicationList' : '/MyApplication';
  };

  const getModalTitle = () => {
    // Customize modal title based on user role
    if (userRole === 1||2) {
      return `All Applications for ${formatDateString(selectedDate)}`;
    } else {
      return `My Applications for ${formatDateString(selectedDate)}`;
    }
  };

  const getAnalyticsTitle = () => {
    if (userRole === 1||2) {
      return "Application Analytics";
    } 
    else {
      return "My Application Status";
    }
  };

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

  // Fetch all applications for monthly comparison
  useEffect(() => {
    const fetchAllApplications = async () => {
      let query = supabase
        .from('user_applications')
        .select('created_at, status');
      if (userRole === 3 && currentUser) {
        query = query.eq('user_id', currentUser.id);
      }
      const { data, error } = await query;
      if (!error && data) setAllApplications(data);
    };
    if (userRole !== null) fetchAllApplications();
  }, [userRole, currentUser]);

  // Helper to get the count for this month and last month for each status
  const getMonthlyStatusDiffs = (data) => {
    // Get the first day of this month and last month
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Initialize counters
    const statusThisMonth = {
      total: 0, pending: 0, needsRevision: 0, approved: 0, rejected: 0, payments: 0, inspecting: 0, completed: 0
    };
    const statusLastMonth = {
      total: 0, pending: 0, needsRevision: 0, approved: 0, rejected: 0, payments: 0, inspecting: 0, completed: 0
    };
    data.forEach(app => {
      const date = new Date(app.created_at);
      let statusKey = null;
      switch (app.status) {
        case 1:
        case 2:
          statusKey = 'pending';
          break;
        case 3:
          statusKey = 'needsRevision';
          break;
        case 4:
          statusKey = 'approved';
          break;
        case 5:
          statusKey = 'rejected';
          break;
        case 6:
        case 7:
        case 8:
          statusKey = 'payments';
          break;
        case 9:
          statusKey = 'inspecting';
          break;
        case 10:
          statusKey = 'completed';
          break;
        default:
          break;
      }
      // Total
      if (date >= firstDayThisMonth) statusThisMonth.total++;
      else if (date >= firstDayLastMonth && date < firstDayThisMonth) statusLastMonth.total++;
      // Status
      if (statusKey) {
        if (date >= firstDayThisMonth) statusThisMonth[statusKey]++;
        else if (date >= firstDayLastMonth && date < firstDayThisMonth) statusLastMonth[statusKey]++;
      }
    });
    // Calculate diffs
    const diffs = {};
    Object.keys(statusThisMonth).forEach(key => {
      diffs[key] = statusThisMonth[key] - statusLastMonth[key];
      diffs[key + '_this'] = statusThisMonth[key];
      diffs[key + '_last'] = statusLastMonth[key];
    });
    return diffs;
  };

  const monthlyDiffs = getMonthlyStatusDiffs(allApplications);

  // Helper to render the subtitle for each card
  const renderMonthlyDiff = (diff, thisMonth) => {
    if (thisMonth === 0) {
      return `(${diff >= 0 ? '+' : ''}${diff}) compared to last month`;
    }
    return `${thisMonth} (${diff >= 0 ? '+' : ''}${diff}) compared to last month`;
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="application-list-header">
          <h1 className={`application-list-title${isMobile ? ' dashboard-mobile-title' : ''}`} style={{ fontSize: '32px', fontWeight: 'bold' }}><FaTachometerAlt style={{marginRight: '10px'}}/>Dashboard</h1>
          <p className="application-list-subtitle" style={{ fontSize: '14px', color: 'gray' }}>View and analyze application statistics and reports</p>
        </div>
        <div className="dashboard-body">
          {/* Application Status Cards */}
          <div className="dashboard-boxes">
            <div className="box total" onClick={() => handleCardClick('all')}>
              <div className="box-content">
                <div>
                  <h3>Total Applications</h3>
                  <p className="count">{totalApplications}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.total, monthlyDiffs.total_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.total} width={60} height={30}>
                    <SparklinesLine color="#64B5F6" />
                  </Sparklines>
                </div>
              </div>
            </div>
            <div className="box pending" onClick={() => handleCardClick('Pending')}>
              <div className="box-content">
                <div>
                  <h3>Pending Applications</h3>
                  <p className="count">{statusCounts.pending}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.pending, monthlyDiffs.pending_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.pending} width={60} height={30}>
                    <SparklinesLine color="#FFC107" />
                  </Sparklines>
                </div>
              </div>
            </div>
            <div className="box needs-revision" onClick={() => handleCardClick('Needs Revision')}>
              <div className="box-content">
                <div>
                  <h3>Needs Revision</h3>
                  <p className="count">{statusCounts.needsRevision}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.needsRevision, monthlyDiffs.needsRevision_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.needsRevision} width={60} height={30}>
                    <SparklinesLine color="#FF7043" />
                  </Sparklines>
                </div>
              </div>
            </div>
            <div className="box approved" onClick={() => handleCardClick('Approved')}>
              <div className="box-content">
                <div>
                  <h3>Approved Applications</h3>
                  <p className="count">{statusCounts.approved}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.approved, monthlyDiffs.approved_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.approved} width={60} height={30}>
                    <SparklinesLine color="#43A047" />
                  </Sparklines>
                </div>
              </div>
            </div>
            <div className="box rejected" onClick={() => handleCardClick('Rejected')}>
              <div className="box-content">
                <div>
                  <h3>Rejected Applications</h3>
                  <p className="count">{statusCounts.rejected}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.rejected, monthlyDiffs.rejected_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.rejected} width={60} height={30}>
                    <SparklinesLine color="#E53935" />
                  </Sparklines>
                </div>
              </div>
            </div>
            <div className="box payments" onClick={() => handleCardClick('Payments')}>
              <div className="box-content">
                <div>
                  <h3>Payments</h3>
                  <p className="count">{statusCounts.payments}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.payments, monthlyDiffs.payments_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.payments} width={60} height={30}>
                    <SparklinesLine color="#00897B" />
                  </Sparklines>
                </div>
              </div>
            </div>
            <div className="box inspecting" onClick={() => handleCardClick('Inspecting')}>
              <div className="box-content">
                <div>
                  <h3>Inspecting</h3>
                  <p className="count">{statusCounts.inspecting}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.inspecting, monthlyDiffs.inspecting_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.inspecting} width={60} height={30}>
                    <SparklinesLine color="#1976D2" />
                  </Sparklines>
                </div>
              </div>
            </div>
            <div className="box completed" onClick={() => handleCardClick('Completed')}>
              <div className="box-content">
                <div>
                  <h3>Completed</h3>
                  <p className="count">{statusCounts.completed}</p>
                  <span>{renderMonthlyDiff(monthlyDiffs.completed, monthlyDiffs.completed_this)}</span>
                </div>
                <div className="sparkline-container">
                  <Sparklines data={sparklineData.completed} width={60} height={30}>
                    <SparklinesLine color="#8E24AA" />
                  </Sparklines>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Grid Layout */}
          <div className="dashboard-grid">
            {/* Application Status Analytics Section */}
            <div className="dashboard-card dashboard-analytics">
              <div className="card-header">
                <h3>{getAnalyticsTitle()}</h3>
                <button 
                  className="view-all-btn"
                  onClick={() => navigate(getViewAllDestination())}
                >
                  View All <FaChevronRight />
                </button>
              </div>
              <div className="dashboard-analytics-container">
                <div className="chart-container">
                  <Doughnut data={chartData} options={chartOptions} />
                  <div className="chart-center-text">
                    <div className="total-count">{totalApplications}</div>
                    <div className="total-label">Total</div>
                  </div>
                </div>
                
                <div className="dashboard-chart-legend">
                  <div className="dashboard-legend-item">
                    <div className="dashboard-legend-color dashboard-legend-pending"></div>
                    <div className="dashboard-legend-label">Pending</div>
                  </div>
                  <div className="dashboard-legend-item">
                    <div className="dashboard-legend-color dashboard-legend-needs-revision"></div>
                    <div className="dashboard-legend-label">Needs Revision</div>
                  </div>
                  <div className="dashboard-legend-item">
                    <div className="dashboard-legend-color dashboard-legend-approved"></div>
                    <div className="dashboard-legend-label">Approved</div>
                  </div>
                  <div className="dashboard-legend-item">
                    <div className="dashboard-legend-color dashboard-legend-rejected"></div>
                    <div className="dashboard-legend-label">Rejected</div>
                  </div>
                  <div className="dashboard-legend-item">
                    <div className="dashboard-legend-color dashboard-legend-payments"></div>
                    <div className="dashboard-legend-label">Payments</div>
                  </div>
                  <div className="dashboard-legend-item">
                    <div className="dashboard-legend-color dashboard-legend-inspecting"></div>
                    <div className="dashboard-legend-label">Inspecting</div>
                  </div>
                  <div className="dashboard-legend-item">
                    <div className="dashboard-legend-color dashboard-legend-completed"></div>
                    <div className="dashboard-legend-label">Completed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Section */}
            <div className="dashboard-card calendar">
              <div className="card-header">
                <h3>Calendar</h3>
                <button 
                  className="view-all-btn"
                  onClick={() => navigate(getViewAllDestination())}
                >
                  View All <FaChevronRight />
                </button>
              </div>
              <div className="calendar-container">
                <div className="calendar-navigation">
                  <div className="calendar-month-nav">
                    <button className="calendar-nav-btn" onClick={handlePrevMonth}>
                      <FaChevronLeft />
                    </button>
                    <h4>{getMonthName(currentDate)}</h4>
                    <button className="calendar-nav-btn" onClick={handleNextMonth}>
                      <FaChevronRight />
                    </button>
                  </div>
                  <div className="calendar-year-nav">
                    <button className="calendar-nav-btn" onClick={handlePrevYear}>
                      <FaChevronLeft />
                    </button>
                    <h4>{currentDate.getFullYear()}</h4>
                    <button className="calendar-nav-btn" onClick={handleNextYear}>
                      <FaChevronRight />
                    </button>
                  </div>
                </div>
                <div className="calendar-grid">
                  <div className="calendar-weekdays">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                  </div>
                  <div className="calendar-days">
                    {renderCalendarDays()}
                  </div>
                </div>
                {userRole && (
                  <div className="user-role-indicator">
                    Viewing as: {userRole === 1 ? 'Admin' : userRole === 2 ? 'Manager' : 'User'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Applications Modal */}
      {showApplicationsModal && (
        <div className="modal-overlay">
          <div className="applications-modal">
            <div className="applications-modal-header">
              <h2>{getModalTitle()}</h2>
              <button className="close-modal-btn" onClick={closeApplicationsModal}>
                <FaTimes />
              </button>
            </div>
            
            <div className="applications-modal-content">
              {isLoadingApplications ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading applications...</p>
                </div>
              ) : userApplications.length > 0 ? (
                <div className="user-applications-list">
                  {userApplications.map(app => (
                    <div 
                      key={app.id} 
                      className="user-application-item"
                      onClick={() => handleApplicationClick(app)}
                    >
                      <div className="application-info">
                        <h2>{app.applications?.title || "Application"}</h2>
                        <p><strong>Applicant:</strong> {app.full_name}</p>
                        <p><strong>Purpose:</strong> {app.purpose}</p>
                        <p><strong>Submitted:</strong> {new Date(app.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="application-status">
                        <span className={`dashboard-status-badge ${getStatusClass(app.status)}`}>
                          {getStatusName(app.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-applications">
                  <p>No applications found for this date.</p>
                </div>
              )}
            </div>
            
            <div className="applications-modal-footer">
              <button 
                className="view-all-applications-btn" 
                onClick={() => navigate(getViewAllDestination())}
              >
                View All Applications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
