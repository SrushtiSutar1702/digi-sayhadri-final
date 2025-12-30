import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, set } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Share2, LogOut, CheckCircle, Clock, Calendar, ChevronLeft, ChevronRight, XCircle, LayoutDashboard, Download, CheckSquare, Square, Search, BarChart3, PieChart, TrendingUp, Users, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Dashboard.css';
import './SocialMediaDashboard.css';


const SocialMediaDashboard = ({ initialView = 'dashboard', isSuperAdmin = false, employeeFilter = 'all' }) => {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [showCalendar, setShowCalendar] = useState(initialView === 'calendar');
  const [showDayModal, setShowDayModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(initialView === 'dashboard' || initialView !== 'calendar' && initialView !== 'reports'); // Dashboard view state
  const [revisionMessages, setRevisionMessages] = useState({});
  const [expandedClients, setExpandedClients] = useState({});
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [loggedInUserName, setLoggedInUserName] = useState('');
  const [loggedInUserEmail, setLoggedInUserEmail] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // New state for statistics card filtering
  const [searchTerm, setSearchTerm] = useState(''); // New state for search functionality
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card' view mode
  const [selectedClientForCardView, setSelectedClientForCardView] = useState(null); // For card view client selection
  const [selectedTasks, setSelectedTasks] = useState(new Set()); // For PDF download task selection
  const [showReports, setShowReports] = useState(initialView === 'reports'); // For Reports section
  const [showDownloadOptions, setShowDownloadOptions] = useState(false); // For download dropdown
  const [selectedReportTasks, setSelectedReportTasks] = useState(new Set()); // For Reports section task selection
  const [showCheckboxes, setShowCheckboxes] = useState(false); // Toggle checkboxes visibility (unified for both clients and tasks)
  const [selectedClients, setSelectedClients] = useState(new Set()); // For client selection in Reports
  const [showFormatDropdown, setShowFormatDropdown] = useState(false); // For format selection dropdown
  const [showAllReportDropdown, setShowAllReportDropdown] = useState(false); // For All Report button dropdown


  // Reports section filter states (same as GraphicsDashboard)
  const [reportsSearchQuery, setReportsSearchQuery] = useState(''); // Search for reports
  const [reportsEmployeeFilter, setReportsEmployeeFilter] = useState('all'); // Employee filter for reports
  const [reportsClientFilter, setReportsClientFilter] = useState('all'); // Client filter for reports
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all'); // Status filter for reports
  const [reportTimePeriod, setReportTimePeriod] = useState('month'); // 'day', 'week', 'month'

  // Ad modal states
  const [showAdModal, setShowAdModal] = useState(false);
  const [selectedTaskForPosting, setSelectedTaskForPosting] = useState(null);
  const [adType, setAdType] = useState('');
  const [adCost, setAdCost] = useState('');

  // Employees state
  const [employees, setEmployees] = useState([]);

  // Add Extra Task states
  const [showAddExtraTaskModal, setShowAddExtraTaskModal] = useState(initialView === 'addExtraTask');
  const [manualClientEntry, setManualClientEntry] = useState(false);
  const [newTask, setNewTask] = useState({
    clientName: '',
    clientId: '',
    ideas: '',
    content: '',
    referenceLink: '',
    specialNotes: '',
    department: '', // video or graphics
    taskType: '',
    postDate: ''
  });

  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();

  // Function to group tasks by client
  const groupTasksByClient = (tasks) => {
    const grouped = {};
    tasks.forEach(task => {
      const clientName = task.clientName || 'Unknown Client';
      if (!grouped[clientName]) {
        grouped[clientName] = [];
      }
      grouped[clientName].push(task);
    });
    return grouped;
  };

  // Function to toggle client expansion
  const toggleClientExpansion = (clientName) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  // Function to filter reports data based on search and filters
  const getReportsFilteredTasks = () => {
    let filtered = tasks.filter(task => {
      // Show ALL tasks that have been assigned to departments
      if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;
      const taskDate = task.postDate || task.deadline;
      if (!taskDate) return true;
      return taskDate.startsWith(selectedMonth);
    });

    // Apply time period filter
    if (reportTimePeriod !== 'month') {
      filtered = filtered.filter(task => {
        const taskDate = task.postDate ? new Date(task.postDate) : task.createdAt ? new Date(task.createdAt) : null;
        if (taskDate) {
          const now = new Date();

          if (reportTimePeriod === 'day') {
            // Show tasks from today only
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
            return taskDay.getTime() === today.getTime();
          } else if (reportTimePeriod === 'week') {
            // Show tasks from current week (last 7 days)
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return taskDate >= weekAgo && taskDate <= now;
          }
        }
        return false;
      });
    }

    // Apply search filter
    if (reportsSearchQuery.trim()) {
      const query = reportsSearchQuery.toLowerCase();
      filtered = filtered.filter(task => {
        return (
          task.clientName?.toLowerCase().includes(query) ||
          task.clientId?.toLowerCase().includes(query) ||
          task.taskName?.toLowerCase().includes(query) ||
          task.projectName?.toLowerCase().includes(query) ||
          task.assignedTo?.toLowerCase().includes(query)
        );
      });
    }

    // Apply employee filter
    if (reportsEmployeeFilter !== 'all') {
      console.log('Filtering for employee:', reportsEmployeeFilter);
      console.log('Tasks before employee filter:', filtered.length);
      filtered = filtered.filter(task => {
        // Check both assignedTo and socialMediaAssignedTo fields
        const matches = task.assignedTo === reportsEmployeeFilter ||
          task.socialMediaAssignedTo === reportsEmployeeFilter;
        if (matches) {
          console.log('Matched task:', task.taskName, 'assignedTo:', task.assignedTo, 'socialMediaAssignedTo:', task.socialMediaAssignedTo);
        }
        return matches;
      });
      console.log('Tasks after employee filter:', filtered.length);
    }

    // Apply client filter
    if (reportsClientFilter !== 'all') {
      filtered = filtered.filter(task => task.clientName === reportsClientFilter);
    }

    // Apply status filter
    if (reportsStatusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === reportsStatusFilter);
    }

    return filtered;
  };

  // Function to handle download of ALL reports (PDF & Excel) based on current filters
  const handleAllReportDownload = (format) => {
    console.log('handleAllReportDownload triggered with format:', format);
    const tasksToDownload = getReportsFilteredTasks();
    console.log('Tasks to download:', tasksToDownload.length);

    if (tasksToDownload.length === 0) {
      showToast('⚠️ No tasks to download based on current filters', 'warning');
      return;
    }

    // Automatically select all filtered tasks and clients to reflect "All Report" action
    const allTaskIds = new Set(tasksToDownload.map(t => t.id));
    setSelectedReportTasks(allTaskIds);

    const allClientNames = new Set();
    tasksToDownload.forEach(t => {
      if (t.clientName) allClientNames.add(t.clientName);
    });
    setSelectedClients(allClientNames);

    const now = new Date();
    const dateTimeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

    showToast(`⏳ Generating ${format.toUpperCase()} report for ${tasksToDownload.length} tasks...`, 'info');

    try {
      if (format === 'pdf') {
        console.log('Starting PDF generation...');
        // --- PDF GENERATION ---
        const groupedByEmployee = {};
        tasksToDownload.forEach(task => {
          const employeeName = task.socialMediaAssignedTo || task.assignedTo || 'Unassigned';
          if (!groupedByEmployee[employeeName]) {
            groupedByEmployee[employeeName] = {};
          }
          const clientName = task.clientName || 'Unknown Client';
          if (!groupedByEmployee[employeeName][clientName]) {
            groupedByEmployee[employeeName][clientName] = [];
          }
          groupedByEmployee[employeeName][clientName].push(task);
        });

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 20;

        // Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 180, 111); // Green #37B46F
        doc.text('Digi Syhadri', pageWidth / 2, yPosition, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Generated: ' + dateTimeStr, pageWidth - 15, 10, { align: 'right' });

        yPosition += 8;
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 180, 111); // Green #37B46F
        doc.text('Social Media Report', pageWidth / 2, yPosition, { align: 'center' });

        yPosition += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`Total Employees: ${Object.keys(groupedByEmployee).length} | Total Tasks: ${tasksToDownload.length}`, 20, yPosition);

        yPosition += 15;

        // Add content
        Object.entries(groupedByEmployee).forEach(([employeeName, clientGroups]) => {
          const employeeTotalTasks = Object.values(clientGroups).flat().length;

          if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFillColor(100, 116, 234);
          doc.rect(15, yPosition - 5, pageWidth - 30, 12, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(employeeName, 18, yPosition + 3);

          yPosition += 12;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          const completed = Object.values(clientGroups).flat().filter(t => t.status === 'posted').length;
          const inProgress = Object.values(clientGroups).flat().filter(t => t.status === 'approved').length;
          const pending = Object.values(clientGroups).flat().filter(t => t.status === 'assigned-to-department').length;
          doc.text(`Total Tasks: ${employeeTotalTasks} | Completed: ${completed} | In Progress: ${inProgress} | Pending: ${pending}`, 18, yPosition);
          yPosition += 10;

          Object.entries(clientGroups).forEach(([clientName, clientTasks]) => {
            if (yPosition > pageHeight - 60) {
              doc.addPage();
              yPosition = 20;
            }

            doc.setFillColor(200, 210, 240);
            doc.rect(20, yPosition - 4, pageWidth - 40, 8, 'F');
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${clientName} (${clientTasks.length} task${clientTasks.length !== 1 ? 's' : ''})`, 23, yPosition + 1);

            yPosition += 10;

            const tableData = clientTasks.map(task => {
              let postedAt = '-';
              if (task.status === 'posted' && task.postedAt) {
                const postedDate = new Date(task.postedAt);
                postedAt = postedDate.toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
              }
              return [
                (task.taskName || 'N/A').substring(0, 35),
                (task.originalDepartment || task.department || 'N/A').toUpperCase(),
                task.postDate || task.deadline || 'N/A',
                (task.status || '').replace(/-/g, ' ').toUpperCase().substring(0, 15),
                postedAt
              ];
            });

            autoTable(doc, {
              startY: yPosition,
              head: [['Task Name', 'Department', 'Post Date', 'Status', 'Posted At']],
              body: tableData,
              theme: 'striped',
              headStyles: { fillColor: [100, 116, 234], textColor: 255, fontSize: 8, fontStyle: 'bold' },
              bodyStyles: { fontSize: 7, textColor: 50 },
              alternateRowStyles: { fillColor: [248, 250, 252] },
              margin: { left: 20 },
              tableWidth: pageWidth - 40
            });

            yPosition = doc.lastAutoTable.finalY + 10;
          });
          yPosition += 10;
        });

        console.log('Saving PDF...');
        doc.save(`Social_Media_All_Reports_${selectedMonth}.pdf`);

      } else if (format === 'excel') {
        console.log('Starting Excel generation...');
        // --- EXCEL GENERATION ---
        const groupedTasksForExcel = groupTasksByClient(tasksToDownload);
        const wb = XLSX.utils.book_new();
        const headerData = [
          ['Digi Syhadri', '', '', '', 'Generated: ' + dateTimeStr],
          ['Social Media All Report'],
          [],
          [`Total Tasks: ${tasksToDownload.length}`, `Clients: ${Object.keys(groupedTasksForExcel).length}`],
          []
        ];
        let allData = [...headerData];

        Object.entries(groupedTasksForExcel).forEach(([clientName, clientTasks]) => {
          const posted = clientTasks.filter(t => t.status === 'posted').length;
          const approved = clientTasks.filter(t => t.status === 'approved').length;

          allData.push([clientName, '', '', '', '']);
          allData.push([`Tasks: ${clientTasks.length}`, `Posted: ${posted}`, `Ready: ${approved}`, '', '']);
          allData.push(['Task', 'Post Date', 'Assigned To', 'Status', 'Posted At']);

          clientTasks.forEach(task => {
            let postedTime = 'Not Posted';
            if (task.status === 'posted' && task.postedAt) {
              const postedDate = new Date(task.postedAt);
              postedTime = postedDate.toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
            }
            allData.push([
              task.taskName || 'N/A',
              task.postDate || task.deadline || 'N/A',
              task.submittedBy || task.assignedTo || 'Not assigned',
              (task.status || '').replace(/-/g, ' ').toUpperCase(),
              postedTime
            ]);
          });
          allData.push([]);
        });

        console.log('Writing Excel file...');
        const ws = XLSX.utils.aoa_to_sheet(allData);
        ws['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Social Media Report');
        XLSX.writeFile(wb, `social-media-all-report-${selectedMonth}.xlsx`);
      }

      console.log('Download complete.');
      showToast(`✅ ${format.toUpperCase()} downloaded successfully!`, 'success');
      setShowAllReportDropdown(false);
    } catch (error) {
      console.error('Error generating reports:', error);
      showToast('❌ Error generating reports: ' + error.message, 'error');
    }
  };

  // Load logged-in user info from sessionStorage (for department heads)
  useEffect(() => {
    // For department heads, use sessionStorage set by main login
    const employeeName = sessionStorage.getItem('employeeName');
    const employeeDataStr = sessionStorage.getItem('employeeData');

    if (employeeName) {
      setLoggedInUserName(employeeName);
      console.log('SocialMediaDashboard - Logged in user:', employeeName);
    }

    if (employeeDataStr) {
      try {
        const employeeData = JSON.parse(employeeDataStr);
        if (employeeData.email) {
          setLoggedInUserEmail(employeeData.email);
        }
        if (employeeData.employeeName) {
          setLoggedInUserName(employeeData.employeeName);
        }
      } catch (error) {
        console.error('Error parsing employee data:', error);
      }
    }
  }, []);

  // Handle initialView prop changes
  useEffect(() => {
    if (initialView === 'calendar') {
      setShowCalendar(true);
      setShowReports(false);
      setShowDashboard(false);
      setShowAddExtraTaskModal(false);
    } else if (initialView === 'reports') {
      setShowReports(true);
      setShowCalendar(false);
      setShowDashboard(false);
      setShowAddExtraTaskModal(false);
    } else if (initialView === 'dashboard') {
      setShowDashboard(true);
      setShowCalendar(false);
      setShowReports(false);
      setShowAddExtraTaskModal(false);
    } else if (initialView === 'addExtraTask') {
      setShowAddExtraTaskModal(true);
      setShowCalendar(false);
      setShowReports(false);
      setShowDashboard(false);
    } else {
      setShowCalendar(false);
      setShowReports(false);
      setShowDashboard(false);
      setShowAddExtraTaskModal(false);
    }
  }, [initialView]);

  useEffect(() => {
    // Load clients to check their status
    const clientsRef = ref(database, 'clients');
    const strategyClientsRef = ref(database, 'strategyClients');
    const strategyHeadClientsRef = ref(database, 'strategyHeadClients');

    let activeClientIds = new Set();
    let activeClientNames = new Set();

    // Listen to all client sources
    const unsubscribeClients = onValue(clientsRef, (snapshot) => {
      if (snapshot.exists()) {
        Object.values(snapshot.val()).forEach(client => {
          if (client.status !== 'inactive' && client.status !== 'disabled') {
            if (client.clientId) activeClientIds.add(client.clientId);
            if (client.clientName) activeClientNames.add(client.clientName);
          }
        });
      }
    });

    const unsubscribeStrategyClients = onValue(strategyClientsRef, (snapshot) => {
      if (snapshot.exists()) {
        Object.values(snapshot.val()).forEach(client => {
          if (client.status !== 'inactive' && client.status !== 'disabled') {
            if (client.clientId) activeClientIds.add(client.clientId);
            if (client.clientName) activeClientNames.add(client.clientName);
          }
        });
      }
    });

    const unsubscribeStrategyHeadClients = onValue(strategyHeadClientsRef, (snapshot) => {
      if (snapshot.exists()) {
        Object.values(snapshot.val()).forEach(client => {
          if (client.status !== 'inactive' && client.status !== 'disabled') {
            if (client.clientId) activeClientIds.add(client.clientId);
            if (client.clientName) activeClientNames.add(client.clientName);
          }
        });
      }
    });

    const tasksRef = ref(database, 'tasks');
    const unsubscribeTasks = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tasksList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(task => {
          // Filter out tasks from inactive clients
          const clientIsActive = activeClientIds.has(task.clientId) || activeClientNames.has(task.clientName);
          if (!clientIsActive && (task.clientId || task.clientName)) {
            return false;
          }
          return true;
        });
        setTasks(tasksList);
      } else {
        setTasks([]);
      }
    });

    // Also fetch clients to get client IDs for dropdown
    const clientsForDropdownRef = ref(database, 'clients');
    onValue(clientsForDropdownRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const clientsList = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(client => client.status !== 'inactive' && !client.deleted); // Hide inactive/deleted clients
        setClients(clientsList);
      } else {
        setClients([]);
      }
    });

    // Fetch employees from database
    const employeesRef = ref(database, 'employees');
    onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allEmployees = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));

        // Filter for active social media employees (exclude heads/managers)
        const employeesList = allEmployees.filter(emp => {
          const isActive = emp.status === 'active';
          const isSocialMedia = emp.department === 'social-media' ||
            emp.department === 'Social Media' ||
            emp.department === 'socialmedia' ||
            emp.department?.toLowerCase().includes('social');
          const isNotHead = emp.role !== 'head' && emp.role !== 'manager' && emp.role !== 'department-head';
          return isActive && isSocialMedia && isNotHead;
        });

        setEmployees(employeesList);

        // Security Check: functionality to ensure deleted/inactive users are logged out
        if (loggedInUserEmail && !isSuperAdmin) {
          // Skip check for hardcoded/system accounts that might not be in DB
          if (loggedInUserEmail !== 'social@gmail.com') {
            const currentUser = allEmployees.find(e => e.email === loggedInUserEmail);

            if (!currentUser || currentUser.status === 'inactive' || currentUser.status === 'disabled' || currentUser.deleted === true) {
              console.log('Current user access revoked. Logging out...');
              sessionStorage.clear();
              localStorage.clear(); // Clear all storage
              navigate('/');
            }
          }
        }
      } else {
        setEmployees([]);
      }
    });

    return () => {
      unsubscribeClients();
      unsubscribeStrategyClients();
      unsubscribeStrategyHeadClients();
      unsubscribeTasks();
    };
  }, []);

  // Handle client selection in Add Extra Task modal
  const handleClientChange = (e) => {
    const selectedClientName = e.target.value;
    const selectedClient = clients.find(c => (c.name || c.clientName) === selectedClientName);

    if (selectedClient) {
      setNewTask({
        ...newTask,
        clientName: selectedClientName,
        clientId: selectedClient.clientId || selectedClient.id || ''
      });
    } else {
      setNewTask({ ...newTask, clientName: selectedClientName, clientId: '' });
    }
  };

  // Handle Add Extra Task submission
  const handleAddExtraTask = () => {
    // Validation
    if (!newTask.clientName.trim()) {
      showToast('⚠️ Please enter client name', 'warning');
      return;
    }
    if (!newTask.ideas.trim()) {
      showToast('⚠️ Please enter ideas', 'warning');
      return;
    }
    if (!newTask.department) {
      showToast('⚠️ Please select department', 'warning');
      return;
    }

    // Create new task
    const tasksRef = ref(database, 'tasks');
    const newTaskRef = push(tasksRef);

    const taskData = {
      clientName: newTask.clientName,
      clientId: newTask.clientId || 'N/A',
      taskName: newTask.ideas,
      description: newTask.content || '',
      referenceLink: newTask.referenceLink || '',
      department: newTask.department, // 'video' or 'graphics'
      originalDepartment: newTask.department,
      taskType: newTask.taskType || 'N/A',
      postDate: newTask.postDate || new Date().toISOString(),
      deadline: newTask.postDate || new Date().toISOString(),
      status: 'assigned-to-department',
      assignedBy: 'Social Media Head',
      assignedByName: loggedInUserName || 'Social Media Manager',
      assignedTo: 'Not Assigned',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    set(newTaskRef, taskData)
      .then(() => {
        showToast(`✅ Task assigned to ${newTask.department} department successfully!`, 'success');

        // Reset form
        setNewTask({
          clientName: '',
          clientId: '',
          ideas: '',
          content: '',
          referenceLink: '',
          specialNotes: '',
          department: '',
          taskType: '',
          postDate: ''
        });
        setManualClientEntry(false);

        // Go back to main tasks view
        setShowAddExtraTaskModal(false);
        setShowDashboard(false);
        setShowReports(false);
        setShowCalendar(false);
      })
      .catch((error) => {
        console.error('Error adding task:', error);
        showToast('❌ Failed to add task', 'error');
      });
  };

  const handleMarkAsPosted = (task) => {
    setSelectedTaskForPosting(task);
    setShowAdModal(true);
    setAdType('');
    setAdCost('');
  };

  const handlePostWithoutAd = () => {
    if (!selectedTaskForPosting) return;

    const taskRef = ref(database, `tasks/${selectedTaskForPosting.id}`);
    update(taskRef, {
      status: 'posted',
      postedAt: new Date().toISOString(),
      adsRun: false
    });
    showToast('Content marked as posted!', 'success');
    setShowAdModal(false);
    setSelectedTaskForPosting(null);
  };

  const handlePostWithAd = () => {
    if (!selectedTaskForPosting) return;

    if (!adType) {
      showToast('Please select an ad type', 'warning');
      return;
    }

    if (!adCost || parseFloat(adCost) <= 0) {
      showToast('Please enter a valid ad cost', 'warning');
      return;
    }

    const taskRef = ref(database, `tasks/${selectedTaskForPosting.id}`);
    update(taskRef, {
      status: 'posted',
      postedAt: new Date().toISOString(),
      adsRun: true,
      adType: adType,
      adCost: parseFloat(adCost)
    });
    showToast(`Content posted with ${adType} ad (₹${adCost})!`, 'success');
    setShowAdModal(false);
    setSelectedTaskForPosting(null);
    setAdType('');
    setAdCost('');
  };

  const handleClientApproval = (taskId, approved, task) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    if (approved) {
      update(taskRef, {
        status: 'approved',
        clientApproved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: 'Social Media Department',
        lastUpdated: new Date().toISOString()
      });
      showToast('✅ Content approved! Ready to post on social media.', 'success', 5000);
    } else {
      // Get custom revision message or use default
      const customMessage = revisionMessages[taskId]?.trim();
      if (!customMessage) {
        showToast('⚠️ Please enter a revision message before rejecting.', 'warning', 3000);
        return;
      }

      // Send back to the employee who submitted it
      const employeeName = task.submittedBy || task.assignedTo;
      const originalDept = task.department === 'social-media' ? (task.taskName?.toLowerCase().includes('video') ? 'video' : 'graphics') : task.department;

      // Get current revision count and increment it
      const currentRevisionCount = task.revisionCount || 0;

      update(taskRef, {
        status: 'revision-required',
        department: originalDept || 'video',
        clientApproved: false,
        revisionCount: currentRevisionCount + 1,
        revisionRequestedAt: new Date().toISOString(),
        revisionRequestedBy: 'Social Media Department',
        revisionMessage: customMessage,
        lastRevisionAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });

      // Clear the message after sending
      setRevisionMessages(prev => {
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });

      showToast(`❌ Revision requested. Task sent back to ${employeeName} for rework.`, 'warning', 5000);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'posted' || status === 'approved') return <CheckCircle size={18} color="green" />;
    return <Clock size={18} color="orange" />;
  };

  const filteredTasks = tasks.filter(task => {
    // Show ALL tasks that have been assigned to departments (from Strategy)
    // This includes video, graphics, and social-media tasks
    // Status should be 'assigned-to-department', 'approved', or 'posted'
    if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;

    // Filter by month using postDate or deadline
    const taskDate = task.postDate || task.deadline;
    const monthMatch = !taskDate || taskDate.startsWith(selectedMonth);

    // Apply employee filter (for SuperAdmin)
    if (isSuperAdmin && employeeFilter && employeeFilter !== 'all') {
      const taskAssignedTo = task.socialMediaAssignedTo || task.assignedTo || '';
      if (employeeFilter === 'Social Media Head') {
        // Show tasks assigned to head or unassigned
        if (taskAssignedTo !== 'Social Media Head' && taskAssignedTo !== '') {
          return false;
        }
      } else {
        // Show tasks assigned to specific employee
        if (taskAssignedTo !== employeeFilter) {
          return false;
        }
      }
    }

    // Apply active filter from statistics cards
    let cardFilterMatch = false;
    if (activeFilter === 'all') {
      cardFilterMatch = true;
    } else if (activeFilter === 'approved') {
      cardFilterMatch = task.status === 'approved';
    } else if (activeFilter === 'posted') {
      cardFilterMatch = task.status === 'posted';
    } else {
      cardFilterMatch = task.status === activeFilter;
    }

    // Apply search filter
    const searchMatch = searchTerm === '' ||
      task.taskName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.submittedBy?.toLowerCase().includes(searchTerm.toLowerCase());

    return monthMatch && cardFilterMatch && searchMatch;
  });

  const pendingApprovals = tasks.filter(t =>
    t.status === 'pending-client-approval'
    // Show ALL departments' pending approvals
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
  };

  // Handle statistics card clicks
  const handleStatCardClick = (filterType) => {
    setActiveFilter(filterType);

    // Show toast message
    const allMonthTasks = tasks.filter(task => {
      // Show ALL tasks assigned to departments (video, graphics, social-media)
      if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;
      const taskDate = task.postDate || task.deadline;
      if (!taskDate) return true;
      return taskDate.startsWith(selectedMonth);
    });

    const filterMessages = {
      'all': `Showing all ${allMonthTasks.length} social media tasks`,
      'approved': `Showing ${allMonthTasks.filter(t => t.status === 'approved').length} ready to post tasks`,
      'posted': `Showing ${allMonthTasks.filter(t => t.status === 'posted').length} posted tasks`
    };

    showToast(filterMessages[filterType] || 'Filter applied', 'info');

    // Auto-scroll to the client cards section
    setTimeout(() => {
      const clientCardsSection = document.querySelector('.socialmedia-clients-section');
      if (clientCardsSection) {
        const yOffset = -100; // Offset for header
        const y = clientCardsSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getTasksForDay = (day) => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return tasks.filter(task => {
      // Show tasks on their POST DATE (not deadline)
      if (!task.postDate) return false;
      // Show ALL tasks assigned to departments
      if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;

      // Handle different date formats for post date
      let taskPostDate = task.postDate;

      // If date is in DD/MM/YYYY or DD-MM-YYYY format, convert to YYYY-MM-DD
      if (taskPostDate.includes('/') || (taskPostDate.includes('-') && taskPostDate.split('-')[0].length <= 2)) {
        const parts = taskPostDate.split(/[-/]/);
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          taskPostDate = `${year}-${month}-${day}`;
        }
      }

      return taskPostDate && taskPostDate.startsWith(dateStr);
    });
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'assigned': '#ffc107',
      'assigned-to-department': '#ff9800',
      'in-progress': '#2196f3',
      'completed': '#4caf50',
      'pending-client-approval': '#ff9800',
      'approved': '#8bc34a',
      'posted': '#00bcd4',
      'revision-required': '#f44336'
    };
    return statusColors[status] || '#9e9e9e';
  };

  const handlePreviousMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    setSelectedCalendarDay(null);
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
    setSelectedCalendarDay(null);
  };

  // Handle individual task selection
  const handleTaskSelect = (taskId) => {
    const newSelectedTasks = new Set(selectedTasks);
    if (newSelectedTasks.has(taskId)) {
      newSelectedTasks.delete(taskId);
    } else {
      newSelectedTasks.add(taskId);
    }
    setSelectedTasks(newSelectedTasks);
  };

  // Handle client selection (select all tasks for that client)
  const handleClientSelect = (clientTasks) => {
    const newSelectedTasks = new Set(selectedTasks);
    const clientTaskIds = clientTasks.map(t => t.id);

    // Check if all tasks of this client are selected
    const allSelected = clientTaskIds.every(id => newSelectedTasks.has(id));

    if (allSelected) {
      // Deselect all tasks of this client
      clientTaskIds.forEach(id => newSelectedTasks.delete(id));
    } else {
      // Select all tasks of this client
      clientTaskIds.forEach(id => newSelectedTasks.add(id));
    }

    setSelectedTasks(newSelectedTasks);
  };

  // Check if all tasks of a client are selected
  const isClientFullySelected = (clientTasks) => {
    return clientTasks.every(task => selectedTasks.has(task.id));
  };

  // Check if some (but not all) tasks of a client are selected
  const isClientPartiallySelected = (clientTasks) => {
    const selectedCount = clientTasks.filter(task => selectedTasks.has(task.id)).length;
    return selectedCount > 0 && selectedCount < clientTasks.length;
  };

  // Download client report as PDF
  const handleDownloadReport = () => {
    try {
      // Get filtered tasks (excluding pending-client-approval)
      const allTasks = filteredTasks.filter(t => t.status !== 'pending-client-approval');

      // If no tasks selected, download ALL tasks; otherwise download only selected
      const selectedTasksData = selectedTasks.size === 0
        ? allTasks
        : allTasks.filter(task => selectedTasks.has(task.id));

      if (selectedTasksData.length === 0) {
        showToast('⚠️ No tasks to download', 'warning', 3000);
        return;
      }

      // Group selected tasks by client
      const groupedByClient = {};
      selectedTasksData.forEach(task => {
        const clientName = task.clientName || 'Unknown Client';
        if (!groupedByClient[clientName]) {
          groupedByClient[clientName] = {
            clientName,
            clientId: task.clientId || 'N/A',
            tasks: []
          };
        }
        groupedByClient[clientName].tasks.push(task);
      });

      // Create PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(29, 209, 161);
      doc.text('Social Media Tasks Report', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Report Period: ' + selectedMonth, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 5;
      doc.text('Generated: ' + new Date().toLocaleDateString(), pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 12;

      // Add each client's tasks
      Object.values(groupedByClient).forEach((clientGroup) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        // Client header
        doc.setFillColor(29, 209, 161);
        doc.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(clientGroup.clientName + ' (' + clientGroup.clientId + ')', 18, yPosition + 2);

        yPosition += 10;

        // Task count
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Total Tasks: ' + clientGroup.tasks.length, 18, yPosition);
        yPosition += 8;

        // Tasks table using autoTable with ALL fields
        const tableData = clientGroup.tasks.map(task => {
          // Get post time
          let postTime = 'Not posted yet';
          if (task.status === 'posted' && task.postedAt) {
            try {
              postTime = new Date(task.postedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
            } catch (e) {
              postTime = 'Not posted yet';
            }
          }

          // Get ads run info
          let adsRun = 'No';
          if (task.adsRun && task.adType) {
            adsRun = `${task.adType} (₹${task.adCost || 0})`;
          }

          return [
            (task.taskName || 'N/A').substring(0, 35),
            (task.originalDepartment || task.department || 'N/A').toUpperCase(),
            (task.taskType || 'N/A').substring(0, 15),
            task.postDate || 'N/A',
            postTime,
            (task.socialMediaAssignedTo || 'Not assigned').substring(0, 20),
            adsRun.substring(0, 25),
            (task.status || '').replace(/-/g, ' ').toUpperCase().substring(0, 20)
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [['Task Name', 'Dept', 'Type', 'Post Date', 'Post Time', 'Assigned To', 'Ads Run', 'Status']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [85, 239, 196],
            textColor: 50,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          },
          bodyStyles: {
            fontSize: 7,
            textColor: 50,
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          styles: {
            cellPadding: 2,
            overflow: 'linebreak',
            cellWidth: 'wrap'
          },
          columnStyles: {
            0: { cellWidth: 35, halign: 'left' },
            1: { cellWidth: 18 },
            2: { cellWidth: 20 },
            3: { cellWidth: 22 },
            4: { cellWidth: 22 },
            5: { cellWidth: 25 },
            6: { cellWidth: 25 },
            7: { cellWidth: 23 }
          },
          margin: { left: 10, right: 10 },
          didDrawPage: function (data) {
            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
              'Page ' + doc.internal.getCurrentPageInfo().pageNumber,
              pageWidth / 2,
              pageHeight - 10,
              { align: 'center' }
            );
          }
        });

        yPosition = doc.lastAutoTable.finalY + 12;
      });

      // Save PDF
      const filename = 'social-media-report-' + selectedMonth + '-' + Date.now() + '.pdf';
      doc.save(filename);

      const message = selectedTasks.size > 0
        ? '✅ PDF report downloaded for ' + selectedTasks.size + ' selected task(s)!'
        : '✅ PDF report downloaded for all tasks!';
      showToast(message, 'success', 3000);
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('PDF Error:', error);
      showToast('❌ Failed to generate PDF: ' + (error.message || 'Unknown error'), 'error', 5000);
    }
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(calendarDate);
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    dayNames.forEach(name => {
      days.push(
        <div key={`day-name-${name}`} className="calendar-day-name">
          {name}
        </div>
      );
    });

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayTasks = getTasksForDay(day);
      const isToday = isCurrentMonth && today.getDate() === day;
      const isSelected = selectedCalendarDay === day;
      const hasTasks = dayTasks.length > 0;

      days.push(
        <div
          key={`day-${day}`}
          className={`calendar-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => {
            if (hasTasks) {
              setSelectedCalendarDay(day);
              setShowDayModal(true);
            }
          }}
        >
          <div className="day-number">{day}</div>
          {hasTasks && (
            <div className="task-indicators">
              {dayTasks.slice(0, 3).map((task, idx) => (
                <div
                  key={idx}
                  className="task-indicator"
                  style={{ backgroundColor: getStatusColor(task.status) }}
                  title={task.taskName}
                ></div>
              ))}
              {dayTasks.length > 3 && (
                <div className="task-count">+{dayTasks.length - 3}</div>
              )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const renderTaskCard = (task) => (
    <div key={task.id} className="workflow-card">
      <div className="card-top">
        <h4>{task.taskName}</h4>
        {getStatusIcon(task.status)}
      </div>
      <p className="task-project">{task.projectName}</p>
      <p className="task-client">Client: {task.clientName}</p>
      <p className="task-deadline">Due: {new Date(task.deadline).toLocaleDateString()}</p>
      <span className={`status-badge ${task.status}`}>{task.status.replace(/-/g, ' ')}</span>

      <div className="card-actions">
        {task.status !== 'posted' && (
          <button
            onClick={() => handleMarkAsPosted(task)}
            className="btn-small btn-success"
          >
            ✅ Mark as Posted
          </button>
        )}
        {task.status === 'posted' && (
          <span className="posted-label">✓ Posted</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="socialmedia-dashboard">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar Navigation */}
      <div className="socialmedia-sidebar">
        <div className="socialmedia-sidebar-header">
          <div className="socialmedia-sidebar-logo">
            <div className="socialmedia-sidebar-logo-icon">
              <Share2 size={24} />
            </div>
            <div className="socialmedia-sidebar-logo-text">
              <h2>Social Media</h2>
              <p>Department</p>
            </div>
          </div>
        </div>

        <nav className="socialmedia-sidebar-nav">
          <div className="socialmedia-sidebar-section">
            <h3 className="socialmedia-sidebar-section-title">Main</h3>
            <ul className="socialmedia-sidebar-menu">
              <li className="socialmedia-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowDashboard(true);
                    setShowReports(false);
                    setShowCalendar(false);
                    setShowAddExtraTaskModal(false);
                  }}
                  className={`socialmedia-sidebar-menu-link ${showDashboard ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showDashboard ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="socialmedia-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  Dashboard
                </button>
              </li>
              <li className="socialmedia-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowDashboard(false);
                    setShowReports(false);
                    setShowCalendar(false);
                    setShowAddExtraTaskModal(false);
                  }}
                  className={`socialmedia-sidebar-menu-link ${!showDashboard && !showReports && !showCalendar ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: !showDashboard && !showReports && !showCalendar ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="socialmedia-sidebar-menu-icon">
                    <LayoutDashboard size={20} />
                  </div>
                  MY Task
                </button>
              </li>
              <li className="socialmedia-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowCalendar(!showCalendar);
                    setShowReports(false);
                    setShowDashboard(false);
                    setShowAddExtraTaskModal(false);
                  }}
                  className={`socialmedia-sidebar-menu-link ${showCalendar ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showCalendar ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="socialmedia-sidebar-menu-icon">
                    <Calendar size={20} />
                  </div>
                  {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
                </button>
              </li>
              <li className="socialmedia-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowAddExtraTaskModal(true);
                    setShowDashboard(false);
                    setShowReports(false);
                    setShowCalendar(false);
                  }}
                  className={`socialmedia-sidebar-menu-link ${showAddExtraTaskModal ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showAddExtraTaskModal ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="socialmedia-sidebar-menu-icon">
                    <Plus size={20} />
                  </div>
                  Assign Extra Task
                </button>
              </li>
              <li className="socialmedia-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowReports(!showReports);
                    setShowDashboard(false);
                    setShowAddExtraTaskModal(false);
                    if (!showReports) {
                      setShowCalendar(false);
                    }
                  }}
                  className={`socialmedia-sidebar-menu-link ${showReports ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showReports ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="socialmedia-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  Reports
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="socialmedia-sidebar-user">
          <div className="socialmedia-sidebar-user-info">
            <div className="socialmedia-sidebar-user-avatar">
              {loggedInUserName ? loggedInUserName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="socialmedia-sidebar-user-details">
              <h4>{loggedInUserName || 'Social Media Manager'}</h4>
              <p>{loggedInUserEmail || 'socialmedia@gmail.com'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="socialmedia-btn socialmedia-btn-logout" style={{ marginTop: '12px', width: '100%' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="socialmedia-main-content">
        {/* Page Header - Hidden when Reports is active */}
        {!showReports && (
          <>
            <div className="socialmedia-header">
              <div className="socialmedia-header-content">
                <div className="socialmedia-header-left">
                  <div className="socialmedia-header-title">
                    <h1>Social Media Department Dashboard</h1>
                    <p>Post approved content on social media platforms</p>
                  </div>
                </div>
                <div className="socialmedia-header-right">
                  <div className="socialmedia-breadcrumb">
                    <span>Dashboard</span>
                    <span className="socialmedia-breadcrumb-separator">/</span>
                    <span>Social Media</span>
                  </div>
                  <div className="socialmedia-filter-group" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '8px',
                    padding: '8px 16px',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <Calendar size={18} />
                    <label style={{ fontSize: '14px', fontWeight: '500' }}>Month:</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Add Extra Task Form - Show when Assign Extra Task is clicked */}
            {showAddExtraTaskModal && (
              <div style={{
                padding: '0 24px 24px 24px'
              }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  {/* Form Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #37B46F 0%, #2d9459 100%)',
                    padding: '24px',
                    color: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Assign Extra Task</h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>Create task for video or graphics department</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowAddExtraTaskModal(false);
                          setShowDashboard(true);
                          setNewTask({
                            clientName: '',
                            clientId: '',
                            ideas: '',
                            content: '',
                            referenceLink: '',
                            department: '',
                            taskType: '',
                            postDate: ''
                          });
                          setManualClientEntry(false);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          border: 'none',
                          color: 'white',
                          fontSize: '24px',
                          cursor: 'pointer',
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Form Body */}
                  <div style={{ padding: '24px' }}>
                    {/* Manual Client Entry Checkbox */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        <input
                          type="checkbox"
                          checked={manualClientEntry}
                          onChange={(e) => {
                            setManualClientEntry(e.target.checked);
                            if (e.target.checked) {
                              setNewTask({ ...newTask, clientName: '', clientId: '' });
                            }
                          }}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        Enter client name manually
                      </label>
                    </div>

                    {/* Client Selection */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Select Client <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      {manualClientEntry ? (
                        <input
                          type="text"
                          value={newTask.clientName}
                          onChange={(e) => setNewTask({ ...newTask, clientName: e.target.value })}
                          placeholder="Enter client name"
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      ) : (
                        <select
                          value={newTask.clientName}
                          onChange={handleClientChange}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">-- Select Client --</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.name || client.clientName}>
                              {client.name || client.clientName} ({client.clientId || client.id})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Client ID */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={newTask.clientId}
                        onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value })}
                        placeholder="Client ID"
                        disabled={!manualClientEntry}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          backgroundColor: manualClientEntry ? 'white' : '#f3f4f6',
                          cursor: manualClientEntry ? 'text' : 'not-allowed'
                        }}
                      />
                    </div>

                    {/* Ideas */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Ideas <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={newTask.ideas}
                        onChange={(e) => setNewTask({ ...newTask, ideas: e.target.value })}
                        placeholder="Enter ideas"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Content
                      </label>
                      <textarea
                        value={newTask.content}
                        onChange={(e) => setNewTask({ ...newTask, content: e.target.value })}
                        placeholder="Enter content"
                        rows="4"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    {/* Reference Link */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Reference Link
                      </label>
                      <input
                        type="url"
                        value={newTask.referenceLink}
                        onChange={(e) => setNewTask({ ...newTask, referenceLink: e.target.value })}
                        placeholder="Enter reference link (e.g., https://example.com)"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Special Notes */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Special Notes
                      </label>
                      <textarea
                        value={newTask.specialNotes}
                        onChange={(e) => setNewTask({ ...newTask, specialNotes: e.target.value })}
                        placeholder="Enter special notes or additional instructions"
                        rows="4"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    {/* Assign to Department */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Assign to Department <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={newTask.department}
                        onChange={(e) => setNewTask({ ...newTask, department: e.target.value, taskType: '' })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          cursor: 'pointer',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="">-- Select department --</option>
                        <option value="video">Video Department</option>
                        <option value="graphics">Graphics Department</option>
                      </select>
                    </div>

                    {/* Task Type - Shows after department is selected */}
                    {newTask.department && (
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          Task Type <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={newTask.taskType}
                          onChange={(e) => setNewTask({ ...newTask, taskType: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">-- Select task type --</option>
                          {newTask.department === 'video' && (
                            <>
                              <option value="long-video">Long Video</option>
                              <option value="reel">Reel</option>
                            </>
                          )}
                          {newTask.department === 'graphics' && (
                            <>
                              <option value="festival-creative">Festival Creative</option>
                              <option value="business-creative">Business Creative</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}

                    {/* Post Date */}
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        Post Date <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={newTask.postDate}
                        onChange={(e) => setNewTask({ ...newTask, postDate: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={handleAddExtraTask}
                        style={{
                          flex: 1,
                          padding: '14px',
                          background: 'linear-gradient(135deg, #37B46F 0%, #2d9459 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        Assign Extra Task
                      </button>
                      <button
                        onClick={() => {
                          setShowAddExtraTaskModal(false);
                          setShowDashboard(true);
                          setNewTask({
                            clientName: '',
                            clientId: '',
                            ideas: '',
                            content: '',
                            referenceLink: '',
                            department: '',
                            taskType: '',
                            postDate: ''
                          });
                          setManualClientEntry(false);
                        }}
                        style={{
                          flex: 1,
                          padding: '14px',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Statistics Cards - Show only in Dashboard view */}
            {showDashboard && (() => {
              const allMonthTasks = tasks.filter(task => {
                // Show ALL tasks assigned to departments (video, graphics, social-media)
                if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;
                const taskDate = task.postDate || task.deadline;
                if (!taskDate) return true;
                return taskDate.startsWith(selectedMonth);
              });

              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '24px',
                  marginBottom: '32px'
                }}>
                  {/* Total Tasks */}
                  <div
                    onClick={() => handleStatCardClick('all')}
                    style={{
                      borderRadius: '16px',
                      padding: '32px 24px',
                      background: activeFilter === 'all'
                        ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: activeFilter === 'all'
                        ? '0 8px 20px rgba(102,126,234,0.4)'
                        : '0 4px 12px rgba(102,126,234,0.2)',
                      transform: activeFilter === 'all' ? 'translateY(-2px)' : 'translateY(0)',
                      border: activeFilter === 'all' ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (activeFilter !== 'all') {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeFilter !== 'all') {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.2)';
                      }
                    }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '700', lineHeight: 1 }}>
                      {allMonthTasks.length}
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', opacity: 0.9 }}>
                      Total Tasks
                    </p>
                    <small style={{ display: 'block', marginTop: '8px', fontSize: '12px', opacity: 0.8, fontWeight: '500' }}>
                      📊 Tasks for selected month
                    </small>
                    {activeFilter === 'all' && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px'
                      }}>
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Ready to Post (Approved) Tasks */}
                  <div
                    onClick={() => handleStatCardClick('approved')}
                    style={{
                      borderRadius: '16px',
                      padding: '32px 24px',
                      background: activeFilter === 'approved'
                        ? 'linear-gradient(135deg, #4a9625 0%, #96d9b8 100%)'
                        : 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: activeFilter === 'approved'
                        ? '0 8px 20px rgba(86,171,47,0.4)'
                        : '0 4px 12px rgba(86,171,47,0.2)',
                      transform: activeFilter === 'approved' ? 'translateY(-2px)' : 'translateY(0)',
                      border: activeFilter === 'approved' ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (activeFilter !== 'approved') {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeFilter !== 'approved') {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(86,171,47,0.2)';
                      }
                    }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '700', lineHeight: 1 }}>
                      {allMonthTasks.filter(t => t.status === 'approved').length}
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', opacity: 0.9 }}>
                      Ready to Post
                    </p>
                    <small style={{ display: 'block', marginTop: '8px', fontSize: '12px', opacity: 0.8, fontWeight: '500' }}>
                      ✅ Approved and ready
                    </small>
                    {activeFilter === 'approved' && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px'
                      }}>
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Posted Tasks */}
                  <div
                    onClick={() => handleStatCardClick('posted')}
                    style={{
                      borderRadius: '16px',
                      padding: '32px 24px',
                      background: activeFilter === 'posted'
                        ? 'linear-gradient(135deg, #17b584 0%, #4dd9b2 100%)'
                        : 'linear-gradient(135deg, #37B46F 0%, #55efc4 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: activeFilter === 'posted'
                        ? '0 8px 20px rgba(0,184,148,0.4)'
                        : '0 4px 12px rgba(0,184,148,0.2)',
                      transform: activeFilter === 'posted' ? 'translateY(-2px)' : 'translateY(0)',
                      border: activeFilter === 'posted' ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (activeFilter !== 'posted') {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeFilter !== 'posted') {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,184,148,0.2)';
                      }
                    }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '700', lineHeight: 1 }}>
                      {allMonthTasks.filter(t => t.status === 'posted').length}
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', opacity: 0.9 }}>
                      Posted
                    </p>
                    <small style={{ display: 'block', marginTop: '8px', fontSize: '12px', opacity: 0.8, fontWeight: '500' }}>
                      📤 Published on social media
                    </small>
                    {activeFilter === 'posted' && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px'
                      }}>
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Completion Rate */}
                  <div
                    style={{
                      borderRadius: '16px',
                      padding: '32px 24px',
                      background: 'linear-gradient(135deg, #e91e63 0%, #f48fb1 100%)',
                      color: 'white',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(233,30,99,0.2)',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 10px 25px rgba(233,30,99,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(233,30,99,0.2)';
                    }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '700', lineHeight: 1 }}>
                      {allMonthTasks.filter(t => t.status === 'approved').length > 0 ?
                        Math.round((allMonthTasks.filter(t => t.status === 'posted').length / allMonthTasks.filter(t => t.status === 'approved' || t.status === 'posted').length) * 100) : 0}%
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', opacity: 0.9 }}>
                      Completion Rate
                    </p>
                    <small style={{ display: 'block', marginTop: '8px', fontSize: '12px', opacity: 0.8, fontWeight: '500' }}>
                      📈 Posted vs approved ratio
                    </small>
                  </div>
                </div>
              );
            })()}

            {/* Daily Report and Weekly Summary Cards - Show only in Dashboard view */}
            {showDashboard && (() => {
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0];

              // Get current week range
              const currentDay = today.getDay();
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - currentDay);
              weekStart.setHours(0, 0, 0, 0);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              weekEnd.setHours(23, 59, 59, 999);

              // Filter tasks for today
              const todayTasks = tasks.filter(task => {
                const taskDate = task.postDate || task.deadline;
                return taskDate && taskDate.startsWith(todayStr);
              });

              // Filter tasks for current week
              const weekTasks = tasks.filter(task => {
                const taskDate = task.postDate || task.deadline;
                if (!taskDate) return false;
                const taskDateTime = new Date(taskDate);
                return taskDateTime >= weekStart && taskDateTime <= weekEnd;
              });

              // Calculate today's stats
              const todayCompleted = todayTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
              const todayInProgress = todayTasks.filter(t => t.status === 'assigned-to-department' || t.status === 'in-progress').length;
              const todaySuccessRate = todayTasks.length > 0 ? Math.round((todayCompleted / todayTasks.length) * 100) : 0;

              // Calculate week's stats
              const weekCompleted = weekTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
              const weekOverdue = weekTasks.filter(t => {
                const deadline = t.deadline || t.postDate;
                if (!deadline) return false;
                const deadlineDate = new Date(deadline);
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                return deadlineDate < todayStart && t.status !== 'completed' && t.status !== 'posted' && t.status !== 'approved';
              }).length;
              const weekEfficiency = weekTasks.length > 0 ? Math.round((weekCompleted / weekTasks.length) * 100) : 0;

              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
                  gap: '24px',
                  marginBottom: '32px'
                }}>
                  {/* Daily Report Card */}
                  <div style={{
                    borderRadius: '20px',
                    padding: '32px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
                    transition: 'all 0.3s ease'
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.25)';
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px'
                        }}>
                          📊
                        </div>
                        <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Daily Report</h3>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        📈 Graphics
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '20px'
                    }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>
                        {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '16px',
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{todayTasks.length}</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>Today's Tasks</div>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{todayCompleted}</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>Completed</div>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{todayInProgress}</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>In Progress</div>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{todaySuccessRate}%</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>Success Rate</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowDashboard(false);
                        setShowReports(false);
                        setShowCalendar(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                      }}
                    >
                      👁️ View Today's Tasks
                    </button>
                  </div>

                  {/* Weekly Summary Card */}
                  <div style={{
                    borderRadius: '20px',
                    padding: '32px',
                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                    color: 'white',
                    boxShadow: '0 8px 24px rgba(17, 153, 142, 0.25)',
                    transition: 'all 0.3s ease'
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(17, 153, 142, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(17, 153, 142, 0.25)';
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px'
                        }}>
                          📅
                        </div>
                        <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Weekly Summary</h3>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        This Week
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '20px'
                    }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>
                        {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '16px',
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{weekTasks.length}</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>Weekly Tasks</div>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{weekCompleted}</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>Completed</div>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{weekOverdue}</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>Overdue</div>
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>{weekEfficiency}%</div>
                        <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>My Efficiency</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowDashboard(false);
                        setShowReports(false);
                        setShowCalendar(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                      }}
                    >
                      📋 View All Tasks
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Calendar View */}
            {showCalendar && (
              <div className="card full-width">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={24} />
                    <h2>📅 Social Media Posting Calendar</h2>
                  </div>
                  <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>Tasks shown on their post dates</p>
                </div>

                <div className="calendar-container">
                  <div className="calendar-navigation">
                    <button onClick={handlePreviousMonth} className="nav-btn">
                      <ChevronLeft size={20} />
                    </button>
                    <h3 className="current-month">
                      {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={handleNextMonth} className="nav-btn">
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  <div className="calendar-grid">
                    {renderCalendar()}
                  </div>

                </div>
              </div>
            )}

            {/* Only show tasks sections when calendar is NOT shown and Reports is NOT shown and Add Extra Task is NOT shown */}
            {!showCalendar && !showReports && !showDashboard && !showAddExtraTaskModal && (
              <div className="dashboard-grid">
                {/* Pending Client Approvals Section */}
                {pendingApprovals.length > 0 && (
                  <div className="card full-width" style={{ marginBottom: '30px' }}>
                    <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                          <h2>⏳ Pending Client Approvals</h2>
                          <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>Review and approve content before posting</p>
                        </div>
                        <div style={{
                          backgroundColor: '#ff6b35',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          {pendingApprovals.length} Pending
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '20px' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                        gap: '16px'
                      }}>
                        {pendingApprovals.map(task => (
                          <div key={task.id} style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                            border: '1px solid #e9ecef',
                            transition: 'all 0.3s ease'
                          }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                            }}
                          >
                            {/* Header with gradient */}
                            <div style={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              padding: '16px',
                              color: 'white'
                            }}>
                              <h4 style={{
                                margin: '0 0 8px 0',
                                fontSize: '16px',
                                fontWeight: '600',
                                lineHeight: '1.3'
                              }}>
                                {task.taskName}
                              </h4>
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '12px',
                                fontSize: '13px',
                                opacity: 0.9
                              }}>
                                <span>👤 {task.clientName}</span>
                                <span>📝 {task.socialMediaAssignedTo || 'Unassigned'}</span>
                                {task.deadline && <span>📅 {new Date(task.deadline).toLocaleDateString()}</span>}
                              </div>
                            </div>

                            {/* Content */}
                            <div style={{ padding: '16px' }}>
                              {/* Quick Info */}
                              {task.postDate && (
                                <div style={{
                                  backgroundColor: '#e3f2fd',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  marginBottom: '12px',
                                  fontSize: '13px',
                                  color: '#1976d2',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  📍 Post Date: {new Date(task.postDate).toLocaleDateString()}
                                </div>
                              )}

                              {/* Revision Input */}
                              <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                  display: 'block',
                                  marginBottom: '8px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#495057'
                                }}>
                                  💬 Revision Notes (Required for rejection)
                                </label>
                                <textarea
                                  value={revisionMessages[task.id] || ''}
                                  onChange={(e) => setRevisionMessages(prev => ({
                                    ...prev,
                                    [task.id]: e.target.value
                                  }))}
                                  placeholder="Enter specific feedback or changes needed..."
                                  rows={2}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '2px solid #e9ecef',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    outline: 'none',
                                    transition: 'all 0.2s ease',
                                    boxSizing: 'border-box'
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = '#667eea';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = '#e9ecef';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                />
                              </div>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleClientApproval(task.id, true, task)}
                                  style={{
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(40, 167, 69, 0.3)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.transform = 'translateY(-1px)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.3)';
                                  }}
                                >
                                  <CheckCircle size={16} /> Approve
                                </button>
                                <button
                                  onClick={() => handleClientApproval(task.id, false, task)}
                                  style={{
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.transform = 'translateY(-1px)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.3)';
                                  }}
                                >
                                  <XCircle size={16} /> Request Revision
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="card full-width" style={{ marginBottom: '30px' }}>
                  <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
                      <div>
                        <h2>📱 Social Media Tasks</h2>
                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>Post approved content on social media platforms</p>
                      </div>
                    </div>

                    {/* View Toggle and Search Bar */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', marginTop: '12px', flexWrap: 'wrap' }}>
                      {/* View Mode Toggle */}
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        backgroundColor: '#f3f4f6',
                        padding: '4px',
                        borderRadius: '8px'
                      }}>
                        <button
                          onClick={() => {
                            setViewMode('list');
                            setSelectedClientForCardView(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: viewMode === 'list' ? '#3b82f6' : 'transparent',
                            color: viewMode === 'list' ? 'white' : '#6b7280',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                        >
                          <LayoutDashboard size={16} /> List View
                        </button>
                        <button
                          onClick={() => {
                            setViewMode('card');
                            setSelectedClientForCardView(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: viewMode === 'card' ? '#3b82f6' : 'transparent',
                            color: viewMode === 'card' ? 'white' : '#6b7280',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Share2 size={16} /> Card View
                        </button>
                      </div>

                      {/* Search Bar */}
                      <input
                        type="text"
                        placeholder="🔍 Search by task name, client, project, or team member..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '300px',
                          padding: '12px 16px',
                          fontSize: '14px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s ease',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#667eea';
                          e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e5e7eb';
                          e.target.style.boxShadow = 'none';
                        }}
                      />

                      {/* Download PDF Button */}
                      <button
                        onClick={handleDownloadReport}
                        style={{
                          padding: '10px 20px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                        }}
                      >
                        <Download size={18} />
                        {selectedTasks.size > 0 ? `Download Report (${selectedTasks.size})` : 'Download All'}
                      </button>

                      {searchTerm && (
                        <div style={{
                          marginTop: '8px',
                          fontSize: '13px',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>Found {filteredTasks.filter(t => t.status !== 'pending-client-approval').length} task(s)</span>
                          <button
                            onClick={() => setSearchTerm('')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#667eea',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              padding: '0',
                              textDecoration: 'underline'
                            }}
                          >
                            Clear search
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', padding: '20px' }}>
                    {filteredTasks.filter(t => t.status !== 'pending-client-approval').length === 0 ? (
                      <div className="empty-state">
                        <p>No tasks in Social Media department for this month</p>
                      </div>
                    ) : viewMode === 'card' ? (
                      /* Card View */
                      selectedClientForCardView ? (
                        /* Show tasks for selected client */
                        <div>
                          <button
                            onClick={() => setSelectedClientForCardView(null)}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '20px'
                            }}
                          >
                            ← Back to All Clients
                          </button>

                          {/* Client Header */}
                          <div style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            overflow: 'hidden',
                            marginBottom: '20px'
                          }}>
                            <div style={{
                              padding: '12px 20px',
                              background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                              color: 'white',
                              textAlign: 'center'
                            }}>
                              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                {selectedClientForCardView}
                              </h3>
                              <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                                {Object.entries(groupTasksByClient(filteredTasks.filter(t => t.status !== 'pending-client-approval'))).find(([name]) => name === selectedClientForCardView)?.[1]?.length || 0} task(s)
                              </p>
                            </div>
                          </div>

                          {/* Task Cards Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '20px'
                          }}>
                            {(Object.entries(groupTasksByClient(filteredTasks.filter(t => t.status !== 'pending-client-approval'))).find(([name]) => name === selectedClientForCardView)?.[1] || []).map(task => {
                              const clientInitial = (task.clientName || 'U').charAt(0).toUpperCase();
                              const getStatusColor = (status) => {
                                switch (status) {
                                  case 'approved': return '#10b981';
                                  case 'posted': return '#06b6d4';
                                  default: return '#6b7280';
                                }
                              };

                              return (
                                <div
                                  key={task.id}
                                  style={{
                                    backgroundColor: 'white',
                                    borderRadius: '10px',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                                    overflow: 'hidden',
                                    border: '1px solid #e9ecef',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%'
                                  }}
                                >
                                  {/* Card Header with Gradient */}
                                  <div style={{
                                    background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                                    padding: '16px 18px',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    position: 'relative'
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedTasks.has(task.id)}
                                      onChange={() => handleTaskSelect(task.id)}
                                      style={{
                                        cursor: 'pointer',
                                        width: '18px',
                                        height: '18px',
                                        flexShrink: 0
                                      }}
                                    />
                                    <div style={{
                                      width: '45px',
                                      height: '45px',
                                      borderRadius: '50%',
                                      backgroundColor: 'rgba(255,255,255,0.3)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '18px',
                                      fontWeight: '700',
                                      flexShrink: 0
                                    }}>
                                      {clientInitial}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.taskName}
                                      </div>
                                      <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                        {task.clientName}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card Body */}
                                  <div style={{ padding: '16px', backgroundColor: 'white', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    {/* Project and Due Date */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px', fontWeight: '500' }}>Project</div>
                                        <div style={{
                                          padding: '7px 10px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          backgroundColor: '#e3f2fd',
                                          color: '#1976d2',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {task.projectName || 'N/A'}
                                        </div>
                                      </div>

                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px', fontWeight: '500' }}>Due Date</div>
                                        <div style={{
                                          padding: '7px 10px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          backgroundColor: '#fee2e2',
                                          color: '#dc2626'
                                        }}>
                                          {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not set'}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Department */}
                                    <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px', fontWeight: '500' }}>Department:</div>
                                      <div style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        backgroundColor: '#00b894',
                                        color: 'white',
                                        textTransform: 'uppercase'
                                      }}>
                                        SOCIAL-MEDIA
                                      </div>
                                    </div>

                                    {/* Assigned To */}
                                    <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px', fontWeight: '500' }}>Assigned To:</div>
                                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                                        {task.socialMediaAssignedTo || 'Unassigned'}
                                      </div>
                                    </div>

                                    {/* Status */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', whiteSpace: 'nowrap' }}>Status:</div>
                                      <div style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        backgroundColor: getStatusColor(task.status),
                                        color: 'white',
                                        textAlign: 'center',
                                        textTransform: 'capitalize'
                                      }}>
                                        {task.status === 'approved' ? 'Approved' :
                                          task.status === 'posted' ? 'Posted' :
                                            task.status === 'assigned-to-department' ? 'Assigned' :
                                              task.status.replace(/-/g, ' ')}
                                      </div>
                                    </div>

                                    {/* Mark as Posted Button */}
                                    {(task.status === 'approved' || task.status === 'posted') && (
                                      <div style={{ marginTop: 'auto' }}>
                                        <button
                                          onClick={() => {
                                            if (task.status === 'approved') {
                                              const taskRef = ref(database, `tasks/${task.id}`);
                                              update(taskRef, {
                                                status: 'posted',
                                                postedAt: new Date().toISOString(),
                                                lastUpdated: new Date().toISOString()
                                              });
                                              showToast('✅ Task marked as posted!', 'success');
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '10px 16px',
                                            backgroundColor: task.status === 'posted' ? '#0891b2' : '#06b6d4',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: task.status === 'posted' ? 'default' : 'pointer',
                                            transition: 'all 0.2s',
                                            opacity: task.status === 'posted' ? 0.8 : 1
                                          }}
                                          onMouseEnter={(e) => {
                                            if (task.status === 'approved') {
                                              e.target.style.backgroundColor = '#0891b2';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (task.status === 'approved') {
                                              e.target.style.backgroundColor = '#06b6d4';
                                            }
                                          }}
                                          disabled={task.status === 'posted'}
                                        >
                                          {task.status === 'posted' ? '✓ Posted' : 'Mark as Posted'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Show client cards */
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                          gap: '20px'
                        }}>
                          {Object.entries(groupTasksByClient(filteredTasks.filter(t => t.status !== 'pending-client-approval'))).map(([clientName, clientTasks]) => {
                            const clientInitial = (clientName || 'U').charAt(0).toUpperCase();
                            const totalTasks = clientTasks.length;
                            const completedTasks = clientTasks.filter(t => t.status === 'posted').length;
                            const inProgressTasks = clientTasks.filter(t => t.status === 'approved').length;

                            return (
                              <div
                                key={clientName}
                                style={{
                                  backgroundColor: 'white',
                                  borderRadius: '16px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                  overflow: 'hidden',
                                  border: '1px solid #e9ecef',
                                  transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-4px)';
                                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                                }}
                              >
                                {/* Client Header */}
                                <div style={{
                                  background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                                  padding: '24px 20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '16px'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={isClientFullySelected(clientTasks)}
                                    ref={(el) => {
                                      if (el) {
                                        el.indeterminate = isClientPartiallySelected(clientTasks);
                                      }
                                    }}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleClientSelect(clientTasks);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ cursor: 'pointer', width: '18px', height: '18px', flexShrink: 0 }}
                                  />
                                  <div
                                    onClick={() => setSelectedClientForCardView(clientName)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '16px',
                                      flex: 1,
                                      minWidth: 0,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <div style={{
                                      width: '60px',
                                      height: '60px',
                                      borderRadius: '50%',
                                      background: 'rgba(255,255,255,0.3)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '24px',
                                      fontWeight: '700',
                                      color: 'white',
                                      flexShrink: 0
                                    }}>
                                      {clientInitial}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <h3 style={{
                                        margin: 0,
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: 'white',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}>
                                        {clientName}
                                      </h3>
                                      <p style={{
                                        margin: '4px 0 0 0',
                                        fontSize: '13px',
                                        color: 'rgba(255,255,255,0.9)'
                                      }}>
                                        {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Task Stats */}
                                <div style={{
                                  padding: '20px',
                                  display: 'flex',
                                  justifyContent: 'space-around',
                                  gap: '12px'
                                }}>
                                  <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{
                                      fontSize: '28px',
                                      fontWeight: '700',
                                      color: '#667eea',
                                      marginBottom: '4px'
                                    }}>
                                      {totalTasks}
                                    </div>
                                    <div style={{
                                      fontSize: '12px',
                                      color: '#6b7280',
                                      fontWeight: '500'
                                    }}>
                                      Total Tasks
                                    </div>
                                  </div>

                                  <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{
                                      fontSize: '28px',
                                      fontWeight: '700',
                                      color: '#10b981',
                                      marginBottom: '4px'
                                    }}>
                                      {completedTasks}
                                    </div>
                                    <div style={{
                                      fontSize: '12px',
                                      color: '#6b7280',
                                      fontWeight: '500'
                                    }}>
                                      Completed
                                    </div>
                                  </div>

                                  <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{
                                      fontSize: '28px',
                                      fontWeight: '700',
                                      color: '#f59e0b',
                                      marginBottom: '4px'
                                    }}>
                                      {inProgressTasks}
                                    </div>
                                    <div style={{
                                      fontSize: '12px',
                                      color: '#6b7280',
                                      fontWeight: '500'
                                    }}>
                                      In Progress
                                    </div>
                                  </div>
                                </div>

                                {/* View Details */}
                                <div style={{ padding: '0 20px 20px 20px' }}>
                                  <div style={{
                                    background: '#f3f4f6',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    fontSize: '13px',
                                    color: '#6b7280',
                                    fontWeight: '500'
                                  }}>
                                    Click to view all tasks
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      /* List View */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {Object.entries(groupTasksByClient(filteredTasks.filter(t => t.status !== 'pending-client-approval'))).map(([clientName, clientTasks]) => {
                          const isExpanded = expandedClients[clientName];
                          const totalTasks = clientTasks.length;
                          const approvedTasks = clientTasks.filter(t => t.status === 'approved').length;
                          const postedTasks = clientTasks.filter(t => t.status === 'posted').length;

                          return (
                            <div key={clientName} style={{
                              backgroundColor: 'white',
                              borderRadius: '12px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              overflow: 'hidden',
                              border: '1px solid #e9ecef'
                            }}>
                              {/* Client Header */}
                              <div
                                onClick={() => toggleClientExpansion(clientName)}
                                style={{
                                  padding: '20px',
                                  background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                                  color: 'white',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'all 0.2s ease',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #00a085 0%, #008f75 100%)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #00b894 0%, #00a085 100%)'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <input
                                    type="checkbox"
                                    checked={isClientFullySelected(clientTasks)}
                                    ref={(el) => {
                                      if (el) {
                                        el.indeterminate = isClientPartiallySelected(clientTasks);
                                      }
                                    }}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleClientSelect(clientTasks);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                  />
                                  <div style={{
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                  }}>
                                    {(() => {
                                      // Try to get clientId from first task, then lookup by clientName
                                      if (clientTasks[0]?.clientId) {
                                        return clientTasks[0].clientId;
                                      }
                                      // Find client by name to get ID
                                      const client = clients.find(c => c.clientName === clientName);
                                      return client ? client.clientId : 'N/A';
                                    })()}
                                  </div>
                                  <div>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                      {clientName}
                                    </h3>
                                    <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>
                                      {totalTasks} social media task{totalTasks !== 1 ? 's' : ''} • {approvedTasks} ready to post • {postedTasks} posted
                                    </div>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: '24px',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.3s ease'
                                  }}
                                >
                                  ▼
                                </div>
                              </div>

                              {/* Client Social Media Tasks */}
                              {isExpanded && (
                                <div style={{ padding: '0' }}>
                                  <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse'
                                  }}>
                                    <thead>
                                      <tr style={{
                                        backgroundColor: '#f8f9fa',
                                        borderBottom: '2px solid #e9ecef'
                                      }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '5%' }}>
                                          <CheckSquare size={16} color="#9ca3af" />
                                        </th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Task Name</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Assigned To</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Due Date</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Status</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Ads Run</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {clientTasks.map(task => (
                                        <tr key={task.id} style={{
                                          borderBottom: clientTasks.indexOf(task) < clientTasks.length - 1 ? '1px solid #f1f3f4' : 'none'
                                        }}>
                                          <td style={{ padding: '12px 16px', textAlign: 'center', width: '5%' }}>
                                            <input
                                              type="checkbox"
                                              checked={selectedTasks.has(task.id)}
                                              onChange={() => handleTaskSelect(task.id)}
                                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                            />
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              {getStatusIcon(task.status)}
                                              <div>
                                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{task.taskName}</div>
                                              </div>
                                            </div>
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            {task.socialMediaAssignedTo ? (
                                              <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                backgroundColor: '#d1fae5',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontWeight: '600'
                                              }}>
                                                <span style={{ color: '#374151' }}>
                                                  {task.socialMediaAssignedTo}
                                                </span>
                                              </div>
                                            ) : (
                                              <span style={{ color: '#9ca3af', fontSize: '12px' }}>Not assigned</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            {new Date(task.deadline).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric'
                                            })}
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <span className={`modern-status-badge status-${task.status}`} style={{
                                              padding: '4px 8px',
                                              borderRadius: '12px',
                                              fontSize: '11px',
                                              fontWeight: '600'
                                            }}>
                                              {task.status.replace(/-/g, ' ')}
                                            </span>
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            {task.adsRun && task.adType ? (
                                              <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}>
                                                <span style={{
                                                  padding: '4px 8px',
                                                  borderRadius: '6px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  backgroundColor: '#dbeafe',
                                                  color: '#1e40af'
                                                }}>
                                                  {task.adType}
                                                </span>
                                                <span style={{
                                                  fontSize: '12px',
                                                  fontWeight: '600',
                                                  color: '#059669'
                                                }}>
                                                  ₹{task.adCost || 0}
                                                </span>
                                              </div>
                                            ) : (
                                              <span style={{
                                                fontSize: '13px',
                                                color: '#6b7280',
                                                fontWeight: '500'
                                              }}>
                                                No
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                              {task.status === 'approved' && (
                                                <button
                                                  onClick={() => handleMarkAsPosted(task)}
                                                  className="action-btn"
                                                  style={{
                                                    backgroundColor: '#28a745',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                  }}
                                                >
                                                  Mark as Posted
                                                </button>
                                              )}
                                              {task.status === 'posted' && (
                                                <span className="status-text" style={{ color: '#28a745', fontWeight: 'bold', fontSize: '12px' }}>
                                                  ✓ Posted
                                                </span>
                                              )}
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
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* End of conditional wrapper for tasks sections */}

            {/* Ad Modal */}
            {showAdModal && selectedTaskForPosting && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
              }}
                onClick={() => {
                  setShowAdModal(false);
                  setSelectedTaskForPosting(null);
                }}
              >
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  maxWidth: '500px',
                  width: '100%',
                  overflow: 'hidden'
                }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '20px',
                    color: 'white'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                      📢 Post Content
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                      {selectedTaskForPosting.taskName}
                    </p>
                  </div>

                  {/* Modal Content */}
                  <div style={{ padding: '24px' }}>
                    <h4 style={{
                      margin: '0 0 16px 0',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      Did you run ads for this post?
                    </h4>

                    {/* No Ads Button */}
                    <button
                      onClick={handlePostWithoutAd}
                      style={{
                        width: '100%',
                        padding: '14px 20px',
                        marginBottom: '12px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      <XCircle size={18} /> No, Post Without Ads
                    </button>

                    {/* Divider */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      margin: '20px 0',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>OR</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                    </div>

                    {/* Yes, with Ads Section */}
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h5 style={{
                        margin: '0 0 12px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}>
                        ✅ Yes, I ran ads
                      </h5>

                      {/* Ad Type Dropdown */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          Ad Type *
                        </label>
                        <select
                          value={adType}
                          onChange={(e) => setAdType(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#667eea';
                            e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e5e7eb';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          <option value="">Select ad type...</option>
                          <option value="Awareness">Awareness</option>
                          <option value="Traffic">Traffic</option>
                          <option value="Engagement">Engagement</option>
                          <option value="Leads">Leads</option>
                          <option value="App Promotion">App Promotion</option>
                          <option value="Sales">Sales</option>
                        </select>
                      </div>

                      {/* Ad Cost Input */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          Ad Cost (₹) *
                        </label>
                        <input
                          type="number"
                          value={adCost}
                          onChange={(e) => setAdCost(e.target.value)}
                          placeholder="Enter cost in rupees"
                          min="0"
                          step="1"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            boxSizing: 'border-box'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#667eea';
                            e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e5e7eb';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handlePostWithAd}
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                        }}
                      >
                        <CheckCircle size={18} /> Post with Ads
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Day Details Modal */}
            {showDayModal && selectedCalendarDay && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
              }}
                onClick={() => setShowDayModal(false)}
              >
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  maxWidth: '700px',
                  width: '100%',
                  maxHeight: '80vh',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                    padding: '20px',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                        📱 Social Media Tasks for {calendarDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).replace(/(\d+),/, `${selectedCalendarDay},`)}
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                        {getTasksForDay(selectedCalendarDay).length} task{getTasksForDay(selectedCalendarDay).length !== 1 ? 's' : ''} scheduled for social media posting
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDayModal(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                        fontSize: '18px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                      ×
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div style={{
                    padding: '20px',
                    maxHeight: 'calc(80vh - 80px)',
                    overflowY: 'auto'
                  }}>
                    {getTasksForDay(selectedCalendarDay).length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: '#666'
                      }}>
                        <p>No social media tasks scheduled for this day</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {getTasksForDay(selectedCalendarDay).map(task => (
                          <div key={task.id} style={{
                            backgroundColor: '#f8f9fa',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid #e9ecef'
                          }}>
                            {/* Task Header */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '12px'
                            }}>
                              <div style={{ flex: 1 }}>
                                <h4 style={{
                                  margin: '0 0 8px 0',
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  color: '#212529',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flexWrap: 'wrap'
                                }}>
                                  <span>{task.taskName}</span>
                                  {task.assignedBy === 'Social Media Head' && (
                                    <span style={{
                                      backgroundColor: '#00b894',
                                      color: 'white',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 'bold'
                                    }}>
                                      EXTRA
                                    </span>
                                  )}
                                </h4>
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '12px',
                                  fontSize: '13px',
                                  color: '#666'
                                }}>
                                  <span>👤 <strong>Client:</strong> {task.clientName}</span>
                                  {task.socialMediaAssignedTo && <span>👨‍💼 <strong>Assigned:</strong> {task.socialMediaAssignedTo}</span>}
                                  <span>📱 <strong>Type:</strong> Social Media</span>
                                  {task.deadline && (
                                    <span>📅 <strong>Deadline:</strong> {new Date(task.deadline).toLocaleDateString()}</span>
                                  )}
                                  {task.postDate && (
                                    <span>📤 <strong>Post Date:</strong> {new Date(task.postDate).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: '8px'
                              }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: '#e8f5e8',
                                  color: '#00b894'
                                }}>
                                  📱 SOCIAL MEDIA
                                </span>
                                <span style={{
                                  padding: '6px 12px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: getStatusColor(task.status),
                                  color: 'white',
                                  minWidth: '120px',
                                  textAlign: 'center'
                                }}>
                                  {task.status === 'approved' ? 'APPROVED' :
                                    task.status === 'posted' ? 'POSTED' :
                                      task.status === 'assigned-to-department' ? 'ASSIGNED' :
                                        task.status.replace(/-/g, ' ').toUpperCase()}
                                </span>
                              </div>
                            </div>

                            {/* Task Description */}
                            {task.description && (
                              <div style={{
                                backgroundColor: '#e8f5e8',
                                padding: '12px',
                                borderRadius: '8px',
                                marginBottom: '12px'
                              }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#00b894', marginBottom: '4px' }}>
                                  📝 Description:
                                </div>
                                <div style={{ fontSize: '13px', color: '#00b894' }}>
                                  {task.description}
                                </div>
                              </div>
                            )}

                            {/* Status Display */}
                            <div style={{
                              textAlign: 'center',
                              padding: '8px',
                              backgroundColor: task.status === 'posted' ? '#d4edda' :
                                task.status === 'approved' ? '#e8f5e8' : '#fff3cd',
                              borderRadius: '8px',
                              color: task.status === 'posted' ? '#155724' :
                                task.status === 'approved' ? '#00b894' : '#856404',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}>
                              {task.status === 'posted' ? '✓ Posted on Social Media' :
                                task.status === 'approved' ? '✓ Ready to Post' :
                                  '📋 Awaiting Approval'
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}



        {/* Reports Section */}
        {showReports && (
          <div style={{ width: '100%', minHeight: '100vh' }}>
            {/* Reports Header */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '20px 28px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  margin: 0
                }}>
                  <BarChart3 size={26} />
                  Social Media Department Reports
                </h2>
                <p style={{ margin: '6px 0 0 36px', color: '#6b7280', fontSize: '13px' }}>
                  Comprehensive analytics and performance metrics
                </p>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowAllReportDropdown(!showAllReportDropdown)}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #37B46F 0%, #2d9459 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 8px rgba(16, 185, 129, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.2)';
                  }}
                >
                  <Download size={18} />
                  All Report
                </button>

                {showAllReportDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid #e5e7eb',
                    minWidth: '160px',
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={() => handleAllReportDownload('pdf')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: '#374151',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ef4444' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Download PDF
                    </button>
                    <button
                      onClick={() => handleAllReportDownload('excel')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: '#374151',
                        transition: 'background 0.1s',
                        borderTop: '1px solid #f3f4f6'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Download Excel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            {(() => {
              let allMonthTasks = tasks.filter(task => {
                if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;
                const taskDate = task.postDate || task.deadline;
                if (!taskDate) return true;
                return taskDate.startsWith(selectedMonth);
              });

              // Apply search filter
              if (reportsSearchQuery.trim()) {
                const query = reportsSearchQuery.toLowerCase();
                allMonthTasks = allMonthTasks.filter(task => {
                  return (
                    task.clientName?.toLowerCase().includes(query) ||
                    task.clientId?.toLowerCase().includes(query) ||
                    task.taskName?.toLowerCase().includes(query) ||
                    task.projectName?.toLowerCase().includes(query) ||
                    task.assignedTo?.toLowerCase().includes(query)
                  );
                });
              }

              // Apply employee filter
              if (reportsEmployeeFilter !== 'all') {
                allMonthTasks = allMonthTasks.filter(task => {
                  // Check both assignedTo and socialMediaAssignedTo fields
                  return task.assignedTo === reportsEmployeeFilter ||
                    task.socialMediaAssignedTo === reportsEmployeeFilter;
                });
              }

              // Apply client filter
              if (reportsClientFilter !== 'all') {
                allMonthTasks = allMonthTasks.filter(task => task.clientName === reportsClientFilter);
              }

              // Apply status filter
              if (reportsStatusFilter !== 'all') {
                allMonthTasks = allMonthTasks.filter(task => task.status === reportsStatusFilter);
              }

              return (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #37B46F 0%, #2d9459 100%)',
                      borderRadius: '10px',
                      padding: '18px',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(29,209,161,0.25)'
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '6px' }}>
                        {allMonthTasks.length}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.95 }}>Total Tasks</div>
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      borderRadius: '10px',
                      padding: '18px',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '6px' }}>
                        {allMonthTasks.filter(t => t.status === 'posted').length}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.95 }}>Posted</div>
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      borderRadius: '10px',
                      padding: '18px',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(59,130,246,0.25)'
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '6px' }}>
                        {allMonthTasks.filter(t => t.status === 'approved').length}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.95 }}>Ready to Post</div>
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      borderRadius: '10px',
                      padding: '18px',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(245,158,11,0.25)'
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '6px' }}>
                        {(() => {
                          const posted = allMonthTasks.filter(t => t.status === 'posted').length;
                          return allMonthTasks.length > 0 ? Math.round((posted / allMonthTasks.length) * 100) : 0;
                        })()}%
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.95 }}>Posting Rate</div>
                    </div>
                  </div>

                  {/* Search Bar and Filters */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      {/* Time Period Dropdown */}
                      <select
                        value={reportTimePeriod}
                        onChange={(e) => setReportTimePeriod(e.target.value)}
                        style={{
                          padding: '10px 36px 10px 14px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '13px',
                          backgroundColor: '#f8f9fa',
                          color: '#1f2937',
                          cursor: 'pointer',
                          outline: 'none',
                          minWidth: '140px',
                          flexShrink: 0,
                          appearance: 'none',
                          fontWeight: '600',
                          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239ca3af\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                          backgroundSize: '16px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <option value="day">📅 Day</option>
                        <option value="week">📊 Week</option>
                        <option value="month">📆 Month</option>
                      </select>

                      {/* Search Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        flex: '1',
                        minWidth: '250px'
                      }}>
                        <Search size={18} style={{ color: '#6b7280' }} />
                        <input
                          type="text"
                          placeholder="Search by client, task, employee..."
                          value={reportsSearchQuery}
                          onChange={(e) => setReportsSearchQuery(e.target.value)}
                          style={{
                            padding: '6px 8px',
                            border: 'none',
                            background: 'transparent',
                            fontSize: '14px',
                            flex: 1,
                            outline: 'none'
                          }}
                        />
                        {reportsSearchQuery && (
                          <button
                            onClick={() => setReportsSearchQuery('')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#6b7280',
                              cursor: 'pointer',
                              fontSize: '18px',
                              padding: '0 4px',
                              fontWeight: 'bold'
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Employee Filter */}
                      <select
                        value={reportsEmployeeFilter}
                        onChange={(e) => {
                          const newEmployee = e.target.value;
                          setReportsEmployeeFilter(newEmployee);

                          if (reportsClientFilter !== 'all' && newEmployee !== 'all') {
                            const employeeTasks = tasks.filter(task => {
                              if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;
                              const taskDate = task.postDate || task.deadline;
                              if (!taskDate) return true;
                              return taskDate.startsWith(selectedMonth) && task.assignedTo === newEmployee;
                            });
                            const employeeClients = [...new Set(employeeTasks.map(t => t.clientName))];
                            if (!employeeClients.includes(reportsClientFilter)) {
                              setReportsClientFilter('all');
                            }
                          }
                        }}
                        style={{
                          padding: '10px 14px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#1f2937',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          outline: 'none',
                          minWidth: '150px'
                        }}
                      >
                        <option value="all">All Employees</option>
                        {employees.length === 0 ? (
                          <option disabled>No social media employees found</option>
                        ) : (
                          employees
                            .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''))
                            .map(emp => (
                              <option key={emp.id} value={emp.employeeName}>
                                {emp.employeeName}
                              </option>
                            ))
                        )}
                      </select>

                      {/* Client Filter */}
                      <select
                        value={reportsClientFilter}
                        onChange={(e) => setReportsClientFilter(e.target.value)}
                        style={{
                          padding: '10px 14px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#1f2937',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          outline: 'none',
                          minWidth: '150px'
                        }}
                      >
                        <option value="all">All Clients</option>
                        {(() => {
                          let tasksToFilter = tasks.filter(task => {
                            if (task.status !== 'assigned-to-department' && task.status !== 'approved' && task.status !== 'posted') return false;
                            const taskDate = task.postDate || task.deadline;
                            if (!taskDate) return true;
                            return taskDate.startsWith(selectedMonth);
                          });
                          if (reportsEmployeeFilter !== 'all') {
                            tasksToFilter = tasksToFilter.filter(t => {
                              // Check both assignedTo and socialMediaAssignedTo
                              return t.assignedTo === reportsEmployeeFilter ||
                                t.socialMediaAssignedTo === reportsEmployeeFilter;
                            });
                          }
                          const uniqueClients = [...new Set(tasksToFilter
                            .filter(t => t.clientName)
                            .map(t => t.clientName))].sort();
                          return uniqueClients.map(client => (
                            <option key={client} value={client}>{client}</option>
                          ));
                        })()}
                      </select>

                      {/* Status Filter */}
                      <select
                        value={reportsStatusFilter}
                        onChange={(e) => setReportsStatusFilter(e.target.value)}
                        style={{
                          padding: '10px 14px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#1f2937',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          outline: 'none',
                          minWidth: '150px'
                        }}
                      >
                        <option value="all">All Status</option>
                        <option value="posted">Posted</option>
                        <option value="approved">Ready to Post</option>
                        <option value="assigned-to-department">Assigned</option>
                      </select>

                      {/* Clear Filters Button */}
                      {(reportsSearchQuery || reportsEmployeeFilter !== 'all' || reportsClientFilter !== 'all' || reportsStatusFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setReportsSearchQuery('');
                            setReportsEmployeeFilter('all');
                            setReportsClientFilter('all');
                            setReportsStatusFilter('all');
                          }}
                          style={{
                            padding: '10px 16px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(239,68,68,0.2)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#dc2626';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(239,68,68,0.3)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(239,68,68,0.2)';
                          }}
                        >
                          ✕ Clear Filters
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1.5fr 1fr',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    {/* Task Status Distribution - Pie Chart */}
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        marginBottom: '14px',
                        color: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <PieChart size={16} />
                        Task Status Distribution
                      </h3>
                      {(() => {
                        const statusData = [
                          { label: 'Posted', count: allMonthTasks.filter(t => t.status === 'posted').length, color: '#10b981' },
                          { label: 'Approved', count: allMonthTasks.filter(t => t.status === 'approved').length, color: '#3b82f6' },
                          { label: 'Assigned', count: allMonthTasks.filter(t => t.status === 'assigned-to-department').length, color: '#f59e0b' }
                        ];
                        const total = statusData.reduce((sum, item) => sum + item.count, 0);

                        if (total === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                              <PieChart size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                              <p style={{ fontSize: '13px', fontWeight: '500' }}>No tasks available</p>
                            </div>
                          );
                        }

                        let currentAngle = 0;
                        const radius = 70;
                        const centerX = 100;
                        const centerY = 100;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                            <svg width="200" height="200" viewBox="0 0 200 200">
                              {statusData.map((item, index) => {
                                if (item.count === 0) return null;
                                const angle = (item.count / total) * 360;
                                const startAngle = currentAngle;
                                const endAngle = currentAngle + angle;

                                const startRad = (startAngle - 90) * (Math.PI / 180);
                                const endRad = (endAngle - 90) * (Math.PI / 180);

                                const x1 = centerX + radius * Math.cos(startRad);
                                const y1 = centerY + radius * Math.sin(startRad);
                                const x2 = centerX + radius * Math.cos(endRad);
                                const y2 = centerY + radius * Math.sin(endRad);

                                const largeArc = angle > 180 ? 1 : 0;
                                const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                                currentAngle += angle;

                                return (
                                  <path
                                    key={index}
                                    d={path}
                                    fill={item.color}
                                    stroke="white"
                                    strokeWidth="2"
                                  />
                                );
                              })}
                            </svg>
                            <div style={{ width: '100%' }}>
                              {statusData.map((item, index) => (
                                item.count > 0 && (
                                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: item.color }}></div>
                                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.label}</span>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>
                                      {item.count} ({Math.round((item.count / total) * 100)}%)
                                    </span>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Task Completion Timeline - Line Chart */}
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        marginBottom: '14px',
                        color: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <TrendingUp size={16} />
                        Task Posting Timeline
                      </h3>
                      {(() => {
                        // Group tasks by day for the selected month
                        const year = parseInt(selectedMonth.split('-')[0]);
                        const month = parseInt(selectedMonth.split('-')[1]);
                        const daysInMonth = new Date(year, month, 0).getDate();

                        const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
                          const day = i + 1;
                          const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                          const dayTasks = allMonthTasks.filter(t => {
                            const taskDate = t.postDate || t.deadline;
                            return taskDate && taskDate.startsWith(dateStr);
                          });
                          const posted = dayTasks.filter(t => t.status === 'posted').length;
                          return { day, total: dayTasks.length, posted };
                        });

                        const maxValue = Math.max(...dailyData.map(d => d.total), 3); // Minimum scale of 3
                        const chartWidth = 600;
                        const chartHeight = 220;
                        const padding = 30; // Reduced padding
                        const plotWidth = chartWidth - padding * 2;
                        const plotHeight = chartHeight - padding * 2;
                        const bottomY = padding + plotHeight;

                        // Calculate points
                        const points = dailyData.map((d, i) => ({
                          x: padding + (plotWidth / (daysInMonth - 1)) * i,
                          yTotal: bottomY - (d.total / maxValue) * plotHeight,
                          yPosted: bottomY - (d.posted / maxValue) * plotHeight,
                          data: d
                        }));

                        // Generate path commands for Area and Line
                        const totalLineCmd = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x},${p.yTotal}`).join(' ');
                        const totalAreaCmd = `${totalLineCmd} L ${points[points.length - 1].x},${bottomY} L ${points[0].x},${bottomY} Z`;

                        const postedLineCmd = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x},${p.yPosted}`).join(' ');
                        const postedAreaCmd = `${postedLineCmd} L ${points[points.length - 1].x},${bottomY} L ${points[0].x},${bottomY} Z`;

                        return (
                          <svg width="100%" height="250" viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} style={{ overflow: 'visible' }}>
                            <defs>
                              {/* Blue Gradient for Total */}
                              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                              </linearGradient>
                              {/* Green Gradient for Posted */}
                              <linearGradient id="gradPosted" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#37B46F" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#37B46F" stopOpacity="0.05" />
                              </linearGradient>
                              {/* Subtle Glow Filter */}
                              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                <feMerge>
                                  <feMergeNode in="coloredBlur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>

                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                              const y = padding + plotHeight * ratio;
                              const val = Math.round(maxValue * (1 - ratio));
                              return (
                                <g key={i}>
                                  <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                                  <text x={padding - 10} y={y + 4} fontSize="10" fill="#9ca3af" textAnchor="end" style={{ fontFamily: 'Inter, sans-serif' }}>
                                    {val}
                                  </text>
                                </g>
                              );
                            })}

                            <rect x={padding} y={padding} width={plotWidth} height={plotHeight} fill="none" />

                            {/* Total Area & Line */}
                            <path d={totalAreaCmd} fill="url(#gradTotal)" />
                            <path d={totalLineCmd} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />

                            {/* Posted Area & Line (On Top) */}
                            <path d={postedAreaCmd} fill="url(#gradPosted)" />
                            <path d={postedLineCmd} fill="none" stroke="#37B46F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />

                            {/* Data Points (Only show relevant ones to avoid clutter) */}
                            {points.map((p, i) => (
                              (p.data.posted > 0 || p.data.total > 0) && (
                                <circle key={`pt-${i}`} cx={p.x} cy={p.yTotal} r="3" fill="#3b82f6" fillOpacity="0.5" />
                              )
                            ))}
                            {points.map((p, i) => (
                              p.data.posted > 0 && (
                                <g key={`pp-${i}`}>
                                  <circle cx={p.x} cy={p.yPosted} r="4" fill="#ffffff" stroke="#37B46F" strokeWidth="2" />
                                </g>
                              )
                            ))}

                            {/* X Axis Labels */}
                            {points.filter((_, i) => i % 4 === 0).map((p, i) => (
                              <text key={i} x={p.x} y={bottomY + 20} fontSize="10" fill="#9ca3af" textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif' }}>
                                {p.data.day}
                              </text>
                            ))}


                            {/* Legend - Custom Styled */}
                            <g transform={`translate(${padding}, ${chartHeight + 10})`}>
                              <rect x="0" y="-5" width="60" height="20" rx="4" fill="#eff6ff" />
                              <circle cx="15" cy="5" r="4" fill="#3b82f6" />
                              <text x="25" y="9" fontSize="11" fill="#1e40af" fontWeight="600">Total</text>

                              <rect x="80" y="-5" width="70" height="20" rx="4" fill="#ecfdf5" />
                              <circle cx="95" cy="5" r="4" fill="#37B46F" />
                              <text x="105" y="9" fontSize="11" fill="#065f46" fontWeight="600">Posted</text>
                            </g>
                          </svg>
                        );
                      })()}
                    </div>

                    {/* Employee Performance */}
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        marginBottom: '14px',
                        color: '#1f2937'
                      }}>
                        Employee Performance
                      </h3>
                      <div
                        className="socialmedia-employee-performance-scroll"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          maxHeight: '340px',
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          paddingRight: '4px'
                        }}>
                        {(() => {
                          // Initialize employees based on filter
                          const employeeCounts = {};

                          if (reportsEmployeeFilter !== 'all') {
                            // If specific employee is selected, show only that employee
                            employeeCounts[reportsEmployeeFilter] = { total: 0, completed: 0 };
                          } else {
                            // Show all social media employees
                            employees.forEach(emp => {
                              if (emp.employeeName) {
                                employeeCounts[emp.employeeName] = { total: 0, completed: 0 };
                              }
                            });
                          }

                          // Count tasks for each employee
                          allMonthTasks.forEach(task => {
                            // Check both assignedTo and socialMediaAssignedTo
                            const emp = task.socialMediaAssignedTo || task.assignedTo;
                            if (emp && emp !== 'Not Assigned' && employeeCounts.hasOwnProperty(emp)) {
                              employeeCounts[emp].total++;
                              if (task.status === 'completed' || task.status === 'posted' || task.status === 'approved') {
                                employeeCounts[emp].completed++;
                              }
                            }
                          });

                          // Sort by completion rate, then by total tasks
                          const sortedEmployees = Object.entries(employeeCounts)
                            .sort((a, b) => {
                              const rateA = a[1].total > 0 ? (a[1].completed / a[1].total) : 0;
                              const rateB = b[1].total > 0 ? (b[1].completed / b[1].total) : 0;
                              if (rateB !== rateA) return rateB - rateA;
                              return b[1].total - a[1].total;
                            });

                          return sortedEmployees.length > 0 ? sortedEmployees.map(([emp, counts], index) => {
                            const completionRate = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;
                            const colors = [
                              { bg: '#667eea', light: '#818cf8', shadow: 'rgba(102,126,234,0.2)' },
                              { bg: '#10b981', light: '#34d399', shadow: 'rgba(16,185,129,0.2)' },
                              { bg: '#f59e0b', light: '#fbbf24', shadow: 'rgba(245,158,11,0.2)' },
                              { bg: '#8b5cf6', light: '#a78bfa', shadow: 'rgba(139,92,246,0.2)' },
                              { bg: '#3b82f6', light: '#60a5fa', shadow: 'rgba(59,130,246,0.2)' }
                            ];
                            const colorScheme = colors[index % colors.length];

                            return (
                              <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px',
                                background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                                borderRadius: '10px',
                                border: '1px solid #e5e7eb',
                                transition: 'all 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                              }}>
                                <div style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  background: `linear-gradient(135deg, ${colorScheme.light} 0%, ${colorScheme.bg} 100%)`,
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '700',
                                  fontSize: '14px',
                                  flexShrink: 0,
                                  boxShadow: `0 4px 8px ${colorScheme.shadow}`,
                                  border: '2px solid white'
                                }}>
                                  {emp.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '6px'
                                  }}>
                                    <span style={{
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      color: '#1f2937',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {emp}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                                      <span style={{
                                        fontSize: '13px',
                                        color: colorScheme.bg,
                                        fontWeight: '700'
                                      }}>
                                        {counts.completed}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
                                        /{counts.total}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{
                                    height: '8px',
                                    backgroundColor: '#e5e7eb',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                  }}>
                                    <div style={{
                                      height: '100%',
                                      width: `${completionRate}%`,
                                      background: `linear-gradient(90deg, ${colorScheme.light} 0%, ${colorScheme.bg} 100%)`,
                                      transition: 'width 0.5s ease',
                                      borderRadius: '4px',
                                      boxShadow: `0 0 8px ${colorScheme.shadow}`
                                    }}></div>
                                  </div>
                                  <div style={{
                                    fontSize: '10px',
                                    color: '#6b7280',
                                    marginTop: '4px',
                                    fontWeight: '600'
                                  }}>
                                    {completionRate.toFixed(0)}% Complete
                                  </div>
                                </div>
                              </div>
                            );
                          }) : (
                            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '30px 20px' }}>
                              <div style={{ fontSize: '40px', marginBottom: '8px', opacity: 0.3 }}>👤</div>
                              <p style={{ fontSize: '12px', fontWeight: '500' }}>No employee data available</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Employee-wise Task Summary */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    marginBottom: '20px'
                  }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      margin: '0 0 16px 0'
                    }}>
                      <Users size={18} />
                      Employee-wise Task Summary
                    </h3>

                    {/* Action Buttons Row */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {(selectedClients.size > 0 || selectedReportTasks.size > 0) && (
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                              style={{
                                padding: '8px 16px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                              }}
                            >
                              <Download size={16} />
                              Download Selected ({selectedClients.size > 0 && selectedReportTasks.size > 0 ? `${selectedClients.size} employees, ${selectedReportTasks.size} tasks` : selectedClients.size > 0 ? `${selectedClients.size} employees` : `${selectedReportTasks.size} tasks`})
                            </button>

                            {showFormatDropdown && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '8px',
                                background: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                border: '1px solid #e5e7eb',
                                minWidth: '180px',
                                zIndex: 1000,
                                overflow: 'hidden'
                              }}>
                                <button
                                  onClick={() => {
                                    // Create ONE combined PDF for all selected items - GROUPED BY EMPLOYEE
                                    const clientGroups = groupTasksByClient(allMonthTasks);
                                    const now = new Date();
                                    const dateTimeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

                                    // Collect all tasks to include
                                    let allTasksToInclude = [];

                                    // If clients are selected, get all their tasks
                                    if (selectedClients.size > 0) {
                                      const selectedClientNames = Array.from(selectedClients);
                                      selectedClientNames.forEach(clientName => {
                                        const clientTasks = clientGroups[clientName];
                                        if (clientTasks) {
                                          allTasksToInclude.push(...clientTasks);
                                        }
                                      });
                                    }

                                    // If individual tasks are selected, add them (avoid duplicates)
                                    if (selectedReportTasks.size > 0) {
                                      const selectedTasksArray = Array.from(selectedReportTasks);
                                      const tasksToAdd = allMonthTasks.filter(t => selectedTasksArray.includes(t.id));
                                      tasksToAdd.forEach(task => {
                                        if (!allTasksToInclude.find(t => t.id === task.id)) {
                                          allTasksToInclude.push(task);
                                        }
                                      });
                                    }

                                    if (allTasksToInclude.length === 0) {
                                      showToast('⚠️ No tasks to download', 'warning');
                                      return;
                                    }

                                    // Group tasks by EMPLOYEE first, then by client
                                    const groupedByEmployee = {};
                                    allTasksToInclude.forEach(task => {
                                      const employeeName = task.socialMediaAssignedTo || task.assignedTo || 'Unassigned';
                                      if (!groupedByEmployee[employeeName]) {
                                        groupedByEmployee[employeeName] = {};
                                      }
                                      const clientName = task.clientName || 'Unknown Client';
                                      if (!groupedByEmployee[employeeName][clientName]) {
                                        groupedByEmployee[employeeName][clientName] = [];
                                      }
                                      groupedByEmployee[employeeName][clientName].push(task);
                                    });

                                    // Create ONE PDF with all employees
                                    const doc = new jsPDF('p', 'mm', 'a4');
                                    const pageWidth = doc.internal.pageSize.getWidth();
                                    const pageHeight = doc.internal.pageSize.getHeight();
                                    let yPosition = 20;

                                    // Header on first page
                                    doc.setFontSize(24);
                                    doc.setFont('helvetica', 'bold');
                                    doc.setTextColor(29, 209, 161);
                                    doc.text('Digi Syhadri', pageWidth / 2, yPosition, { align: 'center' });

                                    doc.setFontSize(9);
                                    doc.setFont('helvetica', 'normal');
                                    doc.setTextColor(100, 100, 100);
                                    doc.text('Generated: ' + dateTimeStr, pageWidth - 15, 10, { align: 'right' });

                                    yPosition += 8;
                                    doc.setFontSize(18);
                                    doc.setFont('helvetica', 'bold');
                                    doc.setTextColor(29, 209, 161);
                                    doc.text('Social Media Report', pageWidth / 2, yPosition, { align: 'center' });

                                    yPosition += 10;
                                    doc.setFontSize(12);
                                    doc.setFont('helvetica', 'normal');
                                    doc.setTextColor(80, 80, 80);
                                    doc.text(`Total Employees: ${Object.keys(groupedByEmployee).length} | Total Tasks: ${allTasksToInclude.length}`, 20, yPosition);

                                    yPosition += 15;

                                    // Add each employee's tasks grouped by client
                                    Object.entries(groupedByEmployee).forEach(([employeeName, clientGroups]) => {
                                      const employeeTotalTasks = Object.values(clientGroups).flat().length;

                                      // Check if we need a new page for employee header
                                      if (yPosition > pageHeight - 80) {
                                        doc.addPage();
                                        yPosition = 20;
                                      }

                                      // Employee header (Blue background like in image)
                                      doc.setFillColor(100, 116, 234); // Blue color
                                      doc.rect(15, yPosition - 5, pageWidth - 30, 12, 'F');
                                      doc.setTextColor(255, 255, 255);
                                      doc.setFontSize(14);
                                      doc.setFont('helvetica', 'bold');
                                      doc.text(employeeName, 18, yPosition + 3);

                                      yPosition += 12;

                                      // Employee stats
                                      doc.setFontSize(10);
                                      doc.setFont('helvetica', 'normal');
                                      doc.setTextColor(80, 80, 80);
                                      const completed = Object.values(clientGroups).flat().filter(t => t.status === 'posted').length;
                                      const inProgress = Object.values(clientGroups).flat().filter(t => t.status === 'approved').length;
                                      const pending = Object.values(clientGroups).flat().filter(t => t.status === 'assigned-to-department').length;
                                      doc.text(`Total Tasks: ${employeeTotalTasks} | Completed: ${completed} | In Progress: ${inProgress} | Pending: ${pending}`, 18, yPosition);
                                      yPosition += 10;

                                      // Add each client under this employee
                                      Object.entries(clientGroups).forEach(([clientName, clientTasks]) => {
                                        // Check if we need a new page
                                        if (yPosition > pageHeight - 60) {
                                          doc.addPage();
                                          yPosition = 20;
                                        }

                                        // Client header (Light blue/gray background)
                                        doc.setFillColor(200, 210, 240); // Light blue
                                        doc.rect(20, yPosition - 4, pageWidth - 40, 8, 'F');
                                        doc.setTextColor(50, 50, 50);
                                        doc.setFontSize(11);
                                        doc.setFont('helvetica', 'bold');
                                        doc.text(`${clientName} (${clientTasks.length} task${clientTasks.length !== 1 ? 's' : ''})`, 23, yPosition + 1);

                                        yPosition += 10;

                                        // Tasks table
                                        const tableData = clientTasks.map(task => {
                                          // Format posted time
                                          let postedAt = '-';
                                          if (task.status === 'posted' && task.postedAt) {
                                            const postedDate = new Date(task.postedAt);
                                            postedAt = postedDate.toLocaleString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            });
                                          }

                                          return [
                                            (task.taskName || 'N/A').substring(0, 35),
                                            (task.originalDepartment || task.department || 'N/A').toUpperCase(),
                                            task.postDate || task.deadline || 'N/A',
                                            (task.status || '').replace(/-/g, ' ').toUpperCase().substring(0, 15),
                                            postedAt
                                          ];
                                        });

                                        autoTable(doc, {
                                          startY: yPosition,
                                          head: [['Task Name', 'Department', 'Post Date', 'Status', 'Posted At']],
                                          body: tableData,
                                          theme: 'striped',
                                          headStyles: {
                                            fillColor: [100, 116, 234],
                                            textColor: 255,
                                            fontSize: 8,
                                            fontStyle: 'bold'
                                          },
                                          bodyStyles: {
                                            fontSize: 7,
                                            textColor: 50
                                          },
                                          alternateRowStyles: {
                                            fillColor: [248, 250, 252]
                                          },
                                          columnStyles: {
                                            0: { cellWidth: 55 },
                                            1: { cellWidth: 25 },
                                            2: { cellWidth: 25 },
                                            3: { cellWidth: 30 },
                                            4: { cellWidth: 30 }
                                          },
                                          margin: { left: 20, right: 20 }
                                        });

                                        yPosition = doc.lastAutoTable.finalY + 8;
                                      });

                                      yPosition += 5; // Extra space between employees
                                    });

                                    doc.save(`social-media-report-${selectedMonth}.pdf`);
                                    showToast(`✅ PDF downloaded with ${allTasksToInclude.length} task(s) from ${Object.keys(groupedByEmployee).length} employee(s)`, 'success');

                                    // Clear selections and hide checkboxes
                                    setSelectedReportTasks(new Set());
                                    setSelectedClients(new Set());
                                    setShowCheckboxes(false);
                                    setShowFormatDropdown(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'white',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#1f2937',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                                >
                                  📄 Download as PDF
                                </button>
                                <button
                                  onClick={() => {
                                    // Create ONE combined Excel for all selected items
                                    const clientGroups = groupTasksByClient(allMonthTasks);
                                    const now = new Date();
                                    const dateTimeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

                                    // Collect all tasks to include
                                    let allTasksToInclude = [];

                                    if (selectedClients.size > 0) {
                                      const selectedClientNames = Array.from(selectedClients);
                                      selectedClientNames.forEach(clientName => {
                                        const clientTasks = clientGroups[clientName];
                                        if (clientTasks) {
                                          allTasksToInclude.push(...clientTasks);
                                        }
                                      });
                                    }

                                    if (selectedReportTasks.size > 0) {
                                      const selectedTasksArray = Array.from(selectedReportTasks);
                                      const tasksToAdd = allMonthTasks.filter(t => selectedTasksArray.includes(t.id));
                                      tasksToAdd.forEach(task => {
                                        if (!allTasksToInclude.find(t => t.id === task.id)) {
                                          allTasksToInclude.push(task);
                                        }
                                      });
                                    }

                                    if (allTasksToInclude.length === 0) {
                                      showToast('⚠️ No tasks to download', 'warning');
                                      return;
                                    }

                                    const groupedTasks = groupTasksByClient(allTasksToInclude);
                                    const wb = XLSX.utils.book_new();

                                    // Create header data
                                    const headerData = [
                                      ['Digi Syhadri', '', '', '', 'Generated: ' + dateTimeStr],
                                      ['Social Media Report'],
                                      [],
                                      [`Total Tasks: ${allTasksToInclude.length}`, `Clients: ${Object.keys(groupedTasks).length}`],
                                      []
                                    ];

                                    // Add all tasks grouped by client
                                    let allData = [...headerData];

                                    Object.entries(groupedTasks).forEach(([clientName, clientTasks]) => {
                                      const posted = clientTasks.filter(t => t.status === 'posted').length;
                                      const approved = clientTasks.filter(t => t.status === 'approved').length;

                                      // Client header
                                      allData.push([clientName, '', '', '', '']);
                                      allData.push([`Tasks: ${clientTasks.length}`, `Posted: ${posted}`, `Ready: ${approved}`, '', '']);
                                      allData.push(['Task', 'Post Date', 'Assigned To', 'Status', 'Posted At']);

                                      // Client tasks
                                      clientTasks.forEach(task => {
                                        let postedTime = 'Not Posted';
                                        if (task.status === 'posted' && task.postedAt) {
                                          const postedDate = new Date(task.postedAt);
                                          postedTime = postedDate.toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          });
                                        }

                                        allData.push([
                                          task.taskName || 'N/A',
                                          task.postDate || task.deadline || 'N/A',
                                          task.submittedBy || task.assignedTo || 'Not assigned',
                                          (task.status || '').replace(/-/g, ' ').toUpperCase(),
                                          postedTime
                                        ]);
                                      });

                                      allData.push([]); // Empty row between clients
                                    });

                                    const ws = XLSX.utils.aoa_to_sheet(allData);
                                    ws['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];

                                    XLSX.utils.book_append_sheet(wb, ws, 'Social Media Report');
                                    XLSX.writeFile(wb, `social-media-report-${selectedMonth}.xlsx`);

                                    showToast(`✅ Excel downloaded with ${allTasksToInclude.length} task(s) from ${Object.keys(groupedTasks).length} client(s)`, 'success');

                                    // Clear selections and hide checkboxes
                                    setSelectedReportTasks(new Set());
                                    setSelectedClients(new Set());
                                    setShowCheckboxes(false);
                                    setShowFormatDropdown(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'white',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#1f2937',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'background 0.2s',
                                    borderTop: '1px solid #f3f4f6'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                                >
                                  📊 Download as Excel
                                </button>
                                <button
                                  onClick={() => {
                                    // Create ONE combined PDF and Excel for all selected items
                                    const clientGroups = groupTasksByClient(allMonthTasks);
                                    const now = new Date();
                                    const dateTimeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

                                    // Collect all tasks to include
                                    let allTasksToInclude = [];

                                    // If clients are selected, get all their tasks
                                    if (selectedClients.size > 0) {
                                      const selectedClientNames = Array.from(selectedClients);
                                      selectedClientNames.forEach(clientName => {
                                        const clientTasks = clientGroups[clientName];
                                        if (clientTasks) {
                                          allTasksToInclude.push(...clientTasks);
                                        }
                                      });
                                    }

                                    // If individual tasks are selected, add them (avoid duplicates)
                                    if (selectedReportTasks.size > 0) {
                                      const selectedTasksArray = Array.from(selectedReportTasks);
                                      const tasksToAdd = allMonthTasks.filter(t => selectedTasksArray.includes(t.id));
                                      tasksToAdd.forEach(task => {
                                        if (!allTasksToInclude.find(t => t.id === task.id)) {
                                          allTasksToInclude.push(task);
                                        }
                                      });
                                    }

                                    if (allTasksToInclude.length === 0) {
                                      showToast('⚠️ No tasks to download', 'warning');
                                      return;
                                    }

                                    // Group tasks by client for the report
                                    const groupedTasks = groupTasksByClient(allTasksToInclude);

                                    // ===== CREATE PDF =====
                                    const doc = new jsPDF('p', 'mm', 'a4');
                                    const pageWidth = doc.internal.pageSize.getWidth();
                                    const pageHeight = doc.internal.pageSize.getHeight();
                                    let yPosition = 20;

                                    // Header on first page
                                    doc.setFontSize(24);
                                    doc.setFont('helvetica', 'bold');
                                    doc.setTextColor(29, 209, 161);
                                    doc.text('Digi Syhadri', pageWidth / 2, yPosition, { align: 'center' });

                                    doc.setFontSize(9);
                                    doc.setFont('helvetica', 'normal');
                                    doc.setTextColor(100, 100, 100);
                                    doc.text('Generated: ' + dateTimeStr, pageWidth - 15, 10, { align: 'right' });

                                    yPosition += 8;
                                    doc.setFontSize(18);
                                    doc.setFont('helvetica', 'bold');
                                    doc.setTextColor(29, 209, 161);
                                    doc.text('Social Media Report', pageWidth / 2, yPosition, { align: 'center' });

                                    yPosition += 10;
                                    doc.setFontSize(12);
                                    doc.setFont('helvetica', 'normal');
                                    doc.setTextColor(80, 80, 80);
                                    doc.text(`Total Tasks: ${allTasksToInclude.length}`, 20, yPosition);
                                    doc.text(`Clients: ${Object.keys(groupedTasks).length}`, 20, yPosition + 6);

                                    yPosition += 15;

                                    // Add each client's tasks
                                    Object.entries(groupedTasks).forEach(([clientName, clientTasks]) => {
                                      const posted = clientTasks.filter(t => t.status === 'posted').length;
                                      const approved = clientTasks.filter(t => t.status === 'approved').length;

                                      // Check if we need a new page
                                      if (yPosition > pageHeight - 60) {
                                        doc.addPage();
                                        yPosition = 20;
                                      }

                                      // Client header
                                      doc.setFillColor(29, 209, 161);
                                      doc.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');
                                      doc.setTextColor(255, 255, 255);
                                      doc.setFontSize(13);
                                      doc.setFont('helvetica', 'bold');
                                      doc.text(clientName, 18, yPosition + 2);

                                      yPosition += 10;

                                      // Client stats
                                      doc.setFontSize(10);
                                      doc.setFont('helvetica', 'normal');
                                      doc.setTextColor(80, 80, 80);
                                      doc.text(`Tasks: ${clientTasks.length} | Posted: ${posted} | Ready: ${approved}`, 18, yPosition);
                                      yPosition += 8;

                                      // Tasks table
                                      const tableData = clientTasks.map(task => {
                                        // Format posted time
                                        let postedTime = 'Not Posted';
                                        if (task.status === 'posted' && task.postedAt) {
                                          const postedDate = new Date(task.postedAt);
                                          postedTime = postedDate.toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          });
                                        }

                                        return [
                                          (task.taskName || 'N/A').substring(0, 30),
                                          task.postDate || task.deadline || 'N/A',
                                          (task.submittedBy || task.assignedTo || 'Not assigned').substring(0, 15),
                                          (task.status || '').replace(/-/g, ' ').toUpperCase().substring(0, 12),
                                          postedTime
                                        ];
                                      });

                                      autoTable(doc, {
                                        startY: yPosition,
                                        head: [['Task', 'Post Date', 'Assigned To', 'Status', 'Posted At']],
                                        body: tableData,
                                        theme: 'striped',
                                        headStyles: {
                                          fillColor: [85, 239, 196],
                                          textColor: 50,
                                          fontSize: 8,
                                          fontStyle: 'bold'
                                        },
                                        bodyStyles: {
                                          fontSize: 7,
                                          textColor: 50
                                        },
                                        alternateRowStyles: {
                                          fillColor: [248, 250, 252]
                                        },
                                        columnStyles: {
                                          0: { cellWidth: 50 },
                                          1: { cellWidth: 25 },
                                          2: { cellWidth: 30 },
                                          3: { cellWidth: 25 },
                                          4: { cellWidth: 35 }
                                        },
                                        margin: { left: 15, right: 15 }
                                      });

                                      yPosition = doc.lastAutoTable.finalY + 12;
                                    });

                                    doc.save(`social-media-report-${selectedMonth}.pdf`);

                                    // ===== CREATE EXCEL =====
                                    const wb = XLSX.utils.book_new();

                                    // Create header data
                                    const headerData = [
                                      ['Digi Syhadri', '', '', '', 'Generated: ' + dateTimeStr],
                                      ['Social Media Report'],
                                      [],
                                      [`Total Tasks: ${allTasksToInclude.length}`, `Clients: ${Object.keys(groupedTasks).length}`],
                                      []
                                    ];

                                    // Add all tasks grouped by client
                                    let allData = [...headerData];

                                    Object.entries(groupedTasks).forEach(([clientName, clientTasks]) => {
                                      const posted = clientTasks.filter(t => t.status === 'posted').length;
                                      const approved = clientTasks.filter(t => t.status === 'approved').length;

                                      // Client header
                                      allData.push([clientName, '', '', '', '']);
                                      allData.push([`Tasks: ${clientTasks.length}`, `Posted: ${posted}`, `Ready: ${approved}`, '', '']);
                                      allData.push(['Task', 'Post Date', 'Assigned To', 'Status', 'Posted At']);

                                      // Client tasks
                                      clientTasks.forEach(task => {
                                        let postedTime = 'Not Posted';
                                        if (task.status === 'posted' && task.postedAt) {
                                          const postedDate = new Date(task.postedAt);
                                          postedTime = postedDate.toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          });
                                        }

                                        allData.push([
                                          task.taskName || 'N/A',
                                          task.postDate || task.deadline || 'N/A',
                                          task.submittedBy || task.assignedTo || 'Not assigned',
                                          (task.status || '').replace(/-/g, ' ').toUpperCase(),
                                          postedTime
                                        ]);
                                      });

                                      allData.push([]); // Empty row between clients
                                    });

                                    const ws = XLSX.utils.aoa_to_sheet(allData);
                                    ws['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];

                                    XLSX.utils.book_append_sheet(wb, ws, 'Social Media Report');
                                    XLSX.writeFile(wb, `social-media-report-${selectedMonth}.xlsx`);

                                    showToast(`✅ Downloaded both PDF & Excel with ${allTasksToInclude.length} task(s) from ${Object.keys(groupedTasks).length} client(s)`, 'success');

                                    // Clear selections and hide checkboxes
                                    setSelectedReportTasks(new Set());
                                    setSelectedClients(new Set());
                                    setShowCheckboxes(false);
                                    setShowFormatDropdown(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'white',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#1f2937',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'background 0.2s',
                                    borderTop: '1px solid #f3f4f6'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                                >
                                  📦 Download Both (PDF & Excel)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setShowCheckboxes(!showCheckboxes);
                            if (showCheckboxes) {
                              setSelectedReportTasks(new Set());
                              setSelectedClients(new Set());
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            background: showCheckboxes ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #37B46F 0%, #2d9459 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(29,209,161,0.25)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {showCheckboxes ? <XCircle size={16} /> : <CheckSquare size={16} />}
                          {showCheckboxes ? 'Cancel' : 'Select Items'}
                        </button>
                      </div>
                    </div>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse'
                    }}>
                      <thead>
                        <tr style={{
                          backgroundColor: '#f9fafb',
                          borderBottom: '2px solid #e5e7eb'
                        }}>
                          {showCheckboxes && (
                            <th style={{
                              padding: '12px 16px',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              width: '60px'
                            }}>
                              {/* Global Checkbox logic would need to be adapted for Employee-wise, hiding for now or keeping simple */}
                              <input
                                type="checkbox"
                                checked={(() => {
                                  const filteredReportTasks = getReportsFilteredTasks();
                                  return filteredReportTasks.length > 0 && filteredReportTasks.every(task => selectedReportTasks.has(task.id));
                                })()}
                                onChange={(e) => {
                                  // Simplified Select All for new structure
                                  const filtered = getReportsFilteredTasks();
                                  if (e.target.checked) {
                                    const newSelected = new Set(filtered.map(t => t.id));
                                    setSelectedReportTasks(newSelected);
                                    // We adhere to ID-based selection for clarity in this view
                                  } else {
                                    setSelectedReportTasks(new Set());
                                  }
                                }}
                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            </th>
                          )}
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase'
                          }}>Employee Name</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase'
                          }}>Total Tasks</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase'
                          }}>Completed</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase'
                          }}>Pending</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase'
                          }}>In Progress</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase'
                          }}>Completion Rate</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase'
                          }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filteredReportTasks = getReportsFilteredTasks();

                          // Group by Employee
                          const employeeGroups = {};
                          filteredReportTasks.forEach(task => {
                            const empName = task.socialMediaAssignedTo || task.assignedTo || 'Unassigned';
                            if (!employeeGroups[empName]) employeeGroups[empName] = [];
                            employeeGroups[empName].push(task);
                          });

                          return Object.entries(employeeGroups).map(([employeeName, employeeTasks], index) => {
                            const completed = employeeTasks.filter(t => t.status === 'posted' || t.status === 'completed').length;
                            const pending = employeeTasks.filter(t => t.status === 'assigned-to-department' || t.status === 'pending-client-approval' || t.status === 'ids-created').length;
                            const inProgress = employeeTasks.filter(t => t.status === 'in-progress' || t.status === 'approved' || t.status === 'revision-required').length;
                            const total = employeeTasks.length;
                            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

                            const isExpanded = expandedEmployees[employeeName];

                            return (
                              <React.Fragment key={employeeName}>
                                <tr style={{
                                  borderBottom: '1px solid #f1f3f4',
                                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                                  cursor: 'pointer'
                                }}
                                  onClick={() => {
                                    setExpandedEmployees(prev => ({
                                      ...prev,
                                      [employeeName]: !prev[employeeName]
                                    }));
                                  }}
                                >
                                  {showCheckboxes && (
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                      {/* Checkbox for Employee tasks */}
                                      <input
                                        type="checkbox"
                                        checked={employeeTasks.every(t => selectedReportTasks.has(t.id))}
                                        onChange={(e) => {
                                          const newSelectedTasks = new Set(selectedReportTasks);

                                          if (e.target.checked) {
                                            employeeTasks.forEach(t => {
                                              newSelectedTasks.add(t.id);
                                            });
                                          } else {
                                            employeeTasks.forEach(t => {
                                              newSelectedTasks.delete(t.id);
                                            });
                                          }
                                          setSelectedReportTasks(newSelectedTasks);
                                        }}
                                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                      />
                                    </td>
                                  )}
                                  <td style={{
                                    padding: '14px 16px',
                                    textAlign: 'left'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px'
                                    }}>
                                      <div style={{
                                        fontSize: '18px',
                                        color: '#37B46F',
                                        transition: 'transform 0.2s',
                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                      }}>
                                        ▶
                                      </div>
                                      <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        flexShrink: 0
                                      }}>
                                        {employeeName.charAt(0).toUpperCase()}
                                      </div>
                                      <span style={{
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#1f2937'
                                      }}>
                                        {employeeName}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>{total}</span>
                                  </td>
                                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', backgroundColor: '#d1fae5', color: '#065f46' }}>{completed}</span>
                                  </td>
                                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', backgroundColor: '#ffedd5', color: '#9a3412' }}>{pending}</span>
                                  </td>
                                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af' }}>{inProgress}</span>
                                  </td>
                                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                      <div style={{ flex: 1, maxWidth: '120px', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', transition: 'width 0.3s ease' }}></div>
                                      </div>
                                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#10b981', minWidth: '45px' }}>{percentage}%</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                    <button style={{
                                      background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px',
                                      padding: '6px 12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 auto'
                                    }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Trigger PDF download for this employee
                                        // This would require a new function or adapting handleDownloadReport
                                        // For now just show toast or nothing
                                        showToast('Select tasks to download report', 'info');
                                      }}
                                    >
                                      <Download size={14} /> PDF
                                    </button>
                                  </td>
                                </tr>

                                {/* Expanded Employee Section - Show Clients */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={showCheckboxes ? "8" : "7"} style={{ padding: '0 0 20px 0', backgroundColor: '#f9fafb' }}>
                                      <div style={{ padding: '16px 24px', backgroundColor: '#f3f4f6' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#4b5563', fontWeight: '600', fontSize: '13px' }}>
                                          <Users size={16} /> Tasks for {employeeName}
                                        </div>

                                        {/* Iterate Clients for this Employee */}
                                        {Object.entries(groupTasksByClient(employeeTasks)).map(([clientName, clientTasks]) => {
                                          const isClientExpanded = expandedClients[`${employeeName}-${clientName}`];
                                          const cCompleted = clientTasks.filter(t => t.status === 'posted').length;
                                          const cInProgress = clientTasks.filter(t => t.status === 'approved' || t.status === 'in-progress').length;

                                          return (
                                            <div key={clientName} style={{ marginBottom: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                              {/* Client Header using Accordion Style */}
                                              <div
                                                style={{
                                                  padding: '12px 16px',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center',
                                                  cursor: 'pointer',
                                                  background: isClientExpanded ? '#eff6ff' : 'white',
                                                  borderBottom: isClientExpanded ? '1px solid #e5e7eb' : 'none'
                                                }}
                                                onClick={() => {
                                                  setExpandedClients(prev => ({
                                                    ...prev,
                                                    [`${employeeName}-${clientName}`]: !prev[`${employeeName}-${clientName}`]
                                                  }));
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                  <div style={{ color: '#3b82f6', transform: isClientExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</div>
                                                  <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px' }}>{clientName}</span>
                                                  <span style={{ fontSize: '12px', color: '#6b7280', padding: '2px 6px', background: '#f3f4f6', borderRadius: '4px' }}>
                                                    {clientTasks.length} tasks • {cCompleted} posted • {cInProgress} in progress
                                                  </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                  {/* Optional Client stats or actions */}
                                                </div>
                                              </div>

                                              {/* Client Tasks Table */}
                                              {isClientExpanded && (
                                                <div style={{ padding: '0' }}>
                                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                                      <tr>
                                                        {showCheckboxes && (
                                                          <th style={{ padding: '10px', textAlign: 'center', width: '40px' }}>
                                                            <input
                                                              type="checkbox"
                                                              checked={clientTasks.length > 0 && clientTasks.every(t => selectedReportTasks.has(t.id))}
                                                              onChange={(e) => {
                                                                const newSelectedTasks = new Set(selectedReportTasks);
                                                                if (e.target.checked) {
                                                                  clientTasks.forEach(t => newSelectedTasks.add(t.id));
                                                                } else {
                                                                  clientTasks.forEach(t => newSelectedTasks.delete(t.id));
                                                                }
                                                                setSelectedReportTasks(newSelectedTasks);
                                                              }}
                                                              style={{ cursor: 'pointer' }}
                                                            />
                                                          </th>
                                                        )}
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Task Name</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Department</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Post Date</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Deadline</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {clientTasks.map((task, i) => (
                                                        <tr key={task.id} style={{ borderBottom: '1px solid #f1f3f4', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                                                          {showCheckboxes && (
                                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                              <input
                                                                type="checkbox"
                                                                checked={selectedReportTasks.has(task.id)}
                                                                onChange={(e) => {
                                                                  const newSelectedTasks = new Set(selectedReportTasks);
                                                                  if (e.target.checked) {
                                                                    newSelectedTasks.add(task.id);
                                                                  } else {
                                                                    newSelectedTasks.delete(task.id);
                                                                  }
                                                                  setSelectedReportTasks(newSelectedTasks);
                                                                }}
                                                                style={{ cursor: 'pointer' }}
                                                              />
                                                            </td>
                                                          )}
                                                          <td style={{ padding: '10px 16px', fontSize: '13px', color: '#374151' }}>{task.taskName}</td>
                                                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                            <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: '#dbeafe', color: '#1e40af', textTransform: 'uppercase' }}>
                                                              {task.department}
                                                            </span>
                                                          </td>
                                                          <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', color: '#4b5563' }}>{task.postDate}</td>
                                                          <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', color: '#4b5563' }}>{task.deadline}</td>
                                                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                            <span style={{
                                                              padding: '3px 8px',
                                                              borderRadius: '10px',
                                                              fontSize: '10px',
                                                              fontWeight: '600',
                                                              backgroundColor: task.status === 'posted' ? '#d1fae5' : task.status === 'approved' ? '#dbeafe' : '#fef3c7',
                                                              color: task.status === 'posted' ? '#065f46' : task.status === 'approved' ? '#1e40af' : '#92400e'
                                                            }}>
                                                              {(task.status || '').replace(/-/g, ' ').toUpperCase()}
                                                            </span>
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>

                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialMediaDashboard;


