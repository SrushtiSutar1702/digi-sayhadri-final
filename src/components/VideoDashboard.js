import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Video, LogOut, CheckCircle, XCircle, Clock, Calendar, ChevronLeft, ChevronRight, LayoutDashboard, User, Users, Plus, List, Send, BarChart3, PieChart, Download, TrendingUp, Search, PlayCircle, AlertCircle, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import './Dashboard.css';
import './VideoDashboard.css';

const VideoDashboard = ({ initialView = 'dashboard', isSuperAdmin = false, employeeFilter = 'all' }) => {
  const [tasks, setTasks] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expandedClients, setExpandedClients] = useState({});
  const [loggedInUserName, setLoggedInUserName] = useState('');
  const [loggedInUserEmail, setLoggedInUserEmail] = useState('');
  const [selectedTaskForAssignment, setSelectedTaskForAssignment] = useState(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [showCalendar, setShowCalendar] = useState(initialView === 'calendar');
  const [showMyTasks, setShowMyTasks] = useState(initialView === 'myTasks');
  const [showEmployeeTasks, setShowEmployeeTasks] = useState(initialView === 'employeeTasks');
  const [showAllTasks, setShowAllTasks] = useState(initialView === 'allTasks');
  const [showExtraTasks, setShowExtraTasks] = useState(initialView === 'extraTasks');
  const [showReports, setShowReports] = useState(initialView === 'reports');
  const [showDayModal, setShowDayModal] = useState(false);
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false);
  const [showSocialMediaEmployeeModal, setShowSocialMediaEmployeeModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [selectedTaskForSending, setSelectedTaskForSending] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // New state for statistics card filtering
  const [searchTerm, setSearchTerm] = useState(''); // New state for search functionality
  const [selectedTasks, setSelectedTasks] = useState({}); // New state for task selection by client
  const [statusFilter, setStatusFilter] = useState('all'); // Status dropdown filter
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // Assignment filter: all, employee, head
  const [showDownloadOptions, setShowDownloadOptions] = useState(false); // New state for download dropdown
  const [showStatusDropdown, setShowStatusDropdown] = useState({}); // State for individual task status dropdowns

  // Reports section filter states
  const [reportsSearchQuery, setReportsSearchQuery] = useState(''); // Search for reports
  const [reportsEmployeeFilter, setReportsEmployeeFilter] = useState('all'); // Employee filter for reports
  const [reportsClientFilter, setReportsClientFilter] = useState('all'); // Client filter for reports
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all'); // Status filter for reports
  const [reportsTimePeriodFilter, setReportsTimePeriodFilter] = useState('month'); // Time period filter: today, week, month
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid' view mode
  const [selectedClientForCardView, setSelectedClientForCardView] = useState(null); // New state for selected client in card view
  const [showAddExtraTaskModal, setShowAddExtraTaskModal] = useState(false); // State for Add Extra Task modal
  const [expandedReportClients, setExpandedReportClients] = useState({}); // Track expanded clients in reports table
  const [selectedClients, setSelectedClients] = useState([]); // Track selected clients for bulk download
  const [selectedReportTasks, setSelectedReportTasks] = useState({}); // Track selected tasks per client in reports
  const [selectAllClientsMode, setSelectAllClientsMode] = useState(false); // Track if "Select All Clients" is active
  const [clients, setClients] = useState([]); // State for clients list
  const [manualClientEntry, setManualClientEntry] = useState(false); // State for manual client entry
  const [newTask, setNewTask] = useState({
    clientName: '',
    clientId: '',
    ideas: '',
    content: '',
    referenceLink: '',
    specialNotes: '',
    department: '',
    taskType: '',
    postDate: ''
  }); // State for new task form
  const navigate = useNavigate();

  // Handle initialView prop changes
  useEffect(() => {
    setShowCalendar(initialView === 'calendar');
    setShowMyTasks(initialView === 'myTasks');
    setShowEmployeeTasks(initialView === 'employeeTasks');
    setShowAllTasks(initialView === 'allTasks');
    setShowExtraTasks(initialView === 'extraTasks');
    setShowReports(initialView === 'reports');
    setShowAddExtraTaskModal(initialView === 'addExtraTask');
  }, [initialView]);

  // Load logged-in user info from sessionStorage
  useEffect(() => {
    const employeeName = sessionStorage.getItem('employeeName');
    const employeeEmail = sessionStorage.getItem('employeeEmail');
    const employeeDataStr = sessionStorage.getItem('employeeData');

    if (employeeName) {
      setLoggedInUserName(employeeName);
      console.log('VideoDashboard - Logged in user:', employeeName);
    }

    // First check for direct employeeEmail (for dashboard users like video@gmail.com)
    if (employeeEmail) {
      setLoggedInUserEmail(employeeEmail);
      console.log('VideoDashboard - User email:', employeeEmail);
    } else if (employeeDataStr) {
      // Fallback to employeeData for employees from database
      try {
        const employeeData = JSON.parse(employeeDataStr);
        if (employeeData.email) {
          setLoggedInUserEmail(employeeData.email);
          console.log('VideoDashboard - User email from data:', employeeData.email);
        }
      } catch (error) {
        console.error('Error parsing employee data:', error);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDownloadOptions && !event.target.closest('.download-dropdown')) {
        setShowDownloadOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadOptions]);
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
        const allTasks = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));

        const tasksList = allTasks.filter(task => {
          // Filter out tasks from inactive clients
          const clientIsActive = activeClientIds.has(task.clientId) || activeClientNames.has(task.clientName);
          if (!clientIsActive && (task.clientId || task.clientName)) {
            console.log(`Filtering out task for inactive client: ${task.clientName}`);
            return false;
          }

          // Show tasks assigned by Production Incharge, Strategy Department, Video Head, or Social Media
          const isAssignedByAuthorized =
            task.assignedBy === 'Production Incharge' ||
            task.assignedBy === 'Strategy Department' ||
            task.assignedBy === 'Strategy Head' || // Added Strategy Head
            task.assignedBy === 'Video Head' ||
            task.assignedBy === 'Super Admin' || // Added Super Admin
            task.assignedFromSocialMedia === true || // Tasks from Social Media Dashboard
            (task.assignedBy && task.assignedBy.includes('Social Media')); // Social Media employees
          const isVideoTask = task.department === 'video' || task.assignedToDept === 'video';
          const isOfficiallyAssigned = task.status === 'assigned-to-department' ||
            task.status === 'assigned' ||
            task.status === 'in-progress' ||
            task.status === 'completed' ||
            task.status === 'pending-client-approval' ||
            task.status === 'approved' ||
            task.status === 'posted' ||
            task.status === 'revision-required' ||
            task.status === 'pending'; // Include pending status for extra tasks

          return isAssignedByAuthorized && isVideoTask && isOfficiallyAssigned;
        });

        console.log('All tasks:', allTasks.length);
        console.log('Video tasks (active clients only):', tasksList.length);

        setTasks(tasksList);
      } else {
        setTasks([]);
      }
    });

    // Fetch employees - Store ALL employees, filter when needed
    const employeesRef = ref(database, 'employees');
    onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const employeesList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setEmployees(employeesList);
        console.log('All employees loaded in VideoDashboard:', employeesList);

        // Security Check: functionality to ensure deleted/inactive users are logged out
        if (loggedInUserEmail && !isSuperAdmin) {
          // Skip check for hardcoded/system accounts that might not be in DB
          if (loggedInUserEmail !== 'video@gmail.com') {
            const currentUser = employeesList.find(e => e.email === loggedInUserEmail);

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

    // Fetch clients (only active ones) for dropdown
    const clientsForDropdownRef = ref(database, 'clients');
    onValue(clientsForDropdownRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const clientsList = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(client =>
            client.status !== 'inactive' &&
            client.deleted !== true
          ); // Hide inactive and deleted clients
        setClients(clientsList);
      } else {
        setClients([]);
      }
    });

    return () => {
      unsubscribeClients();
      unsubscribeStrategyClients();
      unsubscribeStrategyHeadClients();
      unsubscribeTasks();
    };
  }, []);

  const handleAssignToTeamMember = () => {
    if (!selectedTaskForAssignment || !selectedTeamMember) {
      showToast('Please select a team member', 'warning');
      return;
    }

    const taskRef = ref(database, `tasks/${selectedTaskForAssignment.id}`);
    const currentTask = tasks.find(t => t.id === selectedTaskForAssignment.id);

    const updateData = {
      assignedTo: selectedTeamMember,
      status: 'assigned',
      assignedToMemberAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Ensure department is set to video (preserve existing or set new)
    if (!currentTask?.department) {
      updateData.department = 'video';
    }

    // Set originalDepartment if not already set
    if (!currentTask?.originalDepartment) {
      updateData.originalDepartment = 'video';
    }

    // Preserve revision count and related data
    if (currentTask?.revisionCount) {
      updateData.revisionCount = currentTask.revisionCount;
    }
    if (currentTask?.lastRevisionAt) {
      updateData.lastRevisionAt = currentTask.lastRevisionAt;
    }

    update(taskRef, updateData)
      .then(() => {
        showToast(`Task "${selectedTaskForAssignment.taskName}" assigned to ${selectedTeamMember}!`, 'success');
        setShowAssignMemberModal(false);
        setSelectedTaskForAssignment(null);
        setSelectedTeamMember('');
      })
      .catch((error) => {
        console.error('Error assigning task:', error);
        showToast('Failed to assign task', 'error');
      });
  };

  // Handle Send for Approval - Opens modal to select social media employee
  const handleSendForApproval = (taskId, task) => {
    console.log('Send for Approval clicked');
    console.log('All Employees:', employees);
    console.log('Social Media Employees:', employees.filter(emp => emp.department === 'social-media' && emp.status === 'active'));
    setSelectedTaskForSending(task);
    setShowSocialMediaEmployeeModal(true);
  };

  // Handle sending task to selected social media employee
  const handleSendToSocialMediaEmployee = (selectedEmployee) => {
    if (!selectedEmployee || !selectedTaskForSending) return;

    const taskRef = ref(database, `tasks/${selectedTaskForSending.id}`);

    const updateData = {
      status: 'pending-client-approval',
      submittedAt: new Date().toISOString(),
      submittedBy: 'Video Head',
      department: 'social-media',
      socialMediaAssignedTo: selectedEmployee,
      originalDepartment: 'video',
      lastUpdated: new Date().toISOString(),
      revisionMessage: null
    };

    update(taskRef, updateData);
    showToast(`✅ Task sent to ${selectedEmployee} for client approval!`, 'success');
    setShowSocialMediaEmployeeModal(false);
    setSelectedTaskForSending(null);
  };

  const getStatusIcon = (status) => {
    if (status === 'posted') return <CheckCircle size={18} color="green" />;
    if (status === 'approved') return <CheckCircle size={18} color="green" />;
    if (status === 'completed') return <CheckCircle size={18} color="blue" />;
    if (status === 'revision-required') return <XCircle size={18} color="red" />;
    return <Clock size={18} color="orange" />;
  };

  // Handle Add Extra Task form submission
  const handleAddExtraTask = () => {
    // Validation
    if (!newTask.clientName || !newTask.ideas || !newTask.department || !newTask.taskType || !newTask.postDate) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    const tasksRef = ref(database, 'tasks');
    const taskData = {
      clientName: newTask.clientName,
      clientId: newTask.clientId || newTask.clientName,
      taskName: newTask.ideas,
      ideas: newTask.ideas,
      content: newTask.content,
      taskDescription: newTask.content || '',
      referenceLink: newTask.referenceLink || '',
      specialNotes: newTask.specialNotes || '',
      department: newTask.department,
      taskType: newTask.taskType,
      postDate: newTask.postDate,
      deadline: newTask.postDate,
      assignedToDept: newTask.department,
      assignedBy: 'Video Head',
      assignedTo: null, // Not assigned yet - will be assigned from All Tasks
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    push(tasksRef, taskData);
    showToast('Extra task added successfully!', 'success');

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
    setShowAddExtraTaskModal(false);

    // Automatically switch to All Tasks view to show the newly added unassigned task
    setShowAllTasks(true);
    setShowMyTasks(false);
    setShowEmployeeTasks(false);
    setShowExtraTasks(false);

    // Scroll to tasks section after a short delay
    setTimeout(() => {
      const tasksSection = document.querySelector('.video-tasks-card');
      if (tasksSection) {
        tasksSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 300);
  };

  // Handle client selection change
  const handleClientChange = (e) => {
    const selectedClientName = e.target.value;
    const selectedClient = clients.find(c => (c.name || c.clientName) === selectedClientName);

    setNewTask({
      ...newTask,
      clientName: selectedClientName,
      clientId: selectedClient ? (selectedClient.clientId || selectedClient.id) : ''
    });
  };

  // Filter tasks by month, active filter, status filter, and search term
  const filteredTasks = tasks.filter(task => {
    const taskDate = task.deadline;
    const monthMatch = taskDate && taskDate.startsWith(selectedMonth);

    // Check if task belongs to video department
    const isVideoDepartment = task.department === 'video' || task.originalDepartment === 'video';

    // Apply "My Tasks" filter - show only tasks assigned to Video Head
    let myTasksMatch = true;
    if (showMyTasks) {
      // Show tasks that are assigned to logged-in user specifically
      myTasksMatch = task.assignedTo === loggedInUserName || task.assignedTo === 'Video Head';
    } else if (showEmployeeTasks) {
      // Show tasks assigned to employees (not current head)
      myTasksMatch = task.assignedTo && task.assignedTo !== loggedInUserName && task.assignedTo !== 'Video Head';
    } else if (showAllTasks) {
      // Show all tasks (both Video Head and employees)
      // Apply assignment filter in All Tasks section
      if (assignmentFilter === 'head') {
        // Show only tasks assigned to Video Head (Head Tasks)
        myTasksMatch = task.assignedTo === loggedInUserName || task.assignedTo === 'Video Head';
      } else if (assignmentFilter === 'employee') {
        // Show only tasks assigned to employees (Employee Tasks)
        myTasksMatch = task.assignedTo && task.assignedTo !== loggedInUserName && task.assignedTo !== 'Video Head';
      } else {
        // Show all tasks
        myTasksMatch = true;
      }
    } else if (showExtraTasks) {
      // Show only extra tasks (tasks added via Add Extra Task feature OR assigned from Social Media Dashboard)
      myTasksMatch = task.assignedBy === 'Video Head' ||
        task.assignedBy === 'Graphics Head' ||
        task.assignedBy === 'Social Media Head' ||
        (task.assignedBy && task.assignedBy.includes('Social Media')) || // Social Media employees
        task.assignedFromSocialMedia === true; // Flag for tasks from social media
      if (myTasksMatch) {
        console.log('Extra task found:', task.taskName, 'assignedBy:', task.assignedBy, 'department:', task.department);
      }
    } else {
      // Default view - show only video department tasks
      myTasksMatch = isVideoDepartment;
    }

    // Apply active filter from statistics cards (takes priority)
    let cardFilterMatch = false;
    if (activeFilter === 'all') {
      cardFilterMatch = true;
    } else if (activeFilter === 'approved') {
      cardFilterMatch = task.status === 'approved' || task.status === 'posted';
    } else if (activeFilter === 'in-progress') {
      cardFilterMatch = task.status === 'in-progress' || task.status === 'assigned' || task.status === 'assigned-to-department';
    } else {
      cardFilterMatch = task.status === activeFilter;
    }

    // Apply status dropdown filter (only when no card filter is active)
    let dropdownFilterMatch = false;
    if (activeFilter !== 'all') {
      // If a card filter is active, ignore dropdown filter
      dropdownFilterMatch = true;
    } else {
      // Apply dropdown filter
      if (statusFilter === 'all') {
        dropdownFilterMatch = true;
      } else if (statusFilter === 'approved-posted') {
        dropdownFilterMatch = task.status === 'approved' || task.status === 'posted';
      } else {
        dropdownFilterMatch = task.status === statusFilter;
      }
    }

    // Apply search filter
    const searchMatch = searchTerm === '' ||
      task.taskName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignedTo?.toLowerCase().includes(searchTerm.toLowerCase());

    // Apply SuperAdmin employee filter (only when in SuperAdmin context)
    let employeeFilterMatch = true;
    if (isSuperAdmin && employeeFilter !== 'all') {
      employeeFilterMatch = task.assignedTo === employeeFilter;
    }

    // For Extra Tasks, don't require department match (they can be from other departments)
    const departmentMatch = showExtraTasks ? true : isVideoDepartment;

    return monthMatch && myTasksMatch && cardFilterMatch && dropdownFilterMatch && searchMatch && employeeFilterMatch && departmentMatch;
  });

  console.log(`Video tasks for ${selectedMonth}:`, filteredTasks.length, filteredTasks);

  // Function to get filtered tasks for Reports section
  const getReportsFilteredTasks = () => {
    let filtered = [...allMonthTasks];

    // Apply time period filter
    if (reportsTimePeriodFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(task => {
        return task.deadline === today || task.postDate === today;
      });
    } else if (reportsTimePeriodFilter === 'week') {
      const today = new Date();
      const currentDay = today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - currentDay);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      filtered = filtered.filter(task => {
        if (!task.deadline && !task.postDate) return false;
        const taskDate = new Date(task.deadline || task.postDate);
        return taskDate >= weekStart && taskDate <= weekEnd;
      });
    }
    // If 'month', use all allMonthTasks (already filtered by month)

    // Apply search filter
    if (reportsSearchQuery.trim()) {
      const query = reportsSearchQuery.toLowerCase();
      filtered = filtered.filter(task => {
        return (
          task.taskName?.toLowerCase().includes(query) ||
          task.clientName?.toLowerCase().includes(query) ||
          task.assignedTo?.toLowerCase().includes(query) ||
          task.projectName?.toLowerCase().includes(query)
        );
      });
    }

    // Apply employee filter
    if (reportsEmployeeFilter !== 'all') {
      filtered = filtered.filter(task => task.assignedTo === reportsEmployeeFilter);
    }

    // Apply client filter
    if (reportsClientFilter !== 'all') {
      filtered = filtered.filter(task => task.clientName === reportsClientFilter);
    }

    // Apply status filter
    if (reportsStatusFilter !== 'all') {
      if (reportsStatusFilter === 'completed') {
        filtered = filtered.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved');
      } else if (reportsStatusFilter === 'in-progress') {
        filtered = filtered.filter(t => t.status === 'in-progress' || t.status === 'assigned');
      } else if (reportsStatusFilter === 'pending') {
        filtered = filtered.filter(t => t.status === 'pending-client-approval');
      } else {
        filtered = filtered.filter(t => t.status === reportsStatusFilter);
      }
    }

    return filtered;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
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
      if (!task.deadline) return false;
      return task.deadline.startsWith(dateStr);
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

  // Function to check if task is overdue (shows for all tasks including completed/posted)
  const isTaskOverdue = (deadline) => {
    if (!deadline) return false;

    const today = new Date();
    const taskDeadline = new Date(deadline);
    return today > taskDeadline;
  };

  const handlePreviousMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    setSelectedCalendarDay(null);
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
    setSelectedCalendarDay(null);
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

  // Statistics calculations
  const allMonthTasks = tasks.filter(task => {
    if (!task.deadline) return false;
    const taskMonth = task.deadline.slice(0, 7);
    return taskMonth === selectedMonth;
  });

  // Handle statistics card clicks
  const handleStatCardClick = (filterType) => {
    setActiveFilter(filterType);

    // Clear search, selected tasks, and reset status filter when clicking statistics cards
    setSearchTerm('');
    setSelectedTasks([]);
    setStatusFilter('all'); // Reset dropdown filter
    setAssignmentFilter('all'); // Reset assignment filter

    // Scroll to tasks section
    setTimeout(() => {
      const tasksSection = document.querySelector('.video-tasks-card');
      if (tasksSection) {
        tasksSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);

    // Show toast message
    const filterMessages = {
      'all': `Showing all ${allMonthTasks.length} video tasks`,
      'in-progress': `Showing ${allMonthTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned' || t.status === 'assigned-to-department').length} in-progress and assigned tasks`,
      'pending-client-approval': `Showing ${allMonthTasks.filter(t => t.status === 'pending-client-approval').length} pending approval tasks`,
      'completed': `Showing ${allMonthTasks.filter(t => t.status === 'completed').length} completed tasks`,
      'approved': `Showing ${allMonthTasks.filter(t => t.status === 'approved' || t.status === 'posted').length} approved/posted tasks`,
      'revision-required': `Showing ${allMonthTasks.filter(t => t.status === 'revision-required').length} revision required tasks`
    };

    showToast(filterMessages[filterType] || 'Filter applied', 'info');
  };

  // Get icon based on task name or type
  const getTaskIcon = (taskName) => {
    const name = taskName?.toLowerCase() || '';
    if (name.includes('reel')) return '📄';
    if (name.includes('video')) return '🎥';
    if (name.includes('image') || name.includes('graphic')) return '🎨';
    if (name.includes('post')) return '📱';
    if (name.includes('story')) return '📸';
    return '📋'; // default icon
  };

  // Handle status dropdown toggle
  const toggleStatusDropdown = (taskId) => {
    setShowStatusDropdown(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  // Function to toggle task selection
  const toggleTaskSelection = (clientName, taskId) => {
    setSelectedTasks(prev => {
      const clientTasks = prev[clientName] || [];
      const isSelected = clientTasks.includes(taskId);

      if (isSelected) {
        return {
          ...prev,
          [clientName]: clientTasks.filter(id => id !== taskId)
        };
      } else {
        return {
          ...prev,
          [clientName]: [...clientTasks, taskId]
        };
      }
    });
  };

  // Function to check if task is selected
  const isTaskSelected = (clientName, taskId) => {
    return (selectedTasks[clientName] || []).includes(taskId);
  };

  // Function to get selected tasks count for a client
  const getSelectedTasksCount = (clientName) => {
    return (selectedTasks[clientName] || []).length;
  };

  // Function to download PDF report for selected tasks
  const downloadClientReport = (clientName, clientTasks) => {
    const selectedTaskIds = selectedTasks[clientName] || [];
    if (selectedTaskIds.length === 0) {
      showToast('Please select at least one task to download', 'warning');
      return;
    }

    const tasksToDownload = clientTasks.filter(task => selectedTaskIds.includes(task.id));

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Video Department - ${clientName} Tasks Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px; }
          .header h1 { color: #667eea; margin: 0; }
          .info { margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #667eea; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📹 Video Department Task Report</h1>
          <h2>${clientName}</h2>
          <p>Generated on ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}</p>
        </div>
        
        <div class="info">
          <div class="info-row">
            <strong>Total Selected Tasks:</strong>
            <span>${tasksToDownload.length}</span>
          </div>
          <div class="info-row">
            <strong>Month:</strong>
            <span>${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Task Name</th>
              <th>Project</th>
              <th>Assigned To</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Revisions</th>
            </tr>
          </thead>
          <tbody>
            ${tasksToDownload.map(task => `
              <tr>
                <td><strong>${task.taskName || 'N/A'}</strong></td>
                <td>${task.projectName || 'N/A'}</td>
                <td>${task.assignedTo || 'Not Assigned'}</td>
                <td>${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</td>
                <td><span class="status">${task.status?.replace(/-/g, ' ') || 'N/A'}</span></td>
                <td>${task.revisionCount || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated from the Video Department Dashboard</p>
          <p>Client: ${clientName}</p>
        </div>
      </body>
      </html>
    `;

    // Create a new window and print as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load then trigger print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      // Close the window after printing
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 500);

    showToast(`PDF report generated with ${tasksToDownload.length} task(s)`, 'success');

    // Clear selections after download
    setSelectedTasks(prev => ({
      ...prev,
      [clientName]: []
    }));
  };

  // Handle status update
  const handleStatusUpdate = (taskId, newStatus) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const updateData = {
      status: newStatus,
      lastUpdated: new Date().toISOString()
    };

    // Add start timestamp if status is in-progress
    if (newStatus === 'in-progress') {
      updateData.startedAt = new Date().toISOString();
    }

    // Set completedAt timestamp when marking task as completed
    if (newStatus === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    update(taskRef, updateData);
    showToast(`Task status updated to ${newStatus.replace(/-/g, ' ')}`, 'success');

    // Close the dropdown
    setShowStatusDropdown(prev => ({
      ...prev,
      [taskId]: false
    }));
  };

  // Generate individual PDF reports (one per task)
  const generateIndividualPDFs = () => {
    if (selectedTasks.length === 0) {
      showToast('Please select at least one task to generate reports', 'warning');
      return;
    }

    const selectedTasksData = tasks.filter(task => selectedTasks.includes(task.id));

    selectedTasksData.forEach((task, index) => {
      setTimeout(() => {
        generateSingleTaskPDF(task);
      }, index * 500); // Delay each PDF generation by 500ms
    });

    showToast(`Generating ${selectedTasks.length} individual PDF reports...`, 'success');
    setSelectedTasks([]);
    setShowDownloadOptions(false);
  };

  // Generate single task PDF
  const generateSingleTaskPDF = (task) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Video Task Report - ${task.taskName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #667eea; margin: 0; }
          .task-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .field { margin: 10px 0; }
          .label { font-weight: bold; color: #333; }
          .value { color: #666; margin-left: 10px; }
          .status { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📹 Video Task Report</h1>
          <p>Task: ${task.taskName}</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="task-card">
          <div class="field"><span class="label">Task Name:</span><span class="value">${task.taskName || 'N/A'}</span></div>
          <div class="field"><span class="label">Client:</span><span class="value">${task.clientName || 'N/A'}</span></div>
          <div class="field"><span class="label">Project:</span><span class="value">${task.projectName || 'N/A'}</span></div>
          <div class="field"><span class="label">Status:</span><span class="value">${task.status?.replace(/-/g, ' ') || 'N/A'}</span></div>
          <div class="field"><span class="label">Deadline:</span><span class="value">${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</span></div>
          <div class="field"><span class="label">Assigned To:</span><span class="value">${task.assignedTo || 'Not Assigned'}</span></div>
          <div class="field"><span class="label">Revisions:</span><span class="value">${task.revisionCount || 0}</span></div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 500);
  };

  // Generate PDF for ALL client tasks (regardless of selection)
  const downloadAllClientTasksPDF = () => {
    if (filteredTasks.length === 0) {
      showToast('No tasks available to download', 'warning');
      return;
    }

    const groupedTasks = groupTasksByClient(filteredTasks);

    // Create HTML content for combined PDF with all tasks
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Video Department - All Client Tasks Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px; }
          .header h1 { color: #667eea; margin: 0; }
          .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .client-section { margin-bottom: 30px; page-break-inside: avoid; }
          .client-header { background: #667eea; color: white; padding: 10px 15px; border-radius: 6px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
          th { background-color: #f1f3f5; color: #333; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📹 Video Department - All Client Tasks Report</h1>
          <p>Generated on ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}</p>
        </div>
        
        <div class="summary">
          <h3>Report Summary</h3>
          <p><strong>Total Tasks:</strong> ${filteredTasks.length}</p>
          <p><strong>Total Clients:</strong> ${Object.keys(groupedTasks).length}</p>
          <p><strong>Month:</strong> ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          <p><strong>Filter Applied:</strong> ${activeFilter === 'all' ? 'All Tasks' : activeFilter.replace(/-/g, ' ')}</p>
        </div>

        ${Object.entries(groupedTasks).map(([clientName, clientTasks]) => `
          <div class="client-section">
            <div class="client-header">
              <h2 style="margin: 0; font-size: 16px;">${clientName} (${clientTasks.length} tasks)</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Project</th>
                  <th>Assigned To</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Revisions</th>
                </tr>
              </thead>
              <tbody>
                ${clientTasks.map(task => `
                  <tr>
                    <td><strong>${task.taskName || 'N/A'}</strong></td>
                    <td>${task.projectName || 'N/A'}</td>
                    <td>${task.assignedTo || 'Not Assigned'}</td>
                    <td>${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</td>
                    <td><span class="status">${task.status?.replace(/-/g, ' ') || 'N/A'}</span></td>
                    <td>${task.revisionCount || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        <div class="footer">
          <p>This report was generated from the Video Department Dashboard</p>
          <p>Report includes all client tasks for the selected period</p>
        </div>
      </body>
      </html>
    `;

    // Create a new window and print as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load then trigger print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      // Close the window after printing
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 500);

    showToast(`PDF report generated with ${filteredTasks.length} task(s) from ${Object.keys(groupedTasks).length} client(s)`, 'success');
  };

  // Generate combined PDF report (all tasks in one PDF)
  const generateCombinedPDF = () => {
    if (selectedTasks.length === 0) {
      showToast('Please select at least one task to generate report', 'warning');
      return;
    }

    const selectedTasksData = tasks.filter(task => selectedTasks.includes(task.id));

    // Create HTML content for combined PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Video Tasks Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #667eea; margin: 0; }
          .header p { color: #666; margin: 5px 0; }
          .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #667eea; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📹 Video Department Tasks Report</h1>
          <p>Generated on ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}</p>
        </div>
        
        <div class="summary">
          <h3>Report Summary</h3>
          <p><strong>Total Tasks:</strong> ${selectedTasksData.length}</p>
          <p><strong>Clients:</strong> ${[...new Set(selectedTasksData.map(t => t.clientName))].join(', ')}</p>
          <p><strong>Date Range:</strong> ${selectedMonth}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Task Name</th>
              <th>Client</th>
              <th>Project</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Assigned To</th>
              <th>Revisions</th>
            </tr>
          </thead>
          <tbody>
            ${selectedTasksData.map(task => `
              <tr>
                <td><strong>${task.taskName || 'N/A'}</strong></td>
                <td>${task.clientName || 'N/A'}</td>
                <td>${task.projectName || 'N/A'}</td>
                <td><span class="status">${task.status?.replace(/-/g, ' ') || 'N/A'}</span></td>
                <td>${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</td>
                <td>${task.assignedTo || 'Not Assigned'}</td>
                <td>${task.revisionCount || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated from the Video Department Dashboard</p>
        </div>
      </body>
      </html>
    `;

    // Create a new window and print as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load then trigger print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      // Close the window after printing
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 500);

    showToast(`Combined PDF report generated with ${selectedTasks.length} task(s)`, 'success');
    setSelectedTasks([]);
    setShowDownloadOptions(false);
  };

  // Download Video Department Report as PDF with employee-wise data
  const downloadVideoDepartmentReportAsPDF = () => {
    const [year, month] = selectedMonth.split('-');
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    // Group tasks by employee
    const tasksByEmployee = {};
    allMonthTasks.forEach(task => {
      const employeeName = task.assignedTo || 'Unassigned';
      if (!tasksByEmployee[employeeName]) {
        tasksByEmployee[employeeName] = [];
      }
      tasksByEmployee[employeeName].push(task);
    });

    // Count unique employees
    const uniqueEmployees = Object.keys(tasksByEmployee).filter(name => name !== 'Unassigned').length;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Employee Report - ${monthName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
          .top-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
          .header { text-align: center; flex: 1; }
          .header h1 { font-size: 32px; font-weight: bold; margin: 0 0 5px 0; }
          .header .datetime { font-size: 14px; color: #666; margin-bottom: 20px; }
          .generated-info { text-align: right; font-size: 12px; color: #666; min-width: 200px; }
          .generated-info p { margin: 3px 0; }
          .title { font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; text-align: center; }
          .summary { margin: 20px 0; }
          .summary h3 { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .summary p { margin: 5px 0; font-size: 14px; }
          .employee-section { margin: 30px 0; page-break-inside: avoid; }
          .employee-header { font-size: 20px; font-weight: bold; margin: 20px 0 10px 0; color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
          .employee-stats { font-size: 14px; color: #666; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; }
          th { background: #667eea; color: white; padding: 12px; text-align: left; font-weight: 600; border: 1px solid #667eea; }
          td { padding: 10px 12px; border: 1px solid #ddd; font-size: 14px; }
          tr:nth-child(even) { background: #f9f9f9; }
          @media print { body { padding: 20px; } .employee-section { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="top-section">
          <div style="width: 200px;"></div>
          <div class="header">
            <h1>Digi Sayhadri</h1>
           
          </div>
          <div class="generated-info">
            <p><strong>Generated:</strong></p>
            <p>${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
            <p>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
          </div>
        </div>

        <div class="title">Video Department - Employee Report</div>

        <div class="summary">
          <h3>Department Summary:</h3>
          <p>Total Employees: ${uniqueEmployees} | Total Tasks: ${allMonthTasks.length}</p>
        </div>

        ${Object.entries(tasksByEmployee).map(([employeeName, employeeTasks]) => {
      const completed = employeeTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
      const pending = employeeTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned' || t.status === 'pending-client-approval').length;

      return `
            <div class="employee-section">
              <div class="employee-header">${employeeName}</div>
              <div class="employee-stats">Total Tasks: ${employeeTasks.length} | Completed: ${completed} | Pending: ${pending}</div>
              
              <table>
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${employeeTasks.map(task => {
        let statusText = 'Pending';
        if (task.status === 'completed' || task.status === 'posted' || task.status === 'approved') {
          statusText = 'Completed';
        } else if (task.status === 'in-progress' || task.status === 'assigned') {
          statusText = 'Pending';
        }

        // Format the post date (when task was assigned)
        let taskDate = 'N/A';
        if (task.postDate) {
          const date = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
          taskDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        }

        return `
                      <tr>
                        <td>${task.clientName || 'Unknown'}</td>
                        <td>${task.taskName || 'N/A'}</td>
                        <td>${statusText}</td>
                        <td>${taskDate}</td>
                      </tr>
                    `;
      }).join('')}
                </tbody>
              </table>
            </div>
          `;
    }).join('')}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    showToast('PDF report generated successfully!', 'success');
    setShowDownloadOptions(false);
  };

  // Download Video Department Report as Excel with client-wise data
  const downloadVideoDepartmentReportAsExcel = () => {
    const [year, month] = selectedMonth.split('-');
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Group tasks by client
    const clientData = {};
    allMonthTasks.forEach(task => {
      const clientName = task.clientName || 'Unknown';
      const clientId = task.clientId || 'N/A';

      if (!clientData[clientName]) {
        clientData[clientName] = {
          clientId: clientId,
          clientName: clientName,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0
        };
      }

      clientData[clientName].totalTasks++;

      if (task.status === 'completed' || task.status === 'posted' || task.status === 'approved') {
        clientData[clientName].completedTasks++;
      } else if (task.status === 'pending-client-approval') {
        clientData[clientName].pendingTasks++;
      } else if (task.status === 'in-progress' || task.status === 'assigned') {
        clientData[clientName].inProgressTasks++;
      }
    });

    const clientArray = Object.values(clientData);

    // Prepare CSV content
    let csvContent = `Video Department Report - ${monthName}\n\n`;

    // Summary Stats
    csvContent += `Summary Statistics\n`;
    csvContent += `Total Tasks,${allMonthTasks.length}\n`;
    csvContent += `Completed,${allMonthTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length}\n`;
    csvContent += `In Progress,${allMonthTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length}\n`;
    csvContent += `Pending,${allMonthTasks.filter(t => t.status === 'pending-client-approval').length}\n\n`;

    // Client-wise Summary
    csvContent += `Client-wise Task Summary\n`;
    csvContent += `Client ID,Client Name,Total Tasks,Completed Tasks,Pending Tasks,In Progress Tasks,Completion Rate\n`;
    clientArray.forEach(client => {
      const completionRate = client.totalTasks > 0 ? Math.round((client.completedTasks / client.totalTasks) * 100) : 0;
      csvContent += `"${client.clientId}","${client.clientName}",${client.totalTasks},${client.completedTasks},${client.pendingTasks},${client.inProgressTasks},${completionRate}%\n`;
    });
    csvContent += `\n`;

    // All Tasks Detail
    csvContent += `All Tasks Detail\n`;
    csvContent += `Client ID,Client Name,Task Name,Assigned Employee,Status,Date\n`;
    allMonthTasks.forEach(task => {
      let statusText = 'Pending';
      if (task.status === 'completed' || task.status === 'posted' || task.status === 'approved') {
        statusText = 'Completed';
      } else if (task.status === 'in-progress' || task.status === 'assigned') {
        statusText = 'Pending';
      }

      // Format the post date
      let taskDate = 'N/A';
      if (task.postDate) {
        const date = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
        taskDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      }

      csvContent += `"${task.clientId || 'N/A'}","${task.clientName || 'N/A'}","${task.taskName || 'N/A'}","${task.assignedTo || 'Unassigned'}","${statusText}","${taskDate}"\n`;
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-department-report-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Excel report downloaded successfully!', 'success');
    setShowDownloadOptions(false);
  };

  // Download Individual Client Report as PDF
  const downloadIndividualClientReport = (clientData) => {
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    // Get all tasks for this client
    const clientTasks = allMonthTasks.filter(task => task.clientName === clientData.clientName);
    const completionRate = clientData.totalTasks > 0 ? Math.round((clientData.completedTasks / clientData.totalTasks) * 100) : 0;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Client Report - ${clientData.clientName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 32px; font-weight: bold; margin: 0 0 5px 0; }
          .header .datetime { font-size: 14px; color: #666; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin: 30px 0 10px 0; }
          .generated { font-size: 14px; color: #666; margin-bottom: 30px; }
          .client-info { margin: 20px 0; }
          .client-info h3 { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .client-info p { margin: 5px 0; font-size: 14px; }
          .summary { margin: 20px 0; }
          .summary h3 { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .summary p { margin: 5px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #667eea; color: white; padding: 12px; text-align: left; font-weight: 600; border: 1px solid #667eea; }
          td { padding: 10px 12px; border: 1px solid #ddd; font-size: 14px; }
          tr:nth-child(even) { background: #f9f9f9; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Digi Sayhadri</h1>
          <div class="datetime">${currentDateTime}</div>
        </div>

        <div class="title">Client Report - ${clientData.clientName}</div>
        <div class="generated">Generated: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>

        <div class="client-info">
          <h3>Client Information:</h3>
          <p>Client ID: ${clientData.clientId}</p>
          <p>Client Name: ${clientData.clientName}</p>
        </div>

        <div class="summary">
          <h3>Task Summary:</h3>
          <p>Total Tasks: ${clientData.totalTasks}</p>
          <p>Completed: ${clientData.completedTasks}</p>
          <p>Pending: ${clientData.pendingTasks}</p>
          <p>In Progress: ${clientData.inProgressTasks}</p>
          <p>Completion Rate: ${completionRate}%</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Task</th>
              <th>Assigned Employee</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${clientTasks.map(task => {
      let statusText = 'Pending';

      if (task.status === 'completed' || task.status === 'posted' || task.status === 'approved') {
        statusText = 'Completed';
      } else if (task.status === 'in-progress' || task.status === 'assigned') {
        statusText = 'Pending';
      }

      // Format the post date (when task was assigned)
      let taskDate = 'N/A';
      if (task.postDate) {
        const date = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
        taskDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      }

      return `
                <tr>
                  <td>${task.clientId || 'N/A'}</td>
                  <td>${task.clientName || 'Unknown'}</td>
                  <td>${task.taskName || 'N/A'}</td>
                  <td>${task.assignedTo || 'Unassigned'}</td>
                  <td>${statusText}</td>
                  <td>${taskDate}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    showToast(`PDF report generated for ${clientData.clientName}`, 'success');
  };

  // Function to download multiple clients' tasks as PDF
  const downloadMultipleClientsPDF = (tasks) => {
    if (tasks.length === 0) {
      showToast('No tasks to download', 'warning');
      return;
    }

    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    // Group tasks by employee, then by client
    const tasksByEmployee = {};
    tasks.forEach(task => {
      const employeeName = task.assignedTo || 'Unassigned';
      if (!tasksByEmployee[employeeName]) {
        tasksByEmployee[employeeName] = {};
      }

      const clientName = task.clientName || 'Unknown';
      if (!tasksByEmployee[employeeName][clientName]) {
        tasksByEmployee[employeeName][clientName] = [];
      }
      tasksByEmployee[employeeName][clientName].push(task);
    });

    // Count unique employees
    const uniqueEmployees = Object.keys(tasksByEmployee).filter(e => e !== 'Unassigned').length;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Employee Report - ${monthName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
          .top-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
          .header { text-align: center; flex: 1; }
          .header h1 { font-size: 32px; font-weight: bold; margin: 0 0 5px 0; }
          .generated-info { text-align: right; font-size: 12px; color: #666; min-width: 200px; }
          .generated-info p { margin: 3px 0; }
          .title { font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; text-align: center; }
          .summary-info { font-size: 14px; color: #666; margin-bottom: 15px; text-align: center; }
          .employee-section { margin: 30px 0; page-break-inside: avoid; }
          .employee-header { background: #667eea; color: white; padding: 12px; font-size: 20px; font-weight: bold; margin-bottom: 15px; }
          .client-subsection { margin: 15px 0 25px 0; }
          .client-subheader { background: #e0e7ff; color: #4338ca; padding: 8px 12px; font-size: 16px; font-weight: 600; margin-bottom: 8px; border-left: 4px solid #667eea; }
          .summary { margin: 10px 0; padding: 8px; background: #f9fafb; font-size: 13px; }
          .summary p { margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th { background: #667eea; color: white; padding: 10px; text-align: left; font-weight: 600; border: 1px solid #667eea; font-size: 12px; }
          td { padding: 8px 10px; border: 1px solid #ddd; font-size: 12px; }
          tr:nth-child(even) { background: #f9f9f9; }
          @media print { body { padding: 20px; } .employee-section { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="top-section">
          <div style="width: 200px;"></div>
          <div class="header">
            <h1>Digi Sayhadri</h1>
          </div>
          <div class="generated-info">
            <p><strong>Generated:</strong></p>
            <p>${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
            <p>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
          </div>
        </div>

        <div class="title">Video Department</div>
        <div class="summary-info">Total Employees: ${uniqueEmployees} | Total Tasks: ${tasks.length}</div>
      

        ${Object.entries(tasksByEmployee).map(([employeeName, clientsMap]) => {
      // Calculate employee totals
      const employeeTasks = Object.values(clientsMap).flat();
      const completed = employeeTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
      const inProgress = employeeTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length;
      const pending = employeeTasks.filter(t => t.status === 'pending-client-approval').length;

      return `
            <div class="employee-section">
              <div class="employee-header">${employeeName}</div>
              <div class="summary">
                <p><strong>Total Tasks:</strong> ${employeeTasks.length} | <strong>Completed:</strong> ${completed} | <strong>In Progress:</strong> ${inProgress} | <strong>Pending:</strong> ${pending}</p>
              </div>
              
              ${Object.entries(clientsMap).map(([clientName, clientTasks]) => `
                <div class="client-subsection">
                  <div class="client-subheader">📁 ${clientName} (${clientTasks.length} task${clientTasks.length !== 1 ? 's' : ''})</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Task Name</th>
                        <th>Department</th>
                        <th>Post Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${clientTasks.map(task => {
        let taskPostDate = 'N/A';
        if (task.postDate) {
          const date = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
          taskPostDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        }

        return `
                          <tr>
                            <td>${task.taskName || 'N/A'}</td>
                            <td>${task.department || 'N/A'}</td>
                            <td>${taskPostDate}</td>
                            <td>${task.status?.replace(/-/g, ' ') || 'N/A'}</td>
                          </tr>
                        `;
      }).join('')}
                    </tbody>
                  </table>
                </div>
              `).join('')}
            </div>
          `;
    }).join('')}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    showToast(`PDF generated for ${Object.keys(tasksByEmployee).length} employee(s) with ${tasks.length} task(s)`, 'success');
  };

  // Function to download multiple clients' tasks as Excel
  const downloadMultipleClientsExcel = (tasks) => {
    if (tasks.length === 0) {
      showToast('No tasks to download', 'warning');
      return;
    }

    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Group tasks by client
    const tasksByClient = {};
    tasks.forEach(task => {
      const clientName = task.clientName || 'Unknown';
      if (!tasksByClient[clientName]) {
        tasksByClient[clientName] = [];
      }
      tasksByClient[clientName].push(task);
    });

    // Prepare CSV content
    let csvContent = `Multiple Clients Report - Video Department - ${monthName}\n`;
    csvContent += `Generated: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}\n`;
    csvContent += `Total Clients: ${Object.keys(tasksByClient).length} | Total Tasks: ${tasks.length}\n\n`;

    // Add data for each client
    Object.entries(tasksByClient).forEach(([clientName, clientTasks]) => {
      const completed = clientTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
      const inProgress = clientTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length;
      const pending = clientTasks.filter(t => t.status === 'pending-client-approval').length;

      csvContent += `\nClient: ${clientName}\n`;
      csvContent += `Total Tasks: ${clientTasks.length} | Completed: ${completed} | In Progress: ${inProgress} | Pending: ${pending}\n`;
      csvContent += `Task Name,Department,Post Date,Deadline,Status\n`;

      clientTasks.forEach(task => {
        let taskPostDate = 'N/A';
        if (task.postDate) {
          const date = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
          taskPostDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        }
        let taskDeadline = 'N/A';
        if (task.deadline) {
          const date = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
          taskDeadline = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        }

        csvContent += `"${task.taskName || 'N/A'}","${task.department || 'N/A'}","${taskPostDate}","${taskDeadline}","${task.status?.replace(/-/g, ' ') || 'N/A'}"\n`;
      });
      csvContent += `\n`;
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `multiple_clients_report_video_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast(`Excel file downloaded for ${Object.keys(tasksByClient).length} client(s) with ${tasks.length} task(s)`, 'success');
  };

  return (
    <div className="video-dashboard">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar Navigation */}
      <div className="video-sidebar">
        <div className="video-sidebar-header">
          <div className="video-sidebar-logo">
            <div className="video-sidebar-logo-icon">
              <Video size={24} />
            </div>
            <div className="video-sidebar-logo-text">
              <h2>Video</h2>
              <p>Department</p>
            </div>
          </div>
        </div>

        <nav className="video-sidebar-nav">
          <div className="video-sidebar-section">
            <h3 className="video-sidebar-section-title">Main</h3>
            <ul className="video-sidebar-menu">
              <li className="video-sidebar-menu-item">
                <button
                  onClick={() => {
                    // Reset all view states to show dashboard
                    setShowMyTasks(false);
                    setShowEmployeeTasks(false);
                    setShowAllTasks(false);
                    setShowExtraTasks(false);
                    setShowCalendar(false);
                    setShowReports(false);
                    showToast('Showing dashboard overview', 'info');
                  }}
                  className={`video-sidebar-menu-link ${!showMyTasks && !showEmployeeTasks && !showAllTasks && !showExtraTasks && !showCalendar && !showReports ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: (!showMyTasks && !showEmployeeTasks && !showAllTasks && !showExtraTasks && !showCalendar && !showReports) ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div className="video-sidebar-menu-icon">
                    <LayoutDashboard size={20} />
                  </div>
                  Dashboard
                </button>
              </li>
              <li className="video-sidebar-menu-item">
                <button
                  onClick={() => {
                    const newShowCalendar = !showCalendar;
                    setShowCalendar(newShowCalendar);

                    // Turn off all other views when Calendar is turned on
                    if (newShowCalendar) {
                      setShowMyTasks(false);
                      setShowEmployeeTasks(false);
                      setShowAllTasks(false);
                      setShowExtraTasks(false);
                      setShowReports(false);
                      showToast('Showing calendar view', 'info');
                    }
                  }}
                  className={`video-sidebar-menu-link ${showCalendar ? 'active' : ''}`}
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
                  <div className="video-sidebar-menu-icon">
                    <Calendar size={20} />
                  </div>
                  Show Calendar
                </button>
              </li>
              <li className="video-sidebar-menu-item">
                <button
                  onClick={() => {
                    const newShowMyTasks = !showMyTasks;
                    setShowMyTasks(newShowMyTasks);
                    setShowReports(false); // Close Reports when My Tasks is clicked
                    setShowCalendar(false); // Close Calendar when My Tasks is clicked

                    // Turn off Employee Tasks, All Tasks, and Extra Tasks if My Tasks is being turned on
                    if (newShowMyTasks) {
                      setShowEmployeeTasks(false);
                      setShowAllTasks(false);
                      setShowExtraTasks(false);
                    }

                    // Show toast notification
                    if (newShowMyTasks) {
                      const myTasksCount = tasks.filter(t => t.assignedTo === loggedInUserName || t.assignedTo === 'Video Head').length;
                      showToast(`Showing ${myTasksCount} task(s) assigned to you`, 'info');

                      // Scroll to tasks section
                      setTimeout(() => {
                        const tasksSection = document.querySelector('.video-tasks-card');
                        if (tasksSection) {
                          tasksSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    } else {
                      showToast('Showing all video tasks', 'info');
                    }
                  }}
                  className={`video-sidebar-menu-link ${showMyTasks ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showMyTasks ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="video-sidebar-menu-icon">
                    <User size={20} />
                  </div>
                  My Tasks
                </button>
              </li>
              <li className="video-sidebar-menu-item">
                {/* <button
                  onClick={() => {
                    const newShowEmployeeTasks = !showEmployeeTasks;
                    setShowEmployeeTasks(newShowEmployeeTasks);
                    setShowReports(false); // Close Reports when Employee Tasks is clicked

                    // Turn off My Tasks, All Tasks, and Extra Tasks if Employee Tasks is being turned on
                    if (newShowEmployeeTasks) {
                      setShowMyTasks(false);
                      setShowAllTasks(false);
                      setShowExtraTasks(false);
                    }

                    // Show toast notification
                    if (newShowEmployeeTasks) {
                      const employeeTasksCount = tasks.filter(t => t.assignedTo && t.assignedTo !== 'Video Head').length;
                      showToast(`Showing ${employeeTasksCount} task(s) assigned to employees`, 'info');

                      // Scroll to tasks section
                      setTimeout(() => {
                        const tasksSection = document.querySelector('.video-tasks-card');
                        if (tasksSection) {
                          tasksSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    } else {
                      showToast('Showing all video tasks', 'info');
                    }
                  }}
                  className={`video-sidebar-menu-link ${showEmployeeTasks ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showEmployeeTasks ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="video-sidebar-menu-icon">
                    <Users size={20} />
                  </div>
                  Employee Tasks 
                </button> */}
              </li>
              <li className="video-sidebar-menu-item">
                <button
                  onClick={() => {
                    const newShowAllTasks = !showAllTasks;
                    setShowAllTasks(newShowAllTasks);
                    setShowReports(false); // Close Reports when All Tasks is clicked
                    setShowCalendar(false); // Close Calendar when All Tasks is clicked

                    // Turn off My Tasks, Employee Tasks, and Extra Tasks if All Tasks is being turned on
                    if (newShowAllTasks) {
                      setShowMyTasks(false);
                      setShowEmployeeTasks(false);
                      setShowExtraTasks(false);
                    }

                    // Show toast notification
                    if (newShowAllTasks) {
                      const allTasksCount = tasks.length;
                      showToast(`Showing all ${allTasksCount} task(s) from all employees and video head`, 'info');

                      // Scroll to tasks section
                      setTimeout(() => {
                        const tasksSection = document.querySelector('.video-tasks-card');
                        if (tasksSection) {
                          tasksSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    } else {
                      showToast('Showing default video tasks', 'info');
                    }
                  }}
                  className={`video-sidebar-menu-link ${showAllTasks ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showAllTasks ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="video-sidebar-menu-icon">
                    <List size={20} />
                  </div>
                  All Tasks
                </button>
              </li>
              <li className="video-sidebar-menu-item">
                <button
                  onClick={() => {
                    const newShowExtraTasks = !showExtraTasks;
                    setShowExtraTasks(newShowExtraTasks);
                    setShowReports(false); // Close Reports when Extra Tasks is clicked
                    setShowCalendar(false); // Close Calendar when Extra Tasks is clicked

                    // Turn off other filters if Extra Tasks is being turned on
                    if (newShowExtraTasks) {
                      setShowMyTasks(false);
                      setShowEmployeeTasks(false);
                      setShowAllTasks(false);
                    }

                    // Show toast notification
                    if (newShowExtraTasks) {
                      const extraTasksCount = tasks.filter(t => t.assignedBy === 'Video Head' || t.assignedBy === 'Graphics Head').length;
                      showToast(`Showing ${extraTasksCount} extra task(s)`, 'info');

                      // Scroll to tasks section
                      setTimeout(() => {
                        const tasksSection = document.querySelector('.video-tasks-card');
                        if (tasksSection) {
                          tasksSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    } else {
                      showToast('Showing default video tasks', 'info');
                    }
                  }}
                  className={`video-sidebar-menu-link ${showExtraTasks ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showExtraTasks ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="video-sidebar-menu-icon">
                    <Plus size={20} />
                  </div>
                  Extra Tasks
                </button>
              </li>
              <li className="video-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowReports(!showReports);
                    setShowCalendar(false); // Close Calendar when Reports is clicked
                    // Turn off task filters when showing reports
                    if (!showReports) {
                      setShowMyTasks(false);
                      setShowEmployeeTasks(false);
                      setShowAllTasks(false);
                      setShowExtraTasks(false);
                    }
                  }}
                  className={`video-sidebar-menu-link ${showReports ? 'active' : ''}`}
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
                  <div className="video-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  Reports
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="video-sidebar-user">
          <div className="video-sidebar-user-info">
            <div className="video-sidebar-user-avatar">
              {loggedInUserName ? loggedInUserName.charAt(0).toUpperCase() : 'V'}
            </div>
            <div className="video-sidebar-user-details">
              <h4>{loggedInUserName || 'Video Manager'}</h4>
              <p>{loggedInUserEmail || 'video@gmail.com'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="video-btn video-btn-logout" style={{ marginTop: '12px', width: '100%' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="video-main-content">
        {/* Page Header - Hidden when Reports is active */}
        {!showReports && (
          <>
            <div className="video-header">
              <div className="video-header-content">
                <div className="video-header-left">
                  <div className="video-header-title">
                    <h1>Video Department Dashboard</h1>
                    <p>Create video content and send for approval</p>
                  </div>
                </div>
                <div className="video-header-right">
                  <div className="video-breadcrumb">
                    <span>Dashboard</span>
                    <span className="video-breadcrumb-separator">/</span>
                    <span>Video</span>
                  </div>
                  <div className="video-filter-group" style={{
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

            {/* Statistics Cards - Only show in dashboard view */}
            {!showMyTasks && !showEmployeeTasks && !showAllTasks && !showExtraTasks && !showCalendar && (
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
                    background: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: activeFilter === 'all'
                      ? '0 8px 24px rgba(255, 94, 98, 0.4)'
                      : '0 4px 15px rgba(255, 94, 98, 0.3)',
                    transform: activeFilter === 'all' ? 'translateY(-5px)' : 'translateY(0)',
                    border: activeFilter === 'all' ? '3px solid white' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFilter !== 'all') {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Briefcase size={30} color="white" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                      {allMonthTasks.length}
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>
                      Total Tasks
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                      Tasks for selected month
                    </p>
                  </div>
                </div>

                {/* In Progress Tasks */}
                <div
                  onClick={() => handleStatCardClick('in-progress')}
                  style={{
                    borderRadius: '16px',
                    padding: '24px',
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: activeFilter === 'in-progress'
                      ? '0 8px 24px rgba(0, 242, 254, 0.4)'
                      : '0 4px 15px rgba(0, 242, 254, 0.3)',
                    transform: activeFilter === 'in-progress' ? 'translateY(-5px)' : 'translateY(0)',
                    border: activeFilter === 'in-progress' ? '3px solid white' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFilter !== 'in-progress') {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Clock size={30} color="white" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                      {allMonthTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned' || t.status === 'assigned-to-department').length}
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>
                      In Progress
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                      In progress or assigned
                    </p>
                  </div>
                </div>

                {/* Pending Approval Tasks */}
                <div
                  onClick={() => handleStatCardClick('pending-client-approval')}
                  style={{
                    borderRadius: '16px',
                    padding: '24px',
                    background: 'linear-gradient(135deg, #EA384D 0%, #D31027 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: activeFilter === 'pending-client-approval'
                      ? '0 8px 24px rgba(211, 16, 39, 0.4)'
                      : '0 4px 15px rgba(211, 16, 39, 0.3)',
                    transform: activeFilter === 'pending-client-approval' ? 'translateY(-5px)' : 'translateY(0)',
                    border: activeFilter === 'pending-client-approval' ? '3px solid white' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFilter !== 'pending-client-approval') {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <AlertCircle size={30} color="white" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                      {allMonthTasks.filter(t => t.status === 'pending-client-approval').length}
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>
                      Pending Approval
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                      Awaiting client approval
                    </p>
                  </div>
                </div>

                {/* Completed Tasks */}
                <div
                  onClick={() => handleStatCardClick('completed')}
                  style={{
                    borderRadius: '16px',
                    padding: '24px',
                    background: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: activeFilter === 'completed'
                      ? '0 8px 24px rgba(86, 171, 47, 0.4)'
                      : '0 4px 15px rgba(86, 171, 47, 0.3)',
                    transform: activeFilter === 'completed' ? 'translateY(-5px)' : 'translateY(0)',
                    border: activeFilter === 'completed' ? '3px solid white' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFilter !== 'completed') {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle size={30} color="white" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                      {allMonthTasks.filter(t => t.status === 'completed').length}
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>
                      Completed
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                      Finished and ready
                    </p>
                  </div>
                </div>

                {/* Posted/Approved Tasks */}
                <div
                  onClick={() => handleStatCardClick('approved')}
                  style={{
                    borderRadius: '16px',
                    padding: '24px',
                    background: 'linear-gradient(135deg, #1dd1a1 0%, #10ac84 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: activeFilter === 'approved'
                      ? '0 8px 24px rgba(16, 172, 132, 0.4)'
                      : '0 4px 15px rgba(16, 172, 132, 0.3)',
                    transform: activeFilter === 'approved' ? 'translateY(-5px)' : 'translateY(0)',
                    border: activeFilter === 'approved' ? '3px solid white' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFilter !== 'approved') {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle size={30} color="white" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                      {allMonthTasks.filter(t => t.status === 'approved' || t.status === 'posted').length}
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>
                      Posted/Approved
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                      Published or client approved
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Report and Weekly Summary Cards - Only show in dashboard view */}
            {!showMyTasks && !showEmployeeTasks && !showAllTasks && !showExtraTasks && !showCalendar && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
              }}>
                {/* Daily Report Card */}
                <div className="employee-card daily-report-card" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(102,126,234,0.2)',
                  border: 'none',
                  color: 'white'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <div>
                      <h2 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        margin: '0 0 8px 0',
                        color: 'white'
                      }}>📊 Daily Report</h2>
                      <p style={{
                        fontSize: '14px',
                        margin: 0,
                        opacity: 0.9
                      }}>
                        {new Date().toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      📹 Video
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    {/* Today's Tasks */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          return allMonthTasks.filter(task =>
                            task.deadline === today || task.postDate === today
                          ).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>Today's Tasks</div>
                    </div>

                    {/* Completed Today */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          // Count only tasks completed by Video Head (My Tasks)
                          return allMonthTasks.filter(task => {
                            const isCompletedToday = task.completedAt && task.completedAt.startsWith(today);
                            const isMyTask = task.assignedTo === loggedInUserName || task.assignedTo === 'Video Head';
                            const isCompleted = task.status === 'completed' || task.status === 'approved' || task.status === 'posted';
                            return isCompletedToday && isMyTask && isCompleted;
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>Completed</div>
                    </div>

                    {/* Overdue Tasks */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          // Use the same logic as isTaskOverdue function
                          return allMonthTasks.filter(task => {
                            if (!task.deadline) return false;
                            const today = new Date();
                            const taskDeadline = new Date(task.deadline);
                            return today > taskDeadline;
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>Overdue</div>
                    </div>

                    {/* Success Rate */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          const totalTasks = allMonthTasks.length;
                          const completedTasks = allMonthTasks.filter(t =>
                            t.status === 'completed' || t.status === 'approved' || t.status === 'posted'
                          ).length;
                          return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                        })()}%
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>Success Rate</div>
                    </div>
                  </div>

                  {/* Quick Action */}
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      const todayTasks = allMonthTasks.filter(task =>
                        task.deadline === today || task.postDate === today
                      );
                      if (todayTasks.length > 0) {
                        // Scroll to tasks section
                        const tasksSection = document.querySelector('.video-tasks-card');
                        if (tasksSection) {
                          tasksSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      } else {
                        showToast('No tasks scheduled for today!', 'info');
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.3)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    🎯 View Today's Tasks
                  </button>
                </div>

                {/* Weekly Summary Card */}
                <div className="employee-card team-performance-card" style={{
                  background: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(86,171,47,0.2)',
                  border: 'none',
                  color: 'white'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <div>
                      <h2 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        margin: '0 0 8px 0',
                        color: 'white'
                      }}>📈 Weekly Summary</h2>
                      <p style={{
                        fontSize: '14px',
                        margin: 0,
                        opacity: 0.9
                      }}>
                        {(() => {
                          const today = new Date();
                          const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
                          const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                          return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                        })()}
                      </p>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      This Week
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    {/* Weekly Tasks */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          const today = new Date();
                          const currentDay = today.getDay();
                          const weekStart = new Date(today);
                          weekStart.setDate(today.getDate() - currentDay);
                          weekStart.setHours(0, 0, 0, 0);

                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          weekEnd.setHours(23, 59, 59, 999);

                          return allMonthTasks.filter(task => {
                            if (!task.deadline && !task.postDate) return false;
                            const taskDate = new Date(task.deadline || task.postDate);
                            return taskDate >= weekStart && taskDate <= weekEnd;
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>Weekly Tasks</div>
                    </div>

                    {/* Completed This Week */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          const today = new Date();
                          const currentDay = today.getDay();
                          const weekStart = new Date(today);
                          weekStart.setDate(today.getDate() - currentDay);
                          weekStart.setHours(0, 0, 0, 0);

                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          weekEnd.setHours(23, 59, 59, 999);

                          return allMonthTasks.filter(task => {
                            if (!task.deadline && !task.postDate) return false;
                            const taskDate = new Date(task.deadline || task.postDate);
                            const isThisWeek = taskDate >= weekStart && taskDate <= weekEnd;
                            const isCompleted = task.status === 'completed' || task.status === 'approved' || task.status === 'posted';
                            return isThisWeek && isCompleted;
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>Completed</div>
                    </div>

                    {/* In Progress */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          const today = new Date();
                          const currentDay = today.getDay();
                          const weekStart = new Date(today);
                          weekStart.setDate(today.getDate() - currentDay);
                          weekStart.setHours(0, 0, 0, 0);

                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          weekEnd.setHours(23, 59, 59, 999);

                          return allMonthTasks.filter(task => {
                            if (!task.deadline && !task.postDate) return false;
                            const taskDate = new Date(task.deadline || task.postDate);
                            const isThisWeek = taskDate >= weekStart && taskDate <= weekEnd;
                            return isThisWeek && task.status === 'in-progress';
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>In Progress</div>
                    </div>

                    {/* Department Efficiency */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {(() => {
                          const today = new Date();
                          const currentDay = today.getDay();
                          const weekStart = new Date(today);
                          weekStart.setDate(today.getDate() - currentDay);
                          weekStart.setHours(0, 0, 0, 0);

                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          weekEnd.setHours(23, 59, 59, 999);

                          const weekTasks = allMonthTasks.filter(task => {
                            if (!task.deadline && !task.postDate) return false;
                            const taskDate = new Date(task.deadline || task.postDate);
                            return taskDate >= weekStart && taskDate <= weekEnd;
                          });

                          const completed = weekTasks.filter(t =>
                            t.status === 'completed' || t.status === 'approved' || t.status === 'posted'
                          ).length;

                          const total = weekTasks.length;
                          return total > 0 ? Math.round((completed / total) * 100) : 0;
                        })()}%
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>My Efficiency</div>
                    </div>
                  </div>

                  {/* Quick Action */}
                  <button
                    onClick={() => {
                      // Scroll to tasks section
                      const tasksSection = document.querySelector('.video-tasks-card');
                      if (tasksSection) {
                        tasksSection.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start'
                        });
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.3)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    📊 View All Tasks
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Calendar View */}
        {showCalendar && (
          <div className="video-card" style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #d2d6de'
          }}>
            <div className="video-card-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={24} />
                <h2 className="video-card-title" style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0
                }}>📅 Video Task Calendar</h2>
              </div>
              <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>Tasks shown on their deadline dates</p>
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

        {/* Reports Section */}
        {showReports ? (
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
                  Video Department Reports
                </h2>
                <p style={{ margin: '6px 0 0 36px', color: '#6b7280', fontSize: '13px' }}>
                  Comprehensive analytics and performance metrics
                </p>
              </div>
              <div style={{ position: 'relative' }} className="download-dropdown">
                <button
                  onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(102,126,234,0.25)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.35)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(102,126,234,0.25)';
                  }}
                >
                  <Download size={16} />
                  Download Report
                </button>

                {showDownloadOptions && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
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
                      onClick={downloadVideoDepartmentReportAsPDF}
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
                      onClick={downloadVideoDepartmentReportAsExcel}
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
                  </div>
                )}
              </div>
            </div>

            {/* Filters Section */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              {/* Search Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background: '#f8f9fa',
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

                  // Reset client filter if the currently selected client doesn't have tasks for this employee
                  if (reportsClientFilter !== 'all' && newEmployee !== 'all') {
                    const employeeTasks = allMonthTasks.filter(t => t.assignedTo === newEmployee);
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
                {(() => {
                  const assignedEmployees = [...new Set(allMonthTasks
                    .filter(t => t.assignedTo && t.assignedTo !== 'Not Assigned' && t.assignedTo !== '')
                    .map(t => t.assignedTo))].sort();
                  return assignedEmployees.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ));
                })()}
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
                  // Filter clients based on selected employee
                  let tasksToFilter = allMonthTasks;
                  if (reportsEmployeeFilter !== 'all') {
                    tasksToFilter = allMonthTasks.filter(t => t.assignedTo === reportsEmployeeFilter);
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
                <option value="completed">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending Approval</option>
                <option value="revision-required">Revision Required</option>
              </select>

              {/* Time Period Filter */}
              <select
                value={reportsTimePeriodFilter}
                onChange={(e) => setReportsTimePeriodFilter(e.target.value)}
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
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>

              {/* Clear Filters Button */}
              {(reportsSearchQuery || reportsEmployeeFilter !== 'all' || reportsClientFilter !== 'all' || reportsStatusFilter !== 'all' || reportsTimePeriodFilter !== 'month') && (
                <button
                  onClick={() => {
                    setReportsSearchQuery('');
                    setReportsEmployeeFilter('all');
                    setReportsClientFilter('all');
                    setReportsStatusFilter('all');
                    setReportsTimePeriodFilter('month');
                  }}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#dc2626',
                    background: '#fef2f2',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '10px',
                padding: '18px',
                color: 'white',
                boxShadow: '0 2px 8px rgba(102,126,234,0.25)'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '6px' }}>
                  {getReportsFilteredTasks().length}
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
                  {getReportsFilteredTasks().filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.95 }}>Completed</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                borderRadius: '10px',
                padding: '18px',
                color: 'white',
                boxShadow: '0 2px 8px rgba(59,130,246,0.25)'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '6px' }}>
                  {getReportsFilteredTasks().filter(t => t.status === 'in-progress' || t.status === 'assigned').length}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.95 }}>In Progress</div>
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
                    const reportTasks = getReportsFilteredTasks();
                    const completed = reportTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
                    return reportTasks.length > 0 ? Math.round((completed / reportTasks.length) * 100) : 0;
                  })()}%
                </div>
                <div style={{ fontSize: '13px', opacity: 0.95 }}>Completion Rate</div>
              </div>
            </div>

            {/* Three Charts in One Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
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
                  const reportTasks = getReportsFilteredTasks();
                  const statusData = [
                    { label: 'In Progress', count: reportTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length, color: '#3b82f6', gradient: 'url(#blueGradient)' },
                    { label: 'Completed', count: reportTasks.filter(t => t.status === 'completed').length, color: '#10b981', gradient: 'url(#greenGradient)' },
                    { label: 'Pending', count: reportTasks.filter(t => t.status === 'pending-client-approval').length, color: '#f59e0b', gradient: 'url(#orangeGradient)' },
                    { label: 'Posted', count: reportTasks.filter(t => t.status === 'posted' || t.status === 'approved').length, color: '#8b5cf6', gradient: 'url(#purpleGradient)' }
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
                  const radius = 85;
                  const centerX = 130;
                  const centerY = 130;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                      <svg width="160" height="160" viewBox="0 0 260 260" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.07))' }}>
                        <defs>
                          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#34d399', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#fbbf24', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#f59e0b', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
                          </linearGradient>
                          <filter id="shadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                          </filter>
                        </defs>
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

                          currentAngle = endAngle;

                          return (
                            <path
                              key={index}
                              d={path}
                              fill={item.gradient}
                              stroke="#ffffff"
                              strokeWidth="3"
                              style={{ transition: 'all 0.3s ease' }}
                            />
                          );
                        })}
                        <circle cx={centerX} cy={centerY} r="50" fill="#ffffff" stroke="#f3f4f6" strokeWidth="2" filter="url(#shadow)" />
                        <text x={centerX} y={centerY - 8} textAnchor="middle" fontSize="28" fontWeight="700" fill="#1f2937">{total}</text>
                        <text x={centerX} y={centerY + 12} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">Total Tasks</text>
                      </svg>
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {statusData.filter(item => item.count > 0).map((item, index) => {
                          const percentage = total > 0 ? ((item.count / total) * 100).toFixed(0) : 0;
                          return (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              background: '#f9fafb',
                              borderRadius: '8px',
                              transition: 'all 0.2s'
                            }}>
                              <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px',
                                background: item.color,
                                boxShadow: `0 2px 4px ${item.color}40`,
                                flexShrink: 0
                              }}></div>
                              <span style={{ fontSize: '12px', color: '#1f2937', fontWeight: '600', flex: 1 }}>{item.label}</span>
                              <span style={{ fontSize: '13px', color: item.color, fontWeight: '700' }}>{item.count}</span>
                              <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>({percentage}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Task Completion Trend - Line Chart */}
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
                  Completion Trend (7 Days)
                </h3>
                {(() => {
                  const today = new Date();
                  const last7Days = [];
                  for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    last7Days.push(date);
                  }

                  const reportTasks = getReportsFilteredTasks();
                  const dailyData = last7Days.map(date => {
                    const dateStr = date.toISOString().split('T')[0];

                    // Count tasks that have this date as their postDate (when assigned)
                    const dayTasks = reportTasks.filter(task => {
                      if (!task.postDate) return false;
                      const taskDate = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
                      return taskDate.toISOString().split('T')[0] === dateStr;
                    });

                    // Count completed tasks on this date
                    const completed = reportTasks.filter(task => {
                      if (!task.completedAt && task.status !== 'completed' && task.status !== 'posted' && task.status !== 'approved') return false;
                      if (task.completedAt) {
                        const completedDate = task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
                        return completedDate.toISOString().split('T')[0] === dateStr;
                      }
                      return false;
                    }).length;

                    return {
                      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      total: dayTasks.length,
                      completed: completed
                    };
                  });

                  const maxValue = Math.max(...dailyData.map(d => Math.max(d.total, d.completed)), 1);
                  const chartWidth = 300;
                  const chartHeight = 200;
                  const padding = { top: 20, right: 15, bottom: 35, left: 35 };
                  const plotWidth = chartWidth - padding.left - padding.right;
                  const plotHeight = chartHeight - padding.top - padding.bottom;
                  const pointSpacing = plotWidth / (dailyData.length - 1);

                  const totalPoints = dailyData.map((d, i) => ({
                    x: padding.left + i * pointSpacing,
                    y: padding.top + plotHeight - (d.total / maxValue) * plotHeight,
                    value: d.total
                  }));

                  const completedPoints = dailyData.map((d, i) => ({
                    x: padding.left + i * pointSpacing,
                    y: padding.top + plotHeight - (d.completed / maxValue) * plotHeight,
                    value: d.completed
                  }));

                  const totalPath = `M ${totalPoints.map(p => `${p.x},${p.y}`).join(' L ')}`;
                  const completedPath = `M ${completedPoints.map(p => `${p.x},${p.y}`).join(' L ')}`;

                  const totalAreaPath = `${totalPath} L ${totalPoints[totalPoints.length - 1].x},${padding.top + plotHeight} L ${totalPoints[0].x},${padding.top + plotHeight} Z`;
                  const completedAreaPath = `${completedPath} L ${completedPoints[completedPoints.length - 1].x},${padding.top + plotHeight} L ${completedPoints[0].x},${padding.top + plotHeight} Z`;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <svg width={chartWidth} height={chartHeight}>
                        <defs>
                          <linearGradient id="totalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: '#667eea', stopOpacity: 0.05 }} />
                          </linearGradient>
                          <linearGradient id="completedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.4 }} />
                            <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0.05 }} />
                          </linearGradient>
                          <filter id="lineShadow">
                            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.2" />
                          </filter>
                        </defs>

                        {/* Grid lines */}
                        {[0, 1, 2, 3].map(i => {
                          const y = padding.top + (plotHeight / 3) * i;
                          const value = Math.round(maxValue * (1 - i / 3));
                          return (
                            <g key={i}>
                              <line
                                x1={padding.left}
                                y1={y}
                                x2={chartWidth - padding.right}
                                y2={y}
                                stroke="#e5e7eb"
                                strokeWidth="1"
                                strokeDasharray={i === 3 ? "0" : "3,3"}
                              />
                              <text
                                x={padding.left - 8}
                                y={y + 4}
                                fontSize="11"
                                fill="#6b7280"
                                textAnchor="end"
                                fontWeight="500"
                              >
                                {value}
                              </text>
                            </g>
                          );
                        })}

                        {/* Area fills */}
                        <path d={totalAreaPath} fill="url(#totalGradient)" />
                        <path d={completedAreaPath} fill="url(#completedGradient)" />

                        {/* Lines */}
                        <path d={totalPath} stroke="#667eea" strokeWidth="3" fill="none" filter="url(#lineShadow)" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={completedPath} stroke="#10b981" strokeWidth="3" fill="none" filter="url(#lineShadow)" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Points with values */}
                        {totalPoints.map((point, i) => (
                          <g key={`total-${i}`}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#667eea" stroke="#ffffff" strokeWidth="2.5" filter="url(#lineShadow)" />
                            {point.value > 0 && (
                              <text x={point.x} y={point.y - 12} fontSize="10" fill="#667eea" textAnchor="middle" fontWeight="700">
                                {point.value}
                              </text>
                            )}
                          </g>
                        ))}
                        {completedPoints.map((point, i) => (
                          <g key={`completed-${i}`}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" filter="url(#lineShadow)" />
                            {point.value > 0 && (
                              <text x={point.x} y={point.y - 12} fontSize="10" fill="#10b981" textAnchor="middle" fontWeight="700">
                                {point.value}
                              </text>
                            )}
                          </g>
                        ))}

                        {/* X-axis labels */}
                        {dailyData.map((d, i) => (
                          <text
                            key={i}
                            x={padding.left + i * pointSpacing}
                            y={chartHeight - padding.bottom + 20}
                            fontSize="10"
                            fill="#6b7280"
                            textAnchor="middle"
                            fontWeight="500"
                          >
                            {d.date.split(' ')[1]}
                          </text>
                        ))}
                      </svg>

                      {/* Legend */}
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', padding: '8px', background: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '20px', height: '3px', backgroundColor: '#667eea', borderRadius: '2px', boxShadow: '0 2px 4px rgba(102,126,234,0.3)' }}></div>
                          <span style={{ fontSize: '11px', color: '#1f2937', fontWeight: '600' }}>Total</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '20px', height: '3px', backgroundColor: '#10b981', borderRadius: '2px', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}></div>
                          <span style={{ fontSize: '11px', color: '#1f2937', fontWeight: '600' }}>Completed</span>
                        </div>
                      </div>
                    </div>
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
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '340px',
                  overflowY: 'auto',
                  paddingRight: '8px'
                }}>
                  {(() => {
                    // Initialize counts for ALL video department employees
                    const employeeCounts = {};

                    // First, add all video department employees with 0 tasks
                    employees
                      .filter(emp => emp.department === 'video' && emp.status === 'active')
                      .forEach(emp => {
                        const empName = emp.employeeName || emp.name;
                        if (empName) {
                          employeeCounts[empName] = { total: 0, completed: 0 };
                        }
                      });

                    // Then, count tasks for employees who have them
                    const reportTasks = getReportsFilteredTasks();
                    reportTasks.forEach(task => {
                      if (task.assignedTo && task.assignedTo !== 'Not Assigned') {
                        const emp = task.assignedTo;
                        if (!employeeCounts[emp]) {
                          employeeCounts[emp] = { total: 0, completed: 0 };
                        }
                        employeeCounts[emp].total++;
                        if (task.status === 'completed' || task.status === 'posted' || task.status === 'approved') {
                          employeeCounts[emp].completed++;
                        }
                      }
                    });

                    const sortedEmployees = Object.entries(employeeCounts)
                      .sort((a, b) => b[1].completed - a[1].completed);

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

            {/* Employee-wise Task Summary Table */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0,
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  Employee-wise Task Summary
                  {selectedClients.length > 0 && (
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#667eea',
                      background: '#e0e7ff',
                      padding: '4px 12px',
                      borderRadius: '12px'
                    }}>
                      {selectedClients.length} employee(s) selected
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      // Toggle checkboxes visibility
                      if (selectAllClientsMode) {
                        // Hide checkboxes
                        setSelectAllClientsMode(false);
                      } else {
                        // Show checkboxes and select all clients
                        setSelectAllClientsMode(true);

                        // Get all employees and select them
                        const allMonthTasks = filteredTasks;
                        const employeeData = {};
                        const employeeTasksMap = {};

                        allMonthTasks.forEach(task => {
                          const employeeName = task.assignedTo || 'Unassigned';
                          if (!employeeData[employeeName]) {
                            employeeData[employeeName] = true;
                            employeeTasksMap[employeeName] = [];
                          }
                          employeeTasksMap[employeeName].push(task.id);
                        });
                        const allEmployeeNames = Object.keys(employeeData);

                        setSelectedClients(allEmployeeNames);
                        setSelectedReportTasks(employeeTasksMap);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(102,126,234,0.2)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#5568d3';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(102,126,234,0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#667eea';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(102,126,234,0.2)';
                    }}
                  >
                    Select Employees
                  </button>
                  <button
                    onClick={() => {
                      // Clear all selections but keep checkboxes visible
                      setSelectedClients([]);
                      setSelectedReportTasks({});
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
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
                    Deselect All
                  </button>
                  {selectedClients.length > 0 && (
                    <>
                      <button
                        onClick={() => {
                          const allMonthTasks = filteredTasks;
                          // Filter tasks based on selected tasks per employee
                          const selectedClientsTasks = allMonthTasks.filter(t => {
                            const employeeName = t.assignedTo || 'Unassigned';
                            const employeeSelectedTasks = selectedReportTasks[employeeName] || [];
                            // If employee has specific tasks selected, only include those
                            // If employee is selected but no specific tasks, include all tasks for that employee
                            if (selectedClients.includes(employeeName)) {
                              return employeeSelectedTasks.length === 0 || employeeSelectedTasks.includes(t.id);
                            }
                            return false;
                          });

                          if (selectedClientsTasks.length === 0) {
                            showToast('No tasks selected for download', 'warning');
                            return;
                          }

                          downloadMultipleClientsPDF(selectedClientsTasks);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#10b981',
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
                          boxShadow: '0 2px 4px rgba(16,185,129,0.2)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#059669';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(16,185,129,0.3)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#10b981';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(16,185,129,0.2)';
                        }}
                      >
                        📄 Download PDF
                      </button>
                      <button
                        onClick={() => {
                          const allMonthTasks = filteredTasks;
                          // Filter tasks based on selected tasks per employee
                          const selectedClientsTasks = allMonthTasks.filter(t => {
                            const employeeName = t.assignedTo || 'Unassigned';
                            const employeeSelectedTasks = selectedReportTasks[employeeName] || [];
                            // If employee has specific tasks selected, only include those
                            // If employee is selected but no specific tasks, include all tasks for that employee
                            if (selectedClients.includes(employeeName)) {
                              return employeeSelectedTasks.length === 0 || employeeSelectedTasks.includes(t.id);
                            }
                            return false;
                          });

                          if (selectedClientsTasks.length === 0) {
                            showToast('No tasks selected for download', 'warning');
                            return;
                          }

                          downloadMultipleClientsExcel(selectedClientsTasks);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#10b981',
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
                          boxShadow: '0 2px 4px rgba(16,185,129,0.2)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#059669';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(16,185,129,0.3)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#10b981';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(16,185,129,0.2)';
                        }}
                      >
                        📊 Download Excel
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px'
                }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937', width: '40px' }}>
                        {selectAllClientsMode && <span>☑</span>}
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#1f2937' }}>Employee Name</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Total Tasks</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Completed</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Pending</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>In Progress</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Completion Rate</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const employeeData = {};
                      const reportTasks = getReportsFilteredTasks();

                      // Group tasks by employee
                      reportTasks.forEach(task => {
                        const employeeName = task.assignedTo || 'Unassigned';

                        if (!employeeData[employeeName]) {
                          employeeData[employeeName] = {
                            employeeName: employeeName,
                            totalTasks: 0,
                            completedTasks: 0,
                            pendingTasks: 0,
                            inProgressTasks: 0,
                            clientsMap: {} // Track clients for this employee
                          };
                        }

                        employeeData[employeeName].totalTasks++;

                        if (task.status === 'completed' || task.status === 'posted' || task.status === 'approved') {
                          employeeData[employeeName].completedTasks++;
                        } else if (task.status === 'pending-client-approval') {
                          employeeData[employeeName].pendingTasks++;
                        } else if (task.status === 'in-progress' || task.status === 'assigned') {
                          employeeData[employeeName].inProgressTasks++;
                        }

                        // Group tasks by client within each employee
                        const clientName = task.clientName || 'Unknown';
                        if (!employeeData[employeeName].clientsMap[clientName]) {
                          employeeData[employeeName].clientsMap[clientName] = [];
                        }
                        employeeData[employeeName].clientsMap[clientName].push(task);
                      });

                      const employeeArray = Object.values(employeeData).sort((a, b) => b.totalTasks - a.totalTasks);

                      return employeeArray.length > 0 ? employeeArray.map((employee, index) => {
                        const completionRate = employee.totalTasks > 0 ? Math.round((employee.completedTasks / employee.totalTasks) * 100) : 0;
                        const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                        const isExpanded = expandedReportClients[employee.employeeName];
                        const employeeTasks = allMonthTasks.filter(t => (t.assignedTo || 'Unassigned') === employee.employeeName);

                        return (
                          <React.Fragment key={index}>
                            <tr style={{
                              background: rowBg,
                              borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                              transition: 'background 0.2s',
                              cursor: 'pointer'
                            }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                              onMouseOut={(e) => e.currentTarget.style.background = rowBg}
                              onClick={() => {
                                setExpandedReportClients(prev => ({
                                  ...prev,
                                  [employee.employeeName]: !prev[employee.employeeName]
                                }));
                              }}
                            >
                              <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                  {selectAllClientsMode && (
                                    <input
                                      type="checkbox"
                                      checked={selectedClients.includes(employee.employeeName)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          // Select employee
                                          setSelectedClients(prev => [...prev, employee.employeeName]);
                                          // Also select all tasks for this employee
                                          const allTaskIds = employeeTasks.map(t => t.id);
                                          setSelectedReportTasks(prev => ({
                                            ...prev,
                                            [employee.employeeName]: allTaskIds
                                          }));
                                        } else {
                                          // Deselect employee
                                          setSelectedClients(prev => prev.filter(c => c !== employee.employeeName));
                                          // Also deselect all tasks for this employee
                                          setSelectedReportTasks(prev => ({
                                            ...prev,
                                            [employee.employeeName]: []
                                          }));
                                        }
                                      }}
                                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                  )}
                                  <span
                                    style={{
                                      fontSize: '16px',
                                      fontWeight: 'bold',
                                      color: '#667eea',
                                      transition: 'transform 0.2s',
                                      display: 'inline-block',
                                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                      cursor: 'pointer'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedReportClients(prev => ({
                                        ...prev,
                                        [employee.employeeName]: !prev[employee.employeeName]
                                      }));
                                    }}
                                  >
                                    ▶
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#1f2937' }}>{employee.employeeName}</td>
                              <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>{employee.totalTasks}</td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontWeight: '600' }}>{employee.completedTasks}</td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#f59e0b', fontWeight: '600' }}>{employee.pendingTasks}</td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#3b82f6', fontWeight: '600' }}>{employee.inProgressTasks}</td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <div style={{
                                    width: '60px',
                                    height: '6px',
                                    background: '#e5e7eb',
                                    borderRadius: '3px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${completionRate}%`,
                                      height: '100%',
                                      background: completionRate >= 75 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444',
                                      transition: 'width 0.3s ease'
                                    }}></div>
                                  </div>
                                  <span style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: completionRate >= 75 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444'
                                  }}>
                                    {completionRate}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => {
                                    // Download employee report
                                    const employeeTasksForDownload = allMonthTasks.filter(t => (t.assignedTo || 'Unassigned') === employee.employeeName);
                                    downloadMultipleClientsPDF(employeeTasksForDownload);
                                  }}
                                  style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 4px rgba(102,126,234,0.2)'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(102,126,234,0.3)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(102,126,234,0.2)';
                                  }}
                                >
                                  <Download size={12} />
                                  PDF
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Clients and Tasks */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="8" style={{ padding: '0', background: '#f9fafb' }}>
                                  <div style={{ padding: '16px', background: '#f9fafb' }}>
                                    <h4 style={{
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      marginBottom: '12px',
                                      color: '#1f2937',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      👤 Tasks for {employee.employeeName}
                                    </h4>

                                    {/* Group by clients */}
                                    {Object.entries(employee.clientsMap).map(([clientName, clientTasks], clientIndex) => (
                                      <div key={clientIndex} style={{ marginBottom: '20px' }}>
                                        <h5 style={{
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          marginBottom: '8px',
                                          color: '#667eea',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '8px 12px',
                                          background: '#e0e7ff',
                                          borderRadius: '6px'
                                        }}>
                                          📁 {clientName}
                                          <span style={{ fontSize: '11px', fontWeight: '500', color: '#6b7280' }}>
                                            ({clientTasks.length} task{clientTasks.length !== 1 ? 's' : ''})
                                          </span>
                                        </h5>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
                                          <thead>
                                            <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                                              {selectAllClientsMode && (
                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', width: '40px' }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedReportTasks[employee.employeeName]?.filter(id => clientTasks.some(t => t.id === id)).length === clientTasks.length}
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        // Select all tasks for this client under this employee
                                                        const allTaskIds = clientTasks.map(t => t.id);
                                                        setSelectedReportTasks(prev => {
                                                          const existingIds = prev[employee.employeeName] || [];
                                                          const newIds = [...new Set([...existingIds, ...allTaskIds])];
                                                          return {
                                                            ...prev,
                                                            [employee.employeeName]: newIds
                                                          };
                                                        });
                                                      } else {
                                                        // Deselect all tasks for this client under this employee
                                                        const taskIdsToRemove = clientTasks.map(t => t.id);
                                                        setSelectedReportTasks(prev => ({
                                                          ...prev,
                                                          [employee.employeeName]: (prev[employee.employeeName] || []).filter(id => !taskIdsToRemove.includes(id))
                                                        }));
                                                      }
                                                    }}
                                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                  />
                                                </th>
                                              )}
                                              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600' }}>Task Name</th>
                                              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Department</th>
                                              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Post Date</th>
                                              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Deadline</th>
                                              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Status</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {clientTasks.map((task, taskIndex) => {
                                              const taskRowBg = taskIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
                                              const statusColors = {
                                                'completed': '#10b981',
                                                'posted': '#8b5cf6',
                                                'approved': '#10b981',
                                                'in-progress': '#3b82f6',
                                                'assigned': '#f59e0b',
                                                'pending': '#f59e0b',
                                                'revision-required': '#ef4444'
                                              };
                                              const statusColor = statusColors[task.status] || '#6b7280';
                                              const isTaskSelected = selectedReportTasks[employee.employeeName]?.includes(task.id);

                                              return (
                                                <tr key={taskIndex} style={{
                                                  background: taskRowBg,
                                                  borderBottom: '1px solid #e5e7eb'
                                                }}>
                                                  {selectAllClientsMode && (
                                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                      <input
                                                        type="checkbox"
                                                        checked={isTaskSelected}
                                                        onChange={(e) => {
                                                          if (e.target.checked) {
                                                            // Add task to selected tasks
                                                            setSelectedReportTasks(prev => ({
                                                              ...prev,
                                                              [employee.employeeName]: [...(prev[employee.employeeName] || []), task.id]
                                                            }));
                                                          } else {
                                                            // Remove task from selected tasks
                                                            setSelectedReportTasks(prev => ({
                                                              ...prev,
                                                              [employee.employeeName]: (prev[employee.employeeName] || []).filter(id => id !== task.id)
                                                            }));
                                                          }
                                                        }}
                                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                      />
                                                    </td>
                                                  )}
                                                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#1f2937' }}>{task.taskName || 'N/A'}</td>
                                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px' }}>
                                                    <span style={{
                                                      padding: '4px 8px',
                                                      borderRadius: '12px',
                                                      background: '#e0e7ff',
                                                      color: '#4338ca',
                                                      fontWeight: '600',
                                                      textTransform: 'capitalize'
                                                    }}>
                                                      {task.department || 'N/A'}
                                                    </span>
                                                  </td>
                                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                                                    {task.postDate ? new Date(task.postDate).toLocaleDateString() : 'N/A'}
                                                  </td>
                                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                                                    {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}
                                                  </td>
                                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px' }}>
                                                    <span style={{
                                                      padding: '4px 8px',
                                                      borderRadius: '12px',
                                                      background: `${statusColor}20`,
                                                      color: statusColor,
                                                      fontWeight: '600',
                                                      textTransform: 'capitalize'
                                                    }}>
                                                      {(task.status || 'pending').replace(/-/g, ' ')}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }) : (
                        <tr>
                          <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                            No employee data available
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tasks Table - Only show when a task view is active */}
            {(showMyTasks || showEmployeeTasks || showAllTasks || showExtraTasks) && (
              <div className="video-card video-tasks-card" style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '32px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #d2d6de'
              }}>
                <div className="video-card-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '20px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #f1f5f9',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ flex: '1', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div>
                        <h2 className="video-card-title" style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: '#1e293b',
                          margin: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}>
                          📹 Video Tasks
                          {showMyTasks && (
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#667eea',
                              color: 'white',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <User size={14} /> My Assigned Tasks
                            </span>
                          )}
                          {showEmployeeTasks && (
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#10b981',
                              color: 'white',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Users size={14} /> Employee Tasks
                            </span>
                          )}
                        </h2>
                        {/* <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                    {showMyTasks
                      ? 'Tasks assigned to you (Video Head) to work on'
                      : showEmployeeTasks
                        ? 'Tasks assigned to your team members'
                        : 'Create video content and send for client approval'}
                  </p> */}
                      </div>

                      {/* View Toggle Buttons */}
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        backgroundColor: '#f3f4f6',
                        padding: '4px',
                        borderRadius: '8px',
                        marginLeft: 'auto'
                      }}>
                        <button
                          onClick={() => setViewMode('table')}
                          style={{
                            padding: '8px 16px',
                            border: 'none',
                            backgroundColor: viewMode === 'table' ? '#667eea' : 'transparent',
                            color: viewMode === 'table' ? 'white' : '#6b7280',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span>☰</span> List View
                        </button>
                        <button
                          onClick={() => {
                            setViewMode('grid');
                            setSelectedClientForCardView(null); // Reset selected client when switching to card view
                          }}
                          style={{
                            padding: '8px 16px',
                            border: 'none',
                            backgroundColor: viewMode === 'grid' ? '#667eea' : 'transparent',
                            color: viewMode === 'grid' ? 'white' : '#6b7280',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span>⊞</span> Card View
                        </button>
                      </div>
                    </div>

                    <div className="video-filter-group" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexShrink: 0,
                      flexWrap: 'wrap'
                    }}>
                      {/* Selection Counter - Left Side */}
                      {selectedTasks.length > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          backgroundColor: '#e0f2fe',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#0277bd',
                          fontWeight: '600',
                          border: '1px solid #b3e5fc'
                        }}>
                          <span>{selectedTasks.length} task(s) selected</span>
                          <button
                            onClick={() => setSelectedTasks([])}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0277bd',
                              cursor: 'pointer',
                              fontSize: '16px',
                              padding: '2px 4px',
                              borderRadius: '2px',
                              fontWeight: 'bold'
                            }}
                            title="Clear selection"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {/* Right Side - Search and Download */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginLeft: 'auto'
                      }}>
                        {/* Search Bar */}
                        <input
                          type="text"
                          placeholder="🔍 Search tasks, clients..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px',
                            backgroundColor: 'white',
                            minWidth: '250px',
                            outline: 'none',
                            transition: 'border-color 0.2s ease'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#667eea'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />

                        {/* Status Filter Dropdown */}
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setActiveFilter('all'); // Reset card filter when using dropdown
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px',
                            backgroundColor: 'white',
                            minWidth: '160px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="all">All Status</option>
                          <option value="assigned-to-department">Assigned</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="pending-client-approval">Pending Approval</option>
                          <option value="approved">Approved</option>
                          <option value="posted">Posted</option>
                          <option value="revision-required">Revision Required</option>
                        </select>

                        {/* Assignment Filter Dropdown - Only show in All Tasks section */}
                        {showAllTasks && (
                          <select
                            value={assignmentFilter}
                            onChange={(e) => {
                              setAssignmentFilter(e.target.value);
                              setActiveFilter('all'); // Reset card filter when using dropdown
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '14px',
                              backgroundColor: 'white',
                              minWidth: '160px',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="all">All Tasks</option>
                            <option value="head">Head Tasks</option>
                            <option value="employee">Employee Tasks</option>
                          </select>
                        )}

                        {/* Add Extra Task Button - Only show in Extra Tasks section */}
                        {showExtraTasks && (
                          <button
                            onClick={() => setShowAddExtraTaskModal(true)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 16px',
                              backgroundColor: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              minWidth: '160px'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#5568d3';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#667eea';
                            }}
                          >
                            <Plus size={16} />
                            Add Extra Task
                          </button>
                        )}

                        {/* Download PDF Button - Always Clickable */}
                        <button
                          onClick={downloadAllClientTasksPDF}
                          disabled={filteredTasks.length === 0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            backgroundColor: filteredTasks.length > 0 ? '#10b981' : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: filteredTasks.length > 0 ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s ease',
                            minWidth: '160px'
                          }}
                          onMouseEnter={(e) => {
                            if (filteredTasks.length > 0) {
                              e.target.style.backgroundColor = '#059669';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (filteredTasks.length > 0) {
                              e.target.style.backgroundColor = '#10b981';
                            }
                          }}
                        >
                          📄 Download PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selection Status Bar */}
                {selectedTasks.length > 0 && (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    border: '1px solid #e0f2fe',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#0369a1',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      <span>✓ {selectedTasks.length} video task{selectedTasks.length !== 1 ? 's' : ''} selected for download</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <button
                        onClick={() => setSelectedTasks([])}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: '1px solid #0369a1',
                          color: '#0369a1',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Clear All
                      </button>
                      <button
                        onClick={generateCombinedPDF}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#0369a1',
                          border: 'none',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Download Now
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative' }}>
                  {filteredTasks.length === 0 ? (
                    <div className="video-empty-state" style={{
                      textAlign: 'center',
                      padding: '60px 20px',
                      color: '#6c757d'
                    }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '600' }}>No Video Tasks Found</h3>
                      <p style={{ margin: 0, fontSize: '14px' }}>
                        No video tasks match your current filters{searchTerm && ` for "${searchTerm}"`}.
                        Try adjusting your search or status filter.
                      </p>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          style={{
                            marginTop: '12px',
                            padding: '8px 16px',
                            backgroundColor: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  ) : viewMode === 'grid' ? (
                    /* Card View - Client Cards and Task Cards */
                    <div>
                      {/* Back Button and Download Buttons - Show when a client is selected */}
                      {selectedClientForCardView && (
                        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setSelectedClientForCardView(null)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 20px',
                              backgroundColor: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a6fd8'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
                          >
                            ← Back to All Clients
                          </button>

                          {/* Download All Button */}
                          <button
                            onClick={() => {
                              const clientTasks = groupTasksByClient(filteredTasks)[selectedClientForCardView];
                              if (clientTasks && clientTasks.length > 0) {
                                // Select all tasks for this client
                                setSelectedTasks(prev => ({
                                  ...prev,
                                  [selectedClientForCardView]: clientTasks.map(t => t.id)
                                }));
                                // Download immediately
                                setTimeout(() => {
                                  downloadClientReport(selectedClientForCardView, clientTasks);
                                }, 100);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 20px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                          >
                            📥 Download All
                          </button>

                          {/* Download Selected Button */}
                          {getSelectedTasksCount(selectedClientForCardView) > 0 && (
                            <button
                              onClick={() => {
                                const clientTasks = groupTasksByClient(filteredTasks)[selectedClientForCardView];
                                downloadClientReport(selectedClientForCardView, clientTasks);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                            >
                              📥 Download Selected ({getSelectedTasksCount(selectedClientForCardView)})
                            </button>
                          )}
                        </div>
                      )}

                      <div style={{
                        display: selectedClientForCardView ? 'block' : 'grid',
                        gridTemplateColumns: selectedClientForCardView ? 'none' : 'repeat(3, 1fr)',
                        gap: '20px',
                        padding: '10px',
                        width: '100%'
                      }}>
                        {Object.entries(groupTasksByClient(filteredTasks))
                          .filter(([clientName]) => !selectedClientForCardView || clientName === selectedClientForCardView)
                          .map(([clientName, clientTasks]) => {
                            const totalTasks = clientTasks.length;
                            const completedTasks = clientTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
                            const inProgressTasks = clientTasks.filter(t => t.status === 'in-progress').length;
                            const firstTask = clientTasks[0];

                            return (
                              <React.Fragment key={clientName}>
                                {/* Client Summary Card - Only show when NOT expanded */}
                                {!selectedClientForCardView && (
                                  <div style={{
                                    backgroundColor: 'white',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    overflow: 'hidden',
                                    border: '1px solid #e9ecef',
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer'
                                  }}
                                    onClick={() => setSelectedClientForCardView(clientName)}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-4px)';
                                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                    }}>
                                    {/* Card Header */}
                                    <div style={{
                                      background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
                                      padding: '20px',
                                      color: 'white',
                                      position: 'relative'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                        <div style={{
                                          width: '50px',
                                          height: '50px',
                                          borderRadius: '50%',
                                          backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '20px',
                                          fontWeight: '700'
                                        }}>
                                          {clientName.charAt(0)}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                            {clientName}
                                          </h3>
                                          <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                                            {firstTask.clientId || 'N/A'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Card Body - Summary */}
                                    <div style={{ padding: '20px' }}>
                                      {/* Stats Row */}
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '12px',
                                        marginBottom: '16px'
                                      }}>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>
                                            {totalTasks}
                                          </div>
                                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Total Tasks</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                                            {completedTasks}
                                          </div>
                                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Completed</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                                            {inProgressTasks}
                                          </div>
                                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>In Progress</div>
                                        </div>
                                      </div>

                                      {/* Click to expand hint */}
                                      <div style={{
                                        textAlign: 'center',
                                        marginTop: '12px',
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        fontStyle: 'italic'
                                      }}>
                                        Click to view all tasks
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Expanded Task Cards - Show when this client is selected */}
                                {selectedClientForCardView === clientName && (
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '20px',
                                    marginTop: '0',
                                    padding: '0',
                                    width: '100%',
                                    maxWidth: '100%'
                                  }}>
                                    {clientTasks.map((task) => (
                                      <div key={task.id} style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        boxShadow: isTaskSelected(clientName, task.id)
                                          ? '0 8px 24px rgba(102,126,234,0.3)'
                                          : '0 4px 12px rgba(0,0,0,0.1)',
                                        overflow: 'hidden',
                                        border: isTaskSelected(clientName, task.id)
                                          ? '3px solid #667eea'
                                          : '1px solid #e9ecef',
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        minHeight: '380px'
                                      }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.transform = 'translateY(-4px)';
                                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'translateY(0)';
                                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                        }}>
                                        {/* Card Header with Avatar */}
                                        <div style={{
                                          background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
                                          padding: '28px 24px 20px 24px',
                                          color: 'white',
                                          position: 'relative'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                            <div style={{
                                              width: '50px',
                                              height: '50px',
                                              borderRadius: '50%',
                                              backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '20px',
                                              fontWeight: '700'
                                            }}>
                                              {task.clientName?.charAt(0) || 'C'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span>{task.taskName}</span>
                                                {task.assignedBy === 'Video Head' && (
                                                  <span style={{
                                                    backgroundColor: '#8b5cf6',
                                                    color: 'white',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: 'bold'
                                                  }}>
                                                    EXTRA
                                                  </span>
                                                )}
                                              </h3>
                                              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                                                {task.clientName}
                                              </p>
                                            </div>
                                            <input
                                              type="checkbox"
                                              checked={isTaskSelected(clientName, task.id)}
                                              onChange={() => toggleTaskSelection(clientName, task.id)}
                                              style={{
                                                width: '20px',
                                                height: '20px',
                                                cursor: 'pointer'
                                              }}
                                            />
                                          </div>
                                        </div>

                                        {/* Card Body */}
                                        <div style={{ padding: '20px 24px' }}>
                                          {/* Stats Row */}
                                          <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: '12px',
                                            marginBottom: '16px'
                                          }}>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>
                                                {task.projectName?.length > 10 ? task.projectName.substring(0, 10) + '...' : task.projectName}
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Project</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{
                                                fontSize: '24px',
                                                fontWeight: '700',
                                                color: task.revisionCount > 0 ? '#ef4444' : '#10b981'
                                              }}>
                                                {task.revisionCount || 0}
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Revisions</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '15px', fontWeight: '700', color: '#8b5cf6' }}>
                                                {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Due Date</div>
                                            </div>
                                          </div>

                                          {/* Details */}
                                          <div style={{ marginBottom: '16px' }}>
                                            <div style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              marginBottom: '12px',
                                              paddingBottom: '12px',
                                              borderBottom: '1px solid #e5e7eb'
                                            }}>
                                              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Department:</span>
                                              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase' }}>
                                                {task.department}
                                              </span>
                                            </div>

                                            <div style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              marginBottom: '12px',
                                              paddingBottom: '12px',
                                              borderBottom: '1px solid #e5e7eb'
                                            }}>
                                              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Assigned To:</span>
                                              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                                                {task.assignedTo || 'Not Assigned'}
                                              </span>
                                            </div>

                                            <div style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center'
                                            }}>
                                              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Status:</span>
                                              <select
                                                value={task.status}
                                                onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                                                style={{
                                                  padding: '6px 12px',
                                                  borderRadius: '8px',
                                                  fontSize: '12px',
                                                  fontWeight: '600',
                                                  border: '2px solid #e0e0e0',
                                                  backgroundColor: getStatusColor(task.status),
                                                  color: 'white',
                                                  cursor: 'pointer',
                                                  outline: 'none'
                                                }}
                                              >
                                                <option value="assigned-to-department" style={{ backgroundColor: 'white', color: '#333' }}>Assigned to Department</option>
                                                <option value="in-progress" style={{ backgroundColor: 'white', color: '#333' }}>In Progress</option>
                                                <option value="completed" style={{ backgroundColor: 'white', color: '#333' }}>Completed</option>
                                                <option value="pending-client-approval" style={{ backgroundColor: 'white', color: '#333' }}>Pending Client Approval</option>
                                                <option value="approved" style={{ backgroundColor: 'white', color: '#333' }}>Approved</option>
                                                <option value="posted" style={{ backgroundColor: 'white', color: '#333' }}>Posted</option>
                                                <option value="revision-required" style={{ backgroundColor: 'white', color: '#333' }}>Revision Required</option>
                                              </select>
                                            </div>
                                          </div>

                                          {/* Action Buttons */}
                                          <div style={{ display: 'flex', gap: '10px' }}>
                                            {task.assignedTo && task.assignedTo !== 'Not Assigned' ? (
                                              <button
                                                style={{
                                                  flex: 1,
                                                  padding: '12px',
                                                  backgroundColor: '#10b981',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '10px',
                                                  cursor: 'default',
                                                  fontSize: '14px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '6px'
                                                }}
                                              >
                                                ✓ Assigned
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  setSelectedTaskForAssignment(task);
                                                  setShowAssignMemberModal(true);
                                                }}
                                                style={{
                                                  flex: 1,
                                                  padding: '12px',
                                                  backgroundColor: '#3b82f6',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '10px',
                                                  cursor: 'pointer',
                                                  fontSize: '14px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '6px'
                                                }}
                                              >
                                                Assign Member
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Overdue Badge */}
                                        {isTaskOverdue(task.deadline) && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '8px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            zIndex: 10,
                                            textTransform: 'uppercase'
                                          }}>
                                            OVERDUE
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    /* Table View */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {Object.entries(groupTasksByClient(filteredTasks)).map(([clientName, clientTasks]) => {
                        const isExpanded = expandedClients[clientName];
                        const totalTasks = clientTasks.length;
                        const completedTasks = clientTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
                        const inProgressTasks = clientTasks.filter(t => t.status === 'in-progress').length;

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
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                  backgroundColor: 'rgba(255,255,255,0.2)',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}>
                                  {clientTasks[0]?.clientId || 'N/A'}
                                </div>
                                <div>
                                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                    {clientName}
                                  </h3>
                                  <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>
                                    {totalTasks} video task{totalTasks !== 1 ? 's' : ''} • {completedTasks} completed • {inProgressTasks} in progress
                                    {getSelectedTasksCount(clientName) > 0 && ` • ${getSelectedTasksCount(clientName)} selected`}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {isExpanded && getSelectedTasksCount(clientName) > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadClientReport(clientName, clientTasks);
                                    }}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: 'rgba(255,255,255,0.2)',
                                      color: 'white',
                                      border: '2px solid rgba(255,255,255,0.3)',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                                    }}
                                  >
                                    📄 Download Report ({getSelectedTasksCount(clientName)})
                                  </button>
                                )}
                                <div style={{
                                  fontSize: '24px',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.3s ease'
                                }}>
                                  ▼
                                </div>
                              </div>
                            </div>

                            {/* Client Video Tasks */}
                            {isExpanded && (
                              <div style={{ padding: '0' }}>
                                <table style={{
                                  width: '100%',
                                  borderCollapse: 'collapse',
                                  fontSize: '14px'
                                }}>
                                  <thead>
                                    <tr style={{
                                      backgroundColor: '#f8f9fa',
                                      borderBottom: '1px solid #dee2e6'
                                    }}>
                                      {showMyTasks ? (
                                        <>
                                          {/* My Tasks Headers */}
                                          <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Task Name</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Content</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Reference Link</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Special Notes</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Deadline</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Start</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Done</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Revision Timeline</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Status</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #dee2e6' }}>Revisions</th>
                                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                                        </>
                                      ) : (
                                        <>
                                          {/* Regular Headers */}
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            width: '40px',
                                            borderRight: '1px solid #dee2e6'
                                          }}>
                                            <input
                                              type="checkbox"
                                              checked={getSelectedTasksCount(clientName) === clientTasks.length && clientTasks.length > 0}
                                              onChange={() => {
                                                const allSelected = getSelectedTasksCount(clientName) === clientTasks.length;
                                                if (allSelected) {
                                                  setSelectedTasks(prev => ({ ...prev, [clientName]: [] }));
                                                } else {
                                                  setSelectedTasks(prev => ({ ...prev, [clientName]: clientTasks.map(t => t.id) }));
                                                }
                                              }}
                                              style={{
                                                cursor: 'pointer',
                                                transform: 'scale(1.1)'
                                              }}
                                            />
                                          </th>
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'left',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            borderRight: '1px solid #dee2e6'
                                          }}>Task Name</th>
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            borderRight: '1px solid #dee2e6',
                                            width: '120px'
                                          }}>Project</th>
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            borderRight: '1px solid #dee2e6',
                                            width: '100px'
                                          }}>Due Date</th>
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            borderRight: '1px solid #dee2e6',
                                            width: '140px'
                                          }}>Status</th>
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            borderRight: '1px solid #dee2e6',
                                            width: '80px'
                                          }}>Revisions</th>
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            borderRight: '1px solid #dee2e6',
                                            width: '120px'
                                          }}>Assigned To</th>
                                          <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#6c757d',
                                            textTransform: 'uppercase',
                                            width: '120px'
                                          }}>Action</th>
                                        </>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {clientTasks.map(task => (
                                      <tr key={task.id} style={{
                                        borderBottom: '1px solid #f1f3f4',
                                        backgroundColor: isTaskSelected(clientName, task.id) ? '#f0f7ff' : 'white',
                                        transition: 'background-color 0.2s ease'
                                      }}>
                                        {/* Conditional rendering based on My Tasks view */}
                                        {showMyTasks ? (
                                          <>
                                            {/* Task Name */}
                                            <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '14px', borderRight: '1px solid #f1f3f4' }}>
                                              <div>
                                                <div style={{ fontWeight: '600' }}>{task.taskName || 'N/A'}</div>
                                                {task.revisionMessage && (
                                                  <div style={{
                                                    marginTop: '8px',
                                                    padding: '8px 12px',
                                                    backgroundColor: '#fff3cd',
                                                    border: '1px solid #ffc107',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    color: '#856404'
                                                  }}>
                                                    <strong>⚠️ Revision Required:</strong> {task.revisionMessage}
                                                  </div>
                                                )}
                                              </div>
                                            </td>

                                            {/* Content */}
                                            <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '13px', borderRight: '1px solid #f1f3f4' }}>
                                              {(task.taskDescription || task.content) ? (
                                                <button
                                                  onClick={() => {
                                                    setModalTitle('Content');
                                                    setModalContent(task.taskDescription || task.content);
                                                    setShowNotesModal(true);
                                                  }}
                                                  style={{
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                  }}
                                                >
                                                  View More
                                                </button>
                                              ) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>N/A</span>
                                              )}
                                            </td>

                                            {/* Reference Link */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #f1f3f4' }}>
                                              {task.referenceLink ? (
                                                <button
                                                  onClick={() => window.open(task.referenceLink, '_blank')}
                                                  style={{
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                  }}
                                                >
                                                  View More
                                                </button>
                                              ) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                                              )}
                                            </td>

                                            {/* Special Notes */}
                                            <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '13px', borderRight: '1px solid #f1f3f4' }}>
                                              {task.specialNotes ? (
                                                <button
                                                  onClick={() => {
                                                    setModalTitle('Special Notes');
                                                    setModalContent(task.specialNotes);
                                                    setShowNotesModal(true);
                                                  }}
                                                  style={{
                                                    backgroundColor: '#f59e0b',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                  }}
                                                >
                                                  View More
                                                </button>
                                              ) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                                              )}
                                            </td>

                                            {/* Deadline */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px', borderRight: '1px solid #f1f3f4' }}>
                                              {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                              }) : 'N/A'}
                                            </td>

                                            {/* Start */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px', borderRight: '1px solid #f1f3f4' }}>
                                              {task.startedAt ? (
                                                <div>
                                                  <div>{new Date(task.startedAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                  })}</div>
                                                  <div style={{ fontSize: '11px', color: '#999' }}>
                                                    {new Date(task.startedAt).toLocaleTimeString('en-US', {
                                                      hour: '2-digit',
                                                      minute: '2-digit'
                                                    })}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>Not started</span>
                                              )}
                                            </td>

                                            {/* Done */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px', borderRight: '1px solid #f1f3f4' }}>
                                              {task.completedAt ? new Date(task.completedAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                              }) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>No timeline</span>
                                              )}
                                            </td>

                                            {/* Revision Timeline */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px', borderRight: '1px solid #f1f3f4' }}>
                                              {task.lastRevisionAt ? new Date(task.lastRevisionAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                              }) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>No timeline</span>
                                              )}
                                            </td>

                                            {/* Status */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #f1f3f4' }}>
                                              <span style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                backgroundColor: task.status === 'approved' || task.status === 'posted' ? '#10b981' :
                                                  task.status === 'completed' ? '#3b82f6' :
                                                    task.status === 'in-progress' ? '#f59e0b' :
                                                      task.status === 'revision-required' ? '#ef4444' :
                                                        task.status === 'pending-client-approval' ? '#f59e0b' :
                                                          task.status === 'pending' ? '#f59e0b' : '#6b7280',
                                                color: 'white',
                                                display: 'inline-block',
                                                textTransform: 'capitalize'
                                              }}>
                                                {task.status?.replace(/-/g, ' ') || 'Pending'}
                                              </span>
                                            </td>

                                            {/* Revisions */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #f1f3f4' }}>
                                              <span style={{
                                                display: 'inline-block',
                                                minWidth: '24px',
                                                height: '24px',
                                                lineHeight: '24px',
                                                borderRadius: '50%',
                                                fontSize: '12px',
                                                fontWeight: '700',
                                                backgroundColor: (task.revisionCount || 0) > 0 ? '#ff4757' : '#2ed573',
                                                color: 'white',
                                                textAlign: 'center'
                                              }}>
                                                {task.revisionCount || 0}
                                              </span>
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {/* Start Button - Shows when task is assigned or pending */}
                                                {(task.status === 'assigned' || task.status === 'pending') && (
                                                  <button
                                                    onClick={() => handleStatusUpdate(task.id, 'in-progress')}
                                                    style={{
                                                      backgroundColor: '#3b82f6',
                                                      color: 'white',
                                                      border: 'none',
                                                      padding: '6px 12px',
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      fontSize: '12px',
                                                      fontWeight: '600',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '4px'
                                                    }}
                                                  >
                                                    <PlayCircle size={14} /> Start
                                                  </button>
                                                )}

                                                {/* Complete Button - Shows when task is in-progress */}
                                                {task.status === 'in-progress' && (
                                                  <button
                                                    onClick={() => handleStatusUpdate(task.id, 'completed')}
                                                    style={{
                                                      backgroundColor: '#28a745',
                                                      color: 'white',
                                                      border: 'none',
                                                      padding: '6px 12px',
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      fontSize: '12px',
                                                      fontWeight: '600',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '4px'
                                                    }}
                                                  >
                                                    <CheckCircle size={14} /> Complete
                                                  </button>
                                                )}

                                                {/* Send for Approval Button - Shows when task is completed */}
                                                {task.status === 'completed' && (
                                                  <button
                                                    onClick={() => handleSendForApproval(task.id, task)}
                                                    style={{
                                                      backgroundColor: '#8b5cf6',
                                                      color: 'white',
                                                      border: 'none',
                                                      padding: '6px 12px',
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      fontSize: '12px',
                                                      fontWeight: '600',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '4px'
                                                    }}
                                                  >
                                                    <Send size={14} /> Send for Approval
                                                  </button>
                                                )}

                                                {/* Revision Required - Show Start Revision button */}
                                                {task.status === 'revision-required' && (
                                                  <button
                                                    onClick={() => handleStatusUpdate(task.id, 'in-progress')}
                                                    style={{
                                                      backgroundColor: '#f59e0b',
                                                      color: 'white',
                                                      border: 'none',
                                                      padding: '6px 12px',
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      fontSize: '12px',
                                                      fontWeight: '600',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '4px'
                                                    }}
                                                  >
                                                    <PlayCircle size={14} /> Start Revision
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </>
                                        ) : (
                                          <>
                                            {/* Regular view columns */}
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'center',
                                              color: '#495057',
                                              fontSize: '13px',
                                              borderRight: '1px solid #f1f3f4'
                                            }}>
                                              <input
                                                type="checkbox"
                                                checked={isTaskSelected(clientName, task.id)}
                                                onChange={() => toggleTaskSelection(clientName, task.id)}
                                                style={{
                                                  cursor: 'pointer',
                                                  transform: 'scale(1.1)'
                                                }}
                                              />
                                            </td>
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'left',
                                              color: '#495057',
                                              fontSize: '13px',
                                              borderRight: '1px solid #f1f3f4'
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '20px' }}>{getTaskIcon(task.taskName)}</span>
                                                <div>
                                                  <div style={{
                                                    fontWeight: '600',
                                                    marginBottom: '4px',
                                                    color: '#1e293b'
                                                  }}>
                                                    {task.taskName}
                                                    {task.assignedBy === 'Video Head' && (
                                                      <span style={{
                                                        backgroundColor: '#8b5cf6',
                                                        color: 'white',
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        marginLeft: '8px'
                                                      }}>
                                                        EXTRA
                                                      </span>
                                                    )}
                                                  </div>
                                                  {isTaskOverdue(task.deadline) && (
                                                    <span style={{
                                                      backgroundColor: '#dc3545',
                                                      color: 'white',
                                                      padding: '2px 6px',
                                                      borderRadius: '4px',
                                                      fontSize: '10px',
                                                      fontWeight: 'bold'
                                                    }}>
                                                      OVERDUE
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'center',
                                              color: '#495057',
                                              fontSize: '13px',
                                              borderRight: '1px solid #f1f3f4'
                                            }}>
                                              <span className="project-badge" style={{
                                                backgroundColor: '#e3f2fd',
                                                color: '#1976d2',
                                                padding: '4px 8px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                fontWeight: '600'
                                              }}>{task.projectName}</span>
                                            </td>
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'center',
                                              color: '#495057',
                                              fontSize: '13px',
                                              borderRight: '1px solid #f1f3f4'
                                            }}>
                                              {new Date(task.deadline).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                              })}
                                            </td>
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'center',
                                              borderRight: '1px solid #f1f3f4'
                                            }}>
                                              {/* Status Display (Fixed) */}
                                              <span style={{
                                                display: 'inline-block',
                                                padding: '6px 12px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                backgroundColor: task.status === 'approved' ? '#d4edda' :
                                                  task.status === 'posted' ? '#d1ecf1' :
                                                    task.status === 'completed' ? '#cce5ff' :
                                                      task.status === 'in-progress' ? '#fff3cd' :
                                                        task.status === 'revision-required' ? '#f8d7da' :
                                                          task.status === 'pending-client-approval' ? '#ffeaa7' :
                                                            task.status === 'assigned-to-department' ? '#ff9800' : '#f8f9fa',
                                                color: task.status === 'approved' ? '#155724' :
                                                  task.status === 'posted' ? '#0c5460' :
                                                    task.status === 'completed' ? '#004085' :
                                                      task.status === 'in-progress' ? '#856404' :
                                                        task.status === 'revision-required' ? '#721c24' :
                                                          task.status === 'pending-client-approval' ? '#8a6d3b' :
                                                            task.status === 'assigned-to-department' ? 'white' : '#495057',
                                                border: 'none',
                                                minWidth: '180px',
                                                textAlign: 'center'
                                              }}>
                                                {task.status === 'assigned-to-department' ? 'Assigned to Department' :
                                                  task.status === 'in-progress' ? 'In Progress' :
                                                    task.status === 'completed' ? 'Completed' :
                                                      task.status === 'pending-client-approval' ? 'Pending Client Approval' :
                                                        task.status === 'approved' ? 'Approved' :
                                                          task.status === 'posted' ? 'Posted' :
                                                            task.status === 'revision-required' ? 'Revision Required' :
                                                              task.status}
                                              </span>
                                            </td>
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'center',
                                              borderRight: '1px solid #f1f3f4'
                                            }}>
                                              <span style={{
                                                display: 'inline-block',
                                                minWidth: '20px',
                                                height: '20px',
                                                lineHeight: '20px',
                                                borderRadius: '50%',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                backgroundColor: (task.revisionCount || 0) > 0 ? '#ff4757' : '#2ed573',
                                                color: 'white',
                                                textAlign: 'center'
                                              }}>
                                                {task.revisionCount || 0}
                                              </span>
                                            </td>
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'center',
                                              color: '#495057',
                                              fontSize: '13px',
                                              borderRight: '1px solid #f1f3f4'
                                            }}>
                                              {task.assignedTo ? (
                                                <div className="assigned-user" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                  <div className="user-avatar" style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold'
                                                  }}>
                                                    {task.assignedTo.charAt(0).toUpperCase()}
                                                  </div>
                                                  <span>{task.assignedTo}</span>
                                                </div>
                                              ) : (
                                                <span className="not-assigned" style={{ color: '#999', fontStyle: 'italic' }}>Not Assigned</span>
                                              )}
                                            </td>
                                            <td style={{
                                              padding: '8px 12px',
                                              textAlign: 'center'
                                            }}>
                                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {/* Show Complete and Send for Approval buttons in My Tasks section */}
                                                {showMyTasks && (task.assignedTo === 'Video Head' || task.assignedTo === loggedInUserName) && (
                                                  <>
                                                    {/* Complete Button - Shows when task is in-progress */}
                                                    {task.status === 'in-progress' && (
                                                      <button
                                                        onClick={() => handleStatusUpdate(task.id, 'completed')}
                                                        style={{
                                                          backgroundColor: '#28a745',
                                                          color: 'white',
                                                          border: 'none',
                                                          padding: '6px 12px',
                                                          borderRadius: '6px',
                                                          cursor: 'pointer',
                                                          fontSize: '12px',
                                                          fontWeight: '600',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          gap: '4px'
                                                        }}
                                                      >
                                                        <CheckCircle size={14} /> Complete
                                                      </button>
                                                    )}

                                                    {/* Send for Approval Button - Shows when task is completed */}
                                                    {task.status === 'completed' && (
                                                      <button
                                                        onClick={() => handleSendForApproval(task.id, task)}
                                                        style={{
                                                          backgroundColor: '#8b5cf6',
                                                          color: 'white',
                                                          border: 'none',
                                                          padding: '6px 12px',
                                                          borderRadius: '6px',
                                                          cursor: 'pointer',
                                                          fontSize: '12px',
                                                          fontWeight: '600',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          gap: '4px'
                                                        }}
                                                      >
                                                        <Send size={14} /> Send for Approval
                                                      </button>
                                                    )}

                                                    {/* Sent for Approval Label - Shows when task is pending client approval */}
                                                    {task.status === 'pending-client-approval' && (
                                                      <span style={{
                                                        backgroundColor: '#ff9800',
                                                        color: 'white',
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                      }}>
                                                        <Send size={14} /> Sent for Approval
                                                      </span>
                                                    )}

                                                    {/* Approved/Posted Label */}
                                                    {(task.status === 'approved' || task.status === 'posted') && (
                                                      <span style={{
                                                        backgroundColor: '#10b981',
                                                        color: 'white',
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                      }}>
                                                        <CheckCircle size={14} /> {task.status === 'posted' ? 'Posted' : 'Approved'}
                                                      </span>
                                                    )}
                                                  </>
                                                )}

                                                {/* Regular buttons for non-My Tasks sections */}
                                                {!showMyTasks && (
                                                  <>
                                                    {task.assignedTo && task.assignedTo !== 'Not Assigned' ? (
                                                      <button
                                                        className="action-btn"
                                                        style={{
                                                          backgroundColor: '#10b981',
                                                          color: 'white',
                                                          border: 'none',
                                                          padding: '6px 12px',
                                                          borderRadius: '6px',
                                                          cursor: 'default',
                                                          fontSize: '12px',
                                                          fontWeight: '600'
                                                        }}
                                                      >
                                                        ✓ Assigned
                                                      </button>
                                                    ) : (
                                                      <button
                                                        onClick={() => {
                                                          setSelectedTaskForAssignment(task);
                                                          setShowAssignMemberModal(true);
                                                        }}
                                                        className="action-btn"
                                                        style={{
                                                          backgroundColor: '#007bff',
                                                          color: 'white',
                                                          border: 'none',
                                                          padding: '6px 12px',
                                                          borderRadius: '6px',
                                                          cursor: 'pointer',
                                                          fontSize: '12px',
                                                          fontWeight: '600'
                                                        }}
                                                      >
                                                        Assign Member
                                                      </button>
                                                    )}
                                                    {(task.status === 'completed' || task.status === 'posted' || task.status === 'approved') && (
                                                      <span className="status-text" style={{ color: '#28a745', fontWeight: 'bold', fontSize: '12px' }}>
                                                        ✓ {task.status === 'posted' ? 'Posted' : task.status === 'approved' ? 'Approved' : 'Completed'}
                                                      </span>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            </td>
                                          </>
                                        )}
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
            )}
          </>
        )}
      </div>

      {/* Team Member Assignment Modal */}
      {showAssignMemberModal && selectedTaskForAssignment && (
        <div className="day-plan-modal">
          <div className="day-plan-content" style={{ maxWidth: '500px' }}>
            <div className="day-plan-header">
              <h2>👤 Assign Task to Team Member</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setShowAssignMemberModal(false);
                  setSelectedTaskForAssignment(null);
                  setSelectedTeamMember('');
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>{selectedTaskForAssignment.taskName}</h3>
                <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                  <strong>Client:</strong> {selectedTaskForAssignment.clientName}
                </p>
                <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                  <strong>Department:</strong> {selectedTaskForAssignment.department.toUpperCase()}
                </p>
                <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                  <strong>Deadline:</strong> {new Date(selectedTaskForAssignment.deadline).toLocaleDateString()}
                </p>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Select Team Member *
                </label>
                <select
                  value={selectedTeamMember}
                  onChange={(e) => setSelectedTeamMember(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- Select a team member --</option>
                  <option value="Video Head" style={{ fontWeight: 'bold', backgroundColor: '#f0f7ff' }}>
                    👤 Video Head (Myself)
                  </option>
                  {employees
                    .filter(emp => emp.department === 'video' && emp.status === 'active')
                    .map(emp => (
                      <option key={emp.id} value={emp.employeeName}>
                        {emp.employeeName}
                      </option>
                    ))}
                  {employees.filter(emp => emp.department === 'video' && emp.status === 'active').length === 0 && (
                    <option disabled>No video employees available</option>
                  )}
                </select>
                {employees.filter(emp => emp.department === 'video' && emp.status === 'active').length === 0 && (
                  <p style={{ fontSize: '12px', color: '#dc3545', marginTop: '8px', fontWeight: '500' }}>
                    ⚠️ No video employees found. Please add employees first.
                  </p>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowAssignMemberModal(false);
                    setSelectedTaskForAssignment(null);
                    setSelectedTeamMember('');
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignToTeamMember}
                  disabled={!selectedTeamMember}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: selectedTeamMember ? '#28a745' : '#ccc',
                    color: 'white',
                    cursor: selectedTeamMember ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  ✅ Assign Task
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
              background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
              padding: '20px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                  📹 Video Tasks for {calendarDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).replace(/(\d+),/, `${selectedCalendarDay},`)}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  {getTasksForDay(selectedCalendarDay).length} task{getTasksForDay(selectedCalendarDay).length !== 1 ? 's' : ''} scheduled for video production
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
                  <p>No video tasks scheduled for this day</p>
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
                            {task.assignedBy === 'Video Head' && (
                              <span style={{
                                backgroundColor: '#8b5cf6',
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
                            {task.assignedTo && <span>👨‍💼 <strong>Assigned:</strong> {task.assignedTo}</span>}
                            <span>📹 <strong>Type:</strong> Video Production</span>
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
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2'
                          }}>
                            📹 VIDEO
                          </span>
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: getStatusColor(task.status),
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              outline: 'none',
                              appearance: 'none',
                              paddingRight: '24px',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 6px center',
                              minWidth: '150px'
                            }}
                          >
                            <option value="assigned-to-department" style={{ backgroundColor: '#fff', color: '#333' }}>Assigned to Department</option>
                            <option value="in-progress" style={{ backgroundColor: '#fff', color: '#333' }}>In Progress</option>
                            <option value="completed" style={{ backgroundColor: '#fff', color: '#333' }}>Completed</option>
                            <option value="pending-client-approval" style={{ backgroundColor: '#fff', color: '#333' }}>Pending Client Approval</option>
                            <option value="approved" style={{ backgroundColor: '#fff', color: '#333' }}>Approved</option>
                            <option value="posted" style={{ backgroundColor: '#fff', color: '#333' }}>Posted</option>
                            <option value="revision-required" style={{ backgroundColor: '#fff', color: '#333' }}>Revision Required</option>
                          </select>
                          {task.revisionCount > 0 && (
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#ff4757',
                              color: 'white'
                            }}>
                              🔄 {task.revisionCount} Revision{task.revisionCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Task Description */}
                      {task.description && (
                        <div style={{
                          backgroundColor: '#e3f2fd',
                          padding: '12px',
                          borderRadius: '8px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1976d2', marginBottom: '4px' }}>
                            📝 Description:
                          </div>
                          <div style={{ fontSize: '13px', color: '#1976d2' }}>
                            {task.description}
                          </div>
                        </div>
                      )}

                      {/* Status Display */}
                      <div style={{
                        textAlign: 'center',
                        padding: '8px',
                        backgroundColor: task.assignedTo ? '#d4edda' : '#fff3cd',
                        borderRadius: '8px',
                        color: task.assignedTo ? '#155724' : '#856404',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        {task.assignedTo ?
                          `✓ Assigned to ${task.assignedTo}` :
                          '📋 Awaiting Assignment'
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

      {/* Add Extra Task Modal */}
      {showAddExtraTaskModal && (
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
          onClick={() => setShowAddExtraTaskModal(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '24px',
              color: 'white',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Assign Task</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>Create new task for client</p>
                </div>
                <button
                  onClick={() => {
                    setShowAddExtraTaskModal(false);
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

            {/* Modal Body */}
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

              {/* Client Selection or Manual Entry */}
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
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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

              {/* Task Type */}
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
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowAddExtraTaskModal(false);
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
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddExtraTask}
                  disabled={!newTask.clientName || !newTask.ideas || !newTask.department || !newTask.taskType || !newTask.postDate}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: (newTask.clientName && newTask.ideas && newTask.department && newTask.taskType && newTask.postDate) ? '#667eea' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (newTask.clientName && newTask.ideas && newTask.department && newTask.taskType && newTask.postDate) ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (newTask.clientName && newTask.ideas && newTask.department && newTask.taskType && newTask.postDate) {
                      e.currentTarget.style.backgroundColor = '#5a6fd8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (newTask.clientName && newTask.ideas && newTask.department && newTask.taskType && newTask.postDate) {
                      e.currentTarget.style.backgroundColor = '#667eea';
                    }
                  }}
                >
                  ✅ Assign Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Media Employee Selection Modal */}
      {showSocialMediaEmployeeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '48px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              textAlign: 'center'
            }}>Select Social Media Employee</h3>
            <p style={{
              margin: '0 0 40px 0',
              fontSize: '16px',
              color: '#9ca3af',
              textAlign: 'center'
            }}>Choose who will handle client approval for this task</p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              marginBottom: '32px'
            }}>
              {(() => {
                // Handle different possible department name formats
                const socialMediaEmps = employees.filter(emp => {
                  const dept = emp.department?.toLowerCase().replace(/[\s-_]/g, '');
                  const isActive = emp.status === 'active';
                  const isSocialMedia = dept === 'socialmedia' || emp.department === 'social-media';
                  return isSocialMedia && isActive;
                });
                console.log('VideoDashboard Modal - Total employees:', employees.length);
                console.log('VideoDashboard Modal - Social media employees:', socialMediaEmps);
                return socialMediaEmps.length > 0 ? (
                  socialMediaEmps.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => handleSendToSocialMediaEmployee(emp.employeeName)}
                      style={{
                        background: 'linear-gradient(135deg, #1dd1a1 0%, #55efc4 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '16px',
                        padding: '20px 24px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(29, 209, 161, 0.3)',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(29, 209, 161, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(29, 209, 161, 0.3)';
                      }}
                    >
                      {emp.employeeName}
                    </button>
                  ))
                ) : (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '40px',
                    color: '#9ca3af',
                    fontSize: '16px'
                  }}>
                    No active social media employees found
                  </div>
                );
              })()}
            </div>

            <button
              onClick={() => {
                setShowSocialMediaEmployeeModal(false);
                setSelectedTaskForSending(null);
              }}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f3f4f6';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
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
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '700',
                color: '#1f2937'
              }}>{modalTitle}</h3>
              <button
                onClick={() => setShowNotesModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f3f4f6';
                  e.target.style.color = '#1f2937';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#374151',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {modalContent}
            </div>
            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowNotesModal(false)}
                style={{
                  padding: '10px 24px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#3b82f6';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VideoDashboard;