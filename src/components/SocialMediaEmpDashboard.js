import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Share2, LogOut, CheckCircle, XCircle, Clock, Calendar, AlertCircle, PlayCircle, Send, User, LayoutDashboard, Search, List, Grid, Download, BarChart3, PieChart, TrendingUp, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Dashboard.css';
import './EmployeeDashboard';
import './EmployeeDashboard.css';

const SocialMediaEmpDashboard = ({ employeeData = null, isEmbedded = false }) => {
  const [tasks, setTasks] = useState([]);
  const [employeeName, setEmployeeName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [timeFilter, setTimeFilter] = useState('month'); // 'day', 'week', 'month'
  const [activeFilter, setActiveFilter] = useState('all'); // For statistics card filtering
  const [selectedTasks, setSelectedTasks] = useState({}); // For task selection by client
  const [showNameSelector, setShowNameSelector] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [expandedClients, setExpandedClients] = useState({});
  const [searchQuery, setSearchQuery] = useState(''); // For search functionality
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card' view mode
  const [selectedClientForCardView, setSelectedClientForCardView] = useState(null); // For card view client selection
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [selectedTaskForRevision, setSelectedTaskForRevision] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showDashboard, setShowDashboard] = useState(false); // For Dashboard section (statistics cards only)
  const [showReports, setShowReports] = useState(false); // For Reports section
  const [showDownloadOptions, setShowDownloadOptions] = useState(false); // For download dropdown
  const [showReportCheckboxes, setShowReportCheckboxes] = useState(false); // For report selection checkboxes
  const [selectedReportClients, setSelectedReportClients] = useState(new Set()); // Selected clients for download
  const [selectedReportTaskIds, setSelectedReportTaskIds] = useState(new Set()); // Selected task IDs for download
  const [showReportFormatDropdown, setShowReportFormatDropdown] = useState(false); // Format dropdown for reports

  // Reports section filter states (same as GraphicsDashboard)
  const [reportsSearchQuery, setReportsSearchQuery] = useState(''); // Search for reports
  const [reportsEmployeeFilter, setReportsEmployeeFilter] = useState('all'); // Employee filter for reports
  const [reportsClientFilter, setReportsClientFilter] = useState('all'); // Client filter for reports
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all'); // Status filter for reports

  // Ad modal states
  const [showAdModal, setShowAdModal] = useState(false);
  const [selectedTaskForPosting, setSelectedTaskForPosting] = useState(null);
  const [adType, setAdType] = useState('');
  const [adCost, setAdCost] = useState('');

  // Assign Task modal states
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [manualClientEntry, setManualClientEntry] = useState(false);
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
  });

  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();

  // Fetch employees from database
  useEffect(() => {
    const employeesRef = ref(database, 'employees');
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const employeesList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(emp => emp.status === 'active' && emp.department === 'social-media');
        setEmployees(employeesList);
      } else {
        setEmployees([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch clients from database (only active ones)
  useEffect(() => {
    const clientsRef = ref(database, 'clients');
    const unsubscribe = onValue(clientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const clientsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(client =>
          client.status !== 'inactive' && client.deleted !== true
        ); // Hide inactive and deleted clients
        setClients(clientsList);
      } else {
        setClients([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load employee name from props (when embedded) or localStorage
  useEffect(() => {
    // If embedded in SuperAdmin with employee data, use that directly
    if (isEmbedded && employeeData) {
      setEmployeeName(employeeData.employeeName);
      console.log('Loaded employee info from props:', employeeData);
      return;
    }

    // Otherwise, load from localStorage
    const savedName = localStorage.getItem('socialMediaEmployeeName');
    if (savedName) {
      setEmployeeName(savedName);
    } else {
      setShowNameSelector(true);
    }
  }, [employeeData, isEmbedded]);

  // Fetch tasks assigned to this employee
  useEffect(() => {
    if (!employeeName) return;

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
        const tasksList = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(task => {
            // Filter out tasks from inactive clients
            const clientIsActive = activeClientIds.has(task.clientId) || activeClientNames.has(task.clientName);
            if (!clientIsActive && (task.clientId || task.clientName)) {
              return false;
            }

            // Show tasks assigned to this social media employee
            const isAssignedToMe = task.socialMediaAssignedTo === employeeName || task.assignedTo === employeeName;

            // Show if currently in social-media department OR was previously handled by this employee
            const isSocialMediaTask = task.department === 'social-media' ||
              task.socialMediaAssignedTo === employeeName ||
              task.revisionRequestedBy === employeeName;

            return isAssignedToMe && isSocialMediaTask;
          });
        setTasks(tasksList);
      } else {
        setTasks([]);
      }
    });

    return () => {
      unsubscribeClients();
      unsubscribeStrategyClients();
      unsubscribeStrategyHeadClients();
      unsubscribeTasks();
    };
  }, [employeeName]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');

    // Find employee with matching email and password
    const employee = employees.find(emp =>
      emp.email === loginEmail && emp.password === loginPassword
    );

    if (employee) {
      setEmployeeName(employee.employeeName);
      localStorage.setItem('socialMediaEmployeeName', employee.employeeName);
      localStorage.setItem('socialMediaEmployeeEmail', employee.email);
      setShowNameSelector(false);
      showToast(`Welcome, ${employee.employeeName}!`, 'success');
    } else {
      setLoginError('Invalid email or password');
      showToast('Invalid email or password', 'error');
    }
  };

  const handleNameSelection = (name) => {
    setEmployeeName(name);
    localStorage.setItem('socialMediaEmployeeName', name);
    setShowNameSelector(false);
    showToast(`Welcome, ${name}!`, 'success');
  };

  const handleCustomNameSubmit = () => {
    if (customNameInput.trim()) {
      handleNameSelection(customNameInput.trim());
      setCustomNameInput('');
    }
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
      postedBy: employeeName,
      adsRun: false,
      lastUpdated: new Date().toISOString()
    });
    showToast('✅ Task marked as posted!', 'success');
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
      postedBy: employeeName,
      adsRun: true,
      adType: adType,
      adCost: parseFloat(adCost),
      lastUpdated: new Date().toISOString()
    });
    showToast(`✅ Task posted with ${adType} ad (₹${adCost})!`, 'success');
    setShowAdModal(false);
    setSelectedTaskForPosting(null);
    setAdType('');
    setAdCost('');
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

  // Handle Assign Task form submission
  const handleAssignTask = () => {
    // Validation
    if (!newTask.clientName || !newTask.ideas || !newTask.department || !newTask.postDate) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    try {
      const tasksRef = ref(database, 'tasks');
      const taskData = {
        clientName: newTask.clientName,
        clientId: newTask.clientId || newTask.clientName,
        taskName: newTask.ideas,
        taskDescription: newTask.content || '',
        referenceLink: newTask.referenceLink || '',
        specialNotes: newTask.specialNotes || '',
        department: newTask.department,
        assignedToDept: newTask.department,
        taskType: newTask.taskType || 'Extra Task',
        postDate: newTask.postDate,
        deadline: newTask.postDate,
        status: 'pending',
        assignedTo: '', // Empty - not assigned to anyone initially
        assignedBy: employeeName, // Social Media employee name
        assignedFromSocialMedia: true, // Flag to identify tasks from social media
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      push(tasksRef, taskData);
      showToast('Task assigned successfully!', 'success');

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
      setShowAssignTaskModal(false);
    } catch (error) {
      console.error('Error assigning task:', error);
      showToast('Failed to assign task', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('socialMediaEmployeeName');
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle status change from dropdown
  const handleStatusChange = (taskId, newStatus) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const currentTask = tasks.find(t => t.id === taskId);

    const updateData = {
      status: newStatus,
      lastUpdated: new Date().toISOString()
    };

    // Preserve revision count and related data
    if (currentTask?.revisionCount) {
      updateData.revisionCount = currentTask.revisionCount;
    }
    if (currentTask?.lastRevisionAt) {
      updateData.lastRevisionAt = currentTask.lastRevisionAt;
    }

    // Add specific timestamps based on status
    if (newStatus === 'in-progress' && currentTask?.status !== 'in-progress') {
      updateData.startedAt = new Date().toISOString();
    } else if (newStatus === 'completed') {
      updateData.completedAt = new Date().toISOString();
    } else if (newStatus === 'pending-client-approval') {
      updateData.submittedAt = new Date().toISOString();
      updateData.submittedBy = employeeName;
    }

    update(taskRef, updateData);
    showToast(`Status updated to ${newStatus.replace(/-/g, ' ')}`, 'success');
  };

  // Handle Approve Task
  const handleApproveTask = (taskId) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const currentTask = tasks.find(t => t.id === taskId);

    const updateData = {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: employeeName,
      lastUpdated: new Date().toISOString()
    };

    // Preserve revision count and related data
    if (currentTask?.revisionCount) {
      updateData.revisionCount = currentTask.revisionCount;
    }
    if (currentTask?.lastRevisionAt) {
      updateData.lastRevisionAt = currentTask.lastRevisionAt;
    }

    update(taskRef, updateData)
      .then(() => {
        showToast('✅ Task approved successfully!', 'success');
      })
      .catch((error) => {
        console.error('Error approving task:', error);
        showToast('Failed to approve task', 'error');
      });
  };

  // Handle Reject Task (Request Revision)
  const handleRejectTask = (taskId) => {
    const revisionNote = prompt('Please enter revision notes for the team:');

    if (!revisionNote || revisionNote.trim() === '') {
      showToast('Revision note is required', 'warning');
      return;
    }

    const taskRef = ref(database, `tasks/${taskId}`);
    const currentTask = tasks.find(t => t.id === taskId);

    const updateData = {
      status: 'revision-required',
      revisionMessage: revisionNote.trim(),
      lastRevisionAt: new Date().toISOString(),
      revisionCount: (currentTask?.revisionCount || 0) + 1,
      lastUpdated: new Date().toISOString(),
      // Send back to original department
      department: currentTask?.originalDepartment || currentTask?.department
    };

    update(taskRef, updateData)
      .then(() => {
        showToast('📝 Revision request sent to the team!', 'success');
      })
      .catch((error) => {
        console.error('Error requesting revision:', error);
        showToast('Failed to request revision', 'error');
      });
  };

  // Handle statistics card clicks
  const handleStatCardClick = (filterType) => {
    setActiveFilter(filterType);

    // Show toast message
    const filterMessages = {
      'all': `Showing all ${tasks.filter(t => {
        const taskDate = t.deadline;
        return taskDate && taskDate.startsWith(selectedMonth);
      }).length} tasks`,
      'in-progress': `Showing ${tasks.filter(t => t.status === 'in-progress' && t.deadline && t.deadline.startsWith(selectedMonth)).length} in-progress tasks`,
      'completed': `Showing ${tasks.filter(t => t.status === 'completed' && t.deadline && t.deadline.startsWith(selectedMonth)).length} completed tasks`,
      'pending-client-approval': `Showing ${tasks.filter(t => t.status === 'pending-client-approval' && t.deadline && t.deadline.startsWith(selectedMonth)).length} pending approval tasks`,
      'approved': `Showing ${tasks.filter(t => t.status === 'approved' && t.deadline && t.deadline.startsWith(selectedMonth)).length} approved tasks`,
      'posted': `Showing ${tasks.filter(t => t.status === 'posted' && t.deadline && t.deadline.startsWith(selectedMonth)).length} posted tasks`,
      'revision-required': `Showing ${tasks.filter(t => t.status === 'revision-required' && t.deadline && t.deadline.startsWith(selectedMonth)).length} revision required tasks`
    };

    showToast(filterMessages[filterType] || 'Filter applied', 'info');

    // Auto-scroll to tasks section - scroll to the actual task cards
    setTimeout(() => {
      // Try multiple selectors to find the tasks section
      const tasksSection = document.querySelector('.card.full-width') ||
        document.querySelector('[style*="background: white"]') ||
        document.getElementById('tasks-section');

      if (tasksSection) {
        // Scroll with some offset to show the section nicely
        const yOffset = -20; // 20px offset from top
        const y = tasksSection.getBoundingClientRect().top + window.pageYOffset + yOffset;

        window.scrollTo({
          top: y,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  // Function to get search filtered tasks
  const getSearchFilteredTasks = () => {
    if (!searchQuery.trim()) {
      return filteredTasks;
    }

    const query = searchQuery.toLowerCase();
    return filteredTasks.filter(task =>
      task.taskName?.toLowerCase().includes(query) ||
      task.clientName?.toLowerCase().includes(query) ||
      task.projectName?.toLowerCase().includes(query) ||
      task.assignedTo?.toLowerCase().includes(query) ||
      task.status?.toLowerCase().includes(query)
    );
  };

  // Function to filter reports data based on search and filters (same as GraphicsDashboard)
  const getReportsFilteredTasks = () => {
    let filtered = filteredTasks;

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

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'posted':
        return '#28a745';
      case 'in-progress':
        return '#ffc107';
      case 'pending-client-approval':
        return '#17a2b8';
      case 'revision-required':
        return '#dc3545';
      case 'assigned-to-department':
        return '#6c757d';
      default:
        return '#95a5a6';
    }
  };

  // Get department color
  const getDepartmentColor = (dept) => {
    switch (dept) {
      case 'strategy': return '#9b59b6';
      case 'video': return '#e74c3c';
      case 'graphics': return '#3498db';
      case 'social-media': return '#1abc9c';
      default: return '#95a5a6';
    }
  };

  // Check if task is overdue
  const isTaskOverdue = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date() && new Date(deadline).toDateString() !== new Date().toDateString();
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'posted':
        return <CheckCircle size={18} color="green" />;
      case 'revision-required':
        return <XCircle size={18} color="red" />;
      case 'in-progress':
        return <Clock size={18} color="orange" />;
      default:
        return <Clock size={18} color="gray" />;
    }
  };

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      const taskRef = ref(database, `tasks/${taskId}`);
      await update(taskRef, {
        status: newStatus,
        lastUpdated: new Date().toISOString()
      });
      showToast(`Task status updated to ${newStatus.replace(/-/g, ' ')}`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update task status', 'error');
    }
  };

  const handleSendForRevision = () => {
    if (!revisionNotes.trim()) {
      showToast('âš ï¸ Please enter revision notes', 'warning', 3000);
      return;
    }

    const task = selectedTaskForRevision;
    const taskRef = ref(database, `tasks/${task.id}`);

    // Return task to original department and employee
    const originalDept = task.originalDepartment || 'video';
    const originalEmployee = task.submittedBy || task.assignedTo;

    update(taskRef, {
      status: 'revision-required',
      revisionMessage: revisionNotes,
      revisionCount: (task.revisionCount || 0) + 1,
      lastRevisionAt: new Date().toISOString(),
      // Return to original department and employee
      department: originalDept,
      assignedTo: originalEmployee,
      // Keep track of who requested the revision and preserve social media assignment
      revisionRequestedBy: employeeName,
      socialMediaAssignedTo: employeeName, // Keep this so task stays visible in social media employee dashboard
      // Reset acknowledgment so popup shows for the employee
      revisionAcknowledged: false,
      lastUpdated: new Date().toISOString()
    });

    showToast(`âœ… Task sent back for revision to ${originalEmployee}`, 'success', 5000);
    setShowRevisionModal(false);
    setSelectedTaskForRevision(null);
    setRevisionNotes('');
  };





  // Group tasks by client
  const groupTasksByClient = (tasks) => {
    const grouped = {};
    tasks.forEach(task => {
      const clientName = task.clientName || 'Unknown Client';
      if (!grouped[clientName]) {
        grouped[clientName] = [];
      }
      grouped[clientName].push(task);
    });
    return Object.values(grouped);
  };

  const toggleClientExpansion = (clientName) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  // Helper function to check if date is today
  const isToday = (dateString) => {
    if (!dateString) return false;
    const taskDate = new Date(dateString);
    const today = new Date();
    return taskDate.toDateString() === today.toDateString();
  };

  // Helper function to check if date is in current week
  const isInCurrentWeek = (dateString) => {
    if (!dateString) return false;
    const taskDate = new Date(dateString);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return taskDate >= startOfWeek && taskDate <= endOfWeek;
  };

  const filteredTasks = tasks.filter(task => {
    const taskDate = task.deadline;

    // Apply time filter (day, week, month)
    let timeMatch = false;
    if (timeFilter === 'day') {
      timeMatch = isToday(taskDate);
    } else if (timeFilter === 'week') {
      timeMatch = isInCurrentWeek(taskDate);
    } else if (timeFilter === 'month') {
      timeMatch = taskDate && taskDate.startsWith(selectedMonth);
    }

    // Apply active filter from statistics cards
    let cardFilterMatch = false;
    if (activeFilter === 'all') {
      cardFilterMatch = true;
    } else {
      cardFilterMatch = task.status === activeFilter;
    }

    return timeMatch && cardFilterMatch;
  });

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed' || t.status === 'posted').length,
    pendingApproval: tasks.filter(t => t.status === 'pending-client-approval').length,
    approved: tasks.filter(t => t.status === 'approved').length,
    posted: tasks.filter(t => t.status === 'posted').length,
    revisionRequired: tasks.filter(t => t.status === 'revision-required').length
  };

  // Employee Login Modal (skip if embedded)
  if (showNameSelector && !isEmbedded) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '48px',
          maxWidth: '450px',
          width: '90%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)'
            }}>
              <User size={40} color="white" />
            </div>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937'
            }}>Employee Login</h2>
            <p style={{
              margin: 0,
              fontSize: '15px',
              color: '#6b7280'
            }}>Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {loginError && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} color="#dc2626" />
                <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: '500' }}>
                  {loginError}
                </span>
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }}
            >
              Login
            </button>
          </form>

          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#f9fafb',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#6b7280',
              textAlign: 'center',
              lineHeight: '1.5'
            }}>
              <strong style={{ color: '#374151' }}>Note:</strong> Use the email and password provided by your Production Incharge
            </p>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="employee-dashboard">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar */}
      <div className="employee-sidebar">
        <div className="employee-sidebar-header">
          <div className="employee-sidebar-logo">
            <div className="employee-sidebar-logo-icon">
              <Share2 size={24} />
            </div>
            <div className="employee-sidebar-logo-text">
              <h2>Social Media</h2>
              <p>Employee</p>
            </div>
          </div>
        </div>

        <nav className="employee-sidebar-nav">
          <div className="employee-sidebar-section">
            <h3 className="employee-sidebar-section-title">Main</h3>
            <ul className="employee-sidebar-menu">
              <li className="employee-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowDashboard(true);
                    setShowReports(false);
                    showToast('Dashboard view activated', 'info');
                  }}
                  className={`employee-sidebar-menu-link ${showDashboard ? 'active' : ''}`}
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
                  <div className="employee-sidebar-menu-icon">
                    <LayoutDashboard size={20} />
                  </div>
                  Dashboard
                </button>
              </li>
              <li className="employee-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowDashboard(false);
                    setShowReports(false);
                    showToast('My Tasks view activated', 'info');
                  }}
                  className={`employee-sidebar-menu-link ${!showDashboard && !showReports ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: !showDashboard && !showReports ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="employee-sidebar-menu-icon">
                    <List size={20} />
                  </div>
                  My Tasks
                </button>
              </li>
              <li className="employee-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowAssignTaskModal(true);
                  }}
                  className="employee-sidebar-menu-link"
                  style={{
                    border: 'none',
                    background: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="employee-sidebar-menu-icon">
                    <Send size={20} />
                  </div>
                  Assign Task
                </button>
              </li>
              <li className="employee-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowDashboard(false);
                    setShowReports(true);
                    showToast('Reports view activated', 'info');
                  }}
                  className={`employee-sidebar-menu-link ${showReports ? 'active' : ''}`}
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
                  <div className="employee-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  Reports
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <div className="employee-sidebar-user">
          <div className="employee-sidebar-user-info">
            <div className="employee-sidebar-user-avatar">
              {employeeName ? employeeName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="employee-sidebar-user-details">
              <h4>{employeeName || 'Employee'}</h4>
              <p>Social Media Team</p>
            </div>
          </div>
          <button onClick={handleLogout} className="employee-btn employee-btn-logout" style={{ marginTop: '12px', width: '100%' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="employee-main-content">
        {/* Page Header - Hidden when Reports is active */}
        {!showReports && (
          <>
            <div className="employee-header">
              <div className="employee-header-content">
                <div className="employee-header-left">
                  <div className="employee-header-title">
                    <h1>Social Media Employee Dashboard</h1>
                    <p>Welcome, {employeeName || 'Employee'}</p>
                  </div>
                </div>
                <div className="employee-header-right">
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <Calendar size={18} style={{ color: '#6b7280' }} />
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Month:</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      fontWeight: '500',
                      marginLeft: '8px'
                    }}>
                      {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Cards - Always visible when not in Reports */}
            <div className="stats-row" style={{
              marginBottom: '32px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '24px'
            }}>
              <div
                className="stat-card"
                onClick={() => handleStatCardClick('all')}
                style={{
                  background: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(255, 94, 98, 0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '24px',
                  gap: '20px',
                  height: '100%',
                  position: 'relative',
                  border: activeFilter === 'all' ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  transform: activeFilter === 'all' ? 'translateY(-5px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 94, 98, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = activeFilter === 'all' ? 'translateY(-5px)' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 94, 98, 0.3)';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Briefcase size={30} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold' }}>{stats.total}</h3>
                  <p style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>TOTAL TASKS</p>
                  <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>Tasks for selected month</p>
                </div>
                {activeFilter === 'all' && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>✓</div>
                )}
              </div>

              <div
                className="stat-card"
                onClick={() => handleStatCardClick('in-progress')}
                style={{
                  background: 'linear-gradient(135deg, #00B4DB 0%, #0083B0 100%)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(0, 131, 176, 0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '24px',
                  gap: '20px',
                  height: '100%',
                  position: 'relative',
                  border: activeFilter === 'in-progress' ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  transform: activeFilter === 'in-progress' ? 'translateY(-5px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 131, 176, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = activeFilter === 'in-progress' ? 'translateY(-5px)' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 131, 176, 0.3)';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Clock size={30} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold' }}>{stats.inProgress}</h3>
                  <p style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>IN PROGRESS</p>
                  <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>Currently working</p>
                </div>
                {activeFilter === 'in-progress' && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>✓</div>
                )}
              </div>

              <div
                className="stat-card"
                onClick={() => handleStatCardClick('completed')}
                style={{
                  background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(56, 239, 125, 0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '24px',
                  gap: '20px',
                  height: '100%',
                  position: 'relative',
                  border: activeFilter === 'completed' ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  transform: activeFilter === 'completed' ? 'translateY(-5px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(56, 239, 125, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = activeFilter === 'completed' ? 'translateY(-5px)' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(56, 239, 125, 0.3)';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckCircle size={30} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold' }}>{stats.completed}</h3>
                  <p style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>COMPLETED</p>
                  <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>Successfully finished</p>
                </div>
                {activeFilter === 'completed' && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>✓</div>
                )}
              </div>

              <div
                className="stat-card"
                onClick={() => handleStatCardClick('pending-client-approval')}
                style={{
                  background: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(221, 36, 118, 0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '24px',
                  gap: '20px',
                  height: '100%',
                  position: 'relative',
                  border: activeFilter === 'pending-client-approval' ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  transform: activeFilter === 'pending-client-approval' ? 'translateY(-5px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(221, 36, 118, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = activeFilter === 'pending-client-approval' ? 'translateY(-5px)' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(221, 36, 118, 0.3)';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <AlertCircle size={30} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold' }}>{stats.pendingApproval}</h3>
                  <p style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>PENDING</p>
                  <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>Awaiting approval</p>
                </div>
                {activeFilter === 'pending-client-approval' && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>✓</div>
                )}
              </div>

              <div
                className="stat-card"
                onClick={() => handleStatCardClick('approved')}
                style={{
                  background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(45, 145, 89, 0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '24px',
                  gap: '20px',
                  height: '100%',
                  position: 'relative',
                  border: activeFilter === 'approved' ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  transform: activeFilter === 'approved' ? 'translateY(-5px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(45, 145, 89, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = activeFilter === 'approved' ? 'translateY(-5px)' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(45, 145, 89, 0.3)';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckCircle size={30} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold' }}>{stats.approved}</h3>
                  <p style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>APPROVED</p>
                  <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>Ready for production</p>
                </div>
                {activeFilter === 'approved' && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>✓</div>
                )}
              </div>

              <div
                className="stat-card"
                onClick={() => handleStatCardClick('posted')}
                style={{
                  background: 'linear-gradient(135deg, #EA384D 0%, #D31027 100%)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(211, 16, 39, 0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '24px',
                  gap: '20px',
                  height: '100%',
                  position: 'relative',
                  border: activeFilter === 'posted' ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  transform: activeFilter === 'posted' ? 'translateY(-5px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(211, 16, 39, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = activeFilter === 'posted' ? 'translateY(-5px)' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(211, 16, 39, 0.3)';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Send size={30} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold' }}>{stats.posted}</h3>
                  <p style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>POSTED</p>
                  <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>Published live</p>
                </div>
                {activeFilter === 'posted' && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>✓</div>
                )}
              </div>

              <div
                className="stat-card"
                onClick={() => handleStatCardClick('revision-required')}
                style={{
                  background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(74, 0, 224, 0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '24px',
                  gap: '20px',
                  height: '100%',
                  position: 'relative',
                  border: activeFilter === 'revision-required' ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  transform: activeFilter === 'revision-required' ? 'translateY(-5px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(74, 0, 224, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = activeFilter === 'revision-required' ? 'translateY(-5px)' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(74, 0, 224, 0.3)';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <XCircle size={30} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold' }}>{stats.revisionRequired}</h3>
                  <p style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>REVISION REQ.</p>
                  <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>Needs attention</p>
                </div>
                {activeFilter === 'revision-required' && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>✓</div>
                )}
              </div>
            </div>

            {/* Daily Report and Weekly Summary Cards - Only visible when Dashboard is active */}
            {showDashboard && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px',
                marginBottom: '25px'
              }}>
                {/* Daily Report Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                  borderRadius: '16px',
                  padding: '28px',
                  color: 'white',
                  boxShadow: '0 8px 24px rgba(45, 145, 89, 0.3)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(45, 145, 89, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(45, 145, 89, 0.3)';
                  }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '22px',
                      fontWeight: '700',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>📊 Daily Report</h3>
                    <div style={{
                      padding: '4px 12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      letterSpacing: '0.5px'
                    }}>📋 SOCIAL MEDIA</div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isToday(t.deadline)).length}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>TODAY'S TASKS</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isToday(t.deadline) && (t.status === 'completed' || t.status === 'posted' || t.status === 'approved')).length}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>COMPLETED</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isToday(t.deadline) && isTaskOverdue(t.deadline) && t.status !== 'completed' && t.status !== 'posted' && t.status !== 'approved').length}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>OVERDUE</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isToday(t.deadline)).length > 0
                          ? Math.round((tasks.filter(t => isToday(t.deadline) && (t.status === 'completed' || t.status === 'posted' || t.status === 'approved')).length / tasks.filter(t => isToday(t.deadline)).length) * 100)
                          : 0}%
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>SUCCESS RATE</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTimeFilter('day');
                      setShowDashboard(false);
                      showToast('Viewing today\'s tasks', 'info');
                    }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    View Details
                  </button>
                </div>

                {/* Weekly Summary Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                  borderRadius: '16px',
                  padding: '28px',
                  color: 'white',
                  boxShadow: '0 8px 24px rgba(86, 171, 47, 0.3)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(86, 171, 47, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(86, 171, 47, 0.3)';
                  }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '22px',
                      fontWeight: '700',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>📈 Weekly Summary</h3>
                    <div style={{
                      padding: '4px 12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      letterSpacing: '0.5px'
                    }}>THIS WEEK</div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isInCurrentWeek(t.deadline)).length}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>WEEKLY TASKS</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isInCurrentWeek(t.deadline) && (t.status === 'completed' || t.status === 'posted' || t.status === 'approved')).length}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>COMPLETED</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isInCurrentWeek(t.deadline) && t.status === 'in-progress').length}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>IN PROGRESS</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      backdropFilter: 'blur(10px)',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}>
                        {tasks.filter(t => isInCurrentWeek(t.deadline)).length > 0
                          ? Math.round((tasks.filter(t => isInCurrentWeek(t.deadline) && (t.status === 'completed' || t.status === 'posted' || t.status === 'approved')).length / tasks.filter(t => isInCurrentWeek(t.deadline)).length) * 100)
                          : 0}%
                      </div>
                      <div style={{
                        fontSize: '13px',
                        opacity: 0.9,
                        fontWeight: '600'
                      }}>EFFICIENCY</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTimeFilter('week');
                      setShowDashboard(false);
                      showToast('Viewing this week\'s tasks', 'info');
                    }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            )}

            {/* Search Bar and View Controls - Hidden when Dashboard is active */}
            {!showDashboard && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px 24px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Search Bar */}
                <div style={{
                  flex: '1 1 300px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Search size={18} style={{
                    position: 'absolute',
                    left: '12px',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    placeholder="Search clients, tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
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

                {/* Time Filter Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  background: '#f3f4f6',
                  padding: '4px',
                  borderRadius: '8px'
                }}>
                  <button
                    onClick={() => {
                      setTimeFilter('day');
                      showToast('Showing today\'s tasks', 'info');
                    }}
                    style={{
                      padding: '8px 14px',
                      background: timeFilter === 'day' ? '#667eea' : 'transparent',
                      color: timeFilter === 'day' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Clock size={14} /> Today
                  </button>
                  <button
                    onClick={() => {
                      setTimeFilter('week');
                      showToast('Showing this week\'s tasks', 'info');
                    }}
                    style={{
                      padding: '8px 14px',
                      background: timeFilter === 'week' ? '#667eea' : 'transparent',
                      color: timeFilter === 'week' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Calendar size={14} /> Week
                  </button>
                  <button
                    onClick={() => {
                      setTimeFilter('month');
                      showToast('Showing this month\'s tasks', 'info');
                    }}
                    style={{
                      padding: '8px 14px',
                      background: timeFilter === 'month' ? '#667eea' : 'transparent',
                      color: timeFilter === 'month' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Calendar size={14} /> Month
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  background: '#f3f4f6',
                  padding: '4px',
                  borderRadius: '8px'
                }}>
                  <button
                    onClick={() => setViewMode('list')}
                    style={{
                      padding: '8px 16px',
                      background: viewMode === 'list' ? '#667eea' : 'transparent',
                      color: viewMode === 'list' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <List size={16} /> List View
                  </button>
                  <button
                    onClick={() => setViewMode('card')}
                    style={{
                      padding: '8px 16px',
                      background: viewMode === 'card' ? '#667eea' : 'transparent',
                      color: viewMode === 'card' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Grid size={16} /> Card View
                  </button>
                </div>

                {/* Download All Reports Button */}
                <button
                  onClick={() => {
                    const groupedTasks = groupTasksByClient(getSearchFilteredTasks());
                    if (groupedTasks.length === 0) {
                      showToast('No tasks to download', 'warning');
                      return;
                    }

                    // Create HTML content for PDF
                    const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <title>${employeeName} - All Clients Report</title>
                  <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1abc9c; padding-bottom: 20px; }
                    .header h1 { color: #1abc9c; margin: 0; }
                    .client-section { margin-bottom: 30px; page-break-inside: avoid; }
                    .client-header { background: #1abc9c; color: white; padding: 10px 15px; border-radius: 6px; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                    th { background-color: #f1f3f5; color: #333; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .status { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block; }
                    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <h1>All Clients Task Report</h1>
                    <p>Social Media Employee: ${employeeName}</p>
                    <p>Generated on ${new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</p>
                  </div>
                  
                  ${groupedTasks.map(clientGroup => {
                      const clientName = clientGroup[0].clientName || 'Unknown Client';
                      return `
                      <div class="client-section">
                        <div class="client-header">
                          <h2 style="margin: 0; font-size: 16px;">${clientName} (${clientGroup.length} tasks)</h2>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>Task Name</th>
                              <th>Department</th>
                              <th>Deadline</th>
                              <th>Status</th>
                              <th>Revisions</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${clientGroup.map(task => `
                              <tr>
                                <td><strong>${task.taskName || 'N/A'}</strong></td>
                                <td style="text-transform: uppercase">${task.originalDepartment || task.department || 'N/A'}</td>
                                <td>${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</td>
                                <td><span class="status">${task.status?.replace(/-/g, ' ') || 'N/A'}</span></td>
                                <td>${task.revisionCount || 0}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `;
                    }).join('')}

                  <div class="footer">
                    <p>This report was generated from the Social Media Employee Dashboard</p>
                    <p>Employee: ${employeeName}</p>
                  </div>
                </body>
                </html>
              `;

                    // Create a new window and print as PDF
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(htmlContent);
                    printWindow.document.close();

                    setTimeout(() => {
                      printWindow.focus();
                      printWindow.print();
                      setTimeout(() => {
                        printWindow.close();
                      }, 1000);
                    }, 500);

                    showToast(`PDF report generated for all clients`, 'success');
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(102,126,234,0.3)';
                  }}
                >
                  <Download size={16} /> Download All Reports (PDF)
                </button>
              </div>
            )}



            {/* Tasks by Client - Card View - Hidden when Dashboard is active */}
            {!showDashboard && viewMode === 'card' && !selectedClientForCardView && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '20px',
                padding: '0'
              }}>
                {getSearchFilteredTasks().length === 0 ? (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#9ca3af',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <Share2 size={64} color="#cbd5e1" />
                    <h3 style={{ margin: '16px 0 8px 0', fontSize: '18px', color: '#6b7280' }}>No tasks found</h3>
                    <p style={{ margin: 0, fontSize: '14px' }}>You don't have any tasks assigned yet.</p>
                  </div>
                ) : (
                  groupTasksByClient(getSearchFilteredTasks()).map((clientGroup) => {
                    const clientName = clientGroup[0].clientName || 'Unknown Client';
                    const totalTasks = clientGroup.length;
                    const completedTasks = clientGroup.filter(t => t.status === 'completed' || t.status === 'posted').length;
                    const inProgressTasks = clientGroup.filter(t => t.status === 'in-progress').length;
                    const clientInitial = clientName.charAt(0).toUpperCase();

                    return (
                      <div
                        key={clientName}
                        onClick={() => setSelectedClientForCardView(clientName)}
                        style={{
                          background: 'linear-gradient(135deg, #5dade2 0%, #3498db 100%)',
                          borderRadius: '16px',
                          padding: '0',
                          boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 8px 20px rgba(52, 152, 219, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.3)';
                        }}
                      >
                        {/* Card Header */}
                        <div style={{
                          padding: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          borderBottom: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.25)',
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
                              fontWeight: '700',
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
                              color: 'rgba(255,255,255,0.9)',
                              fontWeight: '500'
                            }}>
                              {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {/* Card Stats */}
                        <div style={{
                          padding: '20px 24px',
                          background: 'white',
                          display: 'flex',
                          justifyContent: 'space-around',
                          gap: '12px'
                        }}>
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{
                              fontSize: '28px',
                              fontWeight: '700',
                              color: '#3498db',
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

                        {/* Click to view */}
                        <div style={{
                          padding: '12px 24px',
                          background: 'rgba(52, 152, 219, 0.1)',
                          textAlign: 'center',
                          fontSize: '13px',
                          color: '#3498db',
                          fontWeight: '600',
                          fontStyle: 'italic'
                        }}>
                          Click to view all tasks
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Individual Task Cards View - When Client is Selected - Hidden when Dashboard is active */}
            {!showDashboard && viewMode === 'card' && selectedClientForCardView && (
              <div>
                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '24px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={() => setSelectedClientForCardView(null)}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(102,126,234,0.3)';
                    }}
                  >
                    ← Back to All Clients
                  </button>

                  <button
                    onClick={() => {
                      const clientGroup = groupTasksByClient(getSearchFilteredTasks())
                        .find(group => group[0].clientName === selectedClientForCardView);

                      if (!clientGroup) return;

                      const clientName = selectedClientForCardView;

                      // Create HTML content for PDF
                      const htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <title>${employeeName} - ${clientName} All Tasks Report</title>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1abc9c; padding-bottom: 20px; }
                        .header h1 { color: #1abc9c; margin: 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #1abc9c; color: white; font-weight: bold; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                        .status { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block; }
                        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <h1>All Tasks Report - ${clientName}</h1>
                        <p>Social Media Employee: ${employeeName}</p>
                        <p>Generated on ${new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</p>
                      </div>

                      <table>
                        <thead>
                          <tr>
                            <th>Task Name</th>
                            <th>Project</th>
                            <th>Department</th>
                            <th>Deadline</th>
                            <th>Status</th>
                            <th>Revisions</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${clientGroup.map(task => `
                            <tr>
                              <td><strong>${task.taskName || 'N/A'}</strong></td>
                              <td>${task.projectName || 'N/A'}</td>
                              <td style="text-transform: uppercase">${task.originalDepartment || task.department || 'N/A'}</td>
                              <td>${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</td>
                              <td><span class="status">${task.status?.replace(/-/g, ' ') || 'N/A'}</span></td>
                              <td>${task.revisionCount || 0}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>

                      <div class="footer">
                        <p>This report was generated from the Social Media Employee Dashboard</p>
                        <p>Employee: ${employeeName} | Client: ${clientName}</p>
                      </div>
                    </body>
                    </html>
                  `;

                      // Create a new window and print as PDF
                      const printWindow = window.open('', '_blank');
                      printWindow.document.write(htmlContent);
                      printWindow.document.close();

                      setTimeout(() => {
                        printWindow.focus();
                        printWindow.print();
                        setTimeout(() => {
                          printWindow.close();
                        }, 1000);
                      }, 500);

                      showToast(`PDF report generated for all ${clientGroup.length} task(s)`, 'success');
                    }}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(102,126,234,0.3)';
                    }}
                  >
                    <Download size={16} /> Download All
                  </button>
                </div>

                {/* Task Cards Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: '20px',
                  padding: '0'
                }}>
                  {(() => {
                    const clientGroup = groupTasksByClient(getSearchFilteredTasks())
                      .find(group => group[0].clientName === selectedClientForCardView);

                    if (!clientGroup) return null;

                    return clientGroup.map(task => {
                      const isOverdue = task.deadline && new Date(task.deadline) < new Date() &&
                        task.status !== 'completed' && task.status !== 'posted' && task.status !== 'approved';

                      return (
                        <div
                          key={task.id}
                          style={{
                            background: 'linear-gradient(135deg, #5dade2 0%, #3498db 100%)',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)',
                            transition: 'all 0.3s ease',
                            position: 'relative'
                          }}
                        >
                          {/* Card Header */}
                          <div style={{
                            padding: '20px',
                            paddingTop: isOverdue ? '48px' : '20px',
                            borderBottom: '1px solid rgba(255,255,255,0.2)',
                            position: 'relative'
                          }}>
                            {/* Overdue Badge */}
                            {isOverdue && (
                              <div style={{
                                position: 'absolute',
                                top: '12px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#ef4444',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                zIndex: 10,
                                boxShadow: '0 2px 8px rgba(239,68,68,0.4)'
                              }}>
                                OVERDUE
                              </div>
                            )}

                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                fontWeight: '700',
                                color: 'white',
                                flexShrink: 0
                              }}>
                                {task.clientName?.charAt(0).toUpperCase() || 'T'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{
                                  margin: 0,
                                  fontSize: '16px',
                                  fontWeight: '700',
                                  color: 'white',
                                  marginBottom: '4px'
                                }}>
                                  {task.taskName || 'Untitled Task'}
                                </h3>
                                <p style={{
                                  margin: 0,
                                  fontSize: '13px',
                                  color: 'rgba(255,255,255,0.9)',
                                  fontWeight: '500'
                                }}>
                                  {task.projectName || 'No Project'}
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={isTaskSelected(selectedClientForCardView, task.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleTaskSelection(selectedClientForCardView, task.id);
                                }}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              />
                            </div>
                          </div>

                          {/* Card Body */}
                          <div style={{
                            padding: '20px',
                            background: 'white'
                          }}>
                            {/* Task Details */}
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    marginBottom: '4px'
                                  }}>
                                    Project
                                  </div>
                                  <div style={{
                                    fontSize: '14px',
                                    color: '#374151',
                                    fontWeight: '600'
                                  }}>
                                    {task.projectName || 'N/A'}
                                  </div>
                                </div>
                                <div style={{
                                  textAlign: 'right',
                                  flex: 1
                                }}>
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    marginBottom: '4px'
                                  }}>
                                    {task.deadline ? 'Due Date' : 'No Deadline'}
                                  </div>
                                  <div style={{
                                    fontSize: '14px',
                                    color: isOverdue ? '#ef4444' : '#374151',
                                    fontWeight: '600'
                                  }}>
                                    {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    }) : '-'}
                                  </div>
                                </div>
                              </div>

                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '12px',
                                marginBottom: '12px'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    marginBottom: '4px'
                                  }}>
                                    Department:
                                  </div>
                                  <div style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    background: getDepartmentColor(task.originalDepartment || task.department),
                                    color: 'white',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase'
                                  }}>
                                    {task.originalDepartment || task.department || 'N/A'}
                                  </div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'right' }}>
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    marginBottom: '4px'
                                  }}>
                                    Revisions
                                  </div>
                                  <div style={{
                                    display: 'inline-block',
                                    minWidth: '32px',
                                    height: '32px',
                                    lineHeight: '32px',
                                    borderRadius: '50%',
                                    fontSize: '16px',
                                    fontWeight: '700',
                                    backgroundColor: (task.revisionCount || 0) > 0 ? '#ef4444' : '#10b981',
                                    color: 'white',
                                    textAlign: 'center'
                                  }}>
                                    {task.revisionCount || 0}
                                  </div>
                                </div>
                              </div>

                              <div style={{ marginBottom: '12px' }}>
                                <div style={{
                                  fontSize: '11px',
                                  color: '#6b7280',
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  marginBottom: '4px'
                                }}>
                                  Assigned To:
                                </div>
                                <div style={{
                                  fontSize: '14px',
                                  color: '#374151',
                                  fontWeight: '600'
                                }}>
                                  {task.assignedTo || task.socialMediaAssignedTo || 'Unassigned'}
                                </div>
                              </div>

                              <div>
                                <div style={{
                                  fontSize: '11px',
                                  color: '#6b7280',
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  marginBottom: '4px'
                                }}>
                                  Status:
                                </div>
                                <select
                                  value={task.status}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(task.id, e.target.value);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    backgroundColor: getStatusColor(task.status),
                                    color: 'white'
                                  }}
                                >
                                  <option value="assigned-to-department">Assigned</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="pending-client-approval">Pending Client Approval</option>
                                  <option value="approved">Approved</option>
                                  <option value="posted">Posted</option>
                                  <option value="revision-required">Revision Required</option>
                                </select>
                              </div>
                            </div>

                            {/* Revision Message */}
                            {task.revisionMessage && (
                              <div style={{
                                marginTop: '12px',
                                padding: '12px',
                                backgroundColor: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#856404'
                              }}>
                                <strong>⚠️ Revision Required:</strong> {task.revisionMessage}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{
                              marginTop: '16px',
                              display: 'flex',
                              gap: '8px',
                              flexWrap: 'wrap'
                            }}>
                              {task.status === 'pending-client-approval' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const taskRef = ref(database, `tasks/${task.id}`);
                                    update(taskRef, {
                                      status: 'approved',
                                      approvedAt: new Date().toISOString(),
                                      approvedBy: employeeName,
                                      lastUpdated: new Date().toISOString()
                                    });
                                    showToast('✅ Task approved and sent to client!', 'success');
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = '#059669'}
                                  onMouseLeave={(e) => e.target.style.background = '#10b981'}
                                >
                                  ✓ Approve & Send
                                </button>
                              )}

                              {task.status === 'approved' && (
                                <>
                                  <div style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#d1fae5',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    color: '#065f46',
                                    textAlign: 'center',
                                    fontWeight: '600'
                                  }}>
                                    ✓ Approved
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsPosted(task);
                                    }}
                                    style={{
                                      flex: 1,
                                      padding: '12px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                                    onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                                  >
                                    📤 Post
                                  </button>
                                </>
                              )}

                              {task.status === 'posted' && (
                                <div style={{
                                  flex: 1,
                                  padding: '12px',
                                  backgroundColor: '#e0f2fe',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  color: '#0c4a6e',
                                  textAlign: 'center',
                                  fontWeight: '600'
                                }}>
                                  ✓ Posted
                                </div>
                              )}

                              {task.status !== 'pending-client-approval' && task.status !== 'approved' && task.status !== 'posted' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showToast(`Viewing details for: ${task.taskName}`, 'info');
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = '#4b5563'}
                                  onMouseLeave={(e) => e.target.style.background = '#6b7280'}
                                >
                                  View Details
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Tasks by Client - List View - Hidden when Dashboard is active */}
            {!showDashboard && viewMode === 'list' && (
              <div className="card full-width">
                <div className="card-header">
                  <h2> My Tasks ({getSearchFilteredTasks().length})</h2>
                  <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
                    All tasks assigned to you
                  </p>
                </div>

                {getSearchFilteredTasks().length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                    <Share2 size={64} color="#cbd5e1" />
                    <h3 style={{ margin: '16px 0 8px 0', fontSize: '18px', color: '#6b7280' }}>No tasks found</h3>
                    <p style={{ margin: 0, fontSize: '14px' }}>You don't have any tasks assigned yet.</p>
                  </div>
                ) : (
                  <div style={{ padding: '20px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                          <th style={{ padding: '12px 2px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '16%' }}>Task Name</th>
                          <th style={{ padding: '12px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '12%' }}>Client</th>
                          <th style={{ padding: '12px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '10%' }}>Dept</th>
                          <th style={{ padding: '12px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '11%' }}>Deadline</th>
                          <th style={{ padding: '12px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '12%' }}>Status</th>
                          <th style={{ padding: '12px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '39%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSearchFilteredTasks().map((task, index) => (
                          <tr key={task.id} style={{ borderBottom: '1px solid #f1f3f4', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                            <td style={{ padding: '12px 2px', textAlign: 'left', color: '#495057', fontSize: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {getStatusIcon(task.status)}
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={task.taskName}>
                                    {task.taskName}
                                  </div>
                                  {task.revisionMessage && (
                                    <div style={{ marginTop: '6px', padding: '6px 8px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '12px', color: '#856404' }}>
                                      <strong>Revision:</strong> {task.revisionMessage.length > 50 ? task.revisionMessage.substring(0, 50) + '...' : task.revisionMessage}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 2px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={task.clientName}>
                                {task.clientName || 'N/A'}
                              </div>
                            </td>
                            <td style={{ padding: '12px 2px', textAlign: 'center' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: getDepartmentColor(task.originalDepartment || task.department), color: 'white', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                {(task.originalDepartment || task.department || 'N/A').substring(0, 8)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 2px', textAlign: 'center', fontSize: '13px', color: isTaskOverdue(task.deadline) ? '#dc2626' : '#6b7280', fontWeight: isTaskOverdue(task.deadline) ? '600' : 'normal' }}>
                              <div style={{ whiteSpace: 'nowrap' }}>
                                {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                              </div>
                              {isTaskOverdue(task.deadline) && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>OVERDUE</div>}
                            </td>
                            <td style={{ padding: '12px 2px', textAlign: 'center' }}>
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: getStatusColor(task.status),
                                color: 'white',
                                display: 'inline-block',
                                textTransform: 'capitalize',
                                whiteSpace: 'nowrap'
                              }}>
                                {task.status?.replace(/-/g, ' ') || 'N/A'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 2px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {/* Approve and Reject buttons for pending-client-approval status */}
                                {task.status === 'pending-client-approval' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveTask(task.id)}
                                      style={{
                                        padding: '6px 12px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <CheckCircle size={14} /> Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectTask(task.id)}
                                      style={{
                                        padding: '6px 12px',
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 6px rgba(239,68,68,0.3)',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <XCircle size={14} /> Reject
                                    </button>
                                  </>
                                )}
                                {task.status === 'approved' && (
                                  <button onClick={() => handleMarkAsPosted(task)} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}>
                                    <CheckCircle size={14} /> Mark as Posted
                                  </button>
                                )}
                                {task.status === 'posted' && (
                                  <span style={{ padding: '6px 12px', background: '#d1fae5', color: '#065f46', borderRadius: '6px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    <CheckCircle size={13} /> Posted
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
            )}
          </>
        )}

        {/* Reports Section */}
        {showReports && (() => {
          const allMonthTasks = getReportsFilteredTasks();
          const completedTasks = allMonthTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
          const completionRate = allMonthTasks.length > 0 ? Math.round((completedTasks / allMonthTasks.length) * 100) : 0;

          return (
            <div style={{ width: '100%', minHeight: '100vh' }}>
              {/* Reports Header */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '20px 28px',
                marginBottom: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
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
                  <div style={{ position: 'relative' }} className="download-dropdown">
                    <button
                      onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
                        boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.35)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.25)';
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
                          onClick={() => {
                            // Download PDF
                            const doc = new jsPDF('p', 'mm', 'a4');
                            const pageWidth = doc.internal.pageSize.getWidth();

                            doc.setFontSize(20);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(102, 126, 234);
                            doc.text('Social Media Employee Report', pageWidth / 2, 20, { align: 'center' });

                            doc.setFontSize(12);
                            doc.setFont('helvetica', 'normal');
                            doc.setTextColor(100, 100, 100);
                            doc.text(`Employee: ${employeeName}`, 20, 35);
                            doc.text(`Period: ${selectedMonth}`, 20, 42);
                            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 49);

                            doc.setFontSize(14);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(50, 50, 50);
                            doc.text('Performance Summary', 20, 62);

                            doc.setFontSize(11);
                            doc.setFont('helvetica', 'normal');
                            doc.text(`Total Tasks: ${allMonthTasks.length}`, 20, 72);
                            doc.text(`Completed: ${completedTasks}`, 20, 79);
                            doc.text(`In Progress: ${allMonthTasks.filter(t => t.status === 'in-progress').length}`, 20, 86);
                            doc.text(`Completion Rate: ${completionRate}%`, 20, 93);

                            const tableData = allMonthTasks.map(task => [
                              (task.clientName || 'N/A').substring(0, 30),
                              (task.taskName || 'N/A').substring(0, 40),
                              (task.status || '').replace(/-/g, ' ').toUpperCase(),
                              task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'
                            ]);

                            autoTable(doc, {
                              startY: 105,
                              head: [['Client', 'Task', 'Status', 'Deadline']],
                              body: tableData,
                              theme: 'striped',
                              headStyles: {
                                fillColor: [0, 184, 148],
                                textColor: 255,
                                fontSize: 10,
                                fontStyle: 'bold',
                                halign: 'left'
                              },
                              bodyStyles: {
                                fontSize: 9,
                                textColor: 50
                              },
                              alternateRowStyles: {
                                fillColor: [248, 250, 252]
                              },
                              columnStyles: {
                                0: { cellWidth: 45 },
                                1: { cellWidth: 70 },
                                2: { cellWidth: 35 },
                                3: { cellWidth: 30 }
                              },
                              margin: { left: 15, right: 15 }
                            });

                            doc.save(`social-media-employee-report-${selectedMonth}.pdf`);
                            showToast('✅ PDF report downloaded successfully', 'success');
                            setShowDownloadOptions(false);
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
                            // Download Excel
                            const wb = XLSX.utils.book_new();

                            const headerData = [
                              ['Social Media Employee Report'],
                              [],
                              [`Employee: ${employeeName}`],
                              [`Period: ${selectedMonth}`],
                              [`Generated: ${new Date().toLocaleDateString()}`],
                              [],
                              ['Performance Summary'],
                              [`Total Tasks: ${allMonthTasks.length}`],
                              [`Completed: ${completedTasks}`],
                              [`In Progress: ${allMonthTasks.filter(t => t.status === 'in-progress').length}`],
                              [`Completion Rate: ${completionRate}%`],
                              [],
                              ['Client', 'Task', 'Status', 'Deadline']
                            ];

                            const taskData = allMonthTasks.map(task => [
                              task.clientName || 'N/A',
                              task.taskName || 'N/A',
                              (task.status || '').replace(/-/g, ' ').toUpperCase(),
                              task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'
                            ]);

                            const allData = [...headerData, ...taskData];
                            const ws = XLSX.utils.aoa_to_sheet(allData);

                            ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 20 }, { wch: 15 }];

                            XLSX.utils.book_append_sheet(wb, ws, 'Employee Report');
                            XLSX.writeFile(wb, `social-media-employee-report-${selectedMonth}.xlsx`);

                            showToast('✅ Excel report downloaded successfully', 'success');
                            setShowDownloadOptions(false);
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
                      </div>
                    )}
                  </div>
                </div>

                {/* Search and Filter Section */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  paddingTop: '16px',
                  borderTop: '1px solid #e9ecef'
                }}>
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

                      // Reset client filter if the currently selected client doesn't have tasks for this employee
                      if (reportsClientFilter !== 'all' && newEmployee !== 'all') {
                        const employeeTasks = filteredTasks.filter(t => t.assignedTo === newEmployee);
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
                      const assignedEmployees = [...new Set(filteredTasks
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
                      let tasksToFilter = filteredTasks;
                      if (reportsEmployeeFilter !== 'all') {
                        tasksToFilter = filteredTasks.filter(t => t.assignedTo === reportsEmployeeFilter);
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
                    {completedTasks}
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
                    {allMonthTasks.filter(t => t.status === 'in-progress').length}
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
                    {completionRate}%
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.95 }}>Completion Rate</div>
                </div>
              </div>

              {/* Charts Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
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
                      { label: 'In Progress', count: allMonthTasks.filter(t => t.status === 'in-progress').length, color: '#3b82f6' },
                      { label: 'Completed', count: allMonthTasks.filter(t => t.status === 'completed').length, color: '#10b981' },
                      { label: 'Pending', count: allMonthTasks.filter(t => t.status === 'pending-client-approval').length, color: '#f59e0b' },
                      { label: 'Posted', count: allMonthTasks.filter(t => t.status === 'posted' || t.status === 'approved').length, color: '#8b5cf6' }
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

                {/* Completion Trend - Line Chart */}
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
                    Task Completion Timeline
                  </h3>
                  {(() => {
                    // Group tasks by day for the selected month
                    const daysInMonth = new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate();
                    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                      const dayTasks = allMonthTasks.filter(t => t.deadline && t.deadline.startsWith(dateStr));
                      const completed = dayTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
                      return { day, total: dayTasks.length, completed };
                    });

                    const maxValue = Math.max(...dailyData.map(d => d.total), 1);
                    const chartWidth = 600;
                    const chartHeight = 200;
                    const padding = 40;
                    const plotWidth = chartWidth - padding * 2;
                    const plotHeight = chartHeight - padding * 2;

                    return (
                      <svg width="100%" height="220" viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}>
                        {/* Grid lines */}
                        {[0, 1, 2, 3, 4].map(i => {
                          const y = padding + (plotHeight / 4) * i;
                          return (
                            <g key={i}>
                              <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                              <text x={padding - 10} y={y + 4} fontSize="10" fill="#9ca3af" textAnchor="end">
                                {Math.round(maxValue * (1 - i / 4))}
                              </text>
                            </g>
                          );
                        })}

                        {/* Total tasks line */}
                        <polyline
                          points={dailyData.map((d, i) => {
                            const x = padding + (plotWidth / (daysInMonth - 1)) * i;
                            const y = padding + plotHeight - (d.total / maxValue) * plotHeight;
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />

                        {/* Completed tasks line */}
                        <polyline
                          points={dailyData.map((d, i) => {
                            const x = padding + (plotWidth / (daysInMonth - 1)) * i;
                            const y = padding + plotHeight - (d.completed / maxValue) * plotHeight;
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                        />

                        {/* Legend */}
                        <g transform={`translate(${padding}, ${chartHeight - 10})`}>
                          <line x1="0" y1="0" x2="20" y2="0" stroke="#3b82f6" strokeWidth="2" />
                          <text x="25" y="4" fontSize="11" fill="#6b7280">Total</text>
                          <line x1="80" y1="0" x2="100" y2="0" stroke="#10b981" strokeWidth="2" />
                          <text x="105" y="4" fontSize="11" fill="#6b7280">Completed</text>
                        </g>
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* Client-wise Task Summary with Expandable Bars */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    margin: 0,
                    color: '#1f2937'
                  }}>
                    Client-wise Task Summary
                  </h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {(selectedReportClients.size > 0 || selectedReportTaskIds.size > 0) && (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowReportFormatDropdown(!showReportFormatDropdown)}
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
                          Download Selected ({selectedReportClients.size > 0 ? `${selectedReportClients.size} clients` : `${selectedReportTaskIds.size} tasks`})
                        </button>

                        {showReportFormatDropdown && (
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
                              onClick={() => {
                                // Download PDF
                                const clientGroups = {};
                                allMonthTasks.forEach(task => {
                                  const clientName = task.clientName || 'Unknown Client';
                                  if (!clientGroups[clientName]) {
                                    clientGroups[clientName] = {
                                      clientId: task.clientId || 'N/A',
                                      tasks: []
                                    };
                                  }
                                  clientGroups[clientName].tasks.push(task);
                                });

                                // Collect selected tasks
                                let tasksToDownload = [];
                                if (selectedReportClients.size > 0) {
                                  // Download all tasks from selected clients
                                  selectedReportClients.forEach(clientName => {
                                    if (clientGroups[clientName]) {
                                      tasksToDownload.push(...clientGroups[clientName].tasks);
                                    }
                                  });
                                } else if (selectedReportTaskIds.size > 0) {
                                  // Download only selected tasks
                                  tasksToDownload = allMonthTasks.filter(t => selectedReportTaskIds.has(t.id));
                                }

                                if (tasksToDownload.length === 0) {
                                  showToast('⚠️ No tasks selected', 'warning');
                                  return;
                                }

                                // Group selected tasks by client
                                const selectedClientGroups = {};
                                tasksToDownload.forEach(task => {
                                  const clientName = task.clientName || 'Unknown Client';
                                  if (!selectedClientGroups[clientName]) {
                                    selectedClientGroups[clientName] = {
                                      clientId: task.clientId || 'N/A',
                                      tasks: []
                                    };
                                  }
                                  selectedClientGroups[clientName].tasks.push(task);
                                });

                                // Create PDF
                                const doc = new jsPDF('p', 'mm', 'a4');
                                const pageWidth = doc.internal.pageSize.getWidth();
                                const pageHeight = doc.internal.pageSize.getHeight();
                                let yPosition = 20;

                                // Header
                                doc.setFontSize(20);
                                doc.setFont('helvetica', 'bold');
                                doc.setTextColor(102, 126, 234);
                                doc.text('Social Media Employee Report', pageWidth / 2, yPosition, { align: 'center' });

                                yPosition += 8;
                                doc.setFontSize(11);
                                doc.setFont('helvetica', 'normal');
                                doc.setTextColor(100, 100, 100);
                                doc.text(`Employee: ${employeeName}`, 20, yPosition);
                                yPosition += 6;
                                doc.text(`Period: ${selectedMonth}`, 20, yPosition);
                                yPosition += 6;
                                doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
                                yPosition += 12;

                                // Add each client's tasks
                                Object.entries(selectedClientGroups).forEach(([clientName, clientData]) => {
                                  // Check if we need a new page
                                  if (yPosition > pageHeight - 60) {
                                    doc.addPage();
                                    yPosition = 20;
                                  }

                                  // Client header
                                  doc.setFillColor(102, 126, 234);
                                  doc.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');
                                  doc.setTextColor(255, 255, 255);
                                  doc.setFontSize(13);
                                  doc.setFont('helvetica', 'bold');
                                  doc.text(`${clientName} (ID: ${clientData.clientId})`, 18, yPosition + 2);

                                  yPosition += 10;

                                  // Tasks table
                                  const tableData = clientData.tasks.map(task => {
                                    let postDate = 'N/A';
                                    let postTime = 'N/A';

                                    if (task.postDate) {
                                      try {
                                        const date = new Date(task.postDate);
                                        postDate = date.toLocaleDateString('en-GB');
                                        postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                      } catch (e) {
                                        postDate = task.postDate;
                                      }
                                    } else if (task.deadline) {
                                      try {
                                        const date = new Date(task.deadline);
                                        postDate = date.toLocaleDateString('en-GB');
                                        postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                      } catch (e) {
                                        postDate = task.deadline;
                                      }
                                    }

                                    return [
                                      clientData.clientId,
                                      clientName.substring(0, 20),
                                      (task.taskName || task.description || 'N/A').substring(0, 30),
                                      (task.originalDepartment || task.department || 'N/A').toUpperCase(),
                                      task.taskType || 'N/A',
                                      postDate,
                                      postTime
                                    ];
                                  });

                                  autoTable(doc, {
                                    startY: yPosition,
                                    head: [['Client ID', 'Client Name', 'Task Name', 'Department', 'Type', 'Post Date', 'Post Time']],
                                    body: tableData,
                                    theme: 'striped',
                                    headStyles: {
                                      fillColor: [0, 184, 148],
                                      textColor: 255,
                                      fontSize: 9,
                                      fontStyle: 'bold',
                                      halign: 'center',
                                      minCellHeight: 8
                                    },
                                    bodyStyles: {
                                      fontSize: 8,
                                      textColor: 50,
                                      halign: 'center'
                                    },
                                    alternateRowStyles: {
                                      fillColor: [248, 250, 252]
                                    },
                                    columnStyles: {
                                      0: { cellWidth: 20, halign: 'center' },
                                      1: { cellWidth: 30, halign: 'left' },
                                      2: { cellWidth: 45, halign: 'left' },
                                      3: { cellWidth: 25, halign: 'center' },
                                      4: { cellWidth: 25, halign: 'center' },
                                      5: { cellWidth: 22, halign: 'center' },
                                      6: { cellWidth: 20, halign: 'center' }
                                    },
                                    margin: { left: 15, right: 15 }
                                  });

                                  yPosition = doc.lastAutoTable.finalY + 12;
                                });

                                doc.save(`social-media-employee-report-${selectedMonth}.pdf`);
                                showToast(`✅ PDF downloaded with ${tasksToDownload.length} task(s)`, 'success');

                                // Clear selections
                                setSelectedReportClients(new Set());
                                setSelectedReportTaskIds(new Set());
                                setShowReportCheckboxes(false);
                                setShowReportFormatDropdown(false);
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
                                // Download Excel
                                const clientGroups = {};
                                allMonthTasks.forEach(task => {
                                  const clientName = task.clientName || 'Unknown Client';
                                  if (!clientGroups[clientName]) {
                                    clientGroups[clientName] = {
                                      clientId: task.clientId || 'N/A',
                                      tasks: []
                                    };
                                  }
                                  clientGroups[clientName].tasks.push(task);
                                });

                                // Collect selected tasks
                                let tasksToDownload = [];
                                if (selectedReportClients.size > 0) {
                                  selectedReportClients.forEach(clientName => {
                                    if (clientGroups[clientName]) {
                                      tasksToDownload.push(...clientGroups[clientName].tasks);
                                    }
                                  });
                                } else if (selectedReportTaskIds.size > 0) {
                                  tasksToDownload = allMonthTasks.filter(t => selectedReportTaskIds.has(t.id));
                                }

                                if (tasksToDownload.length === 0) {
                                  showToast('⚠️ No tasks selected', 'warning');
                                  return;
                                }

                                // Group selected tasks by client
                                const selectedClientGroups = {};
                                tasksToDownload.forEach(task => {
                                  const clientName = task.clientName || 'Unknown Client';
                                  if (!selectedClientGroups[clientName]) {
                                    selectedClientGroups[clientName] = {
                                      clientId: task.clientId || 'N/A',
                                      tasks: []
                                    };
                                  }
                                  selectedClientGroups[clientName].tasks.push(task);
                                });

                                // Create Excel
                                const wb = XLSX.utils.book_new();

                                const headerData = [
                                  ['Social Media Employee Report'],
                                  [],
                                  [`Employee: ${employeeName}`],
                                  [`Period: ${selectedMonth}`],
                                  [`Generated: ${new Date().toLocaleDateString()}`],
                                  []
                                ];

                                let allData = [...headerData];

                                Object.entries(selectedClientGroups).forEach(([clientName, clientData]) => {
                                  // Client header
                                  allData.push([`${clientName} (ID: ${clientData.clientId})`, '', '', '', '', '', '']);
                                  allData.push(['Client ID', 'Client Name', 'Task Name (Ideas)', 'Department', 'Type', 'Post Date', 'Post Time']);

                                  // Client tasks
                                  clientData.tasks.forEach(task => {
                                    let postDate = 'N/A';
                                    let postTime = 'N/A';

                                    if (task.postDate) {
                                      try {
                                        const date = new Date(task.postDate);
                                        postDate = date.toLocaleDateString('en-GB');
                                        postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                      } catch (e) {
                                        postDate = task.postDate;
                                      }
                                    } else if (task.deadline) {
                                      try {
                                        const date = new Date(task.deadline);
                                        postDate = date.toLocaleDateString('en-GB');
                                        postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                      } catch (e) {
                                        postDate = task.deadline;
                                      }
                                    }

                                    allData.push([
                                      clientData.clientId,
                                      clientName,
                                      task.taskName || task.description || 'N/A',
                                      (task.originalDepartment || task.department || 'N/A').toUpperCase(),
                                      task.taskType || 'N/A',
                                      postDate,
                                      postTime
                                    ]);
                                  });

                                  allData.push([]); // Empty row between clients
                                });

                                const ws = XLSX.utils.aoa_to_sheet(allData);
                                ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];

                                XLSX.utils.book_append_sheet(wb, ws, 'Employee Report');
                                XLSX.writeFile(wb, `social-media-employee-report-${selectedMonth}.xlsx`);

                                showToast(`✅ Excel downloaded with ${tasksToDownload.length} task(s)`, 'success');

                                // Clear selections
                                setSelectedReportClients(new Set());
                                setSelectedReportTaskIds(new Set());
                                setShowReportCheckboxes(false);
                                setShowReportFormatDropdown(false);
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
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowReportCheckboxes(!showReportCheckboxes);
                        if (showReportCheckboxes) {
                          setSelectedReportClients(new Set());
                          setSelectedReportTaskIds(new Set());
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        background: showReportCheckboxes ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
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
                    >
                      {showReportCheckboxes ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      {showReportCheckboxes ? 'Cancel' : 'Select Items'}
                    </button>
                  </div>
                </div>
                {(() => {
                  // Group tasks by client
                  const clientGroups = {};
                  allMonthTasks.forEach(task => {
                    const clientName = task.clientName || 'Unknown Client';
                    if (!clientGroups[clientName]) {
                      clientGroups[clientName] = {
                        clientId: task.clientId || 'N/A',
                        tasks: []
                      };
                    }
                    clientGroups[clientName].tasks.push(task);
                  });

                  return Object.entries(clientGroups).map(([clientName, clientData], index) => {
                    const totalTasks = clientData.tasks.length;
                    const inProgressTasks = clientData.tasks.filter(t => t.status === 'in-progress').length;
                    const completedTasks = clientData.tasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
                    const isExpanded = expandedClients[clientName];

                    return (
                      <div key={clientName} style={{ marginBottom: '12px' }}>
                        {/* Client Bar */}
                        <div
                          onClick={(e) => {
                            // Allow expansion even when checkboxes are shown
                            toggleClientExpansion(clientName);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '10px',
                            padding: '16px 20px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 2px 8px rgba(102,126,234,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(102,126,234,0.2)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                            {showReportCheckboxes && (
                              <input
                                type="checkbox"
                                checked={selectedReportClients.has(clientName)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSelectedClients = new Set(selectedReportClients);
                                  const newSelectedTasks = new Set(selectedReportTaskIds);

                                  if (e.target.checked) {
                                    newSelectedClients.add(clientName);
                                    // Also select all tasks for this client
                                    clientData.tasks.forEach(task => newSelectedTasks.add(task.id));
                                  } else {
                                    newSelectedClients.delete(clientName);
                                    // Also deselect all tasks for this client
                                    clientData.tasks.forEach(task => newSelectedTasks.delete(task.id));
                                  }

                                  setSelectedReportClients(newSelectedClients);
                                  setSelectedReportTaskIds(newSelectedTasks);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            )}
                            <div style={{
                              fontSize: '18px',
                              color: 'white',
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                            }}>
                              ▶
                            </div>
                            <div style={{ color: 'white' }}>
                              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>
                                {clientName}
                              </div>
                              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                                Client ID: {clientData.clientId}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <div style={{ textAlign: 'center', color: 'white' }}>
                              <div style={{ fontSize: '20px', fontWeight: '700' }}>{totalTasks}</div>
                              <div style={{ fontSize: '11px', opacity: 0.9 }}>Total Tasks</div>
                            </div>
                            <div style={{ textAlign: 'center', color: 'white' }}>
                              <div style={{ fontSize: '20px', fontWeight: '700' }}>{inProgressTasks}</div>
                              <div style={{ fontSize: '11px', opacity: 0.9 }}>In Progress</div>
                            </div>
                            <div style={{ textAlign: 'center', color: 'white' }}>
                              <div style={{ fontSize: '20px', fontWeight: '700' }}>{completedTasks}</div>
                              <div style={{ fontSize: '11px', opacity: 0.9 }}>Completed</div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Task Table */}
                        {isExpanded && (
                          <div style={{
                            marginTop: '8px',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            padding: '16px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{
                                  background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                                  color: 'white'
                                }}>
                                  {showReportCheckboxes && (
                                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', width: '50px', whiteSpace: 'nowrap' }}>
                                      <input
                                        type="checkbox"
                                        checked={clientData.tasks.every(t => selectedReportTaskIds.has(t.id))}
                                        onChange={(e) => {
                                          const newSelectedTasks = new Set(selectedReportTaskIds);
                                          const newSelectedClients = new Set(selectedReportClients);

                                          if (e.target.checked) {
                                            clientData.tasks.forEach(t => newSelectedTasks.add(t.id));
                                            newSelectedClients.add(clientName);
                                          } else {
                                            clientData.tasks.forEach(t => newSelectedTasks.delete(t.id));
                                            newSelectedClients.delete(clientName);
                                          }

                                          setSelectedReportTaskIds(newSelectedTasks);
                                          setSelectedReportClients(newSelectedClients);
                                        }}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                      />
                                    </th>
                                  )}
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Client ID</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Client Name</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Task Name</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Department</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Type</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Post Date</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Post Time</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Ads Run</th>
                                </tr>
                              </thead>
                              <tbody>
                                {clientData.tasks.map((task, taskIndex) => {
                                  // Parse post date and time
                                  let postDate = 'N/A';
                                  let postTime = 'N/A';

                                  if (task.postDate) {
                                    try {
                                      const date = new Date(task.postDate);
                                      postDate = date.toLocaleDateString('en-GB');
                                      postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                    } catch (e) {
                                      postDate = task.postDate;
                                    }
                                  } else if (task.deadline) {
                                    try {
                                      const date = new Date(task.deadline);
                                      postDate = date.toLocaleDateString('en-GB');
                                      postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                    } catch (e) {
                                      postDate = task.deadline;
                                    }
                                  }

                                  return (
                                    <tr key={task.id} style={{
                                      borderBottom: '1px solid #e5e7eb',
                                      backgroundColor: taskIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
                                    }}>
                                      {showReportCheckboxes && (
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <input
                                            type="checkbox"
                                            checked={selectedReportTaskIds.has(task.id)}
                                            onChange={(e) => {
                                              const newSelectedTasks = new Set(selectedReportTaskIds);
                                              const newSelectedClients = new Set(selectedReportClients);

                                              if (e.target.checked) {
                                                newSelectedTasks.add(task.id);
                                                // Check if all tasks for this client are now selected
                                                const allTasksSelected = clientData.tasks.every(t =>
                                                  t.id === task.id || newSelectedTasks.has(t.id)
                                                );
                                                if (allTasksSelected) {
                                                  newSelectedClients.add(clientName);
                                                }
                                              } else {
                                                newSelectedTasks.delete(task.id);
                                                // Deselect the client since not all tasks are selected
                                                newSelectedClients.delete(clientName);
                                              }

                                              setSelectedReportTaskIds(newSelectedTasks);
                                              setSelectedReportClients(newSelectedClients);
                                            }}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                          />
                                        </td>
                                      )}
                                      <td style={{ padding: '12px', fontSize: '12px', color: '#1f2937' }}>
                                        {clientData.clientId}
                                      </td>
                                      <td style={{ padding: '12px', fontSize: '12px', color: '#1f2937', fontWeight: '500' }}>
                                        {clientName}
                                      </td>
                                      <td style={{ padding: '12px', fontSize: '12px', color: '#1f2937' }}>
                                        {task.taskName || task.description || 'N/A'}
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          backgroundColor: task.originalDepartment === 'video' || task.department === 'video' ? '#fee2e2' : '#dbeafe',
                                          color: task.originalDepartment === 'video' || task.department === 'video' ? '#dc2626' : '#2563eb',
                                          textTransform: 'uppercase'
                                        }}>
                                          {task.originalDepartment || task.department || 'N/A'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                                        {task.taskType || 'N/A'}
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                                        {postDate}
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                                        {postTime}
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {task.adsRun && task.adType ? (
                                          <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}>
                                            <span style={{
                                              padding: '3px 6px',
                                              borderRadius: '4px',
                                              fontSize: '10px',
                                              fontWeight: '600',
                                              backgroundColor: '#dbeafe',
                                              color: '#1e40af'
                                            }}>
                                              {task.adType}
                                            </span>
                                            <span style={{
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              color: '#059669'
                                            }}>
                                              ₹{task.adCost || 0}
                                            </span>
                                          </div>
                                        ) : (
                                          <span style={{
                                            fontSize: '11px',
                                            color: '#9ca3af',
                                            fontWeight: '500'
                                          }}>
                                            No
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Revision Notes Modal */}
      {showRevisionModal && (
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
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              fontWeight: '700',
              color: '#1f2937'
            }}>Request Revision</h3>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>Enter specific feedback or changes needed for this task</p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>Revision Notes *</label>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Enter specific feedback or changes needed..."
                rows="5"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSendForRevision}
                disabled={!revisionNotes.trim()}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: revisionNotes.trim()
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : '#e5e7eb',
                  color: revisionNotes.trim() ? 'white' : '#9ca3af',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: revisionNotes.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
              >
                Send for Revision
              </button>
              <button
                onClick={() => {
                  setShowRevisionModal(false);
                  setSelectedTaskForRevision(null);
                  setRevisionNotes('');
                }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {showAssignTaskModal && (
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
            setShowAssignTaskModal(false);
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
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
              padding: '24px',
              color: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 1
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                📋 Assign Task to Department
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                Create and assign a new task to Video or Graphics department
              </p>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px' }}>
              {/* Client Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Client Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {!manualClientEntry ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={newTask.clientName}
                      onChange={handleClientChange}
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    >
                      <option value="">Select a client...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.name || client.clientName}>
                          {client.name || client.clientName}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setManualClientEntry(true)}
                      style={{
                        padding: '12px 16px',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Manual Entry
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newTask.clientName}
                      onChange={(e) => setNewTask({ ...newTask, clientName: e.target.value, clientId: e.target.value })}
                      placeholder="Enter client name"
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                    <button
                      onClick={() => {
                        setManualClientEntry(false);
                        setNewTask({ ...newTask, clientName: '', clientId: '' });
                      }}
                      style={{
                        padding: '12px 16px',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Select from List
                    </button>
                  </div>
                )}
              </div>

              {/* Ideas/Task Name */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Task Name / Ideas <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newTask.ideas}
                  onChange={(e) => setNewTask({ ...newTask, ideas: e.target.value })}
                  placeholder="Enter task name or ideas"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
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
                  Content / Description
                </label>
                <textarea
                  value={newTask.content}
                  onChange={(e) => setNewTask({ ...newTask, content: e.target.value })}
                  placeholder="Enter task description or content details"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
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
                  placeholder="https://example.com"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
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
                  placeholder="Any special instructions or notes"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Department Selection */}
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
                  onChange={(e) => setNewTask({ ...newTask, department: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                >
                  <option value="">Select department...</option>
                  <option value="video">Video Department</option>
                  <option value="graphics">Graphics Department</option>
                </select>
              </div>

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
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={handleAssignTask}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
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
                    boxShadow: '0 2px 8px rgba(26, 188, 156, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(26, 188, 156, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(26, 188, 156, 0.3)';
                  }}
                >
                  <Send size={18} /> Assign Task
                </button>
                <button
                  onClick={() => {
                    setShowAssignTaskModal(false);
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
                    flex: 1,
                    padding: '14px 24px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '15px',
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
          </div>
        </div>
      )}

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
    </div>
  );
};

export default SocialMediaEmpDashboard;
