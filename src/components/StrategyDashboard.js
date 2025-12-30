import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, update, get } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { TrendingUp, LogOut, Plus, Upload, Calendar, Bell, BarChart3, PieChart, FileText, FileSpreadsheet, Download, Search, LayoutDashboard, Briefcase, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './StrategyDashboard.css';

const StrategyDashboard = ({ employeeData = null, isEmbedded = false }) => {
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();

  // Employee authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);

  // Essential state for the component to work
  const [tasks, setTasks] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showTaskAssignForm, setShowTaskAssignForm] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [newTaskAssignment, setNewTaskAssignment] = useState({
    clientId: '',
    clientName: '',
    taskName: '',
    description: '',
    department: '',
    taskType: '',
    postDate: '',
    referenceLink: '',
    ideaPoint: '',
    specialNotes: '',
    useManualEntry: false
  });
  const [clients, setClients] = useState([]);
  const [allClientsFromDB, setAllClientsFromDB] = useState([]); // Store all clients from DB before filtering
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'calendar'
  const [selectedCalendarClient, setSelectedCalendarClient] = useState('all'); // Filter for calendar
  const [uploadedData, setUploadedData] = useState([]);
  const [showUploadedData, setShowUploadedData] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateTasks, setSelectedDateTasks] = useState([]);
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [showClientTasks, setShowClientTasks] = useState(true);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [prefilledClient, setPrefilledClient] = useState({ name: '', id: '' });
  const [taskForms, setTaskForms] = useState([{ id: 1 }]); // Array to manage multiple task forms
  const [multipleTaskForms, setMultipleTaskForms] = useState([{
    id: 1,
    taskName: '',
    description: '',
    referenceLink: '',
    ideaPoint: '',
    specialNotes: '',
    department: '',
    taskType: '',
    postDate: ''
  }]); // Array for multiple tasks in Strategy Prep form
  const [statsFilter, setStatsFilter] = useState('all'); // 'all', 'approved', 'pending'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'in-progress', 'posted'
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [openStatusDropdownTaskId, setOpenStatusDropdownTaskId] = useState(null);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkTaskId, setReworkTaskId] = useState(null);
  const [reworkNote, setReworkNote] = useState('');
  const [showClientTasksModal, setShowClientTasksModal] = useState(false);
  const [selectedClientTasks, setSelectedClientTasks] = useState([]);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showStrategyPrepForm, setShowStrategyPrepForm] = useState(false);
  const [strategyPrepTaskId, setStrategyPrepTaskId] = useState(null);
  const [showTasksOnlyModal, setShowTasksOnlyModal] = useState(false);
  const [tasksOnlyModalData, setTasksOnlyModalData] = useState({ clientName: '', tasks: [] });
  const [reopenTasksModal, setReopenTasksModal] = useState(false); // Track if we should reopen tasks modal after edit
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false); // Track download dropdown visibility
  const [selectedView, setSelectedView] = useState('dashboard'); // 'dashboard' or 'report'
  const [expandedReportClients, setExpandedReportClients] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showSelectionMode, setShowSelectionMode] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false); // Track whether to show checkboxes in report view
  const [selectedClients, setSelectedClients] = useState([]); // Track selected clients for bulk download
  const [selectedReportTasks, setSelectedReportTasks] = useState({}); // Track selected tasks per client in reports

  // Report view filters
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportEmployeeFilter, setReportEmployeeFilter] = useState('all');
  const [reportClientFilter, setReportClientFilter] = useState('all');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportTimePeriod, setReportTimePeriod] = useState('month'); // 'day', 'week', 'month'

  // Ref for calendar section
  const calendarRef = useRef(null);

  // Ref for client tasks section
  const clientTasksRef = useRef(null);

  // Ref for task assignment form
  const taskFormRef = useRef(null);

  // Ref for uploaded Excel data section
  const uploadedDataRef = useRef(null);

  // Load employee info from props (when embedded) or sessionStorage/auth
  useEffect(() => {
    // If embedded in SuperAdmin with employee data, use that directly
    if (isEmbedded && employeeData) {
      setEmployeeInfo({
        name: employeeData.employeeName,
        email: employeeData.email,
        id: employeeData.id,
        department: employeeData.department
      });
      setIsAuthenticated(true); // Skip login when embedded
      console.log('Loaded employee info from props:', employeeData);
      return;
    }

    // Otherwise, load from sessionStorage or auth
    const storedEmployee = sessionStorage.getItem('strategyEmployee');
    if (storedEmployee) {
      try {
        const employee = JSON.parse(storedEmployee);
        // Map employee fields to the format expected by the dashboard
        setEmployeeInfo({
          name: employee.name || employee.employeeName || employee.fullName || employee.firstName || 'Strategy Employee',
          email: employee.email || 'strategy@gmail.com',
          id: employee.id,
          department: employee.department,
          role: employee.role
        });
        console.log('Loaded employee info:', employee);
      } catch (error) {
        console.error('Error parsing employee info:', error);
      }
    } else if (auth.currentUser) {
      // Fallback to auth user if sessionStorage is empty
      setEmployeeInfo({
        name: auth.currentUser.displayName || 'Strategy Employee',
        email: auth.currentUser.email
      });
    }
  }, [employeeData, isEmbedded]);

  // Fetch data from Firebase
  useEffect(() => {
    console.log('StrategyDashboard: Component mounted, setting up Firebase listeners');
    console.log('Database object:', database);

    if (!database) {
      console.log('Database is not initialized, using mock data');
      // Set empty arrays so component can still render
      setTasks([]);
      setClients([]);
      return;
    }

    try {
      const tasksRef = ref(database, 'tasks');
      const unsubscribeTasks = onValue(tasksRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const tasksArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          setTasks(tasksArray);
          console.log('StrategyDashboard: Tasks loaded:', tasksArray.length);
        } else {
          setTasks([]);
          console.log('StrategyDashboard: No tasks found');
        }
      });

      // Load clients ONLY from 'strategyClients' (sent from Strategy Head)
      // Filter to show only clients assigned to this employee
      const strategyClientsRef = ref(database, 'strategyClients');

      const unsubscribeClients = onValue(strategyClientsRef, (snapshot) => {
        const data = snapshot.val();
        console.log('StrategyDashboard: Loading from strategyClients database...');
        console.log('StrategyDashboard: strategyClients data:', data);
        if (data) {
          let clientsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }))
            // Filter out inactive/disabled clients
            .filter(client => client.status !== 'inactive' && client.status !== 'disabled');

          console.log('StrategyDashboard: Active clients loaded from DB:', clientsArray.length);
          console.log('StrategyDashboard: Sample client assignments:', clientsArray.map(c => ({
            name: c.clientName,
            assignedTo: c.assignedToEmployee
          })));

          // Store all active clients - filtering by employee will happen in separate useEffect
          setAllClientsFromDB(clientsArray);
        } else {
          setAllClientsFromDB([]);
          console.log('StrategyDashboard: No clients found in strategyClients');
        }
      });

      // Listen for notifications
      const notificationsRef = ref(database, 'notifications');
      const unsubscribeNotifications = onValue(notificationsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const notificationsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }))
            .filter(notif => notif.to === 'Strategy Department')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          setNotifications(notificationsArray);

          // Count unread notifications
          const unread = notificationsArray.filter(n => !n.read).length;
          setUnreadCount(unread);

          console.log('StrategyDashboard: Notifications loaded:', notificationsArray.length, 'Unread:', unread);
        } else {
          setNotifications([]);
          setUnreadCount(0);
        }
      });

      return () => {
        console.log('StrategyDashboard: Cleaning up Firebase listeners');
        unsubscribeTasks();
        unsubscribeClients();
        unsubscribeNotifications();
      };
    } catch (error) {
      console.error('StrategyDashboard: Error setting up Firebase listeners:', error);
    }
  }, [employeeData]);

  // Filter clients based on logged-in employee
  useEffect(() => {
    console.log('StrategyDashboard: Client filtering useEffect triggered');
    console.log('StrategyDashboard: allClientsFromDB:', allClientsFromDB.length);
    console.log('StrategyDashboard: employeeInfo:', employeeInfo);
    console.log('StrategyDashboard: employeeData:', employeeData);
    console.log('StrategyDashboard: isAuthenticated:', isAuthenticated);

    if (allClientsFromDB.length === 0) {
      console.log('StrategyDashboard: No clients loaded from DB yet');
      setClients([]);
      return;
    }

    // Get current user email - prioritize employeeInfo state, then props, then auth, then sessionStorage
    let currentUserEmail = null;

    // First check employeeInfo state (set from sessionStorage or props)
    if (employeeInfo?.email) {
      currentUserEmail = employeeInfo.email;
      console.log('StrategyDashboard: Using email from employeeInfo state:', currentUserEmail);
    }
    // Fallback to employeeData prop (when embedded)
    else if (employeeData?.email) {
      currentUserEmail = employeeData.email;
      console.log('StrategyDashboard: Using email from employeeData prop:', currentUserEmail);
    }
    // Fallback to auth.currentUser
    else if (auth.currentUser?.email) {
      currentUserEmail = auth.currentUser.email;
      console.log('StrategyDashboard: Using email from auth.currentUser:', currentUserEmail);
    }
    // Last resort: check sessionStorage directly
    else {
      const storedEmployee = sessionStorage.getItem('strategyEmployee');
      if (storedEmployee) {
        try {
          const employee = JSON.parse(storedEmployee);
          currentUserEmail = employee.email;
          console.log('StrategyDashboard: Using email from sessionStorage:', currentUserEmail);
        } catch (error) {
          console.error('Error parsing sessionStorage employee:', error);
        }
      }
    }

    console.log('StrategyDashboard: Final currentUserEmail for filtering:', currentUserEmail);

    // Filter clients assigned to this employee ONLY
    if (currentUserEmail) {
      const filteredClients = allClientsFromDB.filter(client => {
        const isAssigned = client.assignedToEmployee === currentUserEmail;
        console.log(`${isAssigned ? '✅' : '❌'} Client "${client.clientName}" assigned to "${client.assignedToEmployee}" ${isAssigned ? '==' : '!='} "${currentUserEmail}"`);
        return isAssigned;
      });
      console.log('StrategyDashboard: Filtered clients for', currentUserEmail, ':', filteredClients.length);
      console.log('StrategyDashboard: Filtered client names:', filteredClients.map(c => c.clientName));
      setClients(filteredClients);
    } else {
      console.log('⚠️ StrategyDashboard: No currentUserEmail found, showing no clients');
      setClients([]);
    }
  }, [allClientsFromDB, employeeInfo, employeeData, isAuthenticated]);

  // Filter tasks to show only tasks for this employee's clients
  useEffect(() => {
    if (!employeeData || !isEmbedded) return;

    // Get client IDs for this employee
    const employeeClientIds = clients.map(c => c.clientId || c.id);
    const employeeClientNames = clients.map(c => c.clientName);

    // Filter all tasks to show only tasks for this employee's clients
    const tasksRef = ref(database, 'tasks');
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allTasks = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));

        // Filter to show only tasks for this employee's clients
        const filteredTasks = allTasks.filter(task =>
          employeeClientIds.includes(task.clientId) ||
          employeeClientNames.includes(task.clientName)
        );

        setTasks(filteredTasks);
        console.log('StrategyDashboard: Filtered tasks for employee:', filteredTasks.length);
      } else {
        setTasks([]);
      }
    });

    return () => unsubscribe();
  }, [clients, employeeData, isEmbedded]);

  // Auto-refresh selected client tasks when tasks are updated
  useEffect(() => {
    if (selectedClient && showClientTasksModal) {
      const updatedClientTasks = tasks.filter(t =>
        t.clientId === selectedClient.clientId ||
        t.clientName === selectedClient.clientName
      );
      setSelectedClientTasks(updatedClientTasks);
      console.log('Auto-refreshed client tasks:', updatedClientTasks.length);
    }
  }, [tasks, selectedClient, showClientTasksModal]);

  // Auto-refresh tasks-only modal when tasks are updated
  useEffect(() => {
    if (showTasksOnlyModal && tasksOnlyModalData.clientName) {
      const updatedClientTasks = tasks.filter(t =>
        (t.clientName === tasksOnlyModalData.clientName) &&
        !t.deleted
      );
      setTasksOnlyModalData({
        clientName: tasksOnlyModalData.clientName,
        tasks: updatedClientTasks
      });
      console.log('Auto-refreshed tasks-only modal:', updatedClientTasks.length);
    }
  }, [tasks, showTasksOnlyModal, tasksOnlyModalData.clientName]);

  // Scroll to calendar when it opens
  useEffect(() => {
    if (showCalendar && calendarRef.current) {
      setTimeout(() => {
        calendarRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100); // Small delay to ensure calendar is rendered
    }
  }, [showCalendar]);

  // Scroll to task assignment form when it opens
  useEffect(() => {
    if (showTaskAssignForm && taskFormRef.current) {
      setTimeout(() => {
        taskFormRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100); // Small delay to ensure form is rendered
    }
  }, [showTaskAssignForm]);

  // Scroll to uploaded Excel data when it's shown
  useEffect(() => {
    if (showUploadedData && uploadedDataRef.current) {
      setTimeout(() => {
        uploadedDataRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100); // Small delay to ensure data table is rendered
    }
  }, [showUploadedData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openStatusDropdownTaskId !== null) {
        // Check if click is on the status badge or inside the dropdown
        const statusBadge = event.target.closest('.task-status-badge');
        const dropdownMenu = event.target.closest('[data-dropdown-menu]');

        // Only close if clicking outside both the badge and dropdown
        if (!statusBadge && !dropdownMenu) {
          setOpenStatusDropdownTaskId(null);
        }
      }

      // Close download dropdown when clicking outside
      if (showDownloadDropdown) {
        const downloadButton = event.target.closest('button');
        if (!downloadButton || !downloadButton.textContent.includes('Download')) {
          setShowDownloadDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openStatusDropdownTaskId, showDownloadDropdown]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Toggle notification panel
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    if (!database) return;

    try {
      const notificationRef = ref(database, `notifications/${notificationId}`);
      await update(notificationRef, {
        read: true,
        readAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!database || notifications.length === 0) return;

    try {
      const updatePromises = notifications
        .filter(n => !n.read)
        .map(n => {
          const notificationRef = ref(database, `notifications/${n.id}`);
          return update(notificationRef, {
            read: true,
            readAt: new Date().toISOString()
          });
        });

      await Promise.all(updatePromises);
      showToast(' All notifications marked as read', 'success', 2000);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Open client tasks modal
  const openClientTasksModal = async (clientName, clientTasks, client = null) => {
    setSelectedClientName(clientName);
    setSelectedClientTasks(clientTasks);
    setSelectedClient(client); // Store the client object
    setShowClientTasksModal(true);

    // Mark notifications for this client as read
    if (database) {
      const clientNotifications = notifications.filter(
        n => !n.read &&
          n.clientName === clientName &&
          (n.type === 'tasks-sent-to-strategy' || n.type === 'tasks-assigned')
      );

      if (clientNotifications.length > 0) {
        try {
          const updatePromises = clientNotifications.map(n => {
            const notificationRef = ref(database, `notifications/${n.id}`);
            return update(notificationRef, {
              read: true,
              readAt: new Date().toISOString()
            });
          });
          await Promise.all(updatePromises);
        } catch (error) {
          console.error('Error marking client notifications as read:', error);
        }
      }
    }
  };

  // Close client tasks modal
  const closeClientTasksModal = () => {
    setShowClientTasksModal(false);
    setSelectedClientTasks([]);
    setSelectedClientName('');
  };

  // Open rework modal
  const openReworkModal = (taskId) => {
    setReworkTaskId(taskId);
    setReworkNote('');
    setShowReworkModal(true);
  };

  // Close rework modal
  const closeReworkModal = () => {
    setShowReworkModal(false);
    setReworkTaskId(null);
    setReworkNote('');
  };

  // Handle rework with note
  const handleReworkWithNote = async () => {
    if (!reworkNote.trim()) {
      showToast(' Please enter a rework note', 'error', 3000);
      return;
    }

    if (!database) {
      showToast('Database not available', 'error', 3000);
      return;
    }

    try {
      const taskRef = ref(database, `tasks/${reworkTaskId}`);
      await update(taskRef, {
        status: 'information-gathering',
        reworkNote: reworkNote,
        reworkedAt: new Date().toISOString(),
        reworkedBy: 'Strategy Department',
        lastUpdated: new Date().toISOString()
      });

      showToast(' Task sent for rework with note!', 'success', 3000);
      closeReworkModal();
      setOpenStatusDropdownTaskId(null);
    } catch (error) {
      console.error('Error sending task for rework:', error);
      showToast(' Error sending task for rework', 'error', 3000);
    }
  };

  // Handle strategy preparation form submission
  const handleStrategyPrepSubmit = async (e) => {
    e.preventDefault();

    if (!database) {
      showToast(' Database not available', 'error', 3000);
      return;
    }

    try {
      const taskRef = ref(database, `tasks/${strategyPrepTaskId}`);
      await update(taskRef, {
        status: 'strategy-preparation',
        lastUpdated: new Date().toISOString()
      });

      showToast(' Task moved to Strategy Preparation!', 'success', 3000);
      setShowStrategyPrepForm(false);
      setStrategyPrepTaskId(null);
    } catch (error) {
      console.error('Error updating task:', error);
      showToast(' Error updating task', 'error', 3000);
    }
  };

  const handleAssignTask = async (e, keepFormOpen = false) => {
    e.preventDefault();

    if (!database) {
      showToast(' Database not available. Please check Firebase configuration.', 'error', 3000);
      return;
    }

    try {
      const postDate = new Date(newTaskAssignment.postDate);
      const deadline = new Date(postDate);
      deadline.setDate(deadline.getDate() - 2);

      // Check if we're editing an existing task
      if (strategyPrepTaskId) {
        // Update existing task
        const taskRef = ref(database, `tasks/${strategyPrepTaskId}`);
        await update(taskRef, {
          taskName: newTaskAssignment.taskName,
          clientId: newTaskAssignment.clientId || '',
          clientName: newTaskAssignment.clientName,
          department: newTaskAssignment.department,
          taskType: newTaskAssignment.taskType,
          description: newTaskAssignment.description,
          referenceLink: newTaskAssignment.referenceLink || '',
          ideaPoint: newTaskAssignment.ideaPoint || '',
          specialNotes: newTaskAssignment.specialNotes || '',
          postDate: newTaskAssignment.postDate,
          deadline: deadline.toISOString().split('T')[0],
          lastUpdated: new Date().toISOString(),
          updatedBy: 'Strategy Department'
        });

        showToast(' Task updated successfully!', 'success', 3000);

        // If we should reopen the tasks modal, refresh the tasks and reopen it
        if (reopenTasksModal) {
          // Get updated tasks for this client
          const clientTasks = tasks.filter(t =>
            (t.clientId === newTaskAssignment.clientId || t.clientName === newTaskAssignment.clientName) &&
            !t.deleted
          );

          // Reopen the tasks modal with updated data
          setTimeout(() => {
            setTasksOnlyModalData({
              clientName: newTaskAssignment.clientName,
              tasks: clientTasks
            });
            setShowTasksOnlyModal(true);
            setReopenTasksModal(false); // Reset the flag
          }, 500); // Small delay to allow form to close first
        }
      } else {
        // Create new task
        const tasksRef = ref(database, 'tasks');
        await push(tasksRef, {
          taskName: newTaskAssignment.taskName,
          projectId: 'strategy-direct',
          projectName: 'Strategy Department',
          clientId: newTaskAssignment.clientId || '',
          clientName: newTaskAssignment.clientName,
          department: newTaskAssignment.department,
          taskType: newTaskAssignment.taskType,
          description: newTaskAssignment.description,
          referenceLink: newTaskAssignment.referenceLink || '',
          ideaPoint: newTaskAssignment.ideaPoint || '',
          specialNotes: newTaskAssignment.specialNotes || '',
          postDate: newTaskAssignment.postDate,
          deadline: deadline.toISOString().split('T')[0],
          status: 'pending-production',
          createdAt: new Date().toISOString(),
          createdBy: 'Strategy Department'
        });

        showToast(' Task assigned successfully!', 'success', 3000);
      }

      // Note: Removed the old logic that was updating task status to internal-approval
      // since strategyPrepTaskId is now used for editing
      if (false && strategyPrepTaskId) {
        const taskRef = ref(database, `tasks/${strategyPrepTaskId}`);
        await update(taskRef, {
          status: 'internal-approval',
          lastUpdated: new Date().toISOString()
        });

        // Update local state
        setSelectedClientTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === strategyPrepTaskId
              ? { ...t, status: 'internal-approval', lastUpdated: new Date().toISOString() }
              : t
          )
        );

        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === strategyPrepTaskId
              ? { ...t, status: 'internal-approval', lastUpdated: new Date().toISOString() }
              : t
          )
        );
      }

      // Don't update client stage automatically - only when Complete button is clicked
      // Just show success message
      showToast(' Task assigned successfully!', 'success', 3000);

      // Reset form but keep modal open so user can see the updated tasks
      setNewTaskAssignment({
        clientId: selectedClient ? selectedClient.clientId : '',
        clientName: selectedClient ? selectedClient.clientName : '',
        taskName: '',
        description: '',
        department: '',
        taskType: '',
        postDate: '',
        referenceLink: '',
        ideaPoint: '',
        specialNotes: '',
        useManualEntry: false
      });

      // Close the task assignment form but keep client modal open (unless keepFormOpen is true)
      if (!keepFormOpen) {
        setShowStrategyPrepForm(false);
        setStrategyPrepTaskId(null);
      }

      // Tasks will be automatically refreshed by useEffect when Firebase updates
    } catch (error) {
      console.error('Error assigning task:', error);
      showToast(' Error assigning task', 'error', 3000);
    }
  };

  // Helper function to convert Excel serial date to JavaScript Date
  const excelSerialToDate = (serial) => {
    // Excel serial date starts from January 1, 1900
    // But Excel incorrectly treats 1900 as a leap year, so we need to adjust
    if (typeof serial !== 'number') {
      // If it's already a string date, try to parse it
      const parsedDate = new Date(serial);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
      return serial; // Return as is if can't parse
    }

    // Convert Excel serial number to JavaScript Date
    const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
    const jsDate = new Date(excelEpoch.getTime() + (serial - 1) * 24 * 60 * 60 * 1000);

    // Format as YYYY-MM-DD
    return jsDate.toISOString().split('T')[0];
  };

  // Helper function to format date for display
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      // Format as DD-MM-YYYY for better readability
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}-${month}-${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // Helper function to format date without timezone issues
  const formatDateSafe = (date) => {
    if (!date) return '';
    // Use local date components to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const formattedData = jsonData.slice(1).map((row, index) => ({
          client_id: row[0] || (index + 1), // Use client_id from Excel or generate
          name: row[1] || '',               // Client name
          type: row[2] || '',               // Type column (Video/Graphics) - this is the department
          postDate: row[3] ? excelSerialToDate(row[3]) : '', // Convert Excel serial date to proper date
          taskDetails: row[4] || ''         // Department column (2 reels, 1 image, etc.) - this is task details
        }));

        console.log('Parsed Excel data:', formattedData);
        setUploadedData(formattedData);
        setShowUploadedData(true);
        showToast(` Excel file uploaded successfully! Found ${formattedData.length} rows`, 'success', 3000);
      } catch (error) {
        showToast(' Error reading Excel file', 'error', 3000);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Get all tasks for the selected month (for statistics)
  // Only show tasks that have been sent from Production (sentToStrategy: true)
  // OR tasks created by Strategy Department directly
  const allMonthTasks = tasks.filter(task => {
    const postDate = task.postDate;
    const deadline = task.deadline;
    const isInSelectedMonth = (postDate && postDate.startsWith(selectedMonth)) ||
      (deadline && deadline.startsWith(selectedMonth));

    // Show tasks that are either:
    // 1. Sent from Production (sentToStrategy: true)
    // 2. Created by Strategy Department directly
    const isFromProduction = task.sentToStrategy === true;
    const isFromStrategy = task.createdBy && task.createdBy.includes('Strategy Department');

    return isInSelectedMonth && (isFromProduction || isFromStrategy);
  });

  // Apply stats filter, status filter, client filter, and search for display
  const filteredTasks = allMonthTasks.filter(task => {
    // Stats filter
    let statsMatch = true;
    switch (statsFilter) {
      case 'approved':
        statsMatch = task.status === 'approved';
        break;
      case 'pending':
        statsMatch = task.status === 'pending' || task.status === 'pending-production';
        break;
      case 'all':
      default:
        statsMatch = true;
    }

    // Status dropdown filter
    let statusMatch = true;
    if (statusFilter !== 'all') {
      statusMatch = task.status === statusFilter;
    }

    // Client filter
    let clientMatch = true;
    if (reportClientFilter !== 'all') {
      clientMatch = task.clientName === reportClientFilter;
    }

    // Search filter
    let searchMatch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      searchMatch =
        (task.clientName && task.clientName.toLowerCase().includes(query)) ||
        (task.taskName && task.taskName.toLowerCase().includes(query)) ||
        (task.description && task.description.toLowerCase().includes(query)) ||
        (task.clientId && task.clientId.toLowerCase().includes(query)) ||
        (task.assignedTo && task.assignedTo.toLowerCase().includes(query)) ||
        (task.createdBy && task.createdBy.toLowerCase().includes(query));
    }

    return statsMatch && statusMatch && clientMatch && searchMatch;
  });

  // Apply report-specific filters
  const reportFilteredTasks = filteredTasks.filter(task => {
    // Search filter
    let searchMatch = true;
    if (reportSearchQuery.trim()) {
      const query = reportSearchQuery.toLowerCase();
      searchMatch =
        (task.clientName && task.clientName.toLowerCase().includes(query)) ||
        (task.taskName && task.taskName.toLowerCase().includes(query)) ||
        (task.description && task.description.toLowerCase().includes(query)) ||
        (task.assignedTo && task.assignedTo.toLowerCase().includes(query)) ||
        (task.createdBy && task.createdBy.toLowerCase().includes(query));
    }

    // Client filter
    let clientMatch = true;
    if (reportClientFilter !== 'all') {
      clientMatch = task.clientName === reportClientFilter;
    }

    // Status filter
    let statusMatch = true;
    if (reportStatusFilter !== 'all') {
      statusMatch = task.status === reportStatusFilter;
    }

    // Employee filter (if needed in future)
    let employeeMatch = true;
    if (reportEmployeeFilter !== 'all') {
      employeeMatch = task.assignedTo === reportEmployeeFilter || task.createdBy === reportEmployeeFilter;
    }

    // Time period filter
    let timePeriodMatch = true;
    if (reportTimePeriod !== 'month') {
      const taskDate = task.postDate ? new Date(task.postDate) : task.createdAt ? new Date(task.createdAt) : null;
      if (taskDate) {
        const now = new Date();

        if (reportTimePeriod === 'day') {
          // Show tasks from today only
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
          timePeriodMatch = taskDay.getTime() === today.getTime();
        } else if (reportTimePeriod === 'week') {
          // Show tasks from current week (last 7 days)
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          timePeriodMatch = taskDate >= weekAgo && taskDate <= now;
        }
      } else {
        timePeriodMatch = false;
      }
    }

    return searchMatch && clientMatch && statusMatch && employeeMatch && timePeriodMatch;
  });

  // Handle assigning tasks from uploaded Excel data
  const handleAssignTasksFromExcel = async () => {
    if (!database) {
      showToast(' Database not available. Please check Firebase configuration.', 'error', 3000);
      return;
    }

    if (uploadedData.length === 0) {
      showToast('No data to assign', 'error', 3000);
      return;
    }

    try {
      showToast('ï¿½ Creating tasks from Excel data...', 'info', 2000);

      const tasksRef = ref(database, 'tasks');
      const clientsRef = ref(database, 'clients');
      let successCount = 0;
      let clientCount = 0;

      for (const row of uploadedData) {
        if (row.name && row.type && row.taskDetails) {
          // Use original client ID from Excel (no CLI prefix)
          const clientId = String(row.client_id);

          // Save client if it doesn't exist
          try {
            await push(clientsRef, {
              clientId: clientId,
              clientName: row.name,
              createdAt: new Date().toISOString(),
              createdBy: 'Strategy Department (Excel Import)'
            });
            clientCount++;
          } catch (clientError) {
            console.log('Client might already exist:', clientError);
          }

          // Create task with proper date handling
          let postDate;
          try {
            // Since we already converted Excel serial date to YYYY-MM-DD format, just parse it
            if (row.postDate) {
              postDate = new Date(row.postDate);
            }
            if (!postDate || isNaN(postDate.getTime())) {
              postDate = new Date();
            }
          } catch (dateError) {
            postDate = new Date();
          }

          const deadline = new Date(postDate);
          deadline.setDate(deadline.getDate() - 2);

          // Use taskDetails as the task name (2 reels, 1 image, etc.)
          // Use type as the department (Video/Graphics)
          const taskData = {
            taskName: row.taskDetails || `${row.type} Content`,
            projectId: 'strategy-excel-import',
            projectName: 'Strategy Department - Excel Import',
            clientId: clientId,
            clientName: row.name,
            department: row.type.toLowerCase(), // Video or Graphics
            description: `Create ${row.taskDetails} for ${row.name}`,
            postDate: formatDateSafe(postDate),
            deadline: formatDateSafe(deadline),
            status: 'pending-production',
            createdAt: new Date().toISOString(),
            createdBy: 'Strategy Department (Excel Import)'
          };

          console.log('Creating task:', taskData);
          await push(tasksRef, taskData);

          successCount++;
        }
      }

      showToast(`Successfully created ${successCount} tasks and ${clientCount} clients from Excel data!`, 'success', 4000);
      setShowUploadedData(false);
      setUploadedData([]);

    } catch (error) {
      console.error('Error creating tasks from Excel:', error);
      showToast('Error creating tasks: ' + error.message, 'error', 3000);
    }
  };

  // Handle calendar date click
  const handleDateClick = (date, dayTasks) => {
    if (dayTasks.length > 0) {
      setSelectedDate(date);
      setSelectedDateTasks(dayTasks);
      setShowTaskModal(true);
    }
  };

  // Close task modal
  const closeTaskModal = () => {
    setShowTaskModal(false);
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  // Handle opening assign task form with prefilled client
  const handleAssignTaskForClient = (clientName, clientId) => {
    setPrefilledClient({ name: clientName, id: clientId });
    setTaskForms([{ id: 1 }]); // Reset to single form
    setShowAssignForm(true);
  };

  // Add new task form
  const addTaskForm = () => {
    const newId = Math.max(...taskForms.map(f => f.id)) + 1;
    setTaskForms([...taskForms, { id: newId }]);
  };

  // Remove task form
  const removeTaskForm = (formId) => {
    if (taskForms.length > 1) {
      setTaskForms(taskForms.filter(f => f.id !== formId));
    }
  };

  // Toggle client expansion
  const toggleClientExpansion = (clientName) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  };

  // Group tasks by client and sort by date
  const groupTasksByClient = (tasks) => {
    const grouped = tasks.reduce((acc, task) => {
      const clientName = task.clientName || 'Unknown Client';
      if (!acc[clientName]) {
        acc[clientName] = [];
      }
      acc[clientName].push(task);
      return acc;
    }, {});

    // Sort tasks within each client by date
    Object.keys(grouped).forEach(clientName => {
      grouped[clientName].sort((a, b) => {
        const dateA = new Date(a.postDate || a.deadline || '1970-01-01');
        const dateB = new Date(b.postDate || b.deadline || '1970-01-01');
        return dateA - dateB;
      });
    });

    return grouped;
  };

  // Format date as DD-MM-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  };

  // Handle task approval
  const handleTaskApproval = async (taskId) => {
    if (!database) {
      showToast('Database not available', 'error', 3000);
      return;
    }

    try {
      const taskRef = ref(database, `tasks/${taskId}`);
      await update(taskRef, {
        status: 'client-approval',
        lastUpdated: new Date().toISOString()
      });

      // Update local state
      setSelectedClientTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId
            ? { ...t, status: 'client-approval', lastUpdated: new Date().toISOString() }
            : t
        )
      );

      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId
            ? { ...t, status: 'client-approval', lastUpdated: new Date().toISOString() }
            : t
        )
      );

      showToast('Moved to Client Approval!', 'success', 3000);
    } catch (error) {
      console.error('Error approving task:', error);
      showToast('Error approving task', 'error', 3000);
    }
  };

  // Handle task status update
  const handleTaskStatusUpdate = async (taskId, newStatus) => {
    console.log('Updating task status:', taskId, 'to:', newStatus);
    if (!database) {
      showToast('Database not available', 'error', 3000);
      return;
    }

    // Optimistic update - update local state immediately
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: newStatus, lastUpdated: new Date().toISOString() }
          : task
      )
    );

    // Also update selectedClientTasks if in modal
    setSelectedClientTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: newStatus, lastUpdated: new Date().toISOString() }
          : task
      )
    );

    try {
      const taskRef = ref(database, `tasks/${taskId}`);
      const updateData = {
        status: newStatus,
        lastUpdated: new Date().toISOString()
      };
      console.log('Update data:', updateData);

      // Add specific fields based on status
      if (newStatus === 'approved') {
        // Get the task to find its department
        const task = tasks.find(t => t.id === taskId);
        updateData.status = 'assigned-to-department';
        updateData.approvedAt = new Date().toISOString();
        updateData.approvedBy = 'Strategy Department';
        updateData.approvedForCalendar = true;
        updateData.assignedToDepartmentAt = new Date().toISOString();
        updateData.assignedBy = 'Strategy Department'; // Add this so department dashboards can see it
        if (task) {
          updateData.assignedToDept = task.department; // Explicitly set the department
        }
      } else if (newStatus === 'in-progress') {
        updateData.startedAt = new Date().toISOString();
      } else if (newStatus === 'posted') {
        updateData.postedAt = new Date().toISOString();
      }

      await update(taskRef, updateData);
      showToast(`Task status updated to ${newStatus}!`, 'success', 3000);
      setOpenStatusDropdownTaskId(null);
    } catch (error) {
      console.error('Error updating task status:', error);
      showToast('Error updating task status', 'error', 3000);
    }
  };

  // Send all approved tasks for the selected month to Production
  const handleSendCalendarToProduction = async () => {
    if (!database) {
      showToast('Database not available', 'error', 3000);
      return;
    }

    const tasksToSend = filteredTasks.filter(task =>
      task.status === 'approved' && task.approvedForCalendar && !task.addedToCalendar
    );

    if (tasksToSend.length === 0) {
      showToast('No approved tasks to send for this month.', 'info', 3000);
      return;
    }

    try {
      for (const task of tasksToSend) {
        const taskRef = ref(database, `tasks/${task.id}`);
        await update(taskRef, {
          addedToCalendar: true,
          sentToProductionAt: new Date().toISOString()
        });
      }

      showToast(`Sent ${tasksToSend.length} task(s) to Production for this month.`, 'success', 4000);
    } catch (error) {
      console.error('Error sending calendar to Production:', error);
      showToast('Error sending calendar to Production', 'error', 3000);
    }
  };

  // Handle task selection
  const handleTaskSelection = (taskId, clientName = null) => {
    const newSelected = new Set(selectedTasks);
    const taskKey = clientName ? `${clientName}-${taskId}` : taskId;
    if (newSelected.has(taskKey)) {
      newSelected.delete(taskKey);
    } else {
      newSelected.add(taskKey);
    }
    setSelectedTasks(newSelected);
  };

  // Handle select all tasks for a client
  const handleSelectAllClientTasks = (clientName, clientTasks) => {
    const newSelected = new Set(selectedTasks);
    const allSelected = clientTasks.every(task => newSelected.has(`${clientName}-${task.id}`));

    if (allSelected) {
      // Deselect all
      clientTasks.forEach(task => newSelected.delete(`${clientName}-${task.id}`));
    } else {
      // Select all
      clientTasks.forEach(task => newSelected.add(`${clientName}-${task.id}`));
    }
    setSelectedTasks(newSelected);
  };

  // Toggle expanded client in report view
  const toggleReportClientExpansion = (clientName) => {
    const newExpanded = new Set(expandedReportClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedReportClients(newExpanded);
  };

  // Get selected tasks data for download
  const getSelectedTasksData = () => {
    const selectedTasksData = [];
    selectedTasks.forEach(taskKey => {
      const firstHyphenIndex = taskKey.indexOf('-');
      if (firstHyphenIndex === -1) return;

      const clientName = taskKey.substring(0, firstHyphenIndex);
      const taskId = taskKey.substring(firstHyphenIndex + 1);

      const task = filteredTasks.find(t => t.id === taskId && t.clientName === clientName);
      if (task) {
        selectedTasksData.push(task);
      }
    });
    return selectedTasksData;
  };

  // Download selected tasks as PDF
  const downloadSelectedTasksPDF = (clientName = null) => {
    try {
      let selectedTasksData = getSelectedTasksData();

      if (clientName) {
        selectedTasksData = selectedTasksData.filter(task => task.clientName === clientName);
      }

      if (selectedTasksData.length === 0) {
        showToast('âŒ Please select at least one task', 'error', 3000);
        return;
      }

      const doc = new jsPDF();
      const currentDateTime = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Digi Sayhadri', 105, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(currentDateTime, 190, 20, { align: 'right' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const reportTitle = clientName ? `Tasks for ${clientName}` : 'Selected Tasks Report';
      doc.text(reportTitle, 14, 35);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Employee: ${employeeInfo?.name || 'Employee'}`, 14, 42);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 48);
      doc.text(`Total Tasks: ${selectedTasksData.length}`, 14, 54);

      const tableData = selectedTasksData.map(task => [
        task.taskName || 'N/A',
        task.clientName || 'N/A',
        task.department || 'N/A',
        formatDate(task.postDate),
        formatDate(task.deadline),
        task.status || 'pending'
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['Task Name', 'Client Name', 'Department', 'Post Date', 'Deadline', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        margin: { top: 55 }
      });

      const filename = clientName
        ? `${clientName}_Tasks_${new Date().toISOString().split('T')[0]}.pdf`
        : `Selected_Tasks_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      showToast(' PDF downloaded successfully', 'success', 3000);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast('âŒ Error downloading PDF: ' + error.message, 'error', 3000);
    }
  };

  // Download selected tasks as Excel
  const downloadSelectedTasksExcel = (clientName = null) => {
    try {
      let selectedTasksData = getSelectedTasksData();

      if (clientName) {
        selectedTasksData = selectedTasksData.filter(task => task.clientName === clientName);
      }

      if (selectedTasksData.length === 0) {
        showToast(' Please select at least one task', 'error', 3000);
        return;
      }

      const currentDateTime = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const reportTitle = clientName ? `Tasks for ${clientName}` : 'Selected Tasks Report';
      const excelData = [
        ['Digi Sayhadri', '', '', '', '', currentDateTime],
        [],
        [reportTitle],
        [`Generated: ${new Date().toLocaleDateString()}`],
        [`Total Tasks: ${selectedTasksData.length}`],
        [],
        ['Task Name', 'Client Name', 'Department', 'Post Date', 'Deadline', 'Status']
      ];

      selectedTasksData.forEach(task => {
        excelData.push([
          task.taskName || 'N/A',
          task.clientName || 'N/A',
          task.department || 'N/A',
          formatDate(task.postDate),
          formatDate(task.deadline),
          task.status || 'pending'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(excelData);

      ws['!cols'] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Selected Tasks');
      const filename = clientName
        ? `${clientName}_Tasks_${new Date().toISOString().split('T')[0]}.xlsx`
        : `Selected_Tasks_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast(' Excel downloaded successfully', 'success', 3000);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('Error downloading Excel: ' + error.message, 'error', 3000);
    }
  };

  // Download multiple clients' tasks as PDF
  const downloadMultipleClientsPDF = (tasks) => {
    if (tasks.length === 0) {
      showToast('No tasks to download', 'warning');
      return;
    }

    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    // Get employee name from multiple sources
    let employeeName = 'Employee';

    // Try to get from sessionStorage first (most reliable)
    const storedEmployee = sessionStorage.getItem('strategyEmployee');
    if (storedEmployee) {
      try {
        const employee = JSON.parse(storedEmployee);
        console.log('Stored employee data:', employee);
        // Check all possible field names
        employeeName = employee.name || employee.employeeName || employee.fullName || employee.firstName || 'Employee';
      } catch (error) {
        console.error('Error parsing employee info:', error);
      }
    }

    // Fallback to other sources if sessionStorage didn't work
    if (employeeName === 'Employee') {
      if (employeeInfo?.name) {
        employeeName = employeeInfo.name;
      } else if (employeeData?.employeeName) {
        employeeName = employeeData.employeeName;
      } else if (auth.currentUser?.displayName) {
        employeeName = auth.currentUser.displayName;
      }
    }

    console.log('PDF Download - Employee Name:', employeeName);

    // Group tasks by client
    const tasksByClient = {};
    tasks.forEach(task => {
      const clientName = task.clientName || 'Unknown';
      if (!tasksByClient[clientName]) {
        tasksByClient[clientName] = [];
      }
      tasksByClient[clientName].push(task);
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Client Report - ${monthName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
          .header { position: relative; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #667eea; padding-bottom: 15px; }
          .header h1 { font-size: 32px; font-weight: bold; margin: 0 0 5px 0; }
          .header .employee-name { font-size: 16px; color: #667eea; font-weight: 600; margin: 5px 0 0 0; }
          .header .datetime { position: absolute; top: 0; right: 0; font-size: 14px; color: #666; font-weight: 500; }
          .title { font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; color: #667eea; }
          .summary-info { font-size: 14px; color: #666; margin-bottom: 30px; }
          .client-section { margin: 30px 0; page-break-inside: avoid; }
          .client-header { background: #667eea; color: white; padding: 12px; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .summary { margin: 15px 0; padding: 10px; background: #f9fafb; }
          .summary p { margin: 5px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #667eea; color: white; padding: 10px; text-align: left; font-weight: 600; border: 1px solid #667eea; font-size: 12px; }
          td { padding: 8px 10px; border: 1px solid #ddd; font-size: 12px; }
          tr:nth-child(even) { background: #f9f9f9; }
          @media print { body { padding: 20px; } .client-section { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="datetime">${currentDateTime}</div>
          <h1>Digi Sayhadri</h1>
          <p class="employee-name">Employee: ${employeeName}</p>
        </div>

        <div class="title">Client Report</div>
        <div class="summary-info">Total Clients: ${Object.keys(tasksByClient).length} | Total Tasks: ${tasks.length}</div>

        ${Object.entries(tasksByClient).map(([clientName, clientTasks]) => {
      const completed = clientTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
      const inProgress = clientTasks.filter(t => t.status === 'in-progress').length;
      const pending = clientTasks.filter(t => t.status === 'pending' || t.status === 'pending-production').length;

      return `
            <div class="client-section">
              <div class="client-header">${clientName}</div>
              <div class="summary">
                <p><strong>Total Tasks:</strong> ${clientTasks.length} | <strong>Completed:</strong> ${completed} | <strong>In Progress:</strong> ${inProgress} | <strong>Pending:</strong> ${pending}</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Task Name</th>
                    <th>Department</th>
                    <th>Post Date</th>
                    <th>Deadline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${clientTasks.map(task => {
        return `
                      <tr>
                        <td>${task.taskName || 'N/A'}</td>
                        <td>${task.department || 'N/A'}</td>
                        <td>${formatDate(task.postDate)}</td>
                        <td>${formatDate(task.deadline)}</td>
                        <td>${task.status?.replace(/-/g, ' ') || 'N/A'}</td>
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
    showToast(`PDF generated for ${Object.keys(tasksByClient).length} client(s) with ${tasks.length} task(s)`, 'success');
  };

  // Download multiple clients' tasks as Excel
  const downloadMultipleClientsExcel = (tasks) => {
    if (tasks.length === 0) {
      showToast('No tasks to download', 'warning');
      return;
    }

    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    // Get employee name from multiple sources
    let employeeName = 'Employee';

    // Try to get from sessionStorage first (most reliable)
    const storedEmployee = sessionStorage.getItem('strategyEmployee');
    if (storedEmployee) {
      try {
        const employee = JSON.parse(storedEmployee);
        console.log('Stored employee data:', employee);
        // Check all possible field names
        employeeName = employee.name || employee.employeeName || employee.fullName || employee.firstName || 'Employee';
      } catch (error) {
        console.error('Error parsing employee info:', error);
      }
    }

    // Fallback to other sources if sessionStorage didn't work
    if (employeeName === 'Employee') {
      if (employeeInfo?.name) {
        employeeName = employeeInfo.name;
      } else if (employeeData?.employeeName) {
        employeeName = employeeData.employeeName;
      } else if (auth.currentUser?.displayName) {
        employeeName = auth.currentUser.displayName;
      }
    }

    console.log('Excel Download - Employee Name:', employeeName);

    // Group tasks by client
    const tasksByClient = {};
    tasks.forEach(task => {
      const clientName = task.clientName || 'Unknown';
      if (!tasksByClient[clientName]) {
        tasksByClient[clientName] = [];
      }
      tasksByClient[clientName].push(task);
    });

    // Prepare Excel data with proper formatting
    const excelData = [
      ['', '', 'Digi Sayhadri', '', currentDateTime],
      ['', '', `Employee: ${employeeName}`],
      [],
      ['Client Report'],
      [`Total Clients: ${Object.keys(tasksByClient).length} | Total Tasks: ${tasks.length}`],
      []
    ];

    // Add data for each client
    Object.entries(tasksByClient).forEach(([clientName, clientTasks]) => {
      const completed = clientTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
      const inProgress = clientTasks.filter(t => t.status === 'in-progress').length;
      const pending = clientTasks.filter(t => t.status === 'pending' || t.status === 'pending-production').length;

      excelData.push([]);
      excelData.push([`Client: ${clientName}`]);
      excelData.push([`Total Tasks: ${clientTasks.length} | Completed: ${completed} | In Progress: ${inProgress} | Pending: ${pending}`]);
      excelData.push(['Task Name', 'Department', 'Post Date', 'Deadline', 'Status']);

      clientTasks.forEach(task => {
        excelData.push([
          task.taskName || 'N/A',
          task.department || 'N/A',
          formatDate(task.postDate),
          formatDate(task.deadline),
          task.status?.replace(/-/g, ' ') || 'N/A'
        ]);
      });
    });

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Client Report');

    // Download file
    const filename = `client_report_${selectedMonth}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast(`Excel file downloaded for ${Object.keys(tasksByClient).length} client(s) with ${tasks.length} task(s)`, 'success');
  };

  // Handle statistics card click - filter and scroll to tasks
  const handleStatsCardClick = (filter) => {
    setStatsFilter(filter);
    // Clear search query to show all tasks for the selected filter
    setSearchQuery('');
    // Clear status filter to show all statuses
    setStatusFilter('all');
    // Scroll to client tasks section
    setTimeout(() => {
      if (clientTasksRef.current) {
        clientTasksRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  // Bulk approve selected tasks
  const handleBulkApprove = async () => {
    if (selectedTasks.size === 0) {
      showToast('ï¸ Please select at least one task to approve', 'warning', 3000);
      return;
    }

    if (!database) {
      showToast('Database not available', 'error', 3000);
      return;
    }

    try {
      const tasksToApprove = filteredTasks.filter(task =>
        selectedTasks.has(task.id) && task.status !== 'approved'
      );

      if (tasksToApprove.length === 0) {
        showToast('All selected tasks are already approved', 'info', 3000);
        return;
      }

      // Approve all selected tasks
      const approvePromises = tasksToApprove.map(task => {
        const taskRef = ref(database, `tasks/${task.id}`);
        return update(taskRef, {
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: 'Strategy Department',
          approvedForCalendar: true,
          addedToCalendar: false
        });
      });

      await Promise.all(approvePromises);

      showToast(`${tasksToApprove.length} task(s) approved successfully!`, 'success', 3000);
      setSelectedTasks(new Set()); // Clear selection after approval
    } catch (error) {
      console.error('Error approving tasks:', error);
      showToast('Error approving tasks', 'error', 3000);
    }
  };

  // Download selected tasks to Excel
  const handleDownloadExcel = () => {
    if (selectedTasks.size === 0) {
      showToast('ï¸ Please select at least one task to download', 'warning', 3000);
      return;
    }

    const tasksToDownload = filteredTasks.filter(task => selectedTasks.has(task.id));

    // Prepare data for Excel
    const excelData = tasksToDownload.map(task => ({
      'Client ID': task.clientId || 'N/A',
      'Client Name': task.clientName || 'N/A',
      'Task Name': task.taskName || 'N/A',
      'Description': task.description || 'N/A',
      'Department': task.department || 'N/A',
      'Post Date': task.postDate || 'N/A',
      'Deadline': task.deadline || 'N/A',
      'Status': task.status || 'N/A',
      'Created At': task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A',
      'Approved': task.approvedForCalendar ? 'Yes' : 'No'
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // Client ID
      { wch: 20 }, // Client Name
      { wch: 25 }, // Task Name
      { wch: 40 }, // Description
      { wch: 15 }, // Department
      { wch: 12 }, // Post Date
      { wch: 12 }, // Deadline
      { wch: 15 }, // Status
      { wch: 20 }, // Created At
      { wch: 10 }  // Approved
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

    // Generate filename with date
    const filename = `Strategy_Tasks_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Download
    XLSX.writeFile(workbook, filename);

    showToast(`Downloaded ${tasksToDownload.length} task(s) to Excel`, 'success', 3000);

    // Clear selection after download
    setSelectedTasks(new Set());
  };

  // Download selected tasks to PDF
  const handleDownloadPDF = () => {
    if (selectedTasks.size === 0) {
      showToast('ï¸ Please select at least one task to download', 'warning', 3000);
      return;
    }

    const tasksToDownload = filteredTasks.filter(task => selectedTasks.has(task.id));

    // Create a simple HTML table for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #667eea; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: left; font-size: 12px; }
          td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
          tr:nth-child(even) { background-color: #f8f9fa; }
          .header-info { text-align: center; color: #6b7280; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Strategy Department - Tasks Report</h1>
        <div class="header-info">
          <p>Month: ${selectedMonth} | Generated: ${new Date().toLocaleString()}</p>
          <p>Total Tasks: ${tasksToDownload.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Task Name</th>
              <th>Description</th>
              <th>Department</th>
              <th>Post Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tasksToDownload.map(task => `
              <tr>
                <td>${task.clientId || 'N/A'}</td>
                <td>${task.clientName || 'N/A'}</td>
                <td>${task.taskName || 'N/A'}</td>
                <td>${task.description || 'N/A'}</td>
                <td>${task.department || 'N/A'}</td>
                <td>${task.postDate || 'N/A'}</td>
                <td>${task.status || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Create a blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Strategy_Tasks_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Downloaded ${tasksToDownload.length} task(s) to PDF/HTML`, 'success', 3000);

    // Clear selection after download
    setSelectedTasks(new Set());
    setShowDownloadDropdown(false);
  };

  // Download client-specific tasks to Excel
  const handleDownloadClientExcel = (clientName, clientTasks) => {
    if (!clientTasks || clientTasks.length === 0) {
      showToast('âš ï¸ No tasks available to download', 'warning', 3000);
      return;
    }

    // Create header rows with metadata (matching PDF format)
    const headerData = [
      [`Tasks for ${clientName}`],
      [],
      [`Employee: ${employeeInfo?.name || 'Employee'}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Total Tasks: ${clientTasks.length}`],
      [],
      ['Ideas', 'Content', 'Reference Link', 'Special Notes', 'Department', 'Date', 'Complete Date', 'Stage']
    ];

    // Prepare task data rows
    const taskData = clientTasks.map(task => [
      task.taskName || 'N/A',
      task.description || 'N/A',
      task.referenceLink || 'N/A',
      task.specialNotes || 'N/A',
      task.department || 'N/A',
      task.postDate || 'N/A',
      task.completedAt || 'N/A',
      task.status || 'N/A'
    ]);

    // Combine header and task data
    const allData = [...headerData, ...taskData];

    // Create worksheet from array
    const worksheet = XLSX.utils.aoa_to_sheet(allData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // Ideas
      { wch: 40 }, // Content
      { wch: 35 }, // Reference Link
      { wch: 30 }, // Special Notes
      { wch: 15 }, // Department
      { wch: 12 }, // Date
      { wch: 15 }, // Complete Date
      { wch: 20 }  // Stage
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

    // Generate filename
    const safeClientName = clientName.replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeClientName}_Tasks_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Download
    XLSX.writeFile(workbook, filename);

    showToast(`âœ… Downloaded ${clientTasks.length} task(s) to Excel`, 'success', 3000);
  };

  // Download client-specific tasks to PDF
  const handleDownloadClientPDF = (clientName, clientTasks) => {
    if (!clientTasks || clientTasks.length === 0) {
      showToast('âš ï¸ No tasks available to download', 'warning', 3000);
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');

    // Add title
    doc.setFontSize(18);
    doc.setTextColor(102, 126, 234);
    doc.text(`Tasks for ${clientName}`, 14, 15);

    // Add metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Employee: ${employeeInfo?.name || 'Employee'}`, 14, 22);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);
    doc.text(`Total Tasks: ${clientTasks.length}`, 14, 32);

    // Prepare table data - matching the table display
    const tableData = clientTasks.map(task => [
      task.taskName || 'N/A',
      task.description || 'N/A',
      task.referenceLink || 'N/A',
      task.specialNotes || 'N/A',
      task.department || 'N/A',
      task.postDate || 'N/A',
      task.completedAt || 'N/A',
      task.status || 'N/A'
    ]);

    // Add table
    autoTable(doc, {
      startY: 37,
      head: [['Ideas', 'Content', 'Reference Link', 'Special Notes', 'Department', 'Date', 'Complete Date', 'Stage']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 35 }, // Ideas
        1: { cellWidth: 45 }, // Content
        2: { cellWidth: 40 }, // Reference Link
        3: { cellWidth: 35 }, // Special Notes
        4: { cellWidth: 25 }, // Department
        5: { cellWidth: 25 }, // Date
        6: { cellWidth: 25 }, // Complete Date
        7: { cellWidth: 30 }  // Stage
      },
      margin: { top: 32, left: 14, right: 14 },
      styles: {
        overflow: 'linebreak',
        cellWidth: 'wrap'
      }
    });

    // Generate filename
    const safeClientName = clientName.replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeClientName}_Tasks_${new Date().toISOString().slice(0, 10)}.pdf`;

    // Save PDF
    doc.save(filename);

    showToast(`âœ… Downloaded ${clientTasks.length} task(s) to PDF`, 'success', 3000);
  };

  console.log('StrategyDashboard: Rendering component, tasks:', tasks.length, 'clients:', clients.length);

  return (
    <div className="strategy-dashboard">
      {/* Sidebar Navigation */}
      <div className="strategy-sidebar">
        <div className="strategy-sidebar-header">
          <div className="strategy-sidebar-logo">
            <div className="strategy-sidebar-logo-icon">
              <TrendingUp size={24} />
            </div>
            <div className="strategy-sidebar-logo-text">
              <h2>Strategy</h2>
              <p>Department</p>
            </div>
          </div>
        </div>

        <nav className="strategy-sidebar-nav">
          <div className="strategy-sidebar-section">
            {/* <h3 className="strategy-sidebar-section-title">Main</h3> */}
            <ul className="strategy-sidebar-menu">
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    console.log('Dashboard clicked');
                    setCurrentView('dashboard');
                    setShowCalendar(false);
                  }}
                  className={`strategy-sidebar-menu-link ${currentView === 'dashboard' && !showCalendar ? 'active' : ''}`}
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
                  <div className="strategy-sidebar-menu-icon">
                    <LayoutDashboard size={20} />
                  </div>
                  Dashboard
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    console.log('My Task clicked');
                    setCurrentView('myTask');
                    setShowCalendar(false);
                  }}
                  className={`strategy-sidebar-menu-link ${currentView === 'myTask' ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit',
                    pointerEvents: 'auto'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <TrendingUp size={20} />
                  </div>
                  My Task
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    console.log('Calendar button clicked, current state:', showCalendar);
                    if (!showCalendar) {
                      // If calendar is not showing, show it
                      setCurrentView('dashboard');
                      setShowCalendar(true);
                    } else {
                      // If calendar is showing, hide it
                      setShowCalendar(false);
                    }
                  }}
                  className={`strategy-sidebar-menu-link ${showCalendar ? 'active' : ''}`}
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

                  <div className="strategy-sidebar-menu-icon">
                    <Calendar size={20} />
                  </div>
                  Show Calendar
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    console.log('Report button clicked');
                    setCurrentView('report');
                  }}
                  className={`strategy-sidebar-menu-link ${currentView === 'report' ? 'active' : ''}`}
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
                  <div className="strategy-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  Report
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="strategy-sidebar-user">
          <div className="strategy-sidebar-user-info">
            <div className="strategy-sidebar-user-avatar">
              {employeeInfo?.name ? employeeInfo.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="strategy-sidebar-user-details">
              <h4>{employeeInfo?.name || 'Strategy Manager'}</h4>
              <p>{employeeInfo?.email || 'strategy@gmail.com'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="strategy-btn strategy-btn-logout" style={{ marginTop: '12px', width: '100%' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="strategy-main-content">
        <div className="strategy-header">
          <div className="strategy-header-content">
            <div className="strategy-header-left">
              <div className="strategy-header-title">
                <h1>Strategy Dashboard</h1>
                <p>Manage tasks and approve content</p>
              </div>
            </div>
            <div className="strategy-header-right">
              <div className="strategy-filter-group">
                <label>Month Filter:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="strategy-filter-input"
                />
              </div>

              {/* Notification Bell */}
              <div style={{ position: 'relative', marginLeft: '20px' }}>
                <button
                  onClick={toggleNotifications}
                  style={{
                    position: 'relative',
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: showNotifications ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = showNotifications ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)';
                  }}
                >
                  <Bell size={20} color={unreadCount > 0 ? '#667eea' : '#6b7280'} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)'
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div style={{
                    position: 'absolute',
                    top: '60px',
                    right: '0',
                    width: '400px',
                    maxHeight: '500px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb'
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '16px',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Notifications List */}
                    <div style={{
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      {notifications.length === 0 ? (
                        <div style={{
                          padding: '40px 20px',
                          textAlign: 'center',
                          color: '#9ca3af'
                        }}>
                          <Bell size={40} color="#d1d5db" style={{ marginBottom: '10px' }} />
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => markNotificationAsRead(notification.id)}
                            style={{
                              padding: '16px',
                              borderBottom: '1px solid #f3f4f6',
                              cursor: 'pointer',
                              background: notification.read ? 'white' : '#f0f9ff',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = notification.read ? '#f9fafb' : '#e0f2fe';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = notification.read ? 'white' : '#f0f9ff';
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '8px'
                            }}>
                              <h4 style={{
                                margin: 0,
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1f2937'
                              }}>
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <span style={{
                                  width: '8px',
                                  height: '8px',
                                  background: '#3b82f6',
                                  borderRadius: '50%',
                                  marginLeft: '8px',
                                  flexShrink: 0
                                }} />
                              )}
                            </div>
                            <p style={{
                              margin: '0 0 8px 0',
                              fontSize: '13px',
                              color: '#6b7280',
                              lineHeight: '1.5'
                            }}>
                              {notification.message}
                            </p>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '11px',
                              color: '#9ca3af'
                            }}>
                              <span>
                                {new Date(notification.createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {notification.priority === 'high' && (
                                <span style={{
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '600'
                                }}>
                                  HIGH
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Conditional rendering based on currentView */}
        {currentView === 'dashboard' ? (
          <>
            {/* Stats Cards - Show always on dashboard, hide when calendar is shown */}
            {!showCalendar && (
              <div className="strategy-stats-container">
                <div className="strategy-stats-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '24px'
                }}>
                  {/* Total Tasks */}
                  <div
                    onClick={() => handleStatsCardClick('all')}
                    style={{
                      background: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
                      borderRadius: '16px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: statsFilter === 'all' ? '0 8px 24px rgba(255, 94, 98, 0.4)' : '0 4px 15px rgba(255, 94, 98, 0.3)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      border: statsFilter === 'all' ? '3px solid white' : 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
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
                      <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{allMonthTasks.length}</h3>
                      <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Total Tasks</p>
                      <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Tasks for selected month</p>
                    </div>
                  </div>

                  {/* Approved */}
                  <div
                    onClick={() => handleStatsCardClick('approved')}
                    style={{
                      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                      borderRadius: '16px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: statsFilter === 'approved' ? '0 8px 24px rgba(56, 239, 125, 0.4)' : '0 4px 15px rgba(56, 239, 125, 0.3)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      border: statsFilter === 'approved' ? '3px solid white' : 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
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
                      <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{allMonthTasks.filter(t => t.status === 'approved').length}</h3>
                      <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Approved</p>
                      <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Ready for production</p>
                    </div>
                  </div>

                  {/* Pending */}
                  <div
                    onClick={() => handleStatsCardClick('pending')}
                    style={{
                      background: 'linear-gradient(135deg, #EA384D 0%, #D31027 100%)',
                      borderRadius: '16px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: statsFilter === 'pending' ? '0 8px 24px rgba(211, 16, 39, 0.4)' : '0 4px 15px rgba(211, 16, 39, 0.3)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      border: statsFilter === 'pending' ? '3px solid white' : 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
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
                      <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{allMonthTasks.filter(t => t.status === 'pending' || t.status === 'pending-production').length}</h3>
                      <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Pending</p>
                      <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Awaiting approval</p>
                    </div>
                  </div>

                  {/* Clients */}
                  <div
                    onClick={() => {
                      setShowClientTasks(true);
                      if (clientTasksRef.current) {
                        clientTasksRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                      borderRadius: '16px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: '0 4px 15px rgba(74, 0, 224, 0.3)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
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
                      <Users size={30} color="white" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{clients.length}</h3>
                      <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Clients</p>
                      <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Active clients</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Report and Weekly Summary Cards */}
            {!showCalendar && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px',
                marginBottom: '32px',
                padding: '0 20px'
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
                      📋 Strategy
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
                          return allMonthTasks.filter(task => {
                            const isCompletedToday = task.completedAt && task.completedAt.startsWith(today);
                            const isCompleted = task.status === 'completed' || task.status === 'approved' || task.status === 'posted';
                            return isCompletedToday && isCompleted;
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
                          return allMonthTasks.filter(task => {
                            if (!task.deadline) return false;
                            const today = new Date();
                            const taskDeadline = new Date(task.deadline);
                            return today > taskDeadline && task.status !== 'completed' && task.status !== 'approved' && task.status !== 'posted';
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
                        showToast(`📋 ${todayTasks.length} task(s) scheduled for today`, 'info', 3000);
                      } else {
                        showToast('No tasks scheduled for today!', 'info', 3000);
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
                            if (!task.postDate && !task.deadline) return false;
                            const taskDate = new Date(task.postDate || task.deadline);
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
                            const isCompleted = task.status === 'completed' || task.status === 'approved' || task.status === 'posted';
                            if (!isCompleted || !task.completedAt) return false;
                            const completedDate = new Date(task.completedAt);
                            return completedDate >= weekStart && completedDate <= weekEnd;
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
                        {allMonthTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>In Progress</div>
                    </div>

                    {/* My Efficiency */}
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
                            if (!task.postDate && !task.deadline) return false;
                            const taskDate = new Date(task.postDate || task.deadline);
                            return taskDate >= weekStart && taskDate <= weekEnd;
                          });

                          const completedWeekTasks = weekTasks.filter(t =>
                            t.status === 'completed' || t.status === 'approved' || t.status === 'posted'
                          );

                          return weekTasks.length > 0 ? Math.round((completedWeekTasks.length / weekTasks.length) * 100) : 0;
                        })()}%
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>My Efficiency</div>
                    </div>
                  </div>

                  {/* Quick Action */}
                  <button
                    onClick={() => {
                      showToast('📊 Weekly report generated', 'success', 3000);
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

            {/* Task Assignment Form */}
            {showTaskAssignForm && (
              <div ref={taskFormRef} className="strategy-form-container">
                <div className="strategy-modal-header">
                  <h3> Strategy Department - Assign New Task</h3>
                </div>
                <div className="strategy-modal-body">
                  {(() => {
                    // Always use clients from strategyClients (assigned to this employee)
                    // Don't derive from tasks - we want to show all assigned clients regardless of whether they have tasks in the selected month
                    const displayClients = clients;

                    return (
                      <form onSubmit={handleAssignTask} className="strategy-form">
                        <div className="strategy-form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={newTaskAssignment.useManualEntry}
                              onChange={(e) => setNewTaskAssignment({
                                ...newTaskAssignment,
                                useManualEntry: e.target.checked,
                                clientId: '',
                                clientName: ''
                              })}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: '500' }}>Enter client name manually</span>
                          </label>
                        </div>

                        {!newTaskAssignment.useManualEntry ? (
                          <>
                            <div className="strategy-form-group">
                              <label style={{ textAlign: 'left', display: 'block' }}>Select Client *</label>
                              <select
                                className="strategy-form-input"
                                value={newTaskAssignment.clientName}
                                onChange={(e) => {
                                  const selectedClient = displayClients.find(c => c.clientName === e.target.value);
                                  setNewTaskAssignment({
                                    ...newTaskAssignment,
                                    clientName: e.target.value,
                                    clientId: selectedClient ? selectedClient.clientId : ''
                                  });
                                }}
                                required
                              >
                                <option value="">-- Select Client --</option>
                                {displayClients.map(client => (
                                  <option key={client.id} value={client.clientName}>
                                    {client.clientName} ({client.clientId})
                                  </option>
                                ))}
                              </select>
                              {displayClients.length === 0 && (
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                                  No clients available. Ask Production Incharge to add clients.
                                </p>
                              )}
                            </div>

                            <div className="strategy-form-group">
                              <label style={{ textAlign: 'left', display: 'block' }}>Client ID</label>
                              <input
                                type="text"
                                className="strategy-form-input"
                                value={newTaskAssignment.clientId}
                                readOnly
                                placeholder="Auto-filled when client is selected"
                                style={{
                                  backgroundColor: '#f5f5f5',
                                  cursor: 'not-allowed'
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="strategy-form-group">
                            <label style={{ textAlign: 'left', display: 'block' }}>Client Name *</label>
                            <input
                              type="text"
                              className="strategy-form-input"
                              value={newTaskAssignment.clientName}
                              onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, clientName: e.target.value })}
                              placeholder="Enter client name manually"
                              required
                            />
                          </div>
                        )}

                        <div className="strategy-form-group">
                          <label style={{ textAlign: 'left', display: 'block' }}>Ideas *</label>
                          <input
                            type="text"
                            className="strategy-form-input"
                            value={newTaskAssignment.taskName}
                            onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, taskName: e.target.value })}
                            placeholder="Enter ideas"
                            required
                          />
                        </div>

                        <div className="strategy-form-group">
                          <label style={{ textAlign: 'left', display: 'block' }}>Content</label>
                          <textarea
                            className="strategy-form-input"
                            value={newTaskAssignment.description}
                            onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, description: e.target.value })}
                            placeholder="Enter content"
                            rows="3"
                          />
                        </div>

                        <div className="strategy-form-group">
                          <label style={{ textAlign: 'left', display: 'block' }}>Reference Link</label>
                          <input
                            type="url"
                            className="strategy-form-input"
                            value={newTaskAssignment.referenceLink}
                            onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, referenceLink: e.target.value })}
                            placeholder="Enter reference link (e.g., https://example.com)"
                          />
                        </div>

                        <div className="strategy-form-group">
                          <label style={{ textAlign: 'left', display: 'block' }}>Special Notes</label>
                          <textarea
                            className="strategy-form-input"
                            value={newTaskAssignment.specialNotes}
                            onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, specialNotes: e.target.value })}
                            placeholder="Enter special notes or additional instructions"
                            rows="3"
                          />
                        </div>

                        <div className="strategy-form-group">
                          <label style={{ textAlign: 'left', display: 'block' }}>Assign to Department *</label>
                          <select
                            className="strategy-form-input"
                            value={newTaskAssignment.department}
                            onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, department: e.target.value })}
                            required
                          >
                            <option value="">-- Select department --</option>
                            <option value="video">ï¿½ Video Department</option>
                            <option value="graphics">Graphics Department</option>
                          </select>
                        </div>

                        <div className="strategy-form-group">
                          <label style={{ textAlign: 'left', display: 'block' }}>Post Date *</label>
                          <input
                            type="date"
                            className="strategy-form-input"
                            value={newTaskAssignment.postDate}
                            onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, postDate: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-actions" style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '16px',
                          marginTop: '24px',
                          paddingTop: '16px',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          <button type="button" onClick={() => setShowTaskAssignForm(false)} className="strategy-btn strategy-btn-calendar" style={{
                            padding: '12px 24px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            Cancel
                          </button>
                          <button type="submit" className="strategy-btn strategy-btn-assign" style={{
                            padding: '12px 24px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <Plus size={16} /> Assign Task
                          </button>
                        </div>
                      </form>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Uploaded Excel Data Table - REMOVED */}
            {false && showUploadedData && uploadedData.length > 0 && (
              <div ref={uploadedDataRef} className="strategy-card">
                <div className="strategy-modal-header">
                  <h3>Uploaded Excel Data ({uploadedData.length} rows)</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleAssignTasksFromExcel}
                      className="strategy-btn strategy-btn-assign"
                    >
                      Assign Tasks
                    </button>
                    <button
                      onClick={() => setShowUploadedData(false)}
                      className="strategy-btn strategy-btn-calendar"
                    >
                      Hide Data
                    </button>
                  </div>
                </div>
                <div className="strategy-table-container">
                  <table className="strategy-clients-table" style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{
                          padding: '16px 12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          width: '10%'
                        }}>Client ID</th>
                        <th style={{
                          padding: '16px 12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          width: '25%'
                        }}>Name</th>
                        <th style={{
                          padding: '16px 12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          width: '20%'
                        }}>Department</th>
                        <th style={{
                          padding: '16px 12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          width: '25%'
                        }}>Task Details</th>
                        <th style={{
                          padding: '16px 12px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          width: '20%'
                        }}>Schedule Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedData.map((row, index) => (
                        <tr key={index} style={{
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background-color 0.2s'
                        }}
                          onMouseOver={(e) => e.target.parentElement.style.backgroundColor = '#f9fafb'}
                          onMouseOut={(e) => e.target.parentElement.style.backgroundColor = 'transparent'}
                        >
                          <td style={{
                            padding: '16px 12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#374151',
                            fontWeight: '500'
                          }}>{row.client_id}</td>
                          <td style={{
                            padding: '16px 12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#374151'
                          }}>{row.name}</td>
                          <td style={{
                            padding: '16px 12px',
                            textAlign: 'center',
                            fontSize: '14px'
                          }}>
                            <span className={`dept-badge ${row.type?.toLowerCase()}`} style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: row.type === 'Video' ? '#dbeafe' : '#fef3c7',
                              color: row.type === 'Video' ? '#1e40af' : '#92400e'
                            }}>
                              {row.type === 'Video' ? 'Video' : row.type === 'Graphics' ? 'Graphics' : row.type}
                            </span>
                          </td>
                          <td style={{
                            padding: '16px 12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#374151',
                            fontWeight: '600'
                          }}><strong>{row.taskDetails}</strong></td>
                          <td style={{
                            padding: '16px 12px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#374151'
                          }}>{formatDateForDisplay(row.postDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Compact Calendar View */}
            {showCalendar && (
              <>
                {/* Stats Cards - Show when calendar is visible */}
                <div className="strategy-stats-container">
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '24px',
                    marginBottom: '32px'
                  }}>
                    {/* Total Tasks */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
                        borderRadius: '16px',
                        padding: '24px',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(255, 94, 98, 0.3)',
                        cursor: 'default',
                        transition: 'transform 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
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
                        <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{allMonthTasks.length}</h3>
                        <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Total Tasks</p>
                        <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Tasks for selected month</p>
                      </div>
                    </div>

                    {/* Approved (Completed) */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                        borderRadius: '16px',
                        padding: '24px',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(56, 239, 125, 0.3)',
                        cursor: 'default',
                        transition: 'transform 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
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
                        <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{allMonthTasks.filter(t => t.status === 'approved').length}</h3>
                        <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Approved</p>
                        <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Ready for production</p>
                      </div>
                    </div>

                    {/* Pending */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #EA384D 0%, #D31027 100%)',
                        borderRadius: '16px',
                        padding: '24px',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(211, 16, 39, 0.3)',
                        cursor: 'default',
                        transition: 'transform 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
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
                        <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{allMonthTasks.filter(t => t.status === 'pending' || t.status === 'pending-production').length}</h3>
                        <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Pending</p>
                        <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Awaiting approval</p>
                      </div>
                    </div>

                    {/* Active Clients */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                        borderRadius: '16px',
                        padding: '24px',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(74, 0, 224, 0.3)',
                        cursor: 'default',
                        transition: 'transform 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
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
                        <Users size={30} color="white" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{clients.length}</h3>
                        <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Clients</p>
                        <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Active clients</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div ref={calendarRef} style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #d2d6de',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #f1f5f9',
                    padding: '20px 24px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Calendar size={24} />
                      <h2 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        margin: 0
                      }}>📅 Strategy Task Calendar</h2>
                    </div>
                    <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>Tasks shown on their deadline dates</p>
                  </div>

                  <div className="calendar-container" style={{ padding: '15px' }}>
                    <div className="calendar-navigation" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '15px',
                      padding: '10px 15px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '10px',
                      color: 'white',
                      maxWidth: '650px',
                      marginLeft: 'auto',
                      marginRight: 'auto'
                    }}>
                      <button
                        onClick={() => {
                          const date = new Date(selectedMonth + '-01');
                          date.setMonth(date.getMonth() - 1);
                          setSelectedMonth(date.toISOString().slice(0, 7));
                        }}
                        className="nav-btn"
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          border: 'none',
                          color: 'white',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.35)';
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                          e.target.style.transform = 'scale(1)';
                        }}
                      >
                        ‹
                      </button>
                      <h3 className="current-month" style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center',
                        letterSpacing: '0.3px'
                      }}>
                        {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button
                        onClick={() => {
                          const date = new Date(selectedMonth + '-01');
                          date.setMonth(date.getMonth() + 1);
                          setSelectedMonth(date.toISOString().slice(0, 7));
                        }}
                        className="nav-btn"
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          border: 'none',
                          color: 'white',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.35)';
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                          e.target.style.transform = 'scale(1)';
                        }}
                      >
                        ›
                      </button>
                    </div>

                    {/* Client Filter */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '15px'
                    }}>
                      <label style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151',
                        whiteSpace: 'nowrap'
                      }}>
                        Filter by Client:
                      </label>
                      <select
                        value={selectedCalendarClient}
                        onChange={(e) => setSelectedCalendarClient(e.target.value)}
                        style={{
                          padding: '8px 16px',
                          border: '2px solid #667eea',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151',
                          outline: 'none',
                          cursor: 'pointer',
                          minWidth: '200px',
                          backgroundColor: 'white',
                          transition: 'all 0.2s'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#4338ca';
                          e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#667eea';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <option value="all">All Clients</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.clientId}>
                            {client.clientName}
                          </option>
                        ))}
                      </select>
                      {selectedCalendarClient !== 'all' && (
                        <button
                          onClick={() => setSelectedCalendarClient('all')}
                          style={{
                            padding: '8px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#ef4444';
                          }}
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>

                    <div className="calendar-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: '6px',
                      maxWidth: '650px',
                      margin: '0 auto'
                    }}>
                      {/* Calendar Days Header */}
                      {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                        <div key={day} className="calendar-day-name" style={{
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#667eea',
                          padding: '6px 4px',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          background: '#f8f9fa',
                          borderRadius: '6px'
                        }}>
                          {day}
                        </div>
                      ))}

                      {/* Calendar Days */}
                      {(() => {
                        const year = parseInt(selectedMonth.split('-')[0]);
                        const month = parseInt(selectedMonth.split('-')[1]) - 1;
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        const startDate = new Date(firstDay);
                        startDate.setDate(startDate.getDate() - firstDay.getDay());

                        const days = [];
                        for (let i = 0; i < 42; i++) {
                          const currentDate = new Date(startDate);
                          currentDate.setDate(startDate.getDate() + i);

                          const isCurrentMonth = currentDate.getMonth() === month;
                          const isToday = currentDate.toDateString() === new Date().toDateString();
                          const dateString = formatDateSafe(currentDate);

                          // Skip rendering dates from other months
                          if (!isCurrentMonth) {
                            days.push(
                              <div
                                key={i}
                                className="calendar-day empty"
                                style={{
                                  aspectRatio: '1',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'default',
                                  minHeight: '45px',
                                  maxHeight: '55px'
                                }}
                              />
                            );
                            continue;
                          }

                          const dayTasks = filteredTasks.filter(task => {
                            // Show all tasks only on their scheduled post date (not on deadline)
                            const matchesDate = (task.postDate === dateString);

                            // Apply client filter
                            const matchesClient = selectedCalendarClient === 'all' ||
                              task.clientId === selectedCalendarClient ||
                              task.clientName === clients.find(c => c.clientId === selectedCalendarClient)?.clientName;

                            return matchesDate && matchesClient;
                          });

                          days.push(
                            <div
                              key={i}
                              className={`calendar-day ${!isCurrentMonth ? 'empty' : ''} ${isToday ? 'today' : ''} ${dayTasks.length > 0 ? 'has-tasks' : ''}`}
                              onClick={() => dayTasks.length > 0 && handleDateClick(dateString, dayTasks)}
                              style={{
                                aspectRatio: '1',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: !isCurrentMonth ? 'transparent' : 'white',
                                borderRadius: '8px',
                                cursor: dayTasks.length > 0 ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                position: 'relative',
                                padding: '4px',
                                border: dayTasks.length > 0 ? '1.5px solid #ffc107' : '1.5px solid #e9ecef',
                                minHeight: '45px',
                                maxHeight: '55px',
                                ...(isToday && {
                                  borderColor: '#667eea',
                                  borderWidth: '2px',
                                  background: 'linear-gradient(135deg, #667eea10 0%, #764ba210 100%)',
                                  boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)'
                                }),
                                ...(dayTasks.length > 0 && !isToday && {
                                  background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
                                  borderColor: '#ffc107'
                                })
                              }}
                              title={dayTasks.length > 0 ? `${dayTasks.length} task(s) on this date` : ''}
                              onMouseEnter={(e) => {
                                if (isCurrentMonth && dayTasks.length > 0) {
                                  e.currentTarget.style.background = '#f8f9fa';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.08)';
                                  e.currentTarget.style.borderColor = '#667eea';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (isCurrentMonth) {
                                  if (isToday) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #667eea10 0%, #764ba210 100%)';
                                    e.currentTarget.style.borderColor = '#667eea';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(102, 126, 234, 0.1)';
                                  } else if (dayTasks.length > 0) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)';
                                    e.currentTarget.style.borderColor = '#ffc107';
                                    e.currentTarget.style.boxShadow = 'none';
                                  } else {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#e9ecef';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }
                              }}
                            >
                              <span className="day-number" style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: !isCurrentMonth ? '#d1d5db' : '#2c3e50',
                                marginBottom: '2px'
                              }}>
                                {currentDate.getDate()}
                              </span>
                              {dayTasks.length > 0 && (
                                <div className="task-indicator" style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: '#f39c12',
                                  borderRadius: '8px',
                                  padding: '2px 4px',
                                  marginTop: '2px'
                                }}>
                                  <span className="task-count" style={{
                                    fontSize: '9px',
                                    fontWeight: '600',
                                    color: 'white'
                                  }}>
                                    {dayTasks.length}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return days;
                      })()}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Client Tasks Section - Hide in dashboard view, only show in My Task view */}
            {false && !showCalendar && (
              <div ref={clientTasksRef} className="strategy-client-section" style={{
                overflow: 'visible',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}>
                {/* Search Bar and Download Excel Button */}
                {allMonthTasks.length > 0 && (
                  <div style={{
                    padding: '16px 20px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ fontSize: '14px', color: '#64748b', minWidth: '150px' }}>
                      {selectedTasks.size > 0 ? (
                        <span style={{ fontWeight: '600', color: '#4B49AC' }}>
                          {selectedTasks.size} task(s) selected
                        </span>
                      ) : (
                        <span>Select tasks to download</span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: '1',
                      justifyContent: 'flex-end'
                    }}>
                      {/* Search Bar */}
                      <div style={{ position: 'relative', minWidth: '250px', maxWidth: '350px', flex: '1' }}>
                        <Search size={16} style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                          pointerEvents: 'none'
                        }} />
                        <input
                          type="text"
                          placeholder="Search tasks, clients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 36px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#4B49AC';
                            e.target.style.boxShadow = '0 0 0 3px rgba(75,73,172,0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e2e8f0';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      {/* Bulk Approve Button */}
                      {/* <button
                    onClick={handleBulkApprove}
                    disabled={selectedTasks.size === 0}
                    style={{
                      padding: '10px 20px',
                      background: selectedTasks.size > 0
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : '#e5e7eb',
                      color: selectedTasks.size > 0 ? 'white' : '#9ca3af',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: selectedTasks.size > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTasks.size > 0) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    Approve Selected
                  </button> */}

                      {/* Download Dropdown Button */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                          disabled={selectedTasks.size === 0}
                          style={{
                            padding: '10px 20px',
                            background: selectedTasks.size > 0
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : '#e5e7eb',
                            color: selectedTasks.size > 0 ? 'white' : '#9ca3af',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: selectedTasks.size > 0 ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedTasks.size > 0) {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          Download
                          <span style={{ marginLeft: '4px' }}></span>
                        </button>

                        {/* Dropdown Menu */}
                        {showDownloadDropdown && selectedTasks.size > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '180px',
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb'
                          }}>
                            <button
                              onClick={() => {
                                handleDownloadExcel();
                                setShowDownloadDropdown(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'white',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = '#f3f4f6';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'white';
                              }}
                            >
                              Download Excel
                            </button>
                            <button
                              onClick={() => {
                                handleDownloadPDF();
                                setShowDownloadDropdown(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'white',
                                border: 'none',
                                borderTop: '1px solid #e5e7eb',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = '#f3f4f6';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'white';
                              }}
                            >
                              Download PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ padding: '20px' }}>
                  {(() => {
                    // Always use clients from strategyClients (assigned to this employee)
                    // Don't derive from tasks - we want to show all assigned clients regardless of whether they have tasks in the selected month
                    const displayClients = clients;

                    return displayClients.length === 0 ? (
                      <div className="strategy-empty-state">
                        <h3>No clients found</h3>
                        <p>No clients available. Add clients from Production Incharge.</p>
                      </div>
                    ) : (
                      <div className="strategy-table-container" style={{ overflow: 'visible' }}>
                        <table className="strategy-clients-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', overflow: 'visible' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '6%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>SELECT</th>
                              <th style={{ width: '12%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>CLIENT ID</th>
                              <th style={{ width: '40%', textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>NAME</th>
                              <th style={{ width: '20%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>TASKS</th>
                              <th style={{ width: '22%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>DATE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayClients.map((client) => {
                              // Use allMonthTasks to show only tasks for selected month
                              const clientTasks = allMonthTasks.filter(t => t.clientId === client.clientId || t.clientName === client.clientName);
                              const latestTask = clientTasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

                              // Count tasks by stage
                              const stageCount = {
                                'information-gathering': clientTasks.filter(t => t.status === 'information-gathering').length,
                                'strategy-preparation': clientTasks.filter(t => t.status === 'strategy-preparation').length,
                                'internal-approval': clientTasks.filter(t => t.status === 'internal-approval').length,
                                'client-approval': clientTasks.filter(t => t.status === 'client-approval').length
                              };

                              return (
                                <tr
                                  key={client.id}
                                  className="strategy-client-row"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => openClientTasksModal(client.clientName, clientTasks, client)}
                                >
                                  <td
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={clientTasks.length > 0 && clientTasks.every(task => selectedTasks.has(`${client.clientName}-${task.id}`))}
                                      onChange={() => clientTasks.length > 0 && handleSelectAllClientTasks(client.clientName, clientTasks)}
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                      }}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{
                                      color: '#6366f1',
                                      fontWeight: 'bold',
                                      fontSize: '14px'
                                    }}>
                                      {client.clientId}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <div className="client-name-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <div className="client-avatar">
                                        {client.clientName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="strategy-client-name">
                                        <span>{client.clientName}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontWeight: '600', color: '#374151' }}>{clientTasks.length}</span>
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                                      {latestTask
                                        ? formatDate(latestTask.postDate || latestTask.deadline)
                                        : client.sentAt
                                          ? formatDate(client.sentAt)
                                          : client.createdAt
                                            ? formatDate(client.createdAt)
                                            : formatDate(new Date().toISOString())
                                      }
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="client-card-mobile">
                          {displayClients.map((client) => {
                            // Use allMonthTasks to show only tasks for selected month
                            const clientTasks = allMonthTasks.filter(t => t.clientId === client.clientId || t.clientName === client.clientName);
                            const latestTask = clientTasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

                            // Count tasks by stage
                            const stageCount = {
                              'information-gathering': clientTasks.filter(t => t.status === 'information-gathering').length,
                              'strategy-preparation': clientTasks.filter(t => t.status === 'strategy-preparation').length,
                              'internal-approval': clientTasks.filter(t => t.status === 'internal-approval').length,
                              'client-approval': clientTasks.filter(t => t.status === 'client-approval').length
                            };

                            return (
                              <div key={client.id} className="client-card">
                                {/* Card Header */}
                                <div className="client-card-header">
                                  <div className="client-card-info">
                                    <div className="client-avatar">
                                      {client.clientName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="client-card-name-section">
                                      <h3 className="client-card-name">{client.clientName}</h3>
                                      <div className="client-card-id">ID: {client.clientId}</div>
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    className="client-card-checkbox"
                                    checked={clientTasks.length > 0 && clientTasks.every(task => selectedTasks.has(`${client.clientName}-${task.id}`))}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      clientTasks.length > 0 && handleSelectAllClientTasks(client.clientName, clientTasks);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>

                                {/* Card Body */}
                                <div className="client-card-body">
                                  {/* Tasks Count */}
                                  <div className="client-card-row">
                                    <span className="client-card-label">Tasks</span>
                                    <span className="client-card-value">{clientTasks.length}</span>
                                  </div>

                                  {/* Date */}
                                  <div className="client-card-row">
                                    <span className="client-card-label">Date</span>
                                    <span className="client-card-value">
                                      {latestTask ? formatDate(latestTask.postDate || latestTask.deadline) : '-'}
                                    </span>
                                  </div>

                                  {/* Stages */}
                                  <div className="client-card-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                    <span className="client-card-label">Stages</span>
                                    <div className="client-card-stages">
                                      <div className={`client-card-stage-badge ${client.stage === 'information-gathering' ? 'stage-info active' : ''}`}>
                                        {stageCount['information-gathering']}
                                      </div>
                                      <div className={`client-card-stage-badge ${client.stage === 'strategy-preparation' ? 'stage-strategy active' : ''}`}>
                                        {stageCount['strategy-preparation']}
                                      </div>
                                      <div className={`client-card-stage-badge ${client.stage === 'internal-approval' ? 'stage-internal active' : ''}`}>
                                        {stageCount['internal-approval']}
                                      </div>
                                      <div className={`client-card-stage-badge ${client.stage === 'client-approval' ? 'stage-client active' : ''}`}>
                                        {stageCount['client-approval']}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status */}
                                  <div className="client-card-row">
                                    <span className="client-card-label">Status</span>
                                    <span className={`client-card-status ${clientTasks.length > 0 ? 'active' : 'pending'}`}>
                                      {clientTasks.length > 0 ? 'ACTIVE' : 'NEW'}
                                    </span>
                                  </div>
                                </div>

                                {/* Card Footer */}
                                <div className="client-card-footer">
                                  {latestTask && (
                                    <div className="client-card-updated">
                                      Updated {formatDate(latestTask.createdAt || latestTask.postDate)}
                                    </div>
                                  )}
                                  <button
                                    className="client-card-view-btn"
                                    onClick={() => openClientTasksModal(client.clientName, clientTasks, client)}
                                  >
                                    View Tasks
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Assign Task Form Modal */}
            {showAssignForm && (
              <div className="strategy-modal" onClick={() => setShowAssignForm(false)} style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px'
              }}>
                <div
                  className="strategy-modal-content"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: '700px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div
                    className="strategy-modal-header"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      padding: '24px 32px',
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '22px',
                        fontWeight: '600',
                        letterSpacing: '-0.025em'
                      }}>
                        Assign New Task
                      </h3>
                      <p style={{
                        margin: '4px 0 0 0',
                        fontSize: '14px',
                        opacity: 0.9,
                        fontWeight: '400'
                      }}>
                        Create a new task for the selected client
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAssignForm(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(10px)'
                      }}
                      onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                      onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                      Close
                    </button>
                  </div>
                  <div style={{ padding: '32px' }}>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      // Handle form submission here
                      setShowAssignForm(false);
                      showToast('Task assigned successfully!', 'success', 3000);
                    }}>
                      {/* Client Information Section */}
                      <div style={{
                        marginBottom: '24px',
                        padding: '20px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <h4 style={{
                          margin: '0 0 16px 0',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#374151',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          Client Information
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#374151',
                              marginBottom: '8px'
                            }}>Client ID</label>
                            <input
                              type="text"
                              value={prefilledClient.id}
                              readOnly
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px',
                                background: '#f9fafb',
                                color: '#6b7280',
                                cursor: 'not-allowed'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#374151',
                              marginBottom: '8px'
                            }}>Client Name</label>
                            <input
                              type="text"
                              value={prefilledClient.name}
                              readOnly
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px',
                                background: '#f9fafb',
                                color: '#6b7280',
                                cursor: 'not-allowed'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Task Details Section */}
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '20px'
                        }}>
                          <h4 style={{
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            Task Details ({taskForms.length} task{taskForms.length > 1 ? 's' : ''})
                          </h4>
                          <button
                            type="button"
                            onClick={addTaskForm}
                            style={{
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '12px 20px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = '#2563eb'}
                            onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                          >
                            + Add More Task
                          </button>
                        </div>

                        {/* Multiple Task Forms */}
                        <div style={{ display: 'grid', gap: '32px' }}>
                          {taskForms.map((taskForm, index) => (
                            <div
                              key={taskForm.id}
                              data-task-form={taskForm.id}
                              style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '10px',
                                padding: '28px',
                                background: taskForms.length > 1 ? '#fafafa' : 'transparent',
                                position: 'relative'
                              }}
                            >
                              {/* Task Form Header */}
                              {taskForms.length > 1 && (
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '16px',
                                  paddingBottom: '12px',
                                  borderBottom: '1px solid #e5e7eb'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    Task #{index + 1}
                                  </h5>
                                  <button
                                    type="button"
                                    onClick={() => removeTaskForm(taskForm.id)}
                                    style={{
                                      background: '#ef4444',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '4px 8px',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                    title="Remove this task"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}

                              <div style={{ display: 'grid', gap: '20px' }}>
                                <div>
                                  <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    marginBottom: '8px',
                                    textAlign: 'center'
                                  }}>Ideas *</label>
                                  <input
                                    type="text"
                                    name={`taskName_${taskForm.id}`}
                                    placeholder="Enter ideas"
                                    required
                                    style={{
                                      width: '100%',
                                      padding: '12px 16px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '6px',
                                      fontSize: '14px',
                                      transition: 'border-color 0.2s',
                                      outline: 'none',
                                      textAlign: 'center'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                  />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                  <div>
                                    <label style={{
                                      display: 'block',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      color: '#374151',
                                      marginBottom: '8px',
                                      textAlign: 'center'
                                    }}>Department *</label>
                                    <select
                                      name={`department_${taskForm.id}`}
                                      required
                                      style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        textAlign: 'center'
                                      }}
                                      onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    >
                                      <option value="">Select Department</option>
                                      <option value="video">Video</option>
                                      <option value="graphics">Graphics</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label style={{
                                      display: 'block',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      color: '#374151',
                                      marginBottom: '8px',
                                      textAlign: 'center'
                                    }}>Priority</label>
                                    <select
                                      name={`priority_${taskForm.id}`}
                                      style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        textAlign: 'center'
                                      }}
                                      onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    >
                                      <option value="medium">Medium</option>
                                      <option value="high">High</option>
                                      <option value="low">Low</option>
                                    </select>
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                  <div>
                                    <label style={{
                                      display: 'block',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      color: '#374151',
                                      marginBottom: '8px',
                                      textAlign: 'center'
                                    }}>Post Date *</label>
                                    <input
                                      type="date"
                                      name={`postDate_${taskForm.id}`}
                                      required
                                      style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        textAlign: 'center'
                                      }}
                                      onChange={(e) => {
                                        // Auto-calculate deadline (2 days before post date)
                                        const postDate = new Date(e.target.value);
                                        if (!isNaN(postDate.getTime())) {
                                          const deadline = new Date(postDate);
                                          deadline.setDate(deadline.getDate() - 2);
                                          const deadlineInput = document.querySelector(`input[name="deadline_${taskForm.id}"]`);
                                          if (deadlineInput) {
                                            deadlineInput.value = formatDateSafe(deadline);
                                          }
                                        }
                                      }}
                                      onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    />
                                  </div>

                                  <div>
                                    <label style={{
                                      display: 'block',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      color: '#374151',
                                      marginBottom: '8px',
                                      textAlign: 'center'
                                    }}>Deadline *</label>
                                    <input
                                      type="date"
                                      name={`deadline_${taskForm.id}`}
                                      required
                                      readOnly
                                      style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        textAlign: 'center',
                                        backgroundColor: '#f9fafb',
                                        cursor: 'not-allowed'
                                      }}
                                      onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    marginBottom: '8px',
                                    textAlign: 'center'
                                  }}>Content</label>
                                  <textarea
                                    name={`description_${taskForm.id}`}
                                    placeholder="Enter content (optional)"
                                    rows="3"
                                    style={{
                                      width: '100%',
                                      padding: '12px 16px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '6px',
                                      fontSize: '14px',
                                      resize: 'vertical',
                                      fontFamily: 'inherit',
                                      outline: 'none',
                                      textAlign: 'left'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                  ></textarea>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Form Actions */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px',
                        paddingTop: '32px',
                        borderTop: '1px solid #e5e7eb'
                      }}>
                        {/* Add More Task Button (Left side) */}
                        <button
                          type="button"
                          onClick={() => {
                            addTaskForm();
                            // Auto-scroll to the new task form after a short delay
                            setTimeout(() => {
                              const newTaskForms = document.querySelectorAll('[data-task-form]');
                              const lastForm = newTaskForms[newTaskForms.length - 1];
                              if (lastForm) {
                                lastForm.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                  inline: 'nearest'
                                });
                              }
                            }, 100);
                          }}
                          style={{
                            padding: '16px 24px',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#3b82f6',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseOver={(e) => e.target.style.background = '#2563eb'}
                          onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                        >
                          + Add More Task
                        </button>

                        {/* Right side buttons */}
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <button
                            type="button"
                            onClick={() => setShowAssignForm(false)}
                            style={{
                              padding: '16px 32px',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              background: 'white',
                              color: '#374151',
                              fontSize: '16px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = '#f9fafb';
                              e.target.style.borderColor = '#9ca3af';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = 'white';
                              e.target.style.borderColor = '#d1d5db';
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            style={{
                              padding: '16px 32px',
                              border: 'none',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              fontSize: '16px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.transform = 'translateY(-1px)';
                              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                            }}
                          >
                            Assign {taskForms.length > 1 ? `${taskForms.length} Tasks` : 'Task'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : currentView === 'myTask' ? (
          <>
            {/* My Task View - Shows Client Tasks */}
            <div style={{ width: '100%', minHeight: '100vh', padding: '20px' }}>
              {/* My Task Header */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '20px 28px',
                marginBottom: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  margin: 0
                }}>
                  <TrendingUp size={26} />
                  My Task
                </h2>
                <p style={{ margin: '6px 0 0 36px', color: '#6b7280', fontSize: '13px' }}>
                  Work on clients assigned to you through all 4 stages
                </p>
              </div>

              {/* Client Tasks Section */}
              <div className="strategy-client-section" style={{
                overflow: 'visible',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}>
                {/* Search Bar and Download Excel Button */}
                {allMonthTasks.length > 0 && (
                  <div style={{
                    padding: '16px 20px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ fontSize: '14px', color: '#64748b', minWidth: '150px' }}>
                      {selectedTasks.size > 0 ? (
                        <span style={{ fontWeight: '600', color: '#4B49AC' }}>
                          {selectedTasks.size} task(s) selected
                        </span>
                      ) : (
                        <span>Select tasks to download</span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: '1',
                      justifyContent: 'flex-end'
                    }}>
                      {/* Search Bar */}
                      <div style={{ position: 'relative', minWidth: '250px', maxWidth: '350px', flex: '1' }}>
                        <Search size={16} style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                          pointerEvents: 'none'
                        }} />
                        <input
                          type="text"
                          placeholder="Search tasks, clients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 36px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#4B49AC';
                            e.target.style.boxShadow = '0 0 0 3px rgba(75,73,172,0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e2e8f0';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      {/* Download Dropdown Button */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                          disabled={selectedTasks.size === 0}
                          style={{
                            padding: '10px 20px',
                            background: selectedTasks.size > 0
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : '#e5e7eb',
                            color: selectedTasks.size > 0 ? 'white' : '#9ca3af',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: selectedTasks.size > 0 ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedTasks.size > 0) {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          Download
                          <span style={{ marginLeft: '4px' }}>▼</span>
                        </button>

                        {/* Dropdown Menu */}
                        {showDownloadDropdown && selectedTasks.size > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '180px',
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb'
                          }}>
                            <button
                              onClick={() => {
                                handleDownloadExcel();
                                setShowDownloadDropdown(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'white',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                              onMouseLeave={(e) => e.target.style.background = 'white'}
                            >
                              <FileSpreadsheet size={16} />
                              Download Excel
                            </button>
                            <button
                              onClick={() => {
                                handleDownloadPDF();
                                setShowDownloadDropdown(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'white',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                              onMouseLeave={(e) => e.target.style.background = 'white'}
                            >
                              <FileText size={16} />
                              Download PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Client Tasks Table - Copy from dashboard view */}
                <div style={{ padding: '20px' }}>
                  {(() => {
                    // Always use clients from strategyClients (assigned to this employee)
                    const displayClients = clients;

                    return displayClients.length === 0 ? (
                      <div className="strategy-empty-state">
                        <h3>No clients found</h3>
                        <p>No clients available. Add clients from Production Incharge.</p>
                      </div>
                    ) : (
                      <div className="strategy-table-container" style={{ overflow: 'visible' }}>
                        <table className="strategy-clients-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', overflow: 'visible' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '6%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>SELECT</th>
                              <th style={{ width: '12%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>CLIENT ID</th>
                              <th style={{ width: '40%', textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>NAME</th>
                              <th style={{ width: '20%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>TASKS</th>
                              <th style={{ width: '22%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>DATE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayClients.map((client) => {
                              // Use allMonthTasks to show only tasks for selected month
                              const clientTasks = allMonthTasks.filter(t => t.clientId === client.clientId || t.clientName === client.clientName);
                              const latestTask = clientTasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

                              return (
                                <tr
                                  key={client.id}
                                  className="strategy-client-row"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => openClientTasksModal(client.clientName, clientTasks, client)}
                                >
                                  <td
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={clientTasks.length > 0 && clientTasks.every(task => selectedTasks.has(`${client.clientName}-${task.id}`))}
                                      onChange={() => clientTasks.length > 0 && handleSelectAllClientTasks(client.clientName, clientTasks)}
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                      }}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{
                                      color: '#6366f1',
                                      fontWeight: 'bold',
                                      fontSize: '14px'
                                    }}>
                                      {client.clientId}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <div className="client-name-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <div className="client-avatar">
                                        {client.clientName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="strategy-client-name">
                                        <span>{client.clientName}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontWeight: '600', color: '#374151' }}>{clientTasks.length}</span>
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                                      {latestTask
                                        ? formatDate(latestTask.postDate || latestTask.deadline)
                                        : client.sentAt
                                          ? formatDate(client.sentAt)
                                          : client.createdAt
                                            ? formatDate(client.createdAt)
                                            : formatDate(new Date().toISOString())
                                      }
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="client-card-mobile">
                          {displayClients.map((client) => {
                            // Use allMonthTasks to show only tasks for selected month
                            const clientTasks = allMonthTasks.filter(t => t.clientId === client.clientId || t.clientName === client.clientName);
                            const latestTask = clientTasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

                            return (
                              <div key={client.id} className="client-card">
                                {/* Card Header */}
                                <div className="client-card-header">
                                  <div className="client-card-info">
                                    <div className="client-avatar">
                                      {client.clientName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="client-card-name-section">
                                      <h3 className="client-card-name">{client.clientName}</h3>
                                      <div className="client-card-id">ID: {client.clientId}</div>
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    className="client-card-checkbox"
                                    checked={clientTasks.length > 0 && clientTasks.every(task => selectedTasks.has(`${client.clientName}-${task.id}`))}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      clientTasks.length > 0 && handleSelectAllClientTasks(client.clientName, clientTasks);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>

                                {/* Card Body */}
                                <div className="client-card-body">
                                  {/* Tasks Count */}
                                  <div className="client-card-row">
                                    <span className="client-card-label">Tasks</span>
                                    <span className="client-card-value">{clientTasks.length}</span>
                                  </div>

                                  {/* Date */}
                                  <div className="client-card-row">
                                    <span className="client-card-label">Date</span>
                                    <span className="client-card-value">
                                      {latestTask ? formatDate(latestTask.postDate || latestTask.deadline) : '-'}
                                    </span>
                                  </div>

                                  {/* Status */}
                                  <div className="client-card-row">
                                    <span className="client-card-label">Status</span>
                                    <span className={`client-card-status ${clientTasks.length > 0 ? 'active' : 'pending'}`}>
                                      {clientTasks.length > 0 ? 'ACTIVE' : 'NEW'}
                                    </span>
                                  </div>
                                </div>

                                {/* Card Footer */}
                                <div className="client-card-footer">
                                  {latestTask && (
                                    <div className="client-card-updated">
                                      Updated {formatDate(latestTask.createdAt || latestTask.postDate)}
                                    </div>
                                  )}
                                  <button
                                    className="client-card-view-btn"
                                    onClick={() => openClientTasksModal(client.clientName, clientTasks, client)}
                                  >
                                    View Tasks
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </>
        ) : currentView === 'report' ? (
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
                  Strategy Employee Reports
                </h2>
                <p style={{ margin: '6px 0 0 36px', color: '#6b7280', fontSize: '13px' }}>
                  Comprehensive analytics and performance metrics
                </p>
              </div>
              <button
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
              >
                <Download size={16} />
                Download Report
              </button>
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
                  {reportFilteredTasks.length}
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
                  {reportFilteredTasks.filter(t => t.status === 'completed' || t.status === 'approved').length}
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
                  {reportFilteredTasks.filter(t => t.status === 'in-progress' || t.status === 'pending').length}
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
                    const completed = reportFilteredTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
                    return reportFilteredTasks.length > 0 ? Math.round((completed / reportFilteredTasks.length) * 100) : 0;
                  })()}%
                </div>
                <div style={{ fontSize: '13px', opacity: 0.95 }}>Completion Rate</div>
              </div>
            </div>

            {/* Search Bar and Filters */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb'
            }}>
              {/* First Row - Time Period and Search */}
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '12px',
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
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      border: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      flex: 1,
                      outline: 'none'
                    }}
                  />
                  {reportSearchQuery && (
                    <button
                      onClick={() => setReportSearchQuery('')}
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
              </div>

              {/* Second Row - Filter Dropdowns */}
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {/* All Employees Filter */}
                <select
                  value={reportEmployeeFilter}
                  onChange={(e) => setReportEmployeeFilter(e.target.value)}
                  style={{
                    padding: '11px 36px 11px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '160px',
                    flex: '1 1 auto',
                    maxWidth: '200px',
                    appearance: 'none',
                    fontWeight: '500',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239ca3af\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    backgroundSize: '18px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                >
                  <option value="all">All Employees</option>
                  {(() => {
                    const assignedEmployees = [...new Set(allMonthTasks
                      .filter(t => (t.assignedTo && t.assignedTo !== 'Not Assigned' && t.assignedTo !== '') || (t.createdBy && t.createdBy !== ''))
                      .map(t => t.assignedTo || t.createdBy))].sort();
                    return assignedEmployees.map(emp => (
                      <option key={emp} value={emp}>{emp}</option>
                    ));
                  })()}
                </select>

                {/* All Clients Filter */}
                <select
                  value={reportClientFilter}
                  onChange={(e) => setReportClientFilter(e.target.value)}
                  style={{
                    padding: '11px 36px 11px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '160px',
                    flex: '1 1 auto',
                    maxWidth: '200px',
                    appearance: 'none',
                    fontWeight: '500',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239ca3af\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    backgroundSize: '18px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                >
                  <option value="all">All Clients</option>
                  {(() => {
                    let tasksToFilter = allMonthTasks;
                    if (reportEmployeeFilter !== 'all') {
                      tasksToFilter = allMonthTasks.filter(t => t.assignedTo === reportEmployeeFilter || t.createdBy === reportEmployeeFilter);
                    }
                    const uniqueClients = [...new Set(tasksToFilter
                      .filter(t => t.clientName)
                      .map(t => t.clientName))].sort();
                    return uniqueClients.map(client => (
                      <option key={client} value={client}>{client}</option>
                    ));
                  })()}
                </select>

                {/* All Status Filter */}
                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  style={{
                    padding: '11px 36px 11px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '160px',
                    flex: '1 1 auto',
                    maxWidth: '200px',
                    appearance: 'none',
                    fontWeight: '500',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239ca3af\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    backgroundSize: '18px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="pending-production">Pending Production</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="approved">Approved</option>
                  <option value="assigned-to-department">Assigned to Department</option>
                  <option value="client-approval">Client Approval</option>
                  <option value="information-gathering">Information Gathering</option>
                </select>
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
                  const statusData = [
                    { label: 'In Progress', count: reportFilteredTasks.filter(t => t.status === 'in-progress' || t.status === 'pending').length, color: '#3b82f6', gradient: 'url(#blueGradientStrategy)' },
                    { label: 'Completed', count: reportFilteredTasks.filter(t => t.status === 'completed').length, color: '#10b981', gradient: 'url(#greenGradientStrategy)' },
                    { label: 'Approved', count: reportFilteredTasks.filter(t => t.status === 'approved').length, color: '#8b5cf6', gradient: 'url(#purpleGradientStrategy)' }
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
                          <linearGradient id="blueGradientStrategy" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="greenGradientStrategy" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#34d399', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="purpleGradientStrategy" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
                          </linearGradient>
                          <filter id="shadowStrategy">
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
                        <circle cx={centerX} cy={centerY} r="50" fill="#ffffff" stroke="#f3f4f6" strokeWidth="2" filter="url(#shadowStrategy)" />
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

                  const dailyData = last7Days.map(date => {
                    const dateStr = date.toISOString().split('T')[0];

                    const dayTasks = filteredTasks.filter(task => {
                      if (!task.postDate) return false;
                      const taskDate = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
                      return taskDate.toISOString().split('T')[0] === dateStr;
                    });

                    const completed = filteredTasks.filter(task => {
                      if (!task.completedAt && task.status !== 'completed' && task.status !== 'approved') return false;
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
                          <linearGradient id="totalGradientStrategy" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: '#667eea', stopOpacity: 0.05 }} />
                          </linearGradient>
                          <linearGradient id="completedGradientStrategy" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.4 }} />
                            <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0.05 }} />
                          </linearGradient>
                          <filter id="lineShadowStrategy">
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
                        <path d={totalAreaPath} fill="url(#totalGradientStrategy)" />
                        <path d={completedAreaPath} fill="url(#completedGradientStrategy)" />

                        {/* Lines */}
                        <path d={totalPath} stroke="#667eea" strokeWidth="3" fill="none" filter="url(#lineShadowStrategy)" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={completedPath} stroke="#10b981" strokeWidth="3" fill="none" filter="url(#lineShadowStrategy)" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Points */}
                        {totalPoints.map((point, i) => (
                          <g key={`total-${i}`}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#667eea" stroke="#ffffff" strokeWidth="2.5" filter="url(#lineShadowStrategy)" />
                          </g>
                        ))}
                        {completedPoints.map((point, i) => (
                          <g key={`completed-${i}`}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" filter="url(#lineShadowStrategy)" />
                          </g>
                        ))}

                        {/* X-axis labels */}
                        {dailyData.map((d, i) => (
                          <text
                            key={i}
                            x={padding.left + i * pointSpacing}
                            y={chartHeight - 10}
                            fontSize="10"
                            fill="#6b7280"
                            textAnchor="middle"
                            fontWeight="500"
                          >
                            {d.date.split(' ')[1]}
                          </text>
                        ))}
                      </svg>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '12px', height: '3px', background: '#667eea', borderRadius: '2px' }}></div>
                          <span style={{ color: '#6b7280', fontWeight: '500' }}>Total</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '12px', height: '3px', background: '#10b981', borderRadius: '2px' }}></div>
                          <span style={{ color: '#6b7280', fontWeight: '500' }}>Completed</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Client Statistics */}
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
                  <BarChart3 size={16} />
                  Client Statistics
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '12px',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    border: '2px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      {clients.length}
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.95, fontWeight: '500' }}>Total Clients</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '12px',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    border: '2px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      {clients.filter(c => c.assignedToEmployee).length}
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.95, fontWeight: '500' }}>Allocated Clients</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    borderRadius: '12px',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    border: '2px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      {clients.filter(c => !c.assignedToEmployee).length}
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.95, fontWeight: '500' }}>Pending Allocation</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client-wise Task Summary Table */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e5e7eb',
                background: '#fafbfc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  margin: 0,
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  Client-wise Task Summary
                  {selectedClients.length > 0 && (
                    <span style={{
                      fontSize: '13px',
                      color: '#667eea',
                      fontWeight: '600',
                      background: '#e0e7ff',
                      padding: '4px 12px',
                      borderRadius: '12px'
                    }}>
                      {selectedClients.length} client(s) selected
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      if (!showCheckboxes) {
                        // First click: Show checkboxes and select all clients
                        setShowCheckboxes(true);
                        const clientData = {};
                        const clientTasksMap = {};

                        filteredTasks.forEach(task => {
                          const clientName = task.clientName || 'Unknown';
                          if (!clientData[clientName]) {
                            clientData[clientName] = true;
                            clientTasksMap[clientName] = [];
                          }
                          clientTasksMap[clientName].push(task.id);
                        });
                        const allClientNames = Object.keys(clientData);

                        // Select all clients and all their tasks
                        setSelectedClients(allClientNames);
                        setSelectedReportTasks(clientTasksMap);
                      } else {
                        // Second click: Deselect all clients but keep checkboxes visible
                        setSelectedClients([]);
                        setSelectedReportTasks({});
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
                    Select All Clients
                  </button>
                  {showCheckboxes && (
                    <button
                      onClick={() => {
                        // Hide checkboxes and clear all selections
                        setShowCheckboxes(false);
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
                  )}
                  {selectedClients.length > 0 && (
                    <>
                      <button
                        onClick={() => {
                          const selectedClientsTasks = filteredTasks.filter(t =>
                            selectedClients.includes(t.clientName || 'Unknown')
                          );
                          downloadMultipleClientsPDF(selectedClientsTasks);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#8b5cf6',
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
                          boxShadow: '0 2px 4px rgba(139,92,246,0.2)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#7c3aed';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(139,92,246,0.3)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#8b5cf6';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(139,92,246,0.2)';
                        }}
                      >
                        📄 Download PDF
                      </button>
                      <button
                        onClick={() => {
                          const selectedClientsTasks = filteredTasks.filter(t =>
                            selectedClients.includes(t.clientName || 'Unknown')
                          );
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
              <div style={{ overflowX: 'auto', padding: '0' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  fontSize: '13px'
                }}>
                  <thead>
                    <tr style={{
                      background: '#f9fafb',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      {showCheckboxes && (
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontWeight: '700',
                          color: '#6b7280',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          borderBottom: '2px solid #e5e7eb',
                          background: '#f9fafb',
                          width: '80px',
                          verticalAlign: 'middle'
                        }}>SELECT</th>
                      )}
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        width: '120px',
                        verticalAlign: 'middle'
                      }}>Client ID</th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        verticalAlign: 'middle'
                      }}>Client Name</th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        width: '120px',
                        verticalAlign: 'middle'
                      }}>Total Tasks</th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        width: '110px',
                        verticalAlign: 'middle'
                      }}>Completed</th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        width: '100px',
                        verticalAlign: 'middle'
                      }}>Pending</th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        width: '120px',
                        verticalAlign: 'middle'
                      }}>In Progress</th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        width: '160px',
                        verticalAlign: 'middle'
                      }}>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const clientData = {};
                      filteredTasks.forEach(task => {
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

                        if (task.status === 'completed' || task.status === 'approved') {
                          clientData[clientName].completedTasks++;
                        } else if (task.status === 'pending') {
                          clientData[clientName].pendingTasks++;
                        } else if (task.status === 'in-progress') {
                          clientData[clientName].inProgressTasks++;
                        }
                      });

                      const clientArray = Object.values(clientData).sort((a, b) => b.totalTasks - a.totalTasks);

                      // Pagination logic
                      const totalPages = Math.ceil(clientArray.length / itemsPerPage);
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const paginatedClients = clientArray.slice(startIndex, endIndex);

                      return paginatedClients.length > 0 ? paginatedClients.map((client, index) => {
                        const completionRate = client.totalTasks > 0 ? Math.round((client.completedTasks / client.totalTasks) * 100) : 0;
                        const rowBg = index % 2 === 0 ? '#ffffff' : '#fafbfc';
                        const isExpanded = expandedReportClients.has(client.clientName);
                        const clientTasks = filteredTasks.filter(task => task.clientName === client.clientName);

                        return (
                          <React.Fragment key={index}>
                            <tr style={{
                              background: '#ffffff',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb'
                            }}
                              onClick={() => toggleReportClientExpansion(client.clientName)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                              }}
                            >
                              {showCheckboxes && (
                                <td style={{
                                  padding: '12px 16px',
                                  textAlign: 'center',
                                  borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                  verticalAlign: 'middle'
                                }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedClients.includes(client.clientName)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        // Select client
                                        setSelectedClients(prev => [...prev, client.clientName]);
                                        // Also select all tasks for this client
                                        const allTaskIds = clientTasks.map(t => t.id);
                                        setSelectedReportTasks(prev => ({
                                          ...prev,
                                          [client.clientName]: allTaskIds
                                        }));
                                      } else {
                                        // Deselect client
                                        setSelectedClients(prev => prev.filter(c => c !== client.clientName));
                                        // Also deselect all tasks for this client
                                        setSelectedReportTasks(prev => ({
                                          ...prev,
                                          [client.clientName]: []
                                        }));
                                      }
                                    }}
                                    style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0 }}
                                  />
                                </td>
                              )}
                              <td style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                color: '#6366f1',
                                fontWeight: '600',
                                fontSize: '13px',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}>{client.clientId}</td>
                              <td style={{
                                padding: '12px 16px',
                                fontWeight: '600',
                                color: '#1f2937',
                                fontSize: '14px',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}>
                                {client.clientName}
                              </td>
                              <td style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                fontWeight: '700',
                                color: '#1f2937',
                                fontSize: '14px',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}>{client.totalTasks}</td>
                              <td style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                color: '#10b981',
                                fontWeight: '700',
                                fontSize: '14px',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}>{client.completedTasks}</td>
                              <td style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                color: '#f59e0b',
                                fontWeight: '700',
                                fontSize: '14px',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}>{client.pendingTasks}</td>
                              <td style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                color: '#3b82f6',
                                fontWeight: '700',
                                fontSize: '14px',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}>{client.inProgressTasks}</td>
                              <td style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '12px'
                                }}>
                                  <div style={{
                                    width: '70px',
                                    height: '8px',
                                    background: '#e5e7eb',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                  }}>
                                    <div style={{
                                      width: `${completionRate}%`,
                                      height: '100%',
                                      background: completionRate >= 75
                                        ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
                                        : completionRate >= 50
                                          ? 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)'
                                          : 'linear-gradient(90deg, #f87171 0%, #ef4444 100%)',
                                      transition: 'width 0.5s ease',
                                      borderRadius: '4px'
                                    }}></div>
                                  </div>
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    minWidth: '35px',
                                    textAlign: 'right',
                                    color: completionRate >= 75 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444'
                                  }}>
                                    {completionRate}%
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Tasks Row */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="8" style={{
                                  padding: '0',
                                  background: '#f3f4f6',
                                  borderBottom: '1px solid #e5e7eb'
                                }}>
                                  <div style={{
                                    padding: '16px 20px',
                                    background: '#f9fafb'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: '12px'
                                    }}>
                                      <h4 style={{
                                        margin: 0,
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#667eea',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}>
                                        📋 Tasks for {client.clientName}
                                        <span style={{
                                          fontSize: '12px',
                                          color: '#6b7280',
                                          fontWeight: '500',
                                          marginLeft: '4px'
                                        }}>
                                          {(selectedReportTasks[client.clientName] || []).length} selected
                                        </span>
                                      </h4>
                                    </div>
                                    <table style={{
                                      width: '100%',
                                      borderCollapse: 'separate',
                                      borderSpacing: 0,
                                      background: '#ffffff',
                                      borderRadius: '6px',
                                      overflow: 'hidden',
                                      border: '1px solid #e5e7eb'
                                    }}>
                                      <thead>
                                        <tr style={{
                                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                          color: 'white'
                                        }}>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            width: '50px'
                                          }}>
                                            <input
                                              type="checkbox"
                                              checked={(selectedReportTasks[client.clientName] || []).length === clientTasks.length && clientTasks.length > 0}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                const allTaskIds = clientTasks.map(t => t.id);
                                                if (e.target.checked) {
                                                  setSelectedReportTasks(prev => ({
                                                    ...prev,
                                                    [client.clientName]: allTaskIds
                                                  }));
                                                } else {
                                                  setSelectedReportTasks(prev => ({
                                                    ...prev,
                                                    [client.clientName]: []
                                                  }));
                                                }
                                              }}
                                              style={{
                                                cursor: 'pointer',
                                                width: '16px',
                                                height: '16px'
                                              }}
                                            />
                                          </th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'left',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                          }}>Task Name</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                          }}>Department</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                          }}>Post Date</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                          }}>Deadline</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                          }}>Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {clientTasks.length > 0 ? clientTasks.map((task, taskIndex) => {
                                          const isSelected = (selectedReportTasks[client.clientName] || []).includes(task.id);

                                          return (
                                            <tr key={task.id || taskIndex} style={{
                                              background: '#ffffff',
                                              borderBottom: taskIndex === clientTasks.length - 1 ? 'none' : '1px solid #e5e7eb'
                                            }}>
                                              <td style={{
                                                padding: '10px 16px',
                                                textAlign: 'center',
                                                verticalAlign: 'middle'
                                              }}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={(e) => {
                                                    e.stopPropagation();
                                                    const currentSelected = selectedReportTasks[client.clientName] || [];
                                                    if (e.target.checked) {
                                                      setSelectedReportTasks(prev => ({
                                                        ...prev,
                                                        [client.clientName]: [...currentSelected, task.id]
                                                      }));
                                                    } else {
                                                      setSelectedReportTasks(prev => ({
                                                        ...prev,
                                                        [client.clientName]: currentSelected.filter(id => id !== task.id)
                                                      }));
                                                    }
                                                  }}
                                                  style={{
                                                    cursor: 'pointer',
                                                    width: '16px',
                                                    height: '16px'
                                                  }}
                                                />
                                              </td>
                                              <td style={{
                                                padding: '10px 16px',
                                                fontWeight: '500',
                                                color: '#1f2937',
                                                fontSize: '13px',
                                                verticalAlign: 'middle'
                                              }}>
                                                {task.taskName || 'Untitled Task'}
                                              </td>
                                              <td style={{
                                                padding: '10px 16px',
                                                textAlign: 'center',
                                                verticalAlign: 'middle'
                                              }}>
                                                <span style={{
                                                  padding: '4px 10px',
                                                  borderRadius: '12px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  background: task.department === 'video' ? '#ddd6fe' :
                                                    task.department === 'graphics' ? '#fce7f3' :
                                                      task.department === 'social-media' ? '#dbeafe' : '#f3f4f6',
                                                  color: task.department === 'video' ? '#7c3aed' :
                                                    task.department === 'graphics' ? '#ec4899' :
                                                      task.department === 'social-media' ? '#2563eb' : '#6b7280'
                                                }}>
                                                  {task.department || 'N/A'}
                                                </span>
                                              </td>
                                              <td style={{
                                                padding: '10px 16px',
                                                textAlign: 'center',
                                                color: '#6b7280',
                                                fontSize: '12px',
                                                verticalAlign: 'middle'
                                              }}>
                                                {formatDate(task.postDate)}
                                              </td>
                                              <td style={{
                                                padding: '10px 16px',
                                                textAlign: 'center',
                                                color: '#6b7280',
                                                fontSize: '12px',
                                                verticalAlign: 'middle'
                                              }}>
                                                {formatDate(task.deadline)}
                                              </td>
                                              <td style={{
                                                padding: '10px 16px',
                                                textAlign: 'center',
                                                verticalAlign: 'middle'
                                              }}>
                                                <span style={{
                                                  padding: '4px 10px',
                                                  borderRadius: '12px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  background: task.status === 'approved' ? '#dcfce7' :
                                                    task.status === 'completed' ? '#d1fae5' :
                                                      task.status === 'pending' ? '#fef3c7' :
                                                        task.status === 'in-progress' ? '#dbeafe' : '#f3f4f6',
                                                  color: task.status === 'approved' ? '#16a34a' :
                                                    task.status === 'completed' ? '#059669' :
                                                      task.status === 'pending' ? '#d97706' :
                                                        task.status === 'in-progress' ? '#2563eb' : '#6b7280'
                                                }}>
                                                  {task.status || 'pending'}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        }) : (
                                          <tr>
                                            <td colSpan="6" style={{
                                              padding: '40px 20px',
                                              textAlign: 'center',
                                              color: '#9ca3af',
                                              fontSize: '13px'
                                            }}>
                                              <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}>ðŸ“‹</div>
                                              No tasks found for this client
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }) : (
                        <tr>
                          <td colSpan={showCheckboxes ? "8" : "7"} style={{
                            padding: '60px 20px',
                            textAlign: 'center',
                            color: '#9ca3af',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>ðŸ“Š</div>
                            No client data available for the selected month
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                const clientData = {};
                filteredTasks.forEach(task => {
                  const clientName = task.clientName || 'Unknown';
                  if (!clientData[clientName]) {
                    clientData[clientName] = true;
                  }
                });
                const totalClients = Object.keys(clientData).length;
                const totalPages = Math.ceil(totalClients / itemsPerPage);

                if (totalPages <= 1) return null;

                return (
                  <div style={{
                    padding: '20px 24px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fafbfc'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalClients)} of {totalClients} clients
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        style={{
                          padding: '8px 16px',
                          background: currentPage === 1 ? '#f3f4f6' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: currentPage === 1 ? '#9ca3af' : 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          opacity: currentPage === 1 ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== 1) {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        â† Previous
                      </button>

                      <div style={{
                        display: 'flex',
                        gap: '4px'
                      }}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            style={{
                              padding: '8px 12px',
                              background: currentPage === page
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : '#ffffff',
                              color: currentPage === page ? 'white' : '#374151',
                              border: currentPage === page ? 'none' : '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              minWidth: '36px'
                            }}
                            onMouseEnter={(e) => {
                              if (currentPage !== page) {
                                e.target.style.background = '#f3f4f6';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (currentPage !== page) {
                                e.target.style.background = '#ffffff';
                              }
                            }}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '8px 16px',
                          background: currentPage === totalPages ? '#f3f4f6' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: currentPage === totalPages ? '#9ca3af' : 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          opacity: currentPage === totalPages ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== totalPages) {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        Next â†’
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        ) : null}



        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>

      {/* Tasks Only Modal */}
      {showTasksOnlyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowTasksOnlyModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '1200px',
              width: '95%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px 16px 0 0',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'white' }}>
                  Tasks for {tasksOnlyModalData.clientName}
                </h3>
                {/* Month Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="tasks-modal-month-filter" style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Month:
                  </label>
                  <input
                    id="tasks-modal-month-filter"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)'
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Add Task Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Find the client info from the tasks
                    const firstTask = tasksOnlyModalData.tasks[0];
                    if (firstTask) {
                      setNewTaskAssignment({
                        clientId: firstTask.clientId || '',
                        clientName: tasksOnlyModalData.clientName,
                        taskName: '',
                        description: '',
                        department: '',
                        taskType: '',
                        postDate: '',
                        referenceLink: '',
                        specialNotes: '',
                        useManualEntry: false
                      });
                      setShowStrategyPrepForm(true);
                      setStrategyPrepTaskId(null);
                      setReopenTasksModal(true); // Flag to reopen tasks modal after adding
                      setShowTasksOnlyModal(false); // Close this modal temporarily
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
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
                  Add Task
                </button>

                {/* Download Excel Button */}
                {tasksOnlyModalData.tasks && tasksOnlyModalData.tasks.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadClientExcel(tasksOnlyModalData.clientName, tasksOnlyModalData.tasks);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(16, 185, 129, 1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(16, 185, 129, 0.9)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    Excel
                  </button>
                )}

                {/* Download PDF Button */}
                {tasksOnlyModalData.tasks && tasksOnlyModalData.tasks.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadClientPDF(tasksOnlyModalData.clientName, tasksOnlyModalData.tasks);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(239, 68, 68, 1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(239, 68, 68, 0.9)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    PDF
                  </button>
                )}

                {/* Close Button */}
                <button
                  onClick={() => setShowTasksOnlyModal(false)}
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
                    fontSize: '20px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  }}
                >

                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {tasksOnlyModalData.tasks.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#9ca3af'
                }}>
                  <p style={{ fontSize: '16px', margin: 0 }}>No tasks found for this client</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '10%' }}>IDEAS</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '12%' }}>CONTENT</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '12%' }}>REFERENCE LINK</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '12%' }}>SPECIAL NOTES</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '9%' }}>DEPARTMENT</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '9%' }}>DATE</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '10%' }}>COMPLETE DATE</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '12%' }}>STAGE</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '14%' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksOnlyModalData.tasks
                        .filter(task => {
                          // Filter tasks by selected month
                          const postDate = task.postDate;
                          const deadline = task.deadline;
                          const isInSelectedMonth = (postDate && postDate.startsWith(selectedMonth)) ||
                            (deadline && deadline.startsWith(selectedMonth));
                          return isInSelectedMonth;
                        })
                        .map(task => {
                          // Debug: Log task data to see what fields are available
                          console.log('Task data:', {
                            id: task.id,
                            taskName: task.taskName,
                            referenceLink: task.referenceLink,
                            specialNotes: task.specialNotes,
                            description: task.description
                          });

                          const stages = {
                            'information-gathering': { name: 'Information Gathering', color: '#dbeafe', borderColor: '#1e40af', textColor: '#1e40af' },
                            'strategy-preparation': { name: 'Strategy Preparation', color: '#e0e7ff', borderColor: '#4338ca', textColor: '#4338ca' },
                            'internal-approval': { name: 'Internal Approval', color: '#fce7f3', borderColor: '#ec4899', textColor: '#ec4899' },
                            'client-approval': { name: 'Client Approval', color: '#fef3c7', borderColor: '#f59e0b', textColor: '#f59e0b' },
                            'assigned-to-department': { name: 'Assigned to Department', color: '#dcfce7', borderColor: '#16a34a', textColor: '#16a34a' },
                            'completed': { name: 'Completed', color: '#dcfce7', borderColor: '#16a34a', textColor: '#16a34a' }
                          };
                          const stageInfo = stages[task.status] || { name: task.status || 'Unknown', color: '#f3f4f6', borderColor: '#9ca3af', textColor: '#6b7280' };

                          return (
                            <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '16px' }}></span>
                                  <span style={{ fontWeight: '500', color: '#374151' }}>{task.taskName || 'Untitled Task'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.description || ''}>
                                  {task.description || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                {task.referenceLink ? (
                                  <a
                                    href={task.referenceLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: '#667eea',
                                      textDecoration: 'none',
                                      fontSize: '13px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      maxWidth: '180px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.textDecoration = 'underline';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.textDecoration = 'none';
                                    }}
                                    title={task.referenceLink}
                                  >
                                    {task.referenceLink}
                                  </a>
                                ) : (
                                  <span style={{ fontSize: '13px', color: '#9ca3af' }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.specialNotes || ''}>
                                  {task.specialNotes || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  background: task.department === 'video' ? '#dbeafe' : task.department === 'graphics' ? '#fce7f3' : '#e0e7ff',
                                  color: task.department === 'video' ? '#1e40af' : task.department === 'graphics' ? '#ec4899' : '#4338ca',
                                  textTransform: 'uppercase'
                                }}>
                                  {task.department || 'N/A'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                                {task.postDate ? new Date(task.postDate).toLocaleDateString() : '-'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                                {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '-'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  background: stageInfo.color,
                                  color: stageInfo.textColor,
                                  border: `1px solid ${stageInfo.borderColor}`,
                                  display: 'inline-block'
                                }}>
                                  {stageInfo.name}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button
                                    onClick={() => {
                                      // Pre-fill the form with task data for editing
                                      setNewTaskAssignment({
                                        clientId: task.clientId || '',
                                        clientName: task.clientName || '',
                                        taskName: task.taskName || '',
                                        description: task.description || '',
                                        department: task.department || '',
                                        taskType: task.taskType || '',
                                        postDate: task.postDate || '',
                                        referenceLink: task.referenceLink || '',
                                        specialNotes: task.specialNotes || '',
                                        useManualEntry: false
                                      });
                                      setStrategyPrepTaskId(task.id); // Set task ID for editing
                                      setReopenTasksModal(true); // Flag to reopen tasks modal after edit
                                      setShowStrategyPrepForm(true);
                                      setShowTasksOnlyModal(false); // Close the tasks modal temporarily
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.transform = 'translateY(-2px)';
                                      e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.transform = 'translateY(0)';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`Are you sure you want to delete the task "${task.taskName}"?`)) {
                                        try {
                                          const taskRef = ref(database, `tasks/${task.id}`);
                                          await update(taskRef, { deleted: true, deletedAt: new Date().toISOString() });

                                          // Update local state to remove the task
                                          setTasksOnlyModalData({
                                            ...tasksOnlyModalData,
                                            tasks: tasksOnlyModalData.tasks.filter(t => t.id !== task.id)
                                          });

                                          showToast('âœ… Task deleted successfully!', 'success', 3000);
                                        } catch (error) {
                                          console.error('Error deleting task:', error);
                                          showToast('âŒ Error deleting task', 'error', 3000);
                                        }
                                      }
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.transform = 'translateY(-2px)';
                                      e.target.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.transform = 'translateY(0)';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="strategy-modal" onClick={closeTaskModal}>
          <div className="strategy-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1600px', width: '95%', maxHeight: '90vh' }}>
            <div className="strategy-modal-header">
              <h3>
                Tasks for {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : ''}
              </h3>
              <button
                onClick={closeTaskModal}
                className="strategy-modal-close"
              >

              </button>
            </div>
            <div className="strategy-modal-body" style={{ padding: '20px' }}>
              {selectedDateTasks.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', width: '12%' }}>IDEAS</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', width: '12%' }}>CONTENT</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', width: '12%' }}>REFERENCE LINK</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', width: '12%' }}>SPECIAL NOTES</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', width: '12%' }}>DEPARTMENT</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', width: '10%' }}>DATE</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', width: '12%' }}>COMPLETE DATE</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', width: '10%' }}>STAGE</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', width: '8%' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDateTasks.map((task, index) => {
                        // Find the client to get their stage
                        const client = clients.find(c => c.clientId === task.clientId || c.clientName === task.clientName);
                        const clientStage = client?.stage || 'pending-production';

                        return (
                          <tr key={index} style={{
                            borderBottom: '1px solid #e5e7eb',
                            transition: 'background 0.2s',
                            background: 'white'
                          }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                            }}>
                            {/* IDEAS */}
                            <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px' }}></span>
                                <span style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                                  {task.taskName || 'Untitled Task'}
                                </span>
                              </div>
                            </td>
                            {/* CONTENT */}
                            <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: '13px',
                                color: '#6b7280',
                                display: 'block',
                                maxWidth: '150px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={task.description || ''}>
                                {task.description || '-'}
                              </span>
                            </td>
                            {/* REFERENCE LINK */}
                            <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                              {task.referenceLink ? (
                                <a
                                  href={task.referenceLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: '#667eea',
                                    textDecoration: 'none',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    maxWidth: '120px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.textDecoration = 'underline';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.textDecoration = 'none';
                                  }}
                                  title={task.referenceLink}
                                >
                                  Link
                                </a>
                              ) : (
                                <span style={{ fontSize: '13px', color: '#9ca3af' }}>-</span>
                              )}
                            </td>
                            {/* SPECIAL NOTES */}
                            <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: '13px',
                                color: '#6b7280',
                                display: 'block',
                                maxWidth: '150px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={task.specialNotes || ''}>
                                {task.specialNotes || '-'}
                              </span>
                            </td>
                            {/* DEPARTMENT */}
                            <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                              <span style={{
                                padding: '6px 14px',
                                borderRadius: '16px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: task.department === 'video' ? '#dbeafe' : task.department === 'graphics' ? '#fce7f3' : '#e0e7ff',
                                color: task.department === 'video' ? '#1e40af' : task.department === 'graphics' ? '#ec4899' : '#4338ca',
                                textTransform: 'uppercase',
                                display: 'inline-block'
                              }}>
                                {task.department === 'video' ? 'VIDEO' : task.department === 'graphics' ? 'GRAPHICS' : task.department?.toUpperCase() || 'N/A'}
                              </span>
                            </td>
                            {/* DATE */}
                            <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#374151', fontSize: '13px', fontWeight: '500' }}>
                                  {task.postDate ? new Date(task.postDate).toLocaleDateString('en-GB') : '-'}
                                </span>
                                {task.postDate === selectedDate && (
                                  <span style={{
                                    color: '#10b981',
                                    fontWeight: '600',
                                    fontSize: '10px',
                                    padding: '3px 8px',
                                    backgroundColor: '#d1fae5',
                                    borderRadius: '6px'
                                  }}>
                                    TODAY
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* COMPLETE DATE */}
                            <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span style={{ color: '#6b7280', fontSize: '13px' }}>
                                {task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB') : '-'}
                              </span>
                            </td>
                            {/* STAGE */}
                            <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: '#f3f4f6',
                                color: '#6b7280',
                                display: 'inline-block',
                                textTransform: 'lowercase'
                              }}>
                                {clientStage.replace(/-/g, '-')}
                              </span>
                            </td>
                            {/* ACTION */}
                            <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  style={{
                                    padding: '8px 12px',
                                    background: '#667eea',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = '#5568d3';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = '#667eea';
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  style={{
                                    padding: '8px 12px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = '#dc2626';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = '#ef4444';
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="strategy-empty-state">
                  <h3>No tasks found</h3>
                  <p>No tasks scheduled for this date</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Tasks Modal */}
      {showClientTasksModal && (
        <div className="strategy-modal" onClick={closeClientTasksModal} style={{ zIndex: 9999 }}>
          <div className="strategy-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px', maxHeight: '90vh', width: '95%' }}>
            <div className="strategy-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}> Tasks for {selectedClientName}</h3>
                {/* Month Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="modal-month-filter" style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                    Month:
                  </label>
                  <input
                    id="modal-month-filter"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Add Task Button - Always visible */}
                {selectedClient && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewTaskAssignment({
                        clientId: selectedClient.clientId,
                        clientName: selectedClient.clientName,
                        taskName: '',
                        description: '',
                        department: '',
                        taskType: '',
                        postDate: '',
                        referenceLink: '',
                        specialNotes: '',
                        useManualEntry: false
                      });
                      setShowStrategyPrepForm(true);
                      setStrategyPrepTaskId(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                    }}
                  >
                    Add Task
                  </button>
                )}

                {/* Show Tasks Button - Always visible */}
                {selectedClient && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const clientTasks = tasks.filter(t =>
                        (t.clientId === selectedClient.clientId || t.clientName === selectedClient.clientName) &&
                        !t.deleted
                      );
                      setTasksOnlyModalData({
                        clientName: selectedClient.clientName,
                        tasks: clientTasks
                      });
                      setShowTasksOnlyModal(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.3)';
                    }}
                  >
                    Show Tasks
                  </button>
                )}

                <button onClick={closeClientTasksModal} className="strategy-modal-close"></button>
              </div>
            </div>
            <div className="strategy-modal-body" style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
              {/* Client Stages Section */}
              {selectedClient && (() => {
                // Set default stage if not present
                if (!selectedClient.stage) {
                  selectedClient.stage = 'information-gathering';
                }
                return (
                  <div style={{ marginBottom: '24px', padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>Client Progress</h4>

                    {/* Desktop Table View */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '8%' }}>CLIENT ID</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '15%' }}>NAME</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '20%' }}>STAGE</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '12%' }}>DATE</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '12%' }}>COMPLETION DATE</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '13%' }}>STATUS</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '20%' }}>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allStages = [
                            { name: 'Information Gathering', status: 'information-gathering', color: '#dbeafe', borderColor: '#1e40af', textColor: '#1e40af' },
                            { name: 'Strategy Preparation', status: 'strategy-preparation', color: '#e0e7ff', borderColor: '#4338ca', textColor: '#4338ca' },
                            { name: 'Internal Approval', status: 'internal-approval', color: '#fce7f3', borderColor: '#ec4899', textColor: '#ec4899' },
                            { name: 'Client Approval', status: 'client-approval', color: '#fef3c7', borderColor: '#f59e0b', textColor: '#f59e0b' }
                          ];

                          // Find current stage index
                          let currentStageIndex = allStages.findIndex(s => s.status === selectedClient.stage);

                          // Debug: Log client stage info
                          console.log('Client stage:', selectedClient.stage, 'Index:', currentStageIndex);

                          // If stage not found or undefined, check if we have completion data
                          if (currentStageIndex === -1) {
                            // Check if client has stageCompletions to determine actual progress
                            if (selectedClient.stageCompletions) {
                              // Find the highest completed stage
                              const completedStages = Object.keys(selectedClient.stageCompletions);
                              if (completedStages.length > 0) {
                                const lastCompletedIndex = Math.max(...completedStages.map(s =>
                                  allStages.findIndex(stage => stage.status === s)
                                ).filter(i => i !== -1));
                                currentStageIndex = lastCompletedIndex + 1; // Next stage after last completed
                              } else {
                                currentStageIndex = 0; // Default to first stage
                              }
                            } else {
                              currentStageIndex = 0; // Default to Information Gathering
                            }
                          }

                          // Show ALL 4 stages always (not progressive)
                          const visibleStages = allStages;

                          return visibleStages.map((stage, index) => {
                            const isActive = selectedClient.stage === stage.status;
                            // A stage is completed if:
                            // 1. Current stage index is greater than this stage's index, OR
                            // 2. This stage has a completion date in stageCompletions
                            const hasCompletionDate = selectedClient.stageCompletions && selectedClient.stageCompletions[stage.status];
                            const isCompleted = currentStageIndex > index || hasCompletionDate;

                            return (
                              <tr key={stage.status} style={{ background: isActive ? stage.color : 'white' }}>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ color: '#6366f1', fontWeight: '600', fontSize: '14px' }}>
                                    {selectedClient.clientId}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ color: '#374151', fontWeight: '500', fontSize: '14px' }}>
                                    {selectedClient.clientName}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: isActive ? `2px solid ${stage.borderColor}` : '1px solid #e5e7eb',
                                    backgroundColor: isActive ? stage.color : '#f9fafb',
                                    color: isActive ? stage.textColor : '#9ca3af',
                                    fontWeight: '600',
                                    fontSize: '13px'
                                  }}>
                                    {stage.name}
                                  </div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {(() => {
                                      // For the first stage (Information Gathering), show sentAt date
                                      if (index === 0) {
                                        return selectedClient.sentAt ? new Date(selectedClient.sentAt).toLocaleDateString() : '-';
                                      }

                                      // For subsequent stages, show the completion date of the previous stage
                                      const previousStage = allStages[index - 1];
                                      if (previousStage && selectedClient.stageCompletions && selectedClient.stageCompletions[previousStage.status]) {
                                        return new Date(selectedClient.stageCompletions[previousStage.status]).toLocaleDateString();
                                      }

                                      return '-';
                                    })()}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ fontSize: '12px', color: isCompleted ? '#16a34a' : '#6b7280', fontWeight: isCompleted ? '600' : 'normal' }}>
                                    {(() => {
                                      // Check stage-specific completion date first
                                      if (selectedClient.stageCompletions && selectedClient.stageCompletions[stage.status]) {
                                        return new Date(selectedClient.stageCompletions[stage.status]).toLocaleDateString();
                                      }
                                      // If stage is completed, show lastUpdated
                                      if (isCompleted && selectedClient.lastUpdated) {
                                        return new Date(selectedClient.lastUpdated).toLocaleDateString();
                                      }
                                      // If this is the first stage and client was sent, show sentAt date
                                      if (index === 0 && selectedClient.sentAt) {
                                        return new Date(selectedClient.sentAt).toLocaleDateString();
                                      }
                                      return '-';
                                    })()}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  {isCompleted ? (
                                    <span style={{
                                      padding: '4px 12px',
                                      background: '#dcfce7',
                                      color: '#16a34a',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}>
                                      Completed
                                    </span>
                                  ) : isActive ? (
                                    <span style={{
                                      padding: '4px 12px',
                                      background: stage.color,
                                      color: stage.textColor,
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}>
                                      In Progress
                                    </span>
                                  ) : (
                                    <span style={{
                                      padding: '4px 12px',
                                      background: '#f3f4f6',
                                      color: '#9ca3af',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}>
                                      Pending
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  {isCompleted ? (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                      <span style={{
                                        padding: '6px 16px',
                                        background: '#dcfce7',
                                        color: '#16a34a',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'inline-block'
                                      }}>
                                        {stage.status === 'client-approval' ? ' Approved' : 'Completed'}
                                      </span>
                                    </div>
                                  ) : isActive && stage.status === 'information-gathering' ? (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Mark Information Gathering as complete and move to Strategy Preparation?')) {
                                          try {
                                            const clientRef = ref(database, `strategyClients/${selectedClient.id}`);
                                            const completionDate = new Date().toISOString();

                                            const updates = {
                                              stage: 'strategy-preparation',
                                              lastUpdated: completionDate,
                                              'stageCompletions/information-gathering': completionDate
                                            };

                                            await update(clientRef, updates);

                                            const updatedClient = {
                                              ...selectedClient,
                                              stage: 'strategy-preparation',
                                              lastUpdated: completionDate,
                                              stageCompletions: {
                                                ...selectedClient.stageCompletions,
                                                'information-gathering': completionDate
                                              }
                                            };
                                            setSelectedClient(updatedClient);

                                            showToast('âœ… Moved to Strategy Preparation!', 'success', 3000);
                                          } catch (error) {
                                            console.error('Error updating stage:', error);
                                            showToast('âŒ Error updating stage: ' + error.message, 'error', 3000);
                                          }
                                        }
                                      }}
                                      style={{
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '8px 16px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                                      }}
                                    >
                                      Complete
                                    </button>
                                  ) : isActive && stage.status === 'strategy-preparation' ? (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Mark Strategy Preparation as complete and move to Internal Approval?')) {
                                          try {
                                            const clientRef = ref(database, `strategyClients/${selectedClient.id}`);
                                            const completionDate = new Date().toISOString();

                                            const updates = {
                                              stage: 'internal-approval',
                                              lastUpdated: completionDate,
                                              'stageCompletions/strategy-preparation': completionDate
                                            };

                                            await update(clientRef, updates);

                                            const updatedClient = {
                                              ...selectedClient,
                                              stage: 'internal-approval',
                                              lastUpdated: completionDate,
                                              stageCompletions: {
                                                ...selectedClient.stageCompletions,
                                                'strategy-preparation': completionDate
                                              }
                                            };
                                            setSelectedClient(updatedClient);

                                            showToast('âœ… Moved to Internal Approval!', 'success', 3000);
                                          } catch (error) {
                                            console.error('Error updating stage:', error);
                                            showToast('âŒ Error updating stage: ' + error.message, 'error', 3000);
                                          }
                                        }
                                      }}
                                      style={{
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '8px 16px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                                      }}
                                    >
                                      Complete
                                    </button>
                                  ) : isActive && stage.status === 'internal-approval' ? (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Move client to Client Approval?')) {
                                          try {
                                            const clientRef = ref(database, `strategyClients/${selectedClient.id}`);
                                            const completionDate = new Date().toISOString();

                                            // Update with proper nested object structure
                                            const updates = {
                                              stage: 'client-approval',
                                              lastUpdated: completionDate,
                                              'stageCompletions/internal-approval': completionDate
                                            };

                                            await update(clientRef, updates);

                                            // Update local state with stageCompletions
                                            const updatedClient = {
                                              ...selectedClient,
                                              stage: 'client-approval',
                                              lastUpdated: completionDate,
                                              stageCompletions: {
                                                ...selectedClient.stageCompletions,
                                                'internal-approval': completionDate
                                              }
                                            };
                                            setSelectedClient(updatedClient);

                                            showToast('âœ… Client moved to Client Approval!', 'success', 3000);
                                          } catch (error) {
                                            console.error('Error updating stage:', error);
                                            showToast('âŒ Error updating stage: ' + error.message, 'error', 3000);
                                          }
                                        }
                                      }}
                                      style={{
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '8px 16px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
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
                                      Approve
                                    </button>
                                  ) : isActive && stage.status === 'client-approval' ? (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (window.confirm('Approve all tasks and send to departments?')) {
                                            try {
                                              // Get all tasks for this client
                                              const clientTasks = tasks.filter(t =>
                                                t.clientId === selectedClient.clientId ||
                                                t.clientName === selectedClient.clientName
                                              );

                                              // Update all tasks to assigned-to-department status
                                              const updatePromises = clientTasks.map(task => {
                                                const taskRef = ref(database, `tasks/${task.id}`);
                                                return update(taskRef, {
                                                  status: 'assigned-to-department',
                                                  approvedAt: new Date().toISOString(),
                                                  approvedBy: 'Strategy Department',
                                                  approvedForCalendar: true,
                                                  assignedToDepartmentAt: new Date().toISOString(),
                                                  assignedBy: 'Strategy Department',
                                                  assignedToDept: task.department,
                                                  lastUpdated: new Date().toISOString()
                                                });
                                              });

                                              await Promise.all(updatePromises);

                                              // Update client stage - reset to information-gathering for next cycle
                                              const clientRef = ref(database, `strategyClients/${selectedClient.id}`);
                                              const completionDate = new Date().toISOString();

                                              const updates = {
                                                stage: 'information-gathering', // Reset to first stage for next cycle
                                                completedAt: completionDate, // Keep record of when cycle was completed
                                                lastUpdated: completionDate,
                                                // Clear ALL stage completions for fresh start
                                                'stageCompletions/information-gathering': null,
                                                'stageCompletions/strategy-preparation': null,
                                                'stageCompletions/internal-approval': null,
                                                'stageCompletions/client-approval': null
                                              };

                                              await update(clientRef, updates);

                                              // Update local state to reflect the reset
                                              const updatedClient = {
                                                ...selectedClient,
                                                stage: 'information-gathering',
                                                completedAt: completionDate,
                                                lastUpdated: completionDate,
                                                stageCompletions: {} // Clear all stage completions
                                              };
                                              setSelectedClient(updatedClient);

                                              showToast(`âœ… ${clientTasks.length} task(s) approved and sent to departments! Client reset to Information Gathering.`, 'success', 3000);
                                              closeClientTasksModal();
                                            } catch (error) {
                                              console.error('Error approving tasks:', error);
                                              showToast('âŒ Error approving tasks', 'error', 3000);
                                            }
                                          }
                                        }}
                                        style={{
                                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '8px',
                                          padding: '8px 16px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
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
                                        Approve
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (window.confirm('Reject and send back to Information Gathering? All progress will be reset.')) {
                                            try {
                                              // Update client stage back to information-gathering and clear all completion dates
                                              const clientRef = ref(database, `strategyClients/${selectedClient.id}`);

                                              const updates = {
                                                stage: 'information-gathering',
                                                rejectedAt: new Date().toISOString(),
                                                rejectedBy: 'Strategy Department',
                                                lastUpdated: new Date().toISOString(),
                                                // Clear all stage completions
                                                'stageCompletions/information-gathering': null,
                                                'stageCompletions/strategy-preparation': null,
                                                'stageCompletions/internal-approval': null,
                                                'stageCompletions/client-approval': null
                                              };

                                              await update(clientRef, updates);

                                              // Update local state with cleared completions
                                              const updatedClient = {
                                                ...selectedClient,
                                                stage: 'information-gathering',
                                                rejectedAt: new Date().toISOString(),
                                                rejectedBy: 'Strategy Department',
                                                lastUpdated: new Date().toISOString(),
                                                stageCompletions: {} // Clear all completions
                                              };
                                              setSelectedClient(updatedClient);

                                              showToast('âŒ Client sent back to Information Gathering! All progress reset.', 'success', 3000);
                                            } catch (error) {
                                              console.error('Error rejecting client:', error);
                                              showToast('âŒ Error rejecting client', 'error', 3000);
                                            }
                                          }
                                        }}
                                        style={{
                                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '8px',
                                          padding: '8px 16px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.transform = 'translateY(-2px)';
                                          e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.transform = 'translateY(0)';
                                          e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#9ca3af', fontSize: '14px' }}>-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="client-progress-card-mobile">
                      {(() => {
                        const allStages = [
                          { name: 'Information Gathering', status: 'information-gathering', className: 'info-gathering', color: '#dbeafe', borderColor: '#1e40af', textColor: '#1e40af' },
                          { name: 'Strategy Preparation', status: 'strategy-preparation', className: 'strategy-prep', color: '#e0e7ff', borderColor: '#4338ca', textColor: '#4338ca' },
                          { name: 'Internal Approval', status: 'internal-approval', className: 'internal-approval', color: '#fce7f3', borderColor: '#ec4899', textColor: '#ec4899' },
                          { name: 'Client Approval', status: 'client-approval', className: 'client-approval', color: '#fef3c7', borderColor: '#f59e0b', textColor: '#f59e0b' }
                        ];

                        let currentStageIndex = allStages.findIndex(s => s.status === selectedClient.stage);
                        if (currentStageIndex === -1) {
                          if (selectedClient.stageCompletions) {
                            const completedStages = Object.keys(selectedClient.stageCompletions);
                            if (completedStages.length > 0) {
                              const lastCompletedIndex = Math.max(...completedStages.map(s =>
                                allStages.findIndex(stage => stage.status === s)
                              ).filter(i => i !== -1));
                              currentStageIndex = lastCompletedIndex + 1;
                            } else {
                              currentStageIndex = 0;
                            }
                          } else {
                            currentStageIndex = 0;
                          }
                        }

                        return allStages.map((stage, index) => {
                          const isActive = selectedClient.stage === stage.status;
                          const hasCompletionDate = selectedClient.stageCompletions && selectedClient.stageCompletions[stage.status];
                          const isCompleted = currentStageIndex > index || hasCompletionDate;

                          return (
                            <div
                              key={stage.status}
                              className={`progress-stage-card ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                              style={isActive ? { borderColor: stage.borderColor } : {}}
                            >
                              {/* Card Header */}
                              <div className="progress-card-header">
                                <div className="progress-card-client-info">
                                  <span className="progress-card-client-id">{selectedClient.clientId}</span>
                                  <span className="progress-card-client-name">{selectedClient.clientName}</span>
                                </div>
                              </div>

                              {/* Card Body */}
                              <div className="progress-card-body">
                                {/* Stage */}
                                <div className="progress-card-row">
                                  <span className="progress-card-label">Stage</span>
                                  <span className={`progress-card-stage-badge ${stage.className}`}>
                                    {stage.name}
                                  </span>
                                </div>

                                {/* Date */}
                                <div className="progress-card-row">
                                  <span className="progress-card-label">Date</span>
                                  <span className="progress-card-value">
                                    {selectedClient.sentAt ? new Date(selectedClient.sentAt).toLocaleDateString() : '-'}
                                  </span>
                                </div>

                                {/* Completion Date */}
                                <div className="progress-card-row">
                                  <span className="progress-card-label">Completion Date</span>
                                  <span className="progress-card-value" style={{ color: isCompleted ? '#16a34a' : '#374151', fontWeight: isCompleted ? '600' : '500' }}>
                                    {(() => {
                                      if (selectedClient.stageCompletions && selectedClient.stageCompletions[stage.status]) {
                                        return new Date(selectedClient.stageCompletions[stage.status]).toLocaleDateString();
                                      }
                                      if (isCompleted && selectedClient.lastUpdated) {
                                        return new Date(selectedClient.lastUpdated).toLocaleDateString();
                                      }
                                      if (index === 0 && selectedClient.sentAt) {
                                        return new Date(selectedClient.sentAt).toLocaleDateString();
                                      }
                                      return '-';
                                    })()}
                                  </span>
                                </div>

                                {/* Status */}
                                <div className="progress-card-row">
                                  <span className="progress-card-label">Status</span>
                                  <span className={`progress-card-status ${isCompleted ? 'completed' : isActive ? 'in-progress' : 'pending'}`}>
                                    {isCompleted ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                                  </span>
                                </div>
                              </div>

                              {/* Card Action */}
                              {(isCompleted || isActive) && (
                                <div className="progress-card-action">
                                  {isCompleted && stage.status === 'strategy-preparation' && (
                                    <button
                                      className="show-tasks-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const clientTasks = tasks.filter(t =>
                                          t.clientId === selectedClient.clientId ||
                                          t.clientName === selectedClient.clientName
                                        );
                                        setTasksOnlyModalData({
                                          clientName: selectedClient.clientName,
                                          tasks: clientTasks
                                        });
                                        setShowTasksOnlyModal(true);
                                      }}
                                    >
                                      Show Tasks
                                    </button>
                                  )}
                                  {isCompleted && stage.status !== 'strategy-preparation' && (
                                    <div className="completed-badge">
                                      {stage.status === 'client-approval' ? ' Approved' : ' Completed'}
                                    </div>
                                  )}
                                  {isActive && stage.status === 'information-gathering' && (
                                    <button
                                      className="complete-btn"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Mark Information Gathering as complete and move to Strategy Preparation?')) {
                                          try {
                                            const clientRef = ref(database, `strategyClients/${selectedClient.id}`);
                                            const completionDate = new Date().toISOString();

                                            const updates = {
                                              stage: 'strategy-preparation',
                                              lastUpdated: completionDate,
                                              'stageCompletions/information-gathering': completionDate
                                            };

                                            await update(clientRef, updates);

                                            const updatedClient = {
                                              ...selectedClient,
                                              stage: 'strategy-preparation',
                                              lastUpdated: completionDate,
                                              stageCompletions: {
                                                ...selectedClient.stageCompletions,
                                                'information-gathering': completionDate
                                              }
                                            };
                                            setSelectedClient(updatedClient);

                                            showToast('âœ… Moved to Strategy Preparation!', 'success', 3000);
                                          } catch (error) {
                                            console.error('Error updating stage:', error);
                                            showToast('âŒ Error updating stage: ' + error.message, 'error', 3000);
                                          }
                                        }
                                      }}
                                    >
                                      Complete
                                    </button>
                                  )}
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
          </div>
        </div>
      )}

      {/* Rework Note Modal */}
      {showReworkModal && (
        <div className="strategy-modal" onClick={closeReworkModal}>
          <div className="strategy-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="strategy-modal-header">
              <h3>Rework Note</h3>
              <button onClick={closeReworkModal} className="strategy-modal-close">-</button>
            </div>
            <div className="strategy-modal-body" style={{ padding: '28px' }}>
              <p style={{ margin: '0 0 20px 0', color: '#374151', fontSize: '15px', lineHeight: '1.6', fontWeight: '500' }}>
                Please provide specific feedback or changes needed for this task:
              </p>
              <textarea
                value={reworkNote}
                onChange={(e) => setReworkNote(e.target.value)}
                placeholder="Type your feedback here..."
                autoFocus
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginBottom: '24px',
                  lineHeight: '1.6',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4B49AC';
                  e.target.style.boxShadow = '0 0 0 4px rgba(75, 73, 172, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p style={{ margin: '0 0 20px 0', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                Example: Need better quality, Wrong format, Missing elements, Change color scheme, etc.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeReworkModal}
                  style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#e5e7eb'}
                  onMouseOut={(e) => e.target.style.background = '#f3f4f6'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReworkWithNote}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
                  }}
                >
                  Send for Rework
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Preparation Form - Right Side Panel */}
      {showStrategyPrepForm && (
        <div className="strategy-modal" onClick={() => {
          setShowStrategyPrepForm(false);
          setStrategyPrepTaskId(null);
        }} style={{ zIndex: 10001 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'relative',
            width: '700px',
            maxWidth: '90%',
            maxHeight: '90vh',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  Assign Task
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  Create new task for client
                </p>
              </div>
              <button
                onClick={() => {
                  setShowStrategyPrepForm(false);
                  setStrategyPrepTaskId(null);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >

              </button>
            </div>

            {/* Form Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}>
              {(() => {
                // Always use clients from strategyClients (assigned to this employee)
                // Don't derive from tasks - we want to show all assigned clients regardless of whether they have tasks in the selected month
                const displayClients = clients;

                return (
                  <form onSubmit={handleAssignTask} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        <input
                          type="checkbox"
                          checked={newTaskAssignment.useManualEntry}
                          onChange={(e) => setNewTaskAssignment({
                            ...newTaskAssignment,
                            useManualEntry: e.target.checked,
                            clientId: '',
                            clientName: ''
                          })}
                          style={{ cursor: 'pointer' }}
                        />
                        Enter client name manually
                      </label>
                    </div>

                    {!newTaskAssignment.useManualEntry ? (
                      <>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                          }}>
                            Select Client *
                          </label>
                          <select
                            value={newTaskAssignment.clientName}
                            onChange={(e) => {
                              const selectedClient = displayClients.find(c => c.clientName === e.target.value);
                              setNewTaskAssignment({
                                ...newTaskAssignment,
                                clientName: e.target.value,
                                clientId: selectedClient ? selectedClient.clientId : ''
                              });
                            }}
                            required
                            style={{
                              width: '100%',
                              padding: '12px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s'
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
                            <option value="">-- Select Client --</option>
                            {displayClients.map(client => (
                              <option key={client.id} value={client.clientName}>
                                {client.clientName} ({client.clientId})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                          }}>
                            Client ID
                          </label>
                          <input
                            type="text"
                            value={newTaskAssignment.clientId}
                            readOnly
                            placeholder="Auto-filled when client is selected"
                            style={{
                              width: '100%',
                              padding: '12px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px',
                              backgroundColor: '#f9fafb',
                              cursor: 'not-allowed'
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          Client Name *
                        </label>
                        <input
                          type="text"
                          value={newTaskAssignment.clientName}
                          onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, clientName: e.target.value })}
                          placeholder="Enter client name manually"
                          required
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s'
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
                    )}

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Ideas *
                      </label>
                      <input
                        type="text"
                        value={newTaskAssignment.taskName}
                        onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, taskName: e.target.value })}
                        placeholder="Enter ideas"
                        required
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'all 0.2s'
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

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Content
                      </label>
                      <textarea
                        value={newTaskAssignment.description}
                        onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, description: e.target.value })}
                        placeholder="Enter content"
                        rows="4"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'all 0.2s',
                          resize: 'vertical',
                          fontFamily: 'inherit'
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

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Reference Link
                      </label>
                      <input
                        type="url"
                        value={newTaskAssignment.referenceLink}
                        onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, referenceLink: e.target.value })}
                        placeholder="Enter reference link (e.g., https://example.com)"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'all 0.2s'
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

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Special Notes
                      </label>
                      <textarea
                        value={newTaskAssignment.specialNotes}
                        onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, specialNotes: e.target.value })}
                        placeholder="Enter special notes or additional instructions"
                        rows="4"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'all 0.2s',
                          resize: 'vertical',
                          fontFamily: 'inherit'
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

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Assign to Department *
                      </label>
                      <select
                        value={newTaskAssignment.department}
                        onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, department: e.target.value, taskType: '' })}
                        required
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'all 0.2s'
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
                        <option value="">-- Select department --</option>
                        <option value="video">Video Department</option>
                        <option value="graphics">Graphics Department</option>
                      </select>
                    </div>

                    {newTaskAssignment.department && (
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          Task Type *
                        </label>
                        <select
                          value={newTaskAssignment.taskType}
                          onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, taskType: e.target.value })}
                          required
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s'
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
                          <option value="">-- Select task type --</option>
                          {newTaskAssignment.department === 'video' && (
                            <>
                              <option value="long-video">Long Video</option>
                              <option value="reel">Reel</option>
                            </>
                          )}
                          {newTaskAssignment.department === 'graphics' && (
                            <>
                              <option value="festival-creative">Festival Creative</option>
                              <option value="business-creative">Business Creative</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Post Date *
                      </label>
                      <input
                        type="date"
                        value={newTaskAssignment.postDate}
                        onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, postDate: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'all 0.2s'
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

                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid #e5e7eb',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowStrategyPrepForm(false);
                          setStrategyPrepTaskId(null);
                        }}
                        style={{
                          flex: '1 1 auto',
                          minWidth: '120px',
                          padding: '12px',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          const form = e.target.closest('form');
                          const fakeEvent = { preventDefault: () => { } };
                          handleAssignTask(fakeEvent, true);
                        }}
                        style={{
                          flex: '1 1 auto',
                          minWidth: '150px',
                          padding: '12px',
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <Plus size={16} /> Add More Task
                      </button>
                      <button
                        type="submit"
                        style={{
                          flex: 1,
                          padding: '12px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <Plus size={18} />
                        Assign Task
                      </button>
                    </div>
                  </form>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyDashboard;

