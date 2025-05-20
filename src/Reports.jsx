import React, { useState, useEffect, useRef } from "react";
import "./CSS/Reports.css"; 
import { FaSearch, FaDownload, FaChevronDown, FaFilePdf, FaFileExcel, FaFileCsv, FaChartBar, FaChartPie, FaChartLine, FaFileAlt, FaCheckCircle, FaClock, FaSmile, FaArrowUp, FaExclamationTriangle, FaCalendarAlt, FaCalendarDay, FaCalendarWeek, FaCalendarCheck } from "react-icons/fa";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { supabase } from "./library/supabaseClient";
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

// Add utility functions at the top (after imports)
function formatDateMMMDDYYYY(date) {
  const d = new Date(date);
  const options = { year: 'numeric', month: 'short', day: '2-digit' };
  return d.toLocaleDateString('en-US', options);
}
function formatTime12hr(date) {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

function Reports() {
  const [search, setSearch] = useState("");
  const [reportType, setReportType] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [activeTab, setActiveTab] = useState("analytics");
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState("all");
  const [userApplications, setUserApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [userApplicationCounts, setUserApplicationCounts] = useState({});
  const [userActivityPeriod, setUserActivityPeriod] = useState("monthly");
  // Report generation state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("monthly");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportName, setReportName] = useState("");
  const [reportData, setReportData] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  // Refs for PDF printing
  const reportTemplateRef = useRef(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  useEffect(() => {
    fetchData();
    fetchUserApplications();
    fetchUsers();
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (users.length > 0 && userApplications.length > 0) {
      calculateUserApplicationCounts();
    }
  }, [users, userApplications, userActivityPeriod]);

  async function fetchData() {
    try {
      setIsLoading(true);
      
      // Fetch user applications
      let { data: user_applications, error: userError } = await supabase
        .from('user_applications')
        .select('*');
      
      if (userError) throw userError;
      setUserApplications(user_applications || []);

      // Fetch applications
      let { data: applications_data, error: appsError } = await supabase
        .from('applications')
        .select('*');
      
      if (appsError) throw appsError;
      setApplications(applications_data || []);

      // Fetch application status history
      let { data: application_status_history, error: historyError } = await supabase
        .from('application_status_history')
        .select('*');
      
      if (historyError) throw historyError;
      setStatusHistory(application_status_history || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserApplications() {
    try {
      let { data, error } = await supabase
        .from('user_applications')
        .select('*');
      
      if (error) throw error;
      setUserApplications(data || []);
    } catch (error) {
      console.error('Error fetching user applications:', error);
    }
  }

  async function fetchUsers() {
    try {
      let { data, error } = await supabase
        .from('users')
        .select('*');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  // Calculate application counts for each user
  const calculateUserApplicationCounts = () => {
    const counts = {};
    const currentDate = new Date();
    
    // Initialize counts for all users
    users.forEach(user => {
      counts[user.id] = {
        count: 0,
        user: user
      };
    });
    
    // Count applications for each user based on selected period
    userApplications.forEach(app => {
      if (app.user_id && counts[app.user_id]) {
        const appDate = new Date(app.created_at);
        let shouldCount = false;

        if (userActivityPeriod === "monthly") {
          // Count applications from the current month
          shouldCount = appDate.getMonth() === currentDate.getMonth() && 
                       appDate.getFullYear() === currentDate.getFullYear();
        } else {
          // Count applications from the current year
          shouldCount = appDate.getFullYear() === currentDate.getFullYear();
        }

        if (shouldCount) {
          counts[app.user_id].count++;
        }
      }
    });
    
    setUserApplicationCounts(counts);
  };

  // Get available years from applications data
  const getAvailableYears = () => {
    const years = new Set();
    let earliestYear = new Date().getFullYear(); // Default to current year
    
    // Find the earliest year in both applications and userApplications data
    [...applications, ...userApplications].forEach(app => {
      const appDate = new Date(app.created_at);
      const year = appDate.getFullYear();
      years.add(year);
      if (year < earliestYear) {
        earliestYear = year;
      }
    });
    
    // Add all years from earliest to current
    const currentYear = new Date().getFullYear();
    const allYears = [];
    
    for (let year = currentYear; year >= earliestYear; year--) {
      allYears.push(year);
    }
    
    return allYears;
  };

  // Handle year change
  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
  };

  // Process applications data for charts
  const processMonthlyApplications = () => {
    const monthlyData = {};
    
    // Initialize all months with 0
    for (let month = 1; month <= 12; month++) {
      monthlyData[month] = 0;
    }
    
    // Count applications per month for the selected year or all years
    userApplications.forEach(userApp => {
      const appDate = new Date(userApp.created_at);
      if (selectedYear === "all" || appDate.getFullYear() === parseInt(selectedYear)) {
        const month = appDate.getMonth() + 1;
        monthlyData[month]++;
      }
    });
    
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: selectedYear === "all" ? 'Applications (All Years)' : `Applications (${selectedYear})`,
          data: Object.values(monthlyData),
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 20,
          maxBarThickness: 30,
          minBarLength: 2
        },
      ],
    };
  };

  // Process permit and certificate trends
  const processPermitCertificateTrends = () => {
    const monthlyData = {
      permits: {},
      certificates: {}
    };
    
    // Initialize data structure for each month
    for (let month = 1; month <= 12; month++) {
      monthlyData.permits[month] = 0;
      monthlyData.certificates[month] = 0;
    }
    
    // Count applications by type and month
    userApplications.forEach(userApp => {
      const appDate = new Date(userApp.created_at);
      if (selectedYear === "all" || appDate.getFullYear() === parseInt(selectedYear)) {
        const month = appDate.getMonth() + 1;
        
        // Find the corresponding application to get its type
        const application = applications.find(app => app.id === userApp.application_id);
        if (application) {
          if (application.type?.toLowerCase().includes('permit')) {
            monthlyData.permits[month]++;
          } else if (application.type?.toLowerCase().includes('certificate')) {
            monthlyData.certificates[month]++;
          }
        }
      }
    });
    
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Permits',
          data: Object.values(monthlyData.permits),
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Certificates',
          data: Object.values(monthlyData.certificates),
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  };

  // Process user applications data for the chart
  const processUserApplicationsByMonth = () => {
    const monthlyData = {};
    
    // Initialize all months with 0
    for (let month = 1; month <= 12; month++) {
      monthlyData[month] = 0;
    }
    
    // Count applications per month for the selected year or all years
    userApplications.forEach(app => {
      const appDate = new Date(app.created_at);
      if (selectedYear === "all" || appDate.getFullYear() === parseInt(selectedYear)) {
        const month = appDate.getMonth() + 1;
        monthlyData[month]++;
      }
    });
    
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: selectedYear === "all" ? 'User Applications (All Years)' : `User Applications (${selectedYear})`,
          data: Object.values(monthlyData),
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Mock data for reports
  const mockReports = [
    {
      id: "REP001",
      title: "Daily Application Summary",
      type: "Daily",
      description: "Summary of all applications submitted on a specific day",
      format: "PDF"
    },
    {
      id: "REP002",
      title: "Monthly Application Summary",
      type: "Monthly",
      description: "Monthly overview of all applications with status distribution",
      format: "PDF"
    },
    {
      id: "REP003",
      title: "Yearly Application Summary",
      type: "Yearly",
      description: "Annual report of application processing and approval rates",
      format: "PDF"
    }
  ];

  // Status mapping for Applications by Status chart
  const statusMap = [
    { code: 1, label: 'Submitted', color: 'rgba(255, 193, 7, 0.5)', border: 'rgba(255, 160, 0, 1)' },      // Pending (amber)
    { code: 2, label: 'Under Review', color: 'rgba(255, 193, 7, 0.5)', border: 'rgba(255, 160, 0, 1)' },  // Pending (amber)
    { code: 3, label: 'Needs Revision', color: 'rgba(255, 112, 67, 0.5)', border: 'rgba(244, 81, 30, 1)' }, // Needs Revision (deep orange)
    { code: 4, label: 'Approved', color: 'rgba(67, 160, 71, 0.5)', border: 'rgba(46, 125, 50, 1)' },      // Approved (green)
    { code: 5, label: 'Rejected', color: 'rgba(229, 57, 53, 0.5)', border: 'rgba(183, 28, 28, 1)' },      // Rejected (red)
    { code: 6, label: 'Payment Pending', color: 'rgba(0, 137, 123, 0.5)', border: 'rgba(0, 105, 92, 1)' }, // Payments (teal)
    { code: 7, label: 'Payment Recieved', color: 'rgba(0, 137, 123, 0.5)', border: 'rgba(0, 105, 92, 1)' }, // Payments (teal)
    { code: 8, label: 'Payment Failed', color: 'rgba(0, 137, 123, 0.5)', border: 'rgba(0, 105, 92, 1)' },  // Payments (teal)
    { code: 9, label: 'Inspecting', color: 'rgba(25, 118, 210, 0.5)', border: 'rgba(13, 71, 161, 1)' },    // Inspecting (blue)
    { code: 11, label: 'Inspected', color: 'rgba(25, 118, 210, 0.5)', border: 'rgba(13, 71, 161, 1)' },    // Inspecting (blue)
    { code: 10, label: 'Completed', color: 'rgba(142, 36, 170, 0.5)', border: 'rgba(106, 27, 154, 1)' }    // Completed (purple)
  ];

  const statusCounts = statusMap.map(({ code }) =>
    userApplications.filter(app => app.status === code).length
  );

  // Chart data for charts tab
  const chartData = {
    // Bar chart data - Applications by month
    applicationsByMonth: processMonthlyApplications(),
    
    // Pie chart data - Applications by status
    applicationsByStatus: {
      labels: statusMap.map(s => s.label),
      datasets: [
        {
          label: 'Applications by Status',
          data: statusCounts,
          backgroundColor: statusMap.map(s => s.color),
          borderColor: statusMap.map(s => s.border),
          borderWidth: 1,
        },
      ],
    },
    
    // Line chart data - Permit and Certificate trends
    processingTimeTrends: processPermitCertificateTrends(),
    
    // Bar chart data - User applications by month
    userApplicationsByMonth: processUserApplicationsByMonth(),
  };

  // Common chart options for animations
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart',
      animateRotate: true,
      animateScale: true,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#333',
        bodyColor: '#666',
        borderColor: '#ddd',
          borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y;
            }
            return label;
          }
        }
      }
    }
  };

  // Specific options for line chart
  const lineChartOptions = {
    ...commonChartOptions,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Applications'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2
      },
      point: {
        radius: 4,
        hoverRadius: 6,
        borderWidth: 2
      }
    }
  };

  // Specific options for bar chart
  const barChartOptions = {
    ...commonChartOptions,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        },
        ticks: {
          stepSize: 1,
          precision: 0
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 4
      }
    }
  };

  // Specific options for pie chart
  const pieChartOptions = {
    ...commonChartOptions,
    cutout: '0%',
    elements: {
      arc: {
        borderWidth: 2
      }
    },
    plugins: {
      ...commonChartOptions.plugins,
      tooltip: {
        ...commonChartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            // For pie/doughnut charts, use context.label and context.raw
            return `${context.label}: ${context.raw}`;
          }
        }
      }
    }
  };

  const handleDownload = (report) => {
    // Mock download functionality
    console.log("Downloading report:", report);
    alert(`Downloading report: ${report.title}`);
  };

  const handleReportTypeChange = (e) => {
    setReportType(e.target.value);
  };

  const handleDateRangeChange = (e) => {
    setDateRange(e.target.value);
  };

  const getFormatIcon = (format) => {
    switch(format.toLowerCase()) {
      case "pdf":
        return <FaFilePdf className="format-icon pdf" />;
      case "excel":
        return <FaFileExcel className="format-icon excel" />;
      case "csv":
        return <FaFileCsv className="format-icon csv" />;
      default:
        return null;
    }
  };

  // Updated table render function
  const renderTable = () => (
    <div className="reports-generation-section">
      <div className="report-generation-header">
        <h3>Generate Application Reports</h3>
        <p>Select a report type and time period to generate detailed application reports</p>
      </div>
      
      <div className="report-generation-options">
        <div className="report-selection">
          <label htmlFor="report-period">Report Period:</label>
          <select 
            id="report-period" 
            value={reportPeriod} 
            onChange={(e) => setReportPeriod(e.target.value)}
            className="report-select"
          >
            <option value="daily">Daily Report</option>
            <option value="monthly">Monthly Report</option>
            <option value="yearly">Yearly Report</option>
          </select>
        </div>
        
        {reportPeriod === "daily" && (
          <div className="report-date-selection">
            <label htmlFor="report-date">Select Date:</label>
            <input 
              type="date" 
              id="report-date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="report-date-input"
            />
          </div>
        )}
        
        {reportPeriod === "monthly" && (
          <div className="report-month-selection">
            <div className="report-month">
              <label htmlFor="report-month">Month:</label>
              <select 
                id="report-month" 
                value={reportMonth}
                onChange={(e) => setReportMonth(parseInt(e.target.value))}
                className="report-select"
              >
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
            <div className="report-year">
              <label htmlFor="report-year-monthly">Year:</label>
              <select 
                id="report-year-monthly" 
                value={reportYear}
                onChange={(e) => setReportYear(parseInt(e.target.value))}
                className="report-select"
              >
                {getAvailableYears().map(year => (
                  <option key={`monthly-${year}`} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        {reportPeriod === "yearly" && (
          <div className="report-year-selection">
            <label htmlFor="report-year">Select Year:</label>
            <select 
              id="report-year" 
              value={reportYear}
              onChange={(e) => setReportYear(parseInt(e.target.value))}
              className="report-select"
            >
              {getAvailableYears().map(year => (
                <option key={`yearly-${year}`} value={year}>{year}</option>
              ))}
            </select>
          </div>
        )}
        
        <button 
          className="generate-report-btn"
          onClick={generateReport}
          disabled={generatingReport}
        >
          {generatingReport ? "Generating..." : "Generate Report"}
        </button>
      </div>
      
      {isMobileView ? (
        <div className="reports-table">
          <h3>Available Report Templates</h3>
          {mockReports.map((report) => (
            <div
              key={report.id}
              className="report-card-mobile"
              onClick={() => {
                setReportPeriod(report.type.toLowerCase());
                if (report.type === "Daily") {
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                } else if (report.type === "Monthly") {
                  setReportMonth(new Date().getMonth() + 1);
                  setReportYear(new Date().getFullYear());
                } else if (report.type === "Yearly") {
                  setReportYear(new Date().getFullYear());
                }
                document.querySelector('.report-generation-header')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span className="report-card-label">Report ID</span>
              <span className="report-card-value">{report.id}</span>
              <span className="report-card-label">Title</span>
              <span className="report-card-value">{report.title}</span>
              <span className="report-card-label">Type</span>
              <span className="report-card-value">{report.type}</span>
              <span className="report-card-label">Description</span>
              <span className="report-card-value">{report.description}</span>
              <span className="select-indicator">Click to select</span>
            </div>
          ))}
        </div>
      ) : (
    <div className="reports-table">
        <h3>Available Report Templates</h3>
      <table>
        <thead>
          <tr>
              <th style={{width: '12%'}}>Report ID</th>
              <th style={{width: '30%'}}>Report Title</th>
              <th style={{width: '15%'}}>Type</th>
              <th style={{width: '43%'}}>Description</th>
          </tr>
        </thead>
        <tbody>
            {mockReports.map((report) => (
              <tr key={report.id}
                  onClick={() => {
                    setReportPeriod(report.type.toLowerCase());
                    if (report.type === "Daily") {
                      setSelectedDate(new Date().toISOString().split('T')[0]);
                    } else if (report.type === "Monthly") {
                      setReportMonth(new Date().getMonth() + 1);
                      setReportYear(new Date().getFullYear());
                    } else if (report.type === "Yearly") {
                      setReportYear(new Date().getFullYear());
                    }
                    document.querySelector('.report-generation-header')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="report-row"
              >
                <td><span className="report-id">{report.id}</span></td>
                <td><strong>{report.title}</strong></td>
                <td>{report.type}</td>
                <td>
                  <div className="report-description">
                    {report.description}
                    <span className="select-indicator">Click to select</span>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      </div>
      )}
    </div>
  );

  // Report generation functions
  const generateReport = async () => {
    try {
      setGeneratingReport(true);
      
      // Create query to fetch applications based on period
      let query = supabase.from('user_applications').select('*');
      
      // Filter by selected period
      if (reportPeriod === "daily") {
        // For daily reports, filter by exact date
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        
        query = query.gte('created_at', startDate.toISOString())
                     .lte('created_at', endDate.toISOString());
                     
      } else if (reportPeriod === "monthly") {
        // For monthly reports, filter by month and year
        const startDate = new Date(reportYear, reportMonth - 1, 1);
        const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);
        
        query = query.gte('created_at', startDate.toISOString())
                     .lte('created_at', endDate.toISOString());
                     
      } else if (reportPeriod === "yearly") {
        // For yearly reports, filter by year
        const startDate = new Date(reportYear, 0, 1);
        const endDate = new Date(reportYear, 11, 31, 23, 59, 59, 999);
        
        query = query.gte('created_at', startDate.toISOString())
                     .lte('created_at', endDate.toISOString());
      }
      
      // Execute query
      const { data: applications, error } = await query;
      
      if (error) throw error;
      
      // Generate report title and date label
      let title = "";
      let dateLabel = "";
      
      if (reportPeriod === "daily") {
        const reportDate = new Date(selectedDate);
        title = `Daily Applications Report - ${reportDate.toLocaleDateString()}`;
        dateLabel = reportDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } else if (reportPeriod === "monthly") {
        const monthNames = ["January", "February", "March", "April", "May", "June",
                           "July", "August", "September", "October", "November", "December"];
        title = `Monthly Applications Report - ${monthNames[reportMonth - 1]} ${reportYear}`;
        dateLabel = `${monthNames[reportMonth - 1]} ${reportYear}`;
      } else if (reportPeriod === "yearly") {
        title = `Yearly Applications Report - ${reportYear}`;
        dateLabel = `Year ${reportYear}`;
      }
      
      // Create report data
      const reportData = {
        title: title,
        dateLabel: dateLabel,
        totalApplications: applications.length,
        applications: applications,
        generatedDate: new Date().toLocaleString(),
        reportPeriod: reportPeriod
      };
      
      // Set report data and show modal
      setReportData(reportData);
      setShowReportModal(true);
      
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  };

  // Handle printing the report
  const handlePrintReport = useReactToPrint({
    content: () => reportTemplateRef.current,
    documentTitle: reportData?.title || "DENR Application Report",
    onBeforeGetContent: () => {
      return new Promise((resolve) => {
        setGeneratingReport(true);
        resolve();
      });
    },
    onAfterPrint: () => {
      setGeneratingReport(false);
    }
  });

  // Export to PDF function
  const exportToPDF = async () => {
    if (!reportData || !reportData.applications || reportData.applications.length === 0) return;
    try {
      setGeneratingReport(true);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title and header
      pdf.setFontSize(18);
      pdf.text(reportData.title, 14, 18);
      pdf.setFontSize(12);
      pdf.text('Department of Environment and Natural Resources', 14, 26);
      pdf.text('Online Permit Application System', 14, 34);
      pdf.setFontSize(10);
      pdf.text(`Period: ${reportData.dateLabel}`, 14, 42);
      pdf.text(`Total Applications: ${reportData.totalApplications}`, 14, 48);
      pdf.text(`Generated On: ${formatDateMMMDDYYYY(reportData.generatedDate)}`, 14, 54);

      // Table columns
      const columns = [
        { header: 'Ref #', dataKey: 'ref' },
        { header: 'Full Name', dataKey: 'fullName' },
        { header: 'Contact', dataKey: 'contact' },
        { header: 'Address', dataKey: 'address' },
        { header: 'Purpose', dataKey: 'purpose' },
        { header: 'Submission Date', dataKey: 'submissionDate' }
      ];
      // Table rows
      const rows = reportData.applications.map(app => ({
        ref: `REF-${app.id.toString().padStart(6, '0')}`,
        fullName: app.full_name || 'N/A',
        contact: app.contact_number || 'N/A',
        address: app.address || 'N/A',
        purpose: app.purpose || 'N/A',
        submissionDate: formatDateMMMDDYYYY(app.created_at)
      }));

      // Use autoTable (ESM style)
      autoTable(pdf, {
        startY: 50,
        head: [columns.map(col => col.header)],
        body: rows.map(row => columns.map(col => row[col.dataKey])),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [76, 175, 80], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { left: 14, right: 14 },
        tableWidth: 'auto',
        didDrawPage: (data) => {
          // Add the report title to the bottom-right of every page
          const pageHeight = pdf.internal.pageSize.getHeight();
          const pageWidth = pdf.internal.pageSize.getWidth();
          pdf.setFontSize(10);
          pdf.text(
            `${reportData.title} - Page ${data.pageNumber}`,
            pageWidth - pdf.getTextWidth(`${reportData.title} - Page ${data.pageNumber}`) - 14,
            pageHeight - 10
          );
        }
      });

      // Save the PDF
      let fileName = '';
      if (reportPeriod === "daily") {
        const reportDate = new Date(selectedDate);
        const formattedDate = reportDate.toISOString().split('T')[0];
        fileName = `DailyReport_${formattedDate}.pdf`;
      } else if (reportPeriod === "monthly") {
        const monthNames = ["January", "February", "March", "April", "May", "June",
                           "July", "August", "September", "October", "November", "December"];
        fileName = `MonthlyReport_${monthNames[reportMonth - 1]}_${reportYear}.pdf`;
      } else if (reportPeriod === "yearly") {
        fileName = `YearlyReport_${reportYear}.pdf`;
      }
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Export to CSV function
  const exportToCSV = () => {
    if (!reportData || !reportData.applications || reportData.applications.length === 0) {
      alert('No data available to export');
      return;
    }
    
    try {
      setGeneratingReport(true);
      
      // Define CSV columns
      const columns = [
        'Reference Number',
        'Full Name',
        'Contact',
        'Address',
        'Purpose',
        'Submission Date'
      ];
      
      // Convert applications to CSV rows
      const rows = reportData.applications.map(app => [
        `REF-${app.id.toString().padStart(6, '0')}`,
        app.full_name || 'N/A',
        app.contact_number || 'N/A',
        app.address || 'N/A',
        app.purpose || 'N/A',
        formatDateMMMDDYYYY(app.created_at)
      ]);
      
      // Create CSV content
      let csvContent = columns.join(',') + '\n';
      rows.forEach(row => {
        // Escape fields that contain commas, quotes, or newlines
        const escapedRow = row.map(field => {
          const fieldStr = String(field);
          // If field contains commas, quotes, or newlines, wrap it in quotes and escape any quotes
          if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
            return `"${fieldStr.replace(/"/g, '""')}"`;
          }
          return fieldStr;
        });
        csvContent += escapedRow.join(',') + '\n';
      });
      
      // Generate a standardized filename based on report period
      let fileName = '';
      if (reportPeriod === "daily") {
        const reportDate = new Date(selectedDate);
        const formattedDate = reportDate.toISOString().split('T')[0];
        fileName = `DailyReport_${formattedDate}.csv`;
      } else if (reportPeriod === "monthly") {
        const monthNames = ["January", "February", "March", "April", "May", "June",
                           "July", "August", "September", "October", "November", "December"];
        fileName = `MonthlyReport_${monthNames[reportMonth - 1]}_${reportYear}.csv`;
      } else if (reportPeriod === "yearly") {
        fileName = `YearlyReport_${reportYear}.csv`;
      }
      
      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating CSV:', err);
      alert('Failed to generate CSV. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Export to Excel function
  const exportToExcel = () => {
    if (!reportData || !reportData.applications || reportData.applications.length === 0) {
      alert('No data available to export');
      return;
    }
    
    try {
      setGeneratingReport(true);
      
      // Get status names for display
      const getStatusName = (statusCode) => {
        switch(statusCode) {
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
          case 11: return 'Inspected';
          default: return 'Unknown';
        }
      };
      
      // Define column headers
      const headers = [
        'Reference Number',
        'Full Name',
        'Contact',
        'Address',
        'Purpose',
        'Status',
        'Submission Date'
      ];
      
      // Convert applications to data rows
      const data = reportData.applications.map(app => ({
        'Reference Number': `REF-${app.id.toString().padStart(6, '0')}`,
        'Full Name': app.full_name || 'N/A',
        'Contact': app.contact_number || 'N/A',
        'Address': app.address || 'N/A',
        'Purpose': app.purpose || 'N/A',
        'Status': getStatusName(app.status),
        'Submission Date': formatDateMMMDDYYYY(app.created_at)
      }));
      
      // Create worksheet from data
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths
      const colWidths = [
        { wch: 15 }, // Reference Number
        { wch: 25 }, // Full Name
        { wch: 15 }, // Contact
        { wch: 30 }, // Address
        { wch: 25 }, // Purpose
        { wch: 15 }, // Status
        { wch: 15 }  // Submission Date
      ];
      worksheet['!cols'] = colWidths;
      
      // Create workbook and add the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications');
      
      // Add report title in a separate sheet
      const infoData = [
        { A: 'Report Title', B: reportData.title },
        { A: 'Period', B: reportData.dateLabel },
        { A: 'Total Applications', B: reportData.totalApplications.toString() },
        { A: 'Generated On', B: reportData.generatedDate }
      ];
      const infoSheet = XLSX.utils.json_to_sheet(infoData, { header: ['A', 'B'] });
      XLSX.utils.book_append_sheet(workbook, infoSheet, 'Report Info');
      
      // Calculate status statistics
      const statusCounts = {
        'Submitted': 0,
        'Under Review': 0,
        'Needs Revision': 0,
        'Approved': 0,
        'Rejected': 0,
        'Payment Pending': 0,
        'Payment Recieved': 0,
        'Payment Failed': 0,
        'Inspecting': 0,
        'Inspected': 0,
        'Completed': 0
      };
      
      // Count applications by status
      reportData.applications.forEach(app => {
        const statusName = getStatusName(app.status);
        statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
      });
      
      // Create statistics sheet
      const statsData = Object.keys(statusCounts).map(status => ({
        'Status': status,
        'Count': statusCounts[status],
        'Percentage': `${((statusCounts[status] / reportData.totalApplications) * 100).toFixed(2)}%`
      }));
      
      const statsSheet = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');
      
      // Generate a standardized filename based on report period
      let fileName = '';
      if (reportPeriod === "daily") {
        const reportDate = new Date(selectedDate);
        const formattedDate = reportDate.toISOString().split('T')[0];
        fileName = `DailyReport_${formattedDate}.xlsx`;
      } else if (reportPeriod === "monthly") {
        const monthNames = ["January", "February", "March", "April", "May", "June",
                           "July", "August", "September", "October", "November", "December"];
        fileName = `MonthlyReport_${monthNames[reportMonth - 1]}_${reportYear}.xlsx`;
      } else if (reportPeriod === "yearly") {
        fileName = `YearlyReport_${reportYear}.xlsx`;
      }
      
      // Save the Excel file
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Error generating Excel:', err);
      alert('Failed to generate Excel. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Add the renderCharts function back 
  const renderCharts = () => (
    <div className="charts-container">
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Applications by Month</h3>
          <div className="year-selector">
            <label htmlFor="year-select">Year: </label>
            <select 
              id="year-select" 
              value={selectedYear} 
              onChange={handleYearChange}
              className="year-dropdown"
            >
              <option value="all">All Years</option>
              {getAvailableYears().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="chart-wrapper">
          {isLoading ? (
            <div className="loading-spinner">Loading...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <Bar 
              data={chartData.applicationsByMonth} 
              options={barChartOptions}
            />
          )}
        </div>
      </div>
      
      <div className="chart-card">
        <h3 className="chart-title">Applications by Status</h3>
        <div className="chart-wrapper">
          <Pie 
            data={chartData.applicationsByStatus} 
            options={pieChartOptions}
          />
        </div>
      </div>
      
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Permit & Certificate Trends</h3>
          <div className="year-selector">
            <label htmlFor="year-select-2">Year: </label>
            <select 
              id="year-select-2" 
              value={selectedYear} 
              onChange={handleYearChange}
              className="year-dropdown"
            >
              <option value="all">All Years</option>
              {getAvailableYears().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="chart-wrapper">
          {isLoading ? (
            <div className="loading-spinner">Loading...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <Line 
              data={chartData.processingTimeTrends} 
              options={lineChartOptions}
            />
          )}
        </div>
      </div>
      
      <div className="user-activity-section">
        <div className="section-header">
          <h3 className="section-title">User Activity</h3>
          <div className="period-selector">
            <select 
              value={userActivityPeriod} 
              onChange={(e) => setUserActivityPeriod(e.target.value)}
              className="period-dropdown"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
        <div className="user-cards-container">
          {isLoading ? (
            <div className="loading-spinner">Loading user data...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            Object.values(userApplicationCounts)
              .sort((a, b) => b.count - a.count)
              .map((userData, index) => (
                <div key={userData.user.id} className="user-card">
                  <div className="user-profile">
                    {userData.user.profile_link ? (
                      <img 
                        src={userData.user.profile_link} 
                        alt={userData.user.user_name || "User"} 
                        className="user-avatar"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://via.placeholder.com/50?text=User";
                        }}
                      />
                    ) : (
                      <div className="user-avatar-placeholder">
                        {userData.user.user_name ? userData.user.user_name.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                    <div className="user-info">
                      <div className="user-name">{userData.user.user_name || "Unknown User"}</div>
                      <div className="user-email">{userData.user.email || "No email"}</div>
                    </div>
                  </div>
                  <div className="user-stats">
                    <div className="application-count">
                      <span className="count-value">{userData.count}</span>
                      <span className="count-label">Applications {userActivityPeriod === "monthly" ? "this month" : "this year"}</span>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );

  // Get the status name from status ID
  const getStatusName = (statusCode) => {
    switch(statusCode) {
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
      case 11: return 'Inspected';
      default: return 'Unknown';
    }
  };

  // Process status history for the timeline chart
  const processStatusHistory = () => {
    if (!statusHistory || statusHistory.length === 0) {
      return {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          {
            label: 'Submitted',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(255, 160, 0, 1)',
            backgroundColor: 'rgba(255, 193, 7, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Under Review',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(255, 160, 0, 1)',
            backgroundColor: 'rgba(255, 193, 7, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Needs Revision',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(244, 81, 30, 1)',
            backgroundColor: 'rgba(255, 112, 67, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Approved',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(46, 125, 50, 1)',
            backgroundColor: 'rgba(67, 160, 71, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Rejected',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(183, 28, 28, 1)',
            backgroundColor: 'rgba(229, 57, 53, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Payment Pending',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(0, 105, 92, 1)',
            backgroundColor: 'rgba(0, 137, 123, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Payment Received',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(0, 105, 92, 1)',
            backgroundColor: 'rgba(0, 137, 123, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Payment Failed',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(0, 105, 92, 1)',
            backgroundColor: 'rgba(0, 137, 123, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Inspecting',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(13, 71, 161, 1)',
            backgroundColor: 'rgba(25, 118, 210, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Inspected',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(13, 71, 161, 1)',
            backgroundColor: 'rgba(25, 118, 210, 0.2)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Completed',
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: 'rgba(106, 27, 154, 1)',
            backgroundColor: 'rgba(142, 36, 170, 0.2)',
            tension: 0.4,
            fill: true
          }
        ]
      };
    }

    // Initialize monthly counts for each status
    const monthlyStatusCounts = {
      1: Array(12).fill(0), // Submitted
      2: Array(12).fill(0), // Under Review
      3: Array(12).fill(0), // Needs Revision
      4: Array(12).fill(0), // Approved
      5: Array(12).fill(0), // Rejected
      6: Array(12).fill(0), // Payment Pending
      7: Array(12).fill(0), // Payment Received
      8: Array(12).fill(0), // Payment Failed
      9: Array(12).fill(0), // Inspecting
      10: Array(12).fill(0), // Completed
      11: Array(12).fill(0)  // Inspected
    };

    // Filter for selected year if not "all"
    const filteredHistory = selectedYear === "all" 
      ? statusHistory 
      : statusHistory.filter(entry => {
          const entryDate = new Date(entry.changed_at);
          return entryDate.getFullYear() === parseInt(selectedYear);
        });

    // Count status changes by month
    filteredHistory.forEach(entry => {
      const entryDate = new Date(entry.changed_at);
      const month = entryDate.getMonth(); // 0-based month
      
      if (entry.status_id && monthlyStatusCounts[entry.status_id]) {
        monthlyStatusCounts[entry.status_id][month]++;
      }
    });

    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Submitted',
          data: monthlyStatusCounts[1],
          borderColor: 'rgba(255, 160, 0, 1)',
          backgroundColor: 'rgba(255, 193, 7, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Under Review',
          data: monthlyStatusCounts[2],
          borderColor: 'rgba(255, 160, 0, 1)',
          backgroundColor: 'rgba(255, 193, 7, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Needs Revision',
          data: monthlyStatusCounts[3],
          borderColor: 'rgba(244, 81, 30, 1)',
          backgroundColor: 'rgba(255, 112, 67, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Approved',
          data: monthlyStatusCounts[4],
          borderColor: 'rgba(46, 125, 50, 1)',
          backgroundColor: 'rgba(67, 160, 71, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Rejected',
          data: monthlyStatusCounts[5],
          borderColor: 'rgba(183, 28, 28, 1)',
          backgroundColor: 'rgba(229, 57, 53, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Payment Pending',
          data: monthlyStatusCounts[6],
          borderColor: 'rgba(0, 105, 92, 1)',
          backgroundColor: 'rgba(0, 137, 123, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Payment Received',
          data: monthlyStatusCounts[7],
          borderColor: 'rgba(0, 105, 92, 1)',
          backgroundColor: 'rgba(0, 137, 123, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Payment Failed',
          data: monthlyStatusCounts[8],
          borderColor: 'rgba(0, 105, 92, 1)',
          backgroundColor: 'rgba(0, 137, 123, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Inspecting',
          data: monthlyStatusCounts[9],
          borderColor: 'rgba(13, 71, 161, 1)',
          backgroundColor: 'rgba(25, 118, 210, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Inspected',
          data: monthlyStatusCounts[11],
          borderColor: 'rgba(13, 71, 161, 1)',
          backgroundColor: 'rgba(25, 118, 210, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Completed',
          data: monthlyStatusCounts[10],
          borderColor: 'rgba(106, 27, 154, 1)',
          backgroundColor: 'rgba(142, 36, 170, 0.2)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  };

  // Update the renderAnalytics function
  const renderAnalytics = () => {
    // Calculate application metrics
    const calculateMetrics = () => {
      if (isLoading || userApplications.length === 0) {
        return {
          totalApplications: 0,
          approvalRate: 0,
          avgProcessingTime: 0,
          pendingRate: 0,
          // Trend data (mock for now - could be calculated from historical data)
          trends: {
            totalTrend: 0,
            approvalTrend: 0,
            processingTimeTrend: 0,
            pendingTrend: 0
          }
        };
      }

      // Get current date and date a month ago for trend calculations
      const currentDate = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(currentDate.getMonth() - 1);

      // Filter applications from current month and previous month
      const currentMonthApps = userApplications.filter(app => 
        new Date(app.created_at) >= oneMonthAgo && new Date(app.created_at) <= currentDate
      );
      
      const previousMonthDate = new Date(oneMonthAgo);
      previousMonthDate.setMonth(oneMonthAgo.getMonth() - 1);
      const previousMonthApps = userApplications.filter(app => 
        new Date(app.created_at) >= previousMonthDate && new Date(app.created_at) < oneMonthAgo
      );

      // Calculate approval rate
      const approvedApps = userApplications.filter(app => app.status === 4).length;
      const approvalRate = (approvedApps / userApplications.length) * 100;
      
      // Previous month approval rate for trend
      const prevApprovedApps = previousMonthApps.filter(app => app.status === 4).length;
      const prevApprovalRate = previousMonthApps.length > 0 ? 
        (prevApprovedApps / previousMonthApps.length) * 100 : 0;
      
      // Calculate average processing time (for approved applications)
      let totalProcessingDays = 0;
      let processedCount = 0;
      
      userApplications.forEach(app => {
        if (app.status === 4 && app.approved_date) { // If approved and has approval date
          const submissionDate = new Date(app.created_at);
          const approvalDate = new Date(app.approved_date);
          const processingDays = (approvalDate - submissionDate) / (1000 * 60 * 60 * 24);
          totalProcessingDays += processingDays;
          processedCount++;
        }
      });
      
      const avgProcessingTime = processedCount > 0 ? (totalProcessingDays / processedCount) : 0;
      
      // Previous month processing time
      let prevTotalProcessingDays = 0;
      let prevProcessedCount = 0;
      
      previousMonthApps.forEach(app => {
        if (app.status === 4 && app.approved_date) {
          const submissionDate = new Date(app.created_at);
          const approvalDate = new Date(app.approved_date);
          const processingDays = (approvalDate - submissionDate) / (1000 * 60 * 60 * 24);
          prevTotalProcessingDays += processingDays;
          prevProcessedCount++;
        }
      });
      
      const prevAvgProcessingTime = prevProcessedCount > 0 ? 
        (prevTotalProcessingDays / prevProcessedCount) : 0;
      
      // Calculate pending application rate
      const pendingApps = userApplications.filter(app => app.status === 1 || app.status === 2).length;
      const pendingRate = (pendingApps / userApplications.length) * 100;
      
      // Previous month pending rate
      const prevPendingApps = previousMonthApps.filter(app => app.status === 1 || app.status === 2).length;
      const prevPendingRate = previousMonthApps.length > 0 ? 
        (prevPendingApps / previousMonthApps.length) * 100 : 0;
      
      // Calculate trends (percentage change)
      const totalTrend = previousMonthApps.length > 0 ? 
        ((currentMonthApps.length - previousMonthApps.length) / previousMonthApps.length) * 100 : 0;
      
      const approvalTrend = prevApprovalRate > 0 ? 
        (approvalRate - prevApprovalRate) : 0;
      
      const processingTimeTrend = prevAvgProcessingTime > 0 ? 
        (avgProcessingTime - prevAvgProcessingTime) : 0;
      
      const pendingTrend = prevPendingRate > 0 ? 
        (pendingRate - prevPendingRate) : 0;
      
      return {
        totalApplications: userApplications.length,
        approvalRate: approvalRate.toFixed(1),
        avgProcessingTime: avgProcessingTime.toFixed(1),
        pendingRate: pendingRate.toFixed(1),
        trends: {
          totalTrend: totalTrend.toFixed(1),
          approvalTrend: approvalTrend.toFixed(1),
          processingTimeTrend: processingTimeTrend.toFixed(1),
          pendingTrend: pendingTrend.toFixed(1)
        }
      };
    };
    
    // Get calculated metrics
    const metrics = calculateMetrics();

    return (
    <div className="analytics-container">
      {/* Permit Application Overview */}
      <div className="analytics-section">
        <h3 className="section-title">Application Overview</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">
              <FaFileAlt />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.totalApplications}</div>
              <div className="metric-label">Total Applications</div>
              <div className={`metric-trend ${parseFloat(metrics.trends.totalTrend) >= 0 ? 'positive' : 'negative'}`}>
                <FaArrowUp /> {Math.abs(parseFloat(metrics.trends.totalTrend))}% from last month
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              <FaCheckCircle />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.approvalRate}%</div>
              <div className="metric-label">Approval Rate</div>
              <div className={`metric-trend ${parseFloat(metrics.trends.approvalTrend) >= 0 ? 'positive' : 'negative'}`}>
                <FaArrowUp /> {Math.abs(parseFloat(metrics.trends.approvalTrend))}% from last month
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              <FaClock />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.avgProcessingTime}</div>
              <div className="metric-label">Avg. Processing Time (days)</div>
              <div className={`metric-trend ${parseFloat(metrics.trends.processingTimeTrend) <= 0 ? 'positive' : 'negative'}`}>
                <FaArrowUp /> {Math.abs(parseFloat(metrics.trends.processingTimeTrend))} days from last month
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              <FaExclamationTriangle />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.pendingRate}%</div>
              <div className="metric-label">Pending Applications</div>
              <div className={`metric-trend ${parseFloat(metrics.trends.pendingTrend) <= 0 ? 'positive' : 'negative'}`}>
                <FaArrowUp /> {Math.abs(parseFloat(metrics.trends.pendingTrend))}% from last month
              </div>
            </div>
          </div>
          </div>
        </div>
        
      {/* Application Status Timeline */}
      <div className="analytics-section">
        <h3 className="section-title">Application Status Timeline</h3>
        <div className="chart-wrapper" style={{ position: 'relative', paddingTop: '50px', height: '400px' }}>
          {/* Year filter moved inside the chart with adjusted positioning */}
          <div className="filter" style={{ 
            position: 'absolute', 
            top: '0px', 
            right: '10px', 
            zIndex: 10,
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '6px 12px',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <label htmlFor="timeline-year-select" style={{ fontWeight: '500', marginBottom: '0', fontSize: '0.9rem' }}>Year:</label>
            <select 
              id="timeline-year-select" 
              value={selectedYear} 
              onChange={handleYearChange}
              style={{ 
                padding: '4px 8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                minWidth: '100px',
                fontSize: '0.9rem'
              }}
            >
              <option value="all">All Years</option>
              {getAvailableYears().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <Line 
            data={processStatusHistory()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
              layout: {
                padding: {
                  top: 10
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  suggestedMin: 0,
                  suggestedMax: 10,
                  title: {
                    display: true,
                    text: 'Number of Applications'
                  },
                  ticks: {
                    stepSize: 1,
                    precision: 0
                  }
                }
              },
                plugins: {
                  legend: {
                  position: 'top',
                  align: 'start',
                  labels: {
                    boxWidth: 15,
                    padding: 15
                  }
                },
                tooltip: {
                  callbacks: {
                    title: function(context) {
                      return context[0].label + ' ' + (selectedYear === "all" ? "" : selectedYear);
                    }
                  }
                }
              }
              }}
            />
          </div>
        </div>

      {/* Recent Applications */}
      <div className="analytics-section">
        <h3 className="section-title">Recent Applications</h3>
        <div className="applications-table">
          {isLoading ? (
            <div className="loading-spinner">Loading application data...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : userApplications.length === 0 ? (
            <div className="no-data-message">No applications found</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Refrence #</th>
                  <th>Applicant</th>
                  <th>Purpose</th>
                  <th>Date Submitted</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Processing Time</th>
                </tr>
              </thead>
              <tbody>
                {userApplications
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .slice(0, 5)
                  .map(app => {
                    // Calculate processing time
                    const submissionDate = new Date(app.created_at);
                    const currentDate = new Date();
                    const approvalDate = app.approved_date ? new Date(app.approved_date) : null;
                    
                    // Use approval date for completed applications, current date for ongoing ones
                    const endDate = approvalDate || currentDate;
                    const processingDays = Math.ceil((endDate - submissionDate) / (1000 * 60 * 60 * 24));
                    
                    // Status badge class based on status code
                    let statusBadgeClass = '';
                    switch(app.status) {
                      case 1: statusBadgeClass = 'pending'; break;
                      case 2: statusBadgeClass = 'under-review'; break;
                      case 3: statusBadgeClass = 'needs-revision'; break;
                      case 4: statusBadgeClass = 'approved'; break;
                      case 5: statusBadgeClass = 'denied'; break;
                      case 9: statusBadgeClass = 'inspecting'; break;
                      case 10: statusBadgeClass = 'completed'; break;
                      case 11: statusBadgeClass = 'inspected'; break;
                      default: statusBadgeClass = 'pending';
                    }
                    
                    return (
                      <tr key={app.id}>
                        <td>REF-{app.id.toString().padStart(6, '0')}</td>
                        <td>{app.full_name || 'N/A'}</td>
                        <td>{app.purpose || 'N/A'}</td>
                        <td>{formatDateMMMDDYYYY(app.created_at)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-badge ${getStatusName(app.status).toLowerCase().replace(/ /g, '-')}`}>
                            {getStatusName(app.status)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {processingDays} day{processingDays !== 1 ? 's' : ''}
                          {app.status === 4 && ' (completed)'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
      </div>
    </div>
          </div>
  );
  };

  // Report Modal Component
  const ReportModal = () => {
    if (!reportData) return null;
    
    return (
      <div className="report-modal-overlay">
        <div className="report-modal">
          <div className="report-modal-header">
            <h2>{reportData.title}</h2>
            <div className="report-modal-actions">
              <button className="report-action-btn print" onClick={handlePrintReport} disabled={generatingReport}>
                <FaFilePdf /> Print
              </button>
              <button className="report-action-btn export" onClick={exportToPDF} disabled={generatingReport}>
                <FaDownload /> Save PDF
              </button>
              <button className="report-action-btn export-csv" onClick={exportToCSV} disabled={generatingReport}>
                <FaFileCsv /> Save CSV
              </button>
              <button className="report-action-btn export-excel" onClick={exportToExcel} disabled={generatingReport}>
                <FaFileExcel /> Save Excel
              </button>
              <button className="report-modal-close" onClick={() => setShowReportModal(false)}>×</button>
          </div>
          </div>
          
          <div className="report-content" ref={reportTemplateRef}>
            <div className="report-header">
              <div className="report-logo">
                <div className="logo-placeholder">
                  <img src="/Logo1.png" alt="DENR Logo" />
          </div>
        </div>
              <div className="report-title">
                <h1><FaChartBar style={{marginRight: '10px'}}/>{reportData.title}</h1>
                <p>Department of Environment and Natural Resources</p>
      </div>
            </div>
            
            <div className="report-info">
              <div className="report-info-item">
                <span className="info-label">Period:</span>
                <span className="info-value">{reportData.dateLabel}</span>
          </div>
              <div className="report-info-item">
                <span className="info-label">Total Applications:</span>
                <span className="info-value">{reportData.totalApplications}</span>
            </div>
              <div className="report-info-item">
                <span className="info-label">Generated On:</span>
                <span className="info-value">{formatDateMMMDDYYYY(reportData.generatedDate)}</span>
          </div>
            </div>
            
            <div className="report-summary">
              <h2>Applications Summary</h2>
              <p>This report provides a summary of applications submitted during the selected period.</p>
      </div>

            <div className="report-applications">
              <h2>Application Details</h2>
              {reportData.applications.length > 0 ? (
                <table className="report-table">
            <thead>
              <tr>
                      <th>Ref #</th>
                      <th>Full Name</th>
                      <th>Contact</th>
                      <th>Address</th>
                      <th>Purpose</th>
                      <th>Submission Date</th>
              </tr>
            </thead>
            <tbody>
                    {reportData.applications.map(app => (
                      <tr key={app.id}>
                        <td>REF-{app.id.toString().padStart(6, '0')}</td>
                        <td>{app.full_name || "N/A"}</td>
                        <td>{app.contact_number || "N/A"}</td>
                        <td>{app.address || "N/A"}</td>
                        <td>{app.purpose || "N/A"}</td>
                        <td>{formatDateMMMDDYYYY(app.created_at)}</td>
              </tr>
                    ))}
            </tbody>
          </table>
              ) : (
                <div className="no-applications">
                  <p>No applications found for this period.</p>
        </div>
              )}
            </div>
            
            <div className="report-footer">
              <p>This is an automatically generated report from the DENR Online Permit Application System.</p>
              <p>Generated on: {formatDateMMMDDYYYY(reportData.generatedDate)}</p>
            </div>
          </div>
      </div>
    </div>
  );
  };

  return (
    <div className="reports-container">
      <div className="application-list-header">
        <h1 className="application-list-title" style={{ fontSize: '32px', fontWeight: 'bold' }}><FaChartBar style={{marginRight: '10px'}}/>Reports</h1>
        <p className="application-list-subtitle">View and analyze application statistics and reports</p>
      </div>

      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <FaChartLine /> Analytics
        </button>
        <button 
          className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <FaChartPie /> Charts
        </button>
        <button 
          className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          <FaChartBar /> Generate Report
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'charts' && renderCharts()}
        {activeTab === 'table' && renderTable()}
      </div>

      {showReportModal && <ReportModal />}
        </div>
    );
}

export default Reports;