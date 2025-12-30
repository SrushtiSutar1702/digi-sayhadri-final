import React, { useState, useEffect, Fragment } from 'react';
import { ref, onValue, push, update, get } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Calendar, LogOut, Plus, UserPlus, Download, CheckSquare, Square, Search, Upload, Trash2, ClipboardList, LayoutDashboard, Briefcase, CheckCircle, Clock, AlertCircle, Users, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './ProductionIncharge.css';

const ProductionIncharge = () => {
  const [tasks, setTasks] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState('pending-production');
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [expandedUnsentClients, setExpandedUnsentClients] = useState(new Set());
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [showTaskAssignForm, setShowTaskAssignForm] = useState(false);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [taskFilter, setTaskFilter] = useState('all'); // 'all', 'assigned', 'pending', 'video', 'graphics', 'social-media'
  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDateTasksModal, setShowDateTasksModal] = useState(false);
  const [selectedDateTasks, setSelectedDateTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const tasksTableRef = React.useRef(null);
  const calendarRef = React.useRef(null);
  const uploadedDataRef = React.useRef(null);
  const taskAssignFormRef = React.useRef(null);
  const [newTaskAssignment, setNewTaskAssignment] = useState({
    clientId: '',
    clientName: '',
    useManualEntry: false,
    tasks: [
      {
        department: '',
        taskType: '',
        taskName: '',
        description: '',
        postDate: '',
        referenceLink: ''
      }
    ]
  });
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [newClient, setNewClient] = useState({
    clientId: '',
    clientName: '',
    contactNumber: '',
    email: '',
    videoInstructions: '',
    graphicsInstructions: ''
  });
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [uploadedExcelData, setUploadedExcelData] = useState([]);
  const [showUploadedData, setShowUploadedData] = useState(false);
  const [clientListSearch, setClientListSearch] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUnsentCheckboxes, setShowUnsentCheckboxes] = useState(false);
  const [showTasksCheckboxes, setShowTasksCheckboxes] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all'); // 'all', 'video', 'graphics'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'in-progress', 'completed'
  const [dateRangeFilter, setDateRangeFilter] = useState('month'); // 'day', 'week', 'month'
  const [showClientTasksModal, setShowClientTasksModal] = useState(false);
  const [selectedClientForModal, setSelectedClientForModal] = useState(null);
  const [selectedClientTasksForModal, setSelectedClientTasksForModal] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage] = useState(10);
  // Employee management states
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeePassword, setEditEmployeePassword] = useState('');
  const [editEmployeeRole, setEditEmployeeRole] = useState('employee');
  const [employeeListSearch, setEmployeeListSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { toasts, showToast, removeToast } = useToast();

  // Helper function to get only active clients
  const getActiveClients = () => {
    return clients.filter(client => {
      // Ensure client has valid data
      if (!client || !client.clientName) {
        console.warn('Invalid client data found:', client);
        return false;
      }
      return (client.status || 'active') === 'active';
    });
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, taskFilter, clientSearchQuery, departmentFilter, statusFilter, dateRangeFilter]);

  // Check authentication state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('✅ User authenticated:', user.email, 'UID:', user.uid);
      } else {
        console.log('⚠️ User not authenticated');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Check for openCalendar state from navigation
  useEffect(() => {
    if (location.state?.openCalendar) {
      setShowCalendar(true);
    }
  }, [location]);

  // Firebase data loading
  useEffect(() => {
    console.log('ProductionIncharge: Setting up Firebase listeners');
    console.log('ProductionIncharge: Database object:', database);
    console.log('ProductionIncharge: Auth state:', auth.currentUser ? `Authenticated as ${auth.currentUser.email}` : 'Not authenticated');

    if (!database) {
      console.error('ProductionIncharge: Database is not initialized!');
      showToast('❌ Database connection error. Please refresh the page.', 'error', 5000);
      return;
    }

    const tasksRef = ref(database, 'tasks');
    const unsubscribeTasks = onValue(tasksRef, (snapshot) => {
      if (snapshot.exists()) {
        const tasksData = snapshot.val();
        const tasksArray = Object.keys(tasksData)
          .map(key => ({
            id: key,
            ...tasksData[key]
          }))
          .filter(task => !task.deleted); // Filter out deleted tasks
        setTasks(tasksArray);
      } else {
        setTasks([]);
      }
    });

    const clientsRef = ref(database, 'clients');
    const unsubscribeClients = onValue(clientsRef, (snapshot) => {
      console.log('ProductionIncharge: Loading clients from Firebase...');
      const data = snapshot.val();
      console.log('ProductionIncharge: Raw clients data:', data);

      if (data) {
        const clientsArray = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(client => !client.deleted); // Filter out deleted clients

        console.log('ProductionIncharge: Clients loaded:', clientsArray.length, clientsArray);
        setClients(clientsArray);
      } else {
        console.log('ProductionIncharge: No clients found in database');
        setClients([]);
      }
    });

    const employeesRef = ref(database, 'employees');
    const unsubscribeEmployees = onValue(employeesRef, (snapshot) => {
      console.log('ProductionIncharge: Loading employees from Firebase...');
      const data = snapshot.val();
      console.log('ProductionIncharge: Raw employees data:', data);

      if (data) {
        const employeesArray = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(employee => !employee.deleted); // Filter out deleted employees

        console.log('ProductionIncharge: Employees loaded:', employeesArray.length, employeesArray);

        // Security Check: functionality to ensure deleted/inactive users are logged out
        const currentUserEmail = auth.currentUser?.email || sessionStorage.getItem('productionEmail');

        if (currentUserEmail &&
          currentUserEmail !== 'proin@gmail.com' &&
          currentUserEmail !== 'productionincharge@gmail.com' &&
          currentUserEmail !== 'superadmin@gmail.com') {

          const userInList = employeesArray.find(e => e.email === currentUserEmail);

          // If they are not in the list (deleted) OR explicitly inactive
          if (!userInList || userInList.status === 'inactive') {
            console.log('Production Incharge: User credential invalid/revoked. Logging out.');
            sessionStorage.clear();
            localStorage.clear();
            navigate('/');
          }
        }

        setEmployees(employeesArray);
      } else {
        console.log('ProductionIncharge: No employees found in database');
        setEmployees([]);
      }
    });

    return () => {
      unsubscribeTasks();
      unsubscribeClients();
      unsubscribeEmployees();
    };
  }, []);

  // Sync sentToStrategyHead flags with strategyHeadClients database
  useEffect(() => {
    const syncClientFlags = async () => {
      if (!database || clients.length === 0) return;

      try {
        const strategyHeadClientsRef = ref(database, 'strategyHeadClients');
        const snapshot = await get(strategyHeadClientsRef);

        if (snapshot.exists()) {
          const strategyHeadClients = snapshot.val();
          const sentClientIds = Object.values(strategyHeadClients).map(c => c.clientId);

          // Update any clients that are in strategyHeadClients but don't have sentToStrategyHead flag
          const clientsRef = ref(database, 'clients');
          const clientsSnapshot = await get(clientsRef);

          if (clientsSnapshot.exists()) {
            const clientsData = clientsSnapshot.val();
            const updates = {};

            Object.entries(clientsData).forEach(([key, client]) => {
              if (sentClientIds.includes(client.clientId) && client.sentToStrategyHead !== true) {
                console.log(`Syncing client ${client.clientName} - marking as sent to Strategy Head`);
                updates[`clients/${key}/sentToStrategyHead`] = true;
                updates[`clients/${key}/sentToStrategyHeadDate`] = new Date().toISOString();
                updates[`clients/${key}/sentToStrategyHeadBy`] = 'Production Incharge (Auto-synced)';
              }
            });

            if (Object.keys(updates).length > 0) {
              await update(ref(database), updates);
              console.log(`Synced ${Object.keys(updates).length / 3} client(s) sentToStrategyHead flags`);
            }
          }
        }
      } catch (error) {
        console.error('Error syncing client flags:', error);
      }
    };

    syncClientFlags();
  }, [clients, database]);

  // Modal is now centered, no need to scroll
  // useEffect(() => {
  //   if (showTaskAssignForm && taskAssignFormRef.current) {
  //     setTimeout(() => {
  //       taskAssignFormRef.current.scrollIntoView({
  //         behavior: 'smooth',
  //         block: 'start'
  //       });
  //     }, 100);
  //   }
  // }, [showTaskAssignForm]);

  // Auto-generate Client ID when Add Client form opens
  useEffect(() => {
    if (showAddClientForm) {
      console.log('Auto-generating client ID, current clients:', clients.length);

      if (clients.length === 0) {
        // First client
        setNewClient(prev => ({
          ...prev,
          clientId: '1'
        }));
        console.log('First client, setting ID to 1');
      } else {
        // Find the highest numeric client ID
        const numericIds = clients
          .map(client => {
            const id = client.clientId;
            // Extract number from clientId (e.g., "1", "2", "CLI001" -> 1)
            const match = id?.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
          })
          .filter(num => !isNaN(num));

        console.log('Numeric IDs found:', numericIds);

        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const nextId = maxId + 1;

        console.log('Next client ID will be:', nextId);

        setNewClient(prev => ({
          ...prev,
          clientId: nextId.toString()
        }));
      }
    }
  }, [showAddClientForm, clients]);

  // Scroll to uploaded Excel data when it's shown
  useEffect(() => {
    if (showUploadedData && uploadedDataRef.current) {
      setTimeout(() => {
        uploadedDataRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [showUploadedData]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Handle calendar toggle (now as modal, no scroll needed)
  const handleShowCalendar = () => {
    setShowCalendar(!showCalendar);
  };

  // Handle date click to show tasks
  const handleDateClick = (dateString, dayTasks) => {
    if (dayTasks.length > 0) {
      setSelectedDate(dateString);
      setSelectedDateTasks(dayTasks);
      setShowDateTasksModal(true);
      // Keep calendar open in background
    }
  };

  // Close date tasks modal
  const closeDateTasksModal = () => {
    setShowDateTasksModal(false);
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  // Handle task assignment
  const handleAssignTask = async (e) => {
    e.preventDefault();

    if (!database) {
      showToast('❌ Database not available. Please check Firebase configuration.', 'error', 3000);
      return;
    }

    // Validate that all tasks have required fields
    const validTasks = newTaskAssignment.tasks.filter(task =>
      task.department && task.taskType && task.taskName && task.postDate
    );

    if (validTasks.length === 0) {
      showToast('❌ Please fill in all required fields for at least one task', 'error', 3000);
      return;
    }

    if (validTasks.length < newTaskAssignment.tasks.length) {
      showToast('⚠️ Some tasks are incomplete and will be skipped', 'warning', 3000);
    }

    try {
      const tasksRef = ref(database, 'tasks');
      const notificationsRef = ref(database, 'notifications');

      // Find client instructions
      const selectedClient = clients.find(c => c.clientName === newTaskAssignment.clientName);

      // Create all valid tasks for the client
      const taskPromises = validTasks.map(task => {
        const postDate = new Date(task.postDate);
        const deadline = new Date(postDate);
        deadline.setDate(deadline.getDate() - 2);

        // Get department-specific instructions
        let departmentInstructions = '';
        if (selectedClient) {
          if (task.department === 'video' && selectedClient.videoInstructions) {
            departmentInstructions = selectedClient.videoInstructions;
          } else if (task.department === 'graphics' && selectedClient.graphicsInstructions) {
            departmentInstructions = selectedClient.graphicsInstructions;
          }
        }

        return push(tasksRef, {
          taskName: task.taskName,
          projectId: 'production-direct',
          projectName: 'Production Department',
          clientId: newTaskAssignment.clientId || '',
          clientName: newTaskAssignment.clientName,
          department: task.department,
          taskType: task.taskType || '',
          description: task.description || '',
          clientInstructions: departmentInstructions,
          postDate: task.postDate,
          deadline: deadline.toISOString().split('T')[0],
          referenceLink: task.referenceLink || '',
          status: 'pending-production',
          approvedForCalendar: false,
          addedToCalendar: false,
          createdAt: new Date().toISOString(),
          createdBy: 'Production Department'
        });
      });

      // Wait for all tasks to be created
      const createdTasks = await Promise.all(taskPromises);

      // Create notification for Strategy Department
      await push(notificationsRef, {
        type: 'tasks-assigned',
        title: '📋 New Tasks Assigned',
        message: `${validTasks.length} task(s) assigned for ${newTaskAssignment.clientName}`,
        clientName: newTaskAssignment.clientName,
        taskCount: validTasks.length,
        taskIds: createdTasks.map(t => t.key),
        from: 'Production Incharge',
        to: 'Strategy Department',
        createdAt: new Date().toISOString(),
        read: false,
        priority: 'normal'
      });

      setNewTaskAssignment({
        clientId: '',
        clientName: '',
        useManualEntry: false,
        tasks: [
          {
            department: '',
            taskType: '',
            taskName: '',
            description: '',
            postDate: '',
            referenceLink: ''
          }
        ]
      });

      setShowTaskAssignForm(false);
      showToast(`✅ ${validTasks.length} task(s) assigned successfully to ${newTaskAssignment.clientName}!`, 'success', 3000);
    } catch (error) {
      console.error('Error assigning tasks:', error);
      showToast('❌ Error assigning tasks. Please try again.', 'error', 3000);
    }
  };

  // Helper function to get date range based on filter
  const getDateRange = () => {
    const today = new Date();
    let startDate, endDate;

    switch (dateRangeFilter) {
      case 'day':
        // Today only
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        break;

      case 'week':
        // Current week (Monday to Sunday)
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust when day is Sunday
        startDate = new Date(today);
        startDate.setDate(today.getDate() + diff);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'month':
      default:
        // Current selected month
        const [year, month] = selectedMonth.split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        break;
    }

    return { startDate, endDate };
  };

  // Filter tasks by date range
  const allMonthTasks = tasks.filter(task => {
    if (!task.postDate) return false;

    // Use string comparison for month filter to avoid timezone issues
    if (dateRangeFilter === 'month') {
      return task.postDate.startsWith(selectedMonth);
    }

    const taskDate = new Date(task.postDate);
    const { startDate, endDate } = getDateRange();

    return taskDate >= startDate && taskDate <= endDate;
  });

  console.log('=== ProductionIncharge Task Filtering Debug ===');
  console.log('Total tasks in database:', tasks.length);
  console.log('Selected month:', selectedMonth);
  console.log('Tasks for selected month:', allMonthTasks.length);
  console.log('Current task filter:', taskFilter);

  // Show sample of tasks with their dates
  if (tasks.length > 0) {
    console.log('Sample tasks with dates:');
    tasks.slice(0, 5).forEach(task => {
      console.log(`  - ${task.taskName || 'Untitled'} | Client: ${task.clientName} | Date: ${task.postDate} | Month: ${task.postDate?.slice(0, 7)}`);
    });
  }

  console.log('All tasks:', tasks);
  console.log('Month filtered tasks:', allMonthTasks);

  // Apply additional filter for display (for table)
  const filteredTasks = allMonthTasks.filter(task => {
    switch (taskFilter) {
      case 'assigned':
        return task.status === 'assigned-to-department' || task.status === 'in-progress';
      case 'pending':
        return task.status === 'approved' || task.status === 'pending-production';
      case 'video':
        return task.department === 'video';
      case 'graphics':
        return task.department === 'graphics';
      case 'social-media':
        return task.department === 'social-media';
      case 'all':
      default:
        return true;
    }
  });

  // Group tasks by client - SHOW ONLY CLIENTS SENT TO STRATEGY HEAD
  const getTasksGroupedByClient = () => {
    const groupedTasks = {};

    console.log('=== getTasksGroupedByClient Debug ===');
    console.log('Active clients:', getActiveClients());
    console.log('Filtered tasks to group:', filteredTasks);

    // Add only clients that have been sent to Strategy Head
    getActiveClients()
      .filter(client => client.sentToStrategyHead === true)
      .forEach(client => {
        // Ensure clientName is a string
        const clientKey = String(client.clientName || 'Unknown Client');
        groupedTasks[clientKey] = {
          clientName: clientKey,
          clientId: client.clientId || 'N/A',
          sentToStrategyHead: true,
          tasks: []
        };
      });

    // Add tasks to their respective clients (ONLY if client was sent to Strategy Head)
    filteredTasks.forEach(task => {
      // Ensure clientName is a string
      const clientKey = String(task.clientName || 'Unknown Client');
      console.log(`Trying to match task "${task.taskName}" with client "${clientKey}"`);
      if (groupedTasks[clientKey]) {
        console.log(`✓ Matched! Adding task to ${clientKey}`);
        groupedTasks[clientKey].tasks.push(task);
      } else {
        console.log(`✗ No match found for client "${clientKey}" - client not sent to Strategy Head, skipping task`);
        // Don't create new entry - only show clients that have been sent to Strategy Head
      }
    });

    // Filter by search query
    let clientGroups = Object.values(groupedTasks);
    if (clientSearchQuery.trim()) {
      clientGroups = clientGroups.filter(cg => {
        const name = String(cg.clientName || '');
        return name.toLowerCase().includes(clientSearchQuery.toLowerCase());
      });
    }

    // Filter by department and status
    clientGroups = clientGroups.map(cg => {
      let filteredTasks = cg.tasks;

      // Apply department filter
      if (departmentFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.department === departmentFilter);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          filteredTasks = filteredTasks.filter(task =>
            task.status === 'pending' ||
            task.status === 'pending-production' ||
            task.status === 'approved'
          );
        } else if (statusFilter === 'in-progress') {
          filteredTasks = filteredTasks.filter(task =>
            task.status === 'in-progress' ||
            task.status === 'assigned-to-department'
          );
        } else if (statusFilter === 'completed') {
          filteredTasks = filteredTasks.filter(task =>
            task.status === 'completed' ||
            task.status === 'posted'
          );
        }
      }

      return {
        ...cg,
        tasks: filteredTasks
      };
    })
      .filter(cg => {
        // Only show clients that have been sent to Strategy Head
        if (cg.sentToStrategyHead !== true) return false;

        // Only show clients that have tasks matching the current filters
        // This prevents showing clients with 0 tasks when date/department/status filters are applied
        // return cg.tasks.length > 0; // DISABLED to show all clients regardless of month selection
        return true;
      });

    console.log('Final grouped tasks:', clientGroups);
    return clientGroups;
  };

  // Pagination wrapper for tasks
  const getPaginatedTasks = () => {
    const allClientGroups = getTasksGroupedByClient();
    const indexOfLastTask = currentPage * tasksPerPage;
    const indexOfFirstTask = indexOfLastTask - tasksPerPage;
    const currentTasks = allClientGroups.slice(indexOfFirstTask, indexOfLastTask);

    return {
      tasks: currentTasks,
      totalTasks: allClientGroups.length,
      totalPages: Math.ceil(allClientGroups.length / tasksPerPage),
      currentPage: currentPage,
      hasNextPage: currentPage < Math.ceil(allClientGroups.length / tasksPerPage),
      hasPrevPage: currentPage > 1
    };
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    // Scroll to tasks table
    if (tasksTableRef.current) {
      tasksTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Toggle client expansion
  const toggleClientExpansion = (clientName) => {
    const newExpandedClients = new Set(expandedClients);
    if (newExpandedClients.has(clientName)) {
      newExpandedClients.delete(clientName);
    } else {
      newExpandedClients.add(clientName);
    }
    setExpandedClients(newExpandedClients);
  };

  // Toggle task expansion to show individual descriptions
  const toggleTaskExpansion = (taskId) => {
    const newExpandedTasks = new Set(expandedTasks);
    if (newExpandedTasks.has(taskId)) {
      newExpandedTasks.delete(taskId);
    } else {
      newExpandedTasks.add(taskId);
    }
    setExpandedTasks(newExpandedTasks);
  };

  // Handle opening task form for specific client
  const handleOpenTaskFormForClient = (clientGroup) => {
    // Since ProductionIncharge doesn't have task creation form,
    // we'll show a message directing to Strategy Dashboard
    showToast(`📝 To add tasks for ${clientGroup.clientName}, please use the Strategy Dashboard`, 'info', 4000);
  };

  // Handle statistics box click - filter and scroll to tasks
  const handleStatBoxClick = (filter) => {
    setTaskFilter(filter);
    // Scroll to tasks table after a short delay
    setTimeout(() => {
      if (tasksTableRef.current) {
        tasksTableRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  // Handle task selection
  const handleTaskSelection = (taskId) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  // Handle select all tasks for a client
  const handleSelectAllClientTasks = (clientTasks) => {
    const newSelected = new Set(selectedTasks);
    const allSelected = clientTasks.every(task => newSelected.has(task.id));

    if (allSelected) {
      clientTasks.forEach(task => newSelected.delete(task.id));
    } else {
      clientTasks.forEach(task => newSelected.add(task.id));
    }
    setSelectedTasks(newSelected);
  };

  // Handle bulk assignment - automatically assign to their respective departments
  const handleBulkAssign = async () => {
    if (selectedTasks.size === 0) {
      showToast('⚠️ Please select at least one task to assign', 'warning', 3000);
      return;
    }

    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      const tasksToAssign = filteredTasks.filter(task => selectedTasks.has(task.id));

      // Check if all tasks have departments assigned
      const tasksWithoutDepartment = tasksToAssign.filter(task => !task.department);
      if (tasksWithoutDepartment.length > 0) {
        showToast(`⚠️ ${tasksWithoutDepartment.length} task(s) don't have a department assigned`, 'warning', 3000);
        return;
      }

      // Assign each task to its respective department
      const assignPromises = tasksToAssign.map(task => {
        const taskRef = ref(database, `tasks/${task.id}`);
        return update(taskRef, {
          status: 'assigned-to-department',
          assignedAt: new Date().toISOString(),
          assignedBy: 'Production Incharge'
        });
      });

      await Promise.all(assignPromises);

      // Count tasks by department for the success message
      const departmentCounts = {};
      tasksToAssign.forEach(task => {
        departmentCounts[task.department] = (departmentCounts[task.department] || 0) + 1;
      });

      const departmentSummary = Object.entries(departmentCounts)
        .map(([dept, count]) => `${count} to ${dept}`)
        .join(', ');

      showToast(`✅ ${tasksToAssign.length} task(s) assigned: ${departmentSummary}`, 'success', 4000);
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Error assigning tasks:', error);
      showToast('❌ Error assigning tasks', 'error', 3000);
    }
  };

  // Handle assigning task to department
  const handleAssignToDepartment = async (taskId, taskDepartment) => {
    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      const taskRef = ref(database, `tasks/${taskId}`);
      await update(taskRef, {
        status: 'assigned-to-department',
        assignedToDept: taskDepartment,
        assignedBy: 'Production Incharge',
        assignedAt: new Date().toISOString()
      });

      const deptName = taskDepartment === 'video' ? 'Video' :
        taskDepartment === 'graphics' ? 'Graphics' :
          'Social Media';
      showToast(`✅ Task assigned to ${deptName} Department successfully!`, 'success', 3000);
    } catch (error) {
      console.error('Error assigning task:', error);
      showToast('❌ Error assigning task to department', 'error', 3000);
    }
  };



  // Handle Edit Employee
  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEditEmployeeName(employee.employeeName);
    setEditEmployeePassword(employee.password || '');
    setEditEmployeeRole(employee.role || 'employee');
    setShowEditEmployeeModal(true);
  };

  // Handle Update Employee
  const handleUpdateEmployee = async () => {
    if (!editEmployeeName.trim()) {
      showToast('Employee name is required', 'error');
      return;
    }

    try {
      const employeeRef = ref(database, `employees/${editingEmployee.id}`);
      const updateData = {
        employeeName: editEmployeeName.trim(),
        role: editEmployeeRole,
        lastUpdated: new Date().toISOString()
      };

      // Only update password if it's changed
      if (editEmployeePassword && editEmployeePassword !== editingEmployee.password) {
        updateData.password = editEmployeePassword;
      }

      await update(employeeRef, updateData);
      showToast('Employee updated successfully!', 'success');
      setShowEditEmployeeModal(false);
      setEditingEmployee(null);
      setEditEmployeeName('');
      setEditEmployeePassword('');
      setEditEmployeeRole('employee');
    } catch (error) {
      console.error('Error updating employee:', error);
      showToast('Failed to update employee', 'error');
    }
  };

  // Handle Delete Employee
  const handleDeleteEmployee = async (employee) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to PERMANENTLY delete employee "${employee.employeeName}"?\n\nThis action will remove the employee, unassign their tasks and clients. This cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      const updates = {};

      // 1. Unassign Tasks
      const empTasks = tasks.filter(t =>
        t.assignedTo === employee.id ||
        t.assignedTo === employee.email ||
        t.assignedTo === employee.employeeName ||
        t.assignedEmployee === employee.id ||
        t.assignedEmployee === employee.email ||
        t.assignedEmployee === employee.employeeName
      );

      empTasks.forEach(task => {
        updates[`tasks/${task.id}/assignedTo`] = null;
        updates[`tasks/${task.id}/assignedEmployee`] = null;
        updates[`tasks/${task.id}/assignedToEmployeeName`] = null;

        if (task.status === 'in-progress' || task.status === 'assigned-to-department') {
          updates[`tasks/${task.id}/status`] = 'pending';
        }
      });

      // 2. Unassign Clients
      const empClients = clients.filter(c =>
        c.assignedToEmployee === employee.id ||
        c.assignedToEmployee === employee.email ||
        c.assignedToEmployee === employee.employeeName ||
        c.assignedEmployee === employee.id ||
        c.assignedEmployee === employee.email ||
        c.assignedEmployee === employee.employeeName
      );

      empClients.forEach(client => {
        const basePath = client.source === 'strategy' ? 'strategyClients' : 'clients';
        updates[`${basePath}/${client.id}/assignedToEmployee`] = null;
        updates[`${basePath}/${client.id}/assignedEmployee`] = null;
        updates[`${basePath}/${client.id}/assignedToEmployeeName`] = null;
      });

      // 3. Delete Employee
      updates[`employees/${employee.id}`] = null;

      await update(ref(database), updates);
      showToast('Employee permanently deleted and data unassigned!', 'success');
    } catch (error) {
      console.error('Error deleting employee:', error);
      showToast('Failed to delete employee: ' + error.message, 'error');
    }
  };

  // Handle employee status toggle
  const handleEmployeeStatusToggle = async (employeeId, currentStatus) => {
    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const employeeRef = ref(database, `employees/${employeeId}`);
      await update(employeeRef, {
        status: newStatus,
        lastStatusUpdate: new Date().toISOString(),
        statusUpdatedBy: 'Production Incharge'
      });
      const statusText = newStatus === 'active' ? 'enabled' : 'disabled';
      showToast(`✅ Employee ${statusText} successfully!`, 'success', 3000);
    } catch (error) {
      console.error('Error updating employee status:', error);
      showToast('❌ Error updating employee status', 'error', 3000);
    }
  };

  // Get filtered employees for display
  const getFilteredEmployees = () => {
    return employees.filter(employee => {
      // Filter out deleted employees
      if (employee.deleted) return false;

      // Search filter
      if (employeeListSearch.trim()) {
        const query = employeeListSearch.toLowerCase();
        const matchesName = employee.employeeName?.toLowerCase().includes(query);
        const matchesEmail = employee.email?.toLowerCase().includes(query);
        const matchesDepartment = employee.department?.toLowerCase().includes(query);
        return matchesName || matchesEmail || matchesDepartment;
      }

      return true;
    });
  };

  // Handle adding new client
  const handleAddClient = async (e) => {
    e.preventDefault();

    console.log('handleAddClient called with data:', newClient);

    if (!database) {
      console.error('Database not available');
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    // Validate required fields
    if (!newClient.clientName || !newClient.clientName.trim()) {
      showToast('❌ Client name is required', 'error', 3000);
      return;
    }

    if (!newClient.contactNumber || newClient.contactNumber.length !== 10) {
      showToast('❌ Contact number must be exactly 10 digits', 'error', 3000);
      return;
    }

    if (!newClient.email || !newClient.email.trim()) {
      showToast('❌ Email is required', 'error', 3000);
      return;
    }

    try {
      console.log('Attempting to add client to Firebase...');
      const clientsRef = ref(database, 'clients');

      const clientData = {
        clientId: newClient.clientId,
        clientName: newClient.clientName.trim(),
        contactNumber: newClient.contactNumber,
        email: newClient.email.trim(),
        videoInstructions: newClient.videoInstructions || '',
        graphicsInstructions: newClient.graphicsInstructions || '',
        createdAt: new Date().toISOString(),
        createdBy: 'Production Incharge',
        status: 'active'
      };

      console.log('Client data to be saved:', clientData);

      const newClientRef = await push(clientsRef, clientData);
      console.log('Client added successfully with ID:', newClientRef.key);

      showToast(`✅ Client ${newClient.clientName} added successfully!`, 'success', 3000);

      // Reset form
      setNewClient({
        clientId: '',
        clientName: '',
        contactNumber: '',
        email: '',
        videoInstructions: '',
        graphicsInstructions: ''
      });
      setShowAddClientForm(false);
    } catch (error) {
      console.error('Error adding client:', error);
      console.error('Error details:', error.message, error.code);

      // Check if it's a permission error
      if (error.code === 'PERMISSION_DENIED' || error.message.includes('Permission denied')) {
        showToast('🚨 PERMISSION DENIED: Please update Firebase Database Rules. Check console for instructions.', 'error', 8000);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('🚨 FIREBASE PERMISSION ERROR');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        console.error('SOLUTION:');
        console.error('1. Go to: https://console.firebase.google.com/');
        console.error('2. Select project: dsayhadri');
        console.error('3. Click: Realtime Database → Rules tab');
        console.error('4. Replace rules with:');
        console.error('');
        console.error(JSON.stringify({
          "rules": {
            ".read": "auth != null",
            ".write": "auth != null"
          }
        }, null, 2));
        console.error('');
        console.error('5. Click PUBLISH button');
        console.error('6. Try adding client again');
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        showToast(`❌ Error adding client: ${error.message}`, 'error', 4000);
      }
    }
  };

  // Helper function to convert Excel serial date to JavaScript Date
  const excelSerialToDate = (serial) => {
    if (typeof serial !== 'number') {
      const parsedDate = new Date(serial);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
      return serial;
    }
    const excelEpoch = new Date(1900, 0, 1);
    const jsDate = new Date(excelEpoch.getTime() + (serial - 1) * 24 * 60 * 60 * 1000);
    return jsDate.toISOString().split('T')[0];
  };

  // Handle Excel file upload - NEW FORMAT (Multiple Clients Support)
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // NEW FORMAT: Skip header row and map data by column index
        // Supports multiple clients in the same Excel file
        const formattedData = jsonData.slice(1)
          .filter(row => row[0] && row[1]) // Filter out empty rows (must have Client Id and Name)
          .map((row, index) => ({
            clientId: String(row[0] || '').trim(),     // Column A: Client Id
            clientName: String(row[1] || '').trim(),   // Column B: Client Name
            ideas: row[2] || '',                       // Column C: Ideas (task name)
            content: row[3] || '',                     // Column D: Content (description)
            referenceLink: row[4] || '',               // Column E: Reference link
            specialNotes: row[5] || '',                // Column F: Special Notes
            department: String(row[6] || '').toLowerCase().trim(), // Column G: Department (video/graphics)
            type: row[7] || '',                        // Column H: Type (reel/long video/business creative/festive creative)
            postDate: row[8] ? excelSerialToDate(row[8]) : '' // Column I: Post Date
          }));

        console.log('Parsed Excel data (NEW FORMAT):', formattedData);
        console.log(`Found ${formattedData.length} tasks for ${new Set(formattedData.map(t => t.clientId)).size} unique clients`);

        // Group data by client for display
        const groupedByClient = formattedData.reduce((acc, row) => {
          const clientKey = row.clientId;
          if (!acc[clientKey]) {
            acc[clientKey] = {
              clientId: row.clientId,
              clientName: row.clientName,
              rows: []
            };
          }
          acc[clientKey].rows.push(row);
          return acc;
        }, {});

        setUploadedExcelData(Object.values(groupedByClient));
        setShowUploadedData(true);

        const uniqueClients = new Set(formattedData.map(t => t.clientName)).size;
        showToast(`✅ Excel uploaded! ${formattedData.length} task(s) from ${uniqueClients} client(s)`, 'success', 3000);
      } catch (error) {
        console.error('Error reading Excel file:', error);
        showToast('❌ Error reading Excel file. Please check the format.', 'error', 3000);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Assign tasks from uploaded Excel data - NEW FORMAT (Multiple Clients Support)
  const handleAssignExcelTasks = async () => {
    if (uploadedExcelData.length === 0) {
      showToast('❌ No data to upload', 'error', 3000);
      return;
    }

    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      const tasksRef = ref(database, 'tasks');
      const clientsRef = ref(database, 'clients');
      let successCount = 0;
      const processedClients = new Set();
      const clientsCreated = [];

      // Flatten the grouped data back to individual rows
      const allRows = uploadedExcelData.flatMap(client => client.rows);

      console.log('Processing Excel data:', allRows.length, 'rows');
      console.log('Sample row:', allRows[0]);

      for (const row of allRows) {
        const clientId = String(row.clientId || '').trim();
        const clientName = String(row.clientName || 'Unknown Client').trim();

        let selectedClient = clients.find(c =>
          c.clientName === clientName ||
          c.clientId === clientId
        );

        // If client doesn't exist, create it
        if (!selectedClient && !processedClients.has(clientId)) {
          try {
            await push(clientsRef, {
              clientId: clientId,
              clientName: clientName,
              contactNumber: '',
              email: '',
              ideas: row.ideas || '',
              content: row.content || '',
              reference: row.referenceLink || '',
              specialNotes: row.specialNotes || '',
              department: row.department || '',
              type: row.type || '',
              postDate: row.postDate || '',
              videoInstructions: '',
              graphicsInstructions: '',
              createdAt: new Date().toISOString(),
              createdBy: 'Production Department - Excel Upload',
              status: 'active',
              sentToStrategyHead: false // Explicitly mark as not sent
            });
            processedClients.add(clientId);
            clientsCreated.push(clientName);
            console.log(`✅ Created new client: ${clientName} (${clientId})`);
          } catch (clientError) {
            console.error('❌ Error creating client:', clientError);
          }
        }

        // Handle post date and deadline
        let postDateStr = row.postDate || new Date().toISOString().split('T')[0];
        let deadlineStr = postDateStr;

        try {
          const postDate = new Date(postDateStr);
          if (!isNaN(postDate.getTime())) {
            const deadline = new Date(postDate);
            deadline.setDate(deadline.getDate() - 2);
            deadlineStr = deadline.toISOString().split('T')[0];
          }
        } catch (dateError) {
          console.warn('Date parsing error:', dateError);
        }

        // Normalize department (video/graphics)
        let department = (row.department || '').toLowerCase().trim();
        if (department === 'video' || department === 'graphics') {
          // Valid department
        } else {
          department = 'graphics'; // Default
        }

        // Create task with all fields
        await push(tasksRef, {
          taskName: row.ideas || 'Untitled Task',
          projectId: 'production-excel-upload',
          projectName: 'Production Department',
          clientId: clientId,
          clientName: clientName,
          department: department,
          taskType: row.type || '', // reel, long video, business creative, festive creative, etc.
          description: row.content || '',
          specialNotes: row.specialNotes || '',
          referenceLink: row.referenceLink || '',
          postDate: postDateStr,
          deadline: deadlineStr,
          status: 'pending-production',
          approvedForCalendar: false,
          addedToCalendar: false,
          createdAt: new Date().toISOString(),
          createdBy: 'Production Department - Excel Upload'
        });
        successCount++;
      }

      // Show detailed success message
      const uniqueClients = uploadedExcelData.length;
      let message = `✅ Successfully added ${successCount} task(s) from ${uniqueClients} client(s)`;
      if (clientsCreated.length > 0) {
        message += `\n📝 New clients created: ${clientsCreated.join(', ')}`;
      }

      showToast(message, 'success', 5000);
      setUploadedExcelData([]);
      setShowUploadedData(false);
    } catch (error) {
      console.error('Error assigning tasks:', error);
      console.error('Error details:', error.message, error.stack);
      showToast(`❌ Error assigning tasks from Excel: ${error.message}`, 'error', 5000);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (taskId, newStatus) => {
    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      const taskRef = ref(database, `tasks/${taskId}`);
      const updateData = {
        status: newStatus,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Production Incharge'
      };

      // If status is changed to 'approved', add to calendar
      if (newStatus === 'approved') {
        updateData.approvedForCalendar = true;
        updateData.addedToCalendar = true;
        updateData.approvedAt = new Date().toISOString();
        updateData.approvedBy = 'Production Incharge';
      }

      await update(taskRef, updateData);

      const message = newStatus === 'approved'
        ? '✅ Task approved and added to calendar!'
        : `✅ Task status updated to ${newStatus.replace(/-/g, ' ')}`;
      showToast(message, 'success', 3000);
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('❌ Error updating task status', 'error', 3000);
    }
  };

  // Handle sending calendar to Strategy
  const handleSendCalendarToStrategy = async () => {
    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    // Get all approved tasks in calendar for the selected month
    const tasksToSend = allMonthTasks.filter(task =>
      task.addedToCalendar === true && task.status === 'approved'
    );

    if (tasksToSend.length === 0) {
      showToast('ℹ️ No approved tasks to send for this month.', 'info', 3000);
      return;
    }

    try {
      // Mark tasks as sent to Strategy and set initial status
      const updatePromises = tasksToSend.map(task => {
        const taskRef = ref(database, `tasks/${task.id}`);
        return update(taskRef, {
          sentToStrategy: true,
          sentToStrategyAt: new Date().toISOString(),
          sentToStrategyBy: 'Production Incharge',
          status: 'contact-client' // Set initial status for Strategy workflow
        });
      });

      await Promise.all(updatePromises);

      showToast(`✅ Sent ${tasksToSend.length} task(s) to Strategy Department for this month.`, 'success', 4000);
    } catch (error) {
      console.error('Error sending calendar to Strategy:', error);
      showToast('❌ Error sending calendar to Strategy', 'error', 3000);
    }
  };

  // Handle sending specific client to Strategy Head
  const handleSendClientToStrategyHead = async (clientId, clientName) => {
    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      // Find the client in the database
      const clientRef = ref(database, 'clients');
      const snapshot = await get(clientRef);

      if (!snapshot.exists()) {
        showToast('❌ No clients found in database', 'error', 3000);
        return;
      }

      const clientsData = snapshot.val();
      let clientKey = null;
      let clientData = null;

      // Find the client by clientId or clientName
      for (const [key, client] of Object.entries(clientsData)) {
        if (client.clientId === clientId || client.clientName === clientName) {
          clientKey = key;
          clientData = client;
          break;
        }
      }

      if (!clientKey || !clientData) {
        showToast('❌ Client not found in database', 'error', 3000);
        return;
      }

      // Check if already sent
      if (clientData.sentToStrategyHead === true) {
        showToast(`⚠️ ${clientName} has already been sent to Strategy Head`, 'warning', 3000);
        return;
      }

      // Get all tasks for this client
      const tasksRef = ref(database, 'tasks');
      const tasksSnapshot = await get(tasksRef);
      let clientTasks = [];

      if (tasksSnapshot.exists()) {
        const tasksData = tasksSnapshot.val();
        clientTasks = Object.entries(tasksData)
          .filter(([_, task]) =>
            (task.clientId === clientId || task.clientName === clientName) &&
            !task.deleted
          )
          .map(([key, task]) => ({ id: key, ...task }));
      }

      // Update client to mark as sent to Strategy Head
      const specificClientRef = ref(database, `clients/${clientKey}`);
      await update(specificClientRef, {
        sentToStrategyHead: true,
        sentToStrategyHeadDate: new Date().toISOString(),
        sentToStrategyHeadBy: 'Production Incharge'
      });

      // Add client to strategyHeadClients with all the new fields
      const strategyHeadClientsRef = ref(database, 'strategyHeadClients');
      await push(strategyHeadClientsRef, {
        clientId: clientData.clientId,
        clientName: clientData.clientName,
        contactNumber: clientData.contactNumber || '',
        email: clientData.email || '',
        ideas: clientData.ideas || '',
        content: clientData.content || '',
        reference: clientData.reference || '',
        specialNotes: clientData.specialNotes || '',
        department: clientData.department || '',
        type: clientData.type || '',
        postDate: clientData.postDate || '',
        videoInstructions: clientData.videoInstructions || '',
        graphicsInstructions: clientData.graphicsInstructions || '',
        sentAt: new Date().toISOString(),
        sentBy: 'Production Incharge',
        status: 'active',
        stage: 'information-gathering',
        taskCount: clientTasks.length
      });

      const taskMessage = clientTasks.length > 0 ? ` and ${clientTasks.length} task(s)` : '';
      showToast(`✅ ${clientName}${taskMessage} sent to Strategy Head successfully!`, 'success', 4000);
    } catch (error) {
      console.error('Error sending client to Strategy Head:', error);
      showToast('❌ Error sending client to Strategy Head', 'error', 3000);
    }
  };

  // Handle sending multiple selected clients to Strategy Head
  const handleSendSelectedClientsToStrategyHead = async () => {
    if (selectedClients.size === 0) {
      showToast('⚠️ Please select at least one client to send', 'warning', 3000);
      return;
    }

    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      const clientRef = ref(database, 'clients');
      const snapshot = await get(clientRef);

      if (!snapshot.exists()) {
        showToast('❌ No clients found in database', 'error', 3000);
        return;
      }

      const clientsData = snapshot.val();
      const tasksRef = ref(database, 'tasks');
      const tasksSnapshot = await get(tasksRef);

      let successCount = 0;
      let alreadySentCount = 0;
      let totalTasks = 0;
      const sentClientNames = [];

      for (const clientId of selectedClients) {
        // Find client in database by ID
        let clientKey = clientId;
        let clientData = clientsData[clientId];

        if (!clientData) {
          console.warn(`Client with ID ${clientId} not found in database`);
          continue;
        }

        // Check if already sent
        if (clientData.sentToStrategyHead === true) {
          alreadySentCount++;
          continue;
        }

        // Get tasks for this client
        let clientTasks = [];
        if (tasksSnapshot.exists()) {
          const tasksData = tasksSnapshot.val();
          clientTasks = Object.entries(tasksData)
            .filter(([_, task]) =>
              (task.clientId === clientData.clientId || task.clientName === clientData.clientName) &&
              !task.deleted
            )
            .map(([key, task]) => ({ id: key, ...task }));
        }

        // Update client
        const specificClientRef = ref(database, `clients/${clientKey}`);
        await update(specificClientRef, {
          sentToStrategyHead: true,
          sentToStrategyHeadDate: new Date().toISOString(),
          sentToStrategyHeadBy: 'Production Incharge'
        });

        // Add to strategyHeadClients with all the new fields
        const strategyHeadClientsRef = ref(database, 'strategyHeadClients');
        await push(strategyHeadClientsRef, {
          clientId: clientData.clientId,
          clientName: clientData.clientName,
          contactNumber: clientData.contactNumber || '',
          email: clientData.email || '',
          ideas: clientData.ideas || '',
          content: clientData.content || '',
          reference: clientData.reference || '',
          specialNotes: clientData.specialNotes || '',
          department: clientData.department || '',
          type: clientData.type || '',
          postDate: clientData.postDate || '',
          videoInstructions: clientData.videoInstructions || '',
          graphicsInstructions: clientData.graphicsInstructions || '',
          sentAt: new Date().toISOString(),
          sentBy: 'Production Incharge',
          status: 'active',
          stage: 'information-gathering',
          taskCount: clientTasks.length
        });

        successCount++;
        totalTasks += clientTasks.length;
        sentClientNames.push(clientData.clientName);
      }

      // Clear selection
      setSelectedClients(new Set());

      // Show result message
      if (successCount > 0) {
        const message = `✅ Sent ${successCount} client(s) with ${totalTasks} task(s) to Strategy Head!`;
        showToast(message, 'success', 5000);
      }

      if (alreadySentCount > 0) {
        showToast(`ℹ️ ${alreadySentCount} client(s) were already sent`, 'info', 3000);
      }

      if (successCount === 0 && alreadySentCount === 0) {
        showToast('❌ No clients could be sent', 'error', 3000);
      }
    } catch (error) {
      console.error('Error sending selected clients:', error);
      showToast('❌ Error sending clients to Strategy Head', 'error', 3000);
    }
  };

  // Handle client selection (select all tasks for that client)
  const handleClientSelect = (clientName, clientTasks) => {
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

  // Handle opening client tasks modal
  const handleOpenClientTasksModal = (clientGroup) => {
    // Get ALL tasks for this client from the main tasks array (not filtered by addedToCalendar)
    // This matches Strategy Dashboard behavior - show all tasks for the client
    const clientTasks = tasks.filter(task => {
      // Match by client name or client ID
      const matchesClient = task.clientName === clientGroup.clientName ||
        task.clientId === clientGroup.clientId;

      // Only show tasks for the selected month
      if (!task.postDate) return false;
      const taskMonth = task.postDate.slice(0, 7);
      const matchesMonth = taskMonth === selectedMonth;

      return matchesClient && matchesMonth;
    });

    console.log('Opening modal for client:', clientGroup.clientName);
    console.log('Client tasks found:', clientTasks.length);
    console.log('Tasks:', clientTasks);

    setSelectedClientForModal(clientGroup);
    setSelectedClientTasksForModal(clientTasks);
    setShowClientTasksModal(true);
  };

  // Handle closing client tasks modal
  const handleCloseClientTasksModal = () => {
    setShowClientTasksModal(false);
    setSelectedClientForModal(null);
    setSelectedClientTasksForModal([]);
  };

  // Handle delete client
  const handleDeleteClient = async (clientId, clientName) => {
    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    // Confirm deletion
    const confirmed = window.confirm(`Are you sure you want to delete client "${clientName}"? This will also delete all tasks associated with this client.`);
    if (!confirmed) return;

    try {
      // Find the client in the database
      const clientRef = ref(database, 'clients');
      const snapshot = await get(clientRef);

      if (snapshot.exists()) {
        const clientsData = snapshot.val();
        let clientKey = null;

        // Find the client key by clientId or clientName
        for (const [key, client] of Object.entries(clientsData)) {
          if (client.clientId === clientId || client.clientName === clientName) {
            clientKey = key;
            break;
          }
        }

        if (clientKey) {
          // Delete the client
          const specificClientRef = ref(database, `clients/${clientKey}`);
          await update(specificClientRef, { deleted: true, deletedAt: new Date().toISOString() });

          // Also delete all tasks for this client
          const tasksRef = ref(database, 'tasks');
          const tasksSnapshot = await get(tasksRef);

          if (tasksSnapshot.exists()) {
            const tasksData = tasksSnapshot.val();
            const deletePromises = [];

            for (const [taskKey, task] of Object.entries(tasksData)) {
              if (task.clientId === clientId || task.clientName === clientName) {
                const taskRef = ref(database, `tasks/${taskKey}`);
                deletePromises.push(update(taskRef, { deleted: true, deletedAt: new Date().toISOString() }));
              }
            }

            await Promise.all(deletePromises);
          }

          showToast(`✅ Client "${clientName}" and associated tasks deleted successfully!`, 'success', 3000);
        } else {
          showToast('❌ Client not found', 'error', 3000);
        }
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      showToast('❌ Error deleting client', 'error', 3000);
    }
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

  // Handle client status toggle
  const handleClientStatusToggle = async (clientId, currentStatus) => {
    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      // Find the client in the database
      const clientRef = ref(database, 'clients');
      const snapshot = await get(clientRef);
      if (snapshot.exists()) {
        const clientsData = snapshot.val();
        let clientKey = null;
        // Find the client key by clientId
        for (const [key, client] of Object.entries(clientsData)) {
          if (client.clientId === clientId) {
            clientKey = key;
            break;
          }
        }
        if (clientKey) {
          const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
          const specificClientRef = ref(database, `clients/${clientKey}`);
          await update(specificClientRef, {
            status: newStatus,
            lastStatusUpdate: new Date().toISOString(),
            statusUpdatedBy: 'Production Incharge'
          });
          const statusText = newStatus === 'active' ? 'activated' : 'deactivated';
          showToast(`✅ Client ${statusText} successfully!`, 'success', 3000);
        } else {
          showToast('❌ Client not found', 'error', 3000);
        }
      }
    } catch (error) {
      console.error('Error updating client status:', error);
      showToast('❌ Error updating client status', 'error', 3000);
    }
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
      // Get all tasks
      const allTasks = getTasksGroupedByClient().flatMap(cg => cg.tasks);

      // If no tasks selected, download ALL tasks; otherwise download only selected
      const selectedTasksData = selectedTasks.size === 0
        ? allTasks
        : allTasks.filter(task => selectedTasks.has(task.id));

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
      let yPosition = 15;

      // Company name at center
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 73, 172);
      const companyName = 'Digi Sayhadri';
      doc.text(companyName, pageWidth / 2, yPosition, { align: 'center' });

      // Date and time at top right
      const now = new Date();
      const dateTimeString = now.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const timeWidth = doc.getTextWidth(dateTimeString);
      doc.text(dateTimeString, pageWidth - timeWidth - 14, 15);

      yPosition += 10;

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 73, 172);
      doc.text('Client Tasks Report', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Report Period: ' + selectedMonth, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 12;

      // Add each client's tasks
      Object.values(groupedByClient).forEach((clientGroup) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        // Client header
        doc.setFillColor(75, 73, 172);
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

        // Tasks table using autoTable
        const tableData = clientGroup.tasks.map(task => [
          (task.taskName || 'N/A').substring(0, 40),
          (task.department || 'N/A').toUpperCase().substring(0, 15),
          task.postDate || 'N/A',
          (task.assignedTo || 'Not assigned').substring(0, 20),
          (task.status || '').replace(/-/g, ' ').toUpperCase().substring(0, 20),
          (task.description || 'No description').substring(0, 50)
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Task', 'Dept', 'Date', 'Assigned', 'Status', 'Description']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [125, 160, 250],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 8,
            textColor: 50
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          styles: {
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'wrap'
          },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
            5: { cellWidth: 30 }
          },
          margin: { left: 15, right: 15 },
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
      const filename = 'client-report-' + selectedMonth + '-' + Date.now() + '.pdf';
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

  // Download client report as Excel
  const handleDownloadExcel = () => {
    try {
      // Get all tasks
      const allTasks = getTasksGroupedByClient().flatMap(cg => cg.tasks);

      // If no tasks selected, download ALL tasks; otherwise download only selected
      const selectedTasksData = selectedTasks.size === 0
        ? allTasks
        : allTasks.filter(task => selectedTasks.has(task.id));

      if (selectedTasksData.length === 0) {
        showToast('❌ No tasks to download', 'error', 3000);
        return;
      }

      // Prepare data for Excel
      const excelData = selectedTasksData.map(task => ({
        'Client ID': task.clientId || 'N/A',
        'Client Name': task.clientName || 'N/A',
        'Task Name': task.taskName || 'Untitled Task',
        'Department': task.department || 'N/A',
        'Task Type': task.taskType || 'N/A',
        'Post Date': task.postDate || 'N/A',
        'Deadline': task.deadline || 'N/A',
        'Status': task.status ? task.status.replace(/-/g, ' ').toUpperCase() : 'N/A',
        'Assigned To': task.assignedTo || 'Not assigned',
        'Description': task.description || 'No description',
        'Reference Link': task.referenceLink || '',
        'Created At': task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 10 }, // Client ID
        { wch: 20 }, // Client Name
        { wch: 30 }, // Task Name
        { wch: 15 }, // Department
        { wch: 15 }, // Task Type
        { wch: 12 }, // Post Date
        { wch: 12 }, // Deadline
        { wch: 20 }, // Status
        { wch: 20 }, // Assigned To
        { wch: 40 }, // Description
        { wch: 30 }, // Reference Link
        { wch: 15 }  // Created At
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Client Tasks');

      // Generate filename with current date
      const filename = selectedTasks.size > 0
        ? `client-tasks-selected-${selectedMonth}-${Date.now()}.xlsx`
        : `client-tasks-all-${selectedMonth}-${Date.now()}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      const message = selectedTasks.size > 0
        ? `✅ Excel downloaded: ${selectedTasksData.length} selected task(s)`
        : `✅ Excel downloaded: all ${selectedTasksData.length} tasks`;
      showToast(message, 'success', 3000);
      setSelectedTasks(new Set());

    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('❌ Error downloading Excel file', 'error', 3000);
    }
  };

  return (
    <div className="production-dashboard">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 1500,
          background: 'white',
          border: 'none',
          borderRadius: '8px',
          width: '40px',
          height: '40px',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: '#4B49AC',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
        className="mobile-menu-button"
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1900,
            display: 'none'
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`production-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar Header */}
        <div className="production-sidebar-header">
          <div className="production-sidebar-logo">
            <div className="production-sidebar-logo-icon">
              <Calendar size={24} />
            </div>
            <div className="production-sidebar-logo-text">
              <h2>Production</h2>
              <p>Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="production-sidebar-nav">
          <div className="production-sidebar-section">
            <div className="production-sidebar-section-title">Main</div>
            <ul className="production-sidebar-menu">
              <li className="production-sidebar-menu-item">
                <button
                  className="production-sidebar-menu-link"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                  onClick={() => {
                    setShowCalendar(false);
                    setShowAddClientForm(false);
                    setShowUploadedData(false);
                    navigate('/production-incharge');
                  }}
                >
                  <div className="production-sidebar-menu-icon">
                    <LayoutDashboard size={20} />
                  </div>
                  Dashboard
                </button>
              </li>
              <li className="production-sidebar-menu-item">
                <button
                  className={`production-sidebar-menu-link ${showCalendar ? 'active' : ''}`}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                  onClick={handleShowCalendar}
                >
                  <div className="production-sidebar-menu-icon">
                    <Calendar size={20} />
                  </div>
                  {showCalendar ? 'Calendar' : 'Calendar'}
                </button>
              </li>
            </ul>
          </div>

          <div className="production-sidebar-section">
            {/* <div className="production-sidebar-section-title">Actions</div> */}
            <ul className="production-sidebar-menu">
              <li className="production-sidebar-menu-item">
                <button
                  className="production-sidebar-menu-link"
                  data-action="add-employee"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                  onClick={() => navigate('/production-incharge/add-employee')}
                >
                  <div className="production-sidebar-menu-icon">
                    <UserPlus size={20} />
                  </div>
                  Add Employee
                </button>
              </li>
              <li className="production-sidebar-menu-item">
                {/* <button
                  className="production-sidebar-menu-link"
                  data-action="add-client"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                  onClick={() => setShowAddClientForm(true)}
                >
                  <div className="production-sidebar-menu-icon">
                    <Plus size={20} />
                  </div>
                  Add Client
                </button> */}
              </li>
              <li className="production-sidebar-menu-item">
                <button
                  className="production-sidebar-menu-link"
                  data-action="view-clients"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                  onClick={() => {
                    navigate('/production-incharge/view-clients');
                  }}
                >
                  <div className="production-sidebar-menu-icon">
                    <UserPlus size={20} />
                  </div>
                  <span style={{ flex: 1 }}>
                    View Clients
                  </span>
                  {getActiveClients().length > 0 && (
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      minWidth: '24px',
                      textAlign: 'center'
                    }}>
                      {getActiveClients().length}
                    </span>
                  )}
                </button>
              </li>
              <li className="production-sidebar-menu-item">
                <button
                  className="production-sidebar-menu-link"
                  data-action="view-employees"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                  onClick={() => navigate('/production-incharge/view-employees')}
                >
                  <div className="production-sidebar-menu-icon">
                    <UserPlus size={20} />
                  </div>
                  <span style={{ flex: 1 }}>
                    All Employees
                  </span>
                  {employees.filter(emp => !emp.deleted && emp.status === 'active').length > 0 && (
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      minWidth: '24px',
                      textAlign: 'center'
                    }}>
                      {employees.filter(emp => !emp.deleted && emp.status === 'active').length}
                    </span>
                  )}
                </button>
              </li>
              <li className="production-sidebar-menu-item">
                <label
                  htmlFor="excel-upload"
                  className="production-sidebar-menu-link"
                  data-action="upload-excel"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="production-sidebar-menu-icon">
                    <Upload size={20} />
                  </div>
                  Upload Excel
                </label>
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  style={{ display: 'none' }}
                />
              </li>
            </ul>
          </div>
        </nav>

        {/* User Profile */}
        <div className="production-sidebar-user">
          <div className="production-sidebar-user-info">
            <div className="production-sidebar-user-avatar">
              P
            </div>
            <div className="production-sidebar-user-details">
              <h4>Production Manager</h4>
              <p>Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="production-btn production-btn-logout"
            style={{ marginTop: '12px', width: '100%' }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div >

      {/* Main Content */}
      < div className="production-main-content" >
        {/* Page Header */}
        < div className="production-header" >
          <div className="production-header-content">
            <div className="production-header-left">
              <div className="production-header-title">
                <h1>Production Dashboard</h1>
                <p>Monitor monthly production plan and workflow</p>
              </div>
            </div>
            <div className="production-header-right">
              <div className="production-breadcrumb">
                <span>Dashboard</span>
                <span className="production-breadcrumb-separator">/</span>
                <span>Production</span>
              </div>
              <div className="production-filter-group" style={{
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
        </div >

        {/* Uploaded Excel Data Display - Clients Not Sent to Strategy Head */}
        {
          showUploadedData && uploadedExcelData.length > 0 && (() => {
            // Flatten all rows from all clients
            const allRows = uploadedExcelData.flatMap(client => client.rows);
            const totalClients = uploadedExcelData.length;

            return (
              <div ref={uploadedDataRef} className="production-card" style={{
                background: 'white',
                borderRadius: '16px',
                padding: '0',
                marginBottom: '32px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '20px 32px',
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      📋 Clients Not Sent to Strategy Head
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
                      {totalClients} Total
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleAssignExcelTasks}
                      style={{
                        padding: '10px 20px',
                        background: 'rgba(16, 185, 129, 1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = 'rgba(5, 150, 105, 1)'}
                      onMouseOut={(e) => e.target.style.background = 'rgba(16, 185, 129, 1)'}
                    >
                      <CheckSquare size={18} />
                      Send Strategy Head
                    </button>
                    <button
                      onClick={() => {
                        setShowUploadedData(false);
                        setUploadedExcelData([]);
                      }}
                      style={{
                        padding: '10px 20px',
                        background: 'rgba(239, 68, 68, 1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = 'rgba(220, 38, 38, 1)'}
                      onMouseOut={(e) => e.target.style.background = 'rgba(239, 68, 68, 1)'}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div style={{ padding: '24px', overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#667eea', color: 'white' }}>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          CLIENT ID
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          CLIENT NAME
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          IDEAS
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          CONTENT
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          REFERENCE
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          SPECIAL NOTES
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          DEPARTMENT
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          TYPE
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          POST DATE
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((row, index) => {
                        return (
                          <tr key={index} style={{
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background-color 0.2s'
                          }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                              {row.clientId || '-'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '13px'
                                }}>
                                  {row.clientName?.charAt(0).toUpperCase() || 'C'}
                                </div>
                                <span style={{ fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                                  {row.clientName || '-'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                              {row.ideas || '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                              {row.content || '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                              {row.referenceLink ? (
                                <a href={row.referenceLink} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'none' }}>
                                  🔗 Link
                                </a>
                              ) : '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                              {row.specialNotes || '-'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: row.department?.toLowerCase() === 'video' ? '#dbeafe' : '#fce7f3',
                                color: row.department?.toLowerCase() === 'video' ? '#1e40af' : '#831843',
                                textTransform: 'lowercase'
                              }}>
                                {row.department || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                              {row.type || '-'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                              {row.postDate ? new Date(row.postDate).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  // Find the client and row index
                                  let clientIndex = -1;
                                  let rowIndex = -1;
                                  let currentRowCount = 0;

                                  for (let i = 0; i < uploadedExcelData.length; i++) {
                                    const client = uploadedExcelData[i];
                                    for (let j = 0; j < client.rows.length; j++) {
                                      if (currentRowCount === index) {
                                        clientIndex = i;
                                        rowIndex = j;
                                        break;
                                      }
                                      currentRowCount++;
                                    }
                                    if (clientIndex !== -1) break;
                                  }

                                  if (clientIndex !== -1 && rowIndex !== -1) {
                                    const rowData = uploadedExcelData[clientIndex].rows[rowIndex];
                                    setEditingRow({ clientIndex, rowIndex });
                                    setEditFormData({
                                      ideas: rowData.ideas || '',
                                      content: rowData.content || '',
                                      referenceLink: rowData.referenceLink || '',
                                      specialNotes: rowData.specialNotes || '',
                                      department: rowData.department || '',
                                      type: rowData.type || '',
                                      postDate: rowData.postDate || ''
                                    });
                                  }
                                }}
                                style={{
                                  padding: '6px 14px',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                ✏️ Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()
        }

        {/* Edit Row Modal */}
        {
          editingRow !== null && editFormData !== null && (
            <>
              {/* Modal Backdrop */}
              <div
                onClick={() => {
                  setEditingRow(null);
                  setEditFormData(null);
                }}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 10000,
                  backdropFilter: 'blur(4px)'
                }}
              />

              {/* Modal Content */}
              <div
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  zIndex: 10001,
                  maxWidth: '600px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '20px 24px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>✏️ Edit Task Details</h3>
                  <button
                    onClick={() => {
                      setEditingRow(null);
                      setEditFormData(null);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      color: 'white',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      fontWeight: 'bold'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                        Ideas
                      </label>
                      <textarea
                        value={editFormData.ideas}
                        onChange={(e) => setEditFormData({ ...editFormData, ideas: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '60px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                        Content
                      </label>
                      <textarea
                        value={editFormData.content}
                        onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '60px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                        Reference Link
                      </label>
                      <input
                        type="text"
                        value={editFormData.referenceLink}
                        onChange={(e) => setEditFormData({ ...editFormData, referenceLink: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                        Special Notes
                      </label>
                      <textarea
                        value={editFormData.specialNotes}
                        onChange={(e) => setEditFormData({ ...editFormData, specialNotes: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '60px'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                          Department
                        </label>
                        <select
                          value={editFormData.department}
                          onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">Select...</option>
                          <option value="video">Video</option>
                          <option value="graphics">Graphics</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                          Type
                        </label>
                        <input
                          type="text"
                          value={editFormData.type}
                          onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                        Post Date
                      </label>
                      <input
                        type="date"
                        value={editFormData.postDate}
                        onChange={(e) => setEditFormData({ ...editFormData, postDate: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button
                      onClick={() => {
                        const updatedData = [...uploadedExcelData];
                        updatedData[editingRow.clientIndex].rows[editingRow.rowIndex] = {
                          ...updatedData[editingRow.clientIndex].rows[editingRow.rowIndex],
                          ...editFormData
                        };
                        setUploadedExcelData(updatedData);
                        setEditingRow(null);
                        setEditFormData(null);
                        showToast('✅ Task updated successfully!', 'success');
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setEditingRow(null);
                        setEditFormData(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: '#e5e7eb',
                        color: '#374151',
                        border: 'none',
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
            </>
          )
        }

        {/* Task Assignment Form Modal */}
        {
          showTaskAssignForm && (
            <>
              {/* Modal Backdrop */}
              <div
                onClick={() => setShowTaskAssignForm(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 9998,
                  backdropFilter: 'blur(4px)'
                }}
              />

              {/* Modal Content */}
              <div
                ref={taskAssignFormRef}
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  borderRadius: '16px',
                  padding: '0',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  zIndex: 9999,
                  maxWidth: '900px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '20px 32px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🎯</span>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Production Department - Assign New Task</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTaskAssignForm(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      color: 'white',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                    onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: '32px' }}>
                  <form onSubmit={handleAssignTask} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Client Selection Section */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
                      <input
                        type="checkbox"
                        id="manualEntry"
                        checked={newTaskAssignment.useManualEntry}
                        onChange={(e) => setNewTaskAssignment({
                          ...newTaskAssignment,
                          useManualEntry: e.target.checked,
                          clientId: '',
                          clientName: ''
                        })}
                        style={{
                          cursor: 'pointer',
                          width: '18px',
                          height: '18px',
                          accentColor: '#667eea'
                        }}
                      />
                      <label htmlFor="manualEntry" style={{ fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>
                        Enter client name manually
                      </label>
                    </div>

                    {!newTaskAssignment.useManualEntry ? (
                      <>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: '600',
                            fontSize: '14px',
                            color: '#374151',
                            textAlign: 'left'
                          }}>
                            Select Client <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={newTaskAssignment.clientName}
                            onChange={(e) => {
                              const selectedClient = clients.find(c => c.clientName === e.target.value);
                              setNewTaskAssignment({
                                ...newTaskAssignment,
                                clientName: e.target.value,
                                clientId: selectedClient ? selectedClient.clientId : ''
                              });
                            }}
                            required
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px',
                              backgroundColor: 'white',
                              color: '#1f2937',
                              cursor: 'pointer',
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
                          >
                            <option value="">-- Select Client --</option>
                            {getActiveClients().map(client => (
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
                            fontWeight: '600',
                            fontSize: '14px',
                            color: '#374151',
                            textAlign: 'left'
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
                              padding: '12px 16px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px',
                              backgroundColor: '#f9fafb',
                              color: '#6b7280',
                              cursor: 'not-allowed',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#374151',
                          textAlign: 'left'
                        }}>
                          Client Name <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={newTaskAssignment.clientName}
                          onChange={(e) => setNewTaskAssignment({ ...newTaskAssignment, clientName: e.target.value })}
                          placeholder="Enter client name manually"
                          required
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
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
                    )}

                    {/* Tasks Section */}
                    <div style={{
                      marginTop: '24px',
                      padding: '20px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        marginBottom: '20px',
                        paddingBottom: '12px',
                        borderBottom: '2px solid #e5e7eb'
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#374151',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '20px' }}>📋</span>
                          Tasks ({newTaskAssignment.tasks.length})
                        </h4>
                      </div>

                      {newTaskAssignment.tasks.map((task, index) => (
                        <div
                          key={index}
                          data-task-card
                          style={{
                            backgroundColor: 'white',
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: index < newTaskAssignment.tasks.length - 1 ? '16px' : '0',
                            border: '1px solid #e5e7eb',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px'
                          }}>
                            <h5 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>
                              Task #{index + 1}
                            </h5>
                            {newTaskAssignment.tasks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newTasks = newTaskAssignment.tasks.filter((_, i) => i !== index);
                                  setNewTaskAssignment({
                                    ...newTaskAssignment,
                                    tasks: newTasks
                                  });
                                }}
                                style={{
                                  padding: '4px 8px',
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Department */}
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                color: '#374151',
                                textAlign: 'left'
                              }}>
                                Department *
                              </label>
                              <select
                                value={task.department}
                                onChange={(e) => {
                                  const newTasks = [...newTaskAssignment.tasks];
                                  newTasks[index].department = e.target.value;
                                  setNewTaskAssignment({ ...newTaskAssignment, tasks: newTasks });
                                }}
                                required
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  outline: 'none',
                                  transition: 'border-color 0.2s',
                                  textAlign: 'left',
                                  boxSizing: 'border-box',
                                  appearance: 'auto'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                              >
                                <option value="">-- Select department --</option>
                                <option value="production">Production Department</option>
                                <option value="video"> Video Department</option>
                                <option value="graphics">Graphics Department</option>
                                <option value="social-media">Social Media Department</option>
                                <option value="strategy"> Strategy Department</option>
                              </select>
                            </div>

                            {/* Task Type */}
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                color: '#374151',
                                textAlign: 'left'
                              }}>
                                Task Type *
                              </label>
                              <select
                                value={task.taskType}
                                onChange={(e) => {
                                  const newTasks = [...newTaskAssignment.tasks];
                                  newTasks[index].taskType = e.target.value;
                                  setNewTaskAssignment({ ...newTaskAssignment, tasks: newTasks });
                                }}
                                required
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  outline: 'none',
                                  transition: 'border-color 0.2s',
                                  textAlign: 'left',
                                  boxSizing: 'border-box',
                                  appearance: 'auto'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                              >
                                <option value="">-- Select task type --</option>
                                <option value="business-creative">💼 Business Creative</option>
                                <option value="festival-creative">🎉 Festival Creative</option>
                                <option value="promotional">📢 Promotional</option>
                                <option value="educational">📚 Educational</option>
                                <option value="entertainment">🎬 Entertainment</option>
                              </select>
                            </div>

                            {/* Task Name */}
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                color: '#374151',
                                textAlign: 'left'
                              }}>
                                Task Name *
                              </label>
                              <input
                                type="text"
                                value={task.taskName}
                                onChange={(e) => {
                                  const newTasks = [...newTaskAssignment.tasks];
                                  newTasks[index].taskName = e.target.value;
                                  setNewTaskAssignment({ ...newTaskAssignment, tasks: newTasks });
                                }}
                                placeholder="Enter task name"
                                required
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  outline: 'none',
                                  transition: 'border-color 0.2s',
                                  textAlign: 'left',
                                  boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                              />
                            </div>

                            {/* Description */}
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                color: '#374151',
                                textAlign: 'left'
                              }}>
                                Description
                              </label>
                              <textarea
                                value={task.description}
                                onChange={(e) => {
                                  const newTasks = [...newTaskAssignment.tasks];
                                  newTasks[index].description = e.target.value;
                                  setNewTaskAssignment({ ...newTaskAssignment, tasks: newTasks });
                                }}
                                placeholder="Enter task description"
                                rows="3"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  resize: 'vertical',
                                  outline: 'none',
                                  transition: 'border-color 0.2s',
                                  textAlign: 'left',
                                  boxSizing: 'border-box',
                                  fontFamily: 'inherit'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                              />
                            </div>

                            {/* Post Date */}
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                color: '#374151',
                                textAlign: 'left'
                              }}>
                                Post Date *
                              </label>
                              <input
                                type="date"
                                value={task.postDate}
                                onChange={(e) => {
                                  const newTasks = [...newTaskAssignment.tasks];
                                  newTasks[index].postDate = e.target.value;
                                  setNewTaskAssignment({ ...newTaskAssignment, tasks: newTasks });
                                }}
                                required
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  outline: 'none',
                                  transition: 'border-color 0.2s',
                                  textAlign: 'left',
                                  boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                              />
                            </div>

                            {/* Reference Link */}
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                color: '#374151',
                                textAlign: 'left'
                              }}>
                                Reference Link
                              </label>
                              <input
                                type="url"
                                value={task.referenceLink}
                                onChange={(e) => {
                                  const newTasks = [...newTaskAssignment.tasks];
                                  newTasks[index].referenceLink = e.target.value;
                                  setNewTaskAssignment({ ...newTaskAssignment, tasks: newTasks });
                                }}
                                placeholder="https://example.com/reference"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  outline: 'none',
                                  transition: 'border-color 0.2s',
                                  textAlign: 'left',
                                  boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add Task Button at Bottom */}
                      <div style={{
                        marginTop: '16px',
                        display: 'flex',
                        justifyContent: 'center'
                      }}>
                        <button
                          type="button"
                          onClick={() => {
                            setNewTaskAssignment({
                              ...newTaskAssignment,
                              tasks: [...newTaskAssignment.tasks, {
                                department: '',
                                taskType: '',
                                taskName: '',
                                description: '',
                                postDate: '',
                                referenceLink: ''
                              }]
                            });

                            // Scroll to the new task after it's added to the DOM
                            setTimeout(() => {
                              const taskCards = document.querySelectorAll('[data-task-card]');
                              if (taskCards.length > 0) {
                                const lastTask = taskCards[taskCards.length - 1];
                                lastTask.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center'
                                });
                              }
                            }, 100);
                          }}
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
                          <Plus size={18} />
                          Add Task
                        </button>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      marginTop: '24px',
                      paddingTop: '24px',
                      borderTop: '1px solid #f3f4f6'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setNewTaskAssignment({
                            clientId: '',
                            clientName: '',
                            useManualEntry: false,
                            tasks: [{
                              department: '',
                              taskType: '',
                              taskName: '',
                              description: '',
                              postDate: '',
                              referenceLink: ''
                            }]
                          });
                          setShowTaskAssignForm(false);
                        }}
                        style={{
                          padding: '12px 32px',
                          background: 'white',
                          color: '#6b7280',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f9fafb';
                          e.target.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'white';
                          e.target.style.borderColor = '#e5e7eb';
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        style={{
                          flex: 1,
                          padding: '12px 32px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
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
                        Assign Task
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>
          )
        }

        {/* Statistics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {/* Total Tasks */}
          <div
            onClick={() => handleStatBoxClick('all')}
            style={{
              background: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(255, 94, 98, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              border: taskFilter === 'all' ? '3px solid white' : 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Total Tasks</p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>For selected month</p>
              </div>
            </div>
          </div>

          {/* Completed Tasks */}
          <div
            onClick={() => {
              // If you want to filter by completed, you might need to update handleStatBoxClick or just use existing filters
              // For now, I'll keep it as a metric display, or filter similar to 'assigned' if appropriate
              // But the user asked for design. I will filter for 'completed' visually if possible.
              // Assuming 'completed' status exists or mapping 'assigned' to this slot if that was the intent.
              // Keeping it as 'assigned' filter for interaction but 'Completed' label for visual match?
              // Actually, let's stick to the code's data: 'assigned' tasks are 'In Progress' usually.
              // Let's strictly map to data we have. 
              // Card 2 in design is "Completed". Do we have completed tasks? 
              // Let's look for status === 'completed'.
            }}
            style={{
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(56, 239, 125, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                  {allMonthTasks.filter(t => t.status === 'completed' || t.status === 'done').length}
                </h3>
                <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Completed</p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Tasks completed</p>
              </div>
            </div>
          </div>

          {/* In Progress (Assigned) */}
          <div
            onClick={() => handleStatBoxClick('assigned')}
            style={{
              background: 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(47, 128, 237, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              border: taskFilter === 'assigned' ? '3px solid white' : 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                  {allMonthTasks.filter(t => t.status === 'assigned-to-department' || t.status === 'in-progress').length}
                </h3>
                <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>In Progress</p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Currently being worked on</p>
              </div>
            </div>
          </div>

          {/* Pending */}
          <div
            onClick={() => handleStatBoxClick('pending')}
            style={{
              background: 'linear-gradient(135deg, #EA384D 0%, #D31027 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(211, 16, 39, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              border: taskFilter === 'pending' ? '3px solid white' : 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                  {allMonthTasks.filter(t => t.status === 'approved' || t.status === 'pending-production' || t.status === 'pending').length}
                </h3>
                <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Pending</p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Awaiting action</p>
              </div>
            </div>
          </div>

          {/* Active Clients */}
          <div
            onClick={() => navigate('/production-incharge/view-clients')}
            style={{
              background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(74, 0, 224, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                  {getActiveClients().length}
                </h3>
                <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Active Clients</p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Total clients</p>
              </div>
            </div>
          </div>

          {/* Active Employees */}
          <div
            onClick={() => navigate('/production-incharge/view-employees')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(118, 75, 162, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                <User size={30} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                  {employees.filter(emp => !emp.deleted && emp.status === 'active').length}
                </h3>
                <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: '600' }}>Active Employees</p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>Across all departments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Section Modal */}
        {
          showCalendar && (
            <>
              {/* Modal Backdrop */}
              <div
                onClick={() => setShowCalendar(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 9998,
                  backdropFilter: 'blur(4px)'
                }}
              />

              {/* Modal Content */}
              <div
                ref={calendarRef}
                className="production-card"
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 9999,
                  maxWidth: '1200px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  margin: 0,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="production-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Calendar size={20} />
                    <h2 className="production-card-title">📅 Production Task Calendar</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => setShowCalendar(false)}
                      style={{
                        background: 'rgba(220, 53, 69, 0.1)',
                        border: 'none',
                        color: '#dc3545',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                      }}
                    >
                      ✕
                    </button>
                    <button
                      onClick={handleSendCalendarToStrategy}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
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
                      📤 Send to Strategy
                    </button>
                  </div>
                </div>

                <div style={{ padding: '24px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '20px',
                    marginBottom: '20px'
                  }}>
                    <button
                      onClick={() => {
                        const date = new Date(selectedMonth + '-01');
                        date.setMonth(date.getMonth() - 1);
                        setSelectedMonth(date.toISOString().slice(0, 7));
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      ← Prev
                    </button>
                    <h3 style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: '600',
                      minWidth: '180px',
                      textAlign: 'center',
                      color: '#2c3e50'
                    }}>
                      {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => {
                        const date = new Date(selectedMonth + '-01');
                        date.setMonth(date.getMonth() + 1);
                        setSelectedMonth(date.toISOString().slice(0, 7));
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      Next →
                    </button>
                  </div>

                  {/* Selected Date Tasks Display */}
                  {selectedDate && selectedDateTasks.length > 0 && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '12px',
                      color: 'white'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                      }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                          📅 Tasks for {new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </h3>
                        <button
                          onClick={() => {
                            setSelectedDate(null);
                            setSelectedDateTasks([]);
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                          onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                        >
                          ✕ Close
                        </button>
                      </div>
                      <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: 0.9 }}>
                        {selectedDateTasks.length} task{selectedDateTasks.length !== 1 ? 's' : ''} scheduled
                      </p>

                      <div style={{
                        display: 'grid',
                        gap: '12px',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        {selectedDateTasks.map((task) => (
                          <div key={task.id} style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '16px',
                            color: '#374151'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '8px'
                            }}>
                              <h4 style={{
                                margin: 0,
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#1f2937',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <span>{task.department === 'video' ? '🎥' : task.department === 'graphics' ? '🎨' : '📱'}</span>
                                {task.taskName}
                              </h4>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: (() => {
                                  const status = task.status?.toLowerCase() || '';
                                  if (status.includes('information')) return '#fef3c7';
                                  if (status.includes('contact') || status.includes('client')) return '#fef3c7';
                                  if (status.includes('pending') || status.includes('production')) return '#fef3c7';
                                  return '#f3f4f6';
                                })(),
                                color: (() => {
                                  const status = task.status?.toLowerCase() || '';
                                  if (status.includes('information')) return '#92400e';
                                  if (status.includes('contact') || status.includes('client')) return '#92400e';
                                  if (status.includes('pending') || status.includes('production')) return '#92400e';
                                  return '#6b7280';
                                })()
                              }}>
                                {task.status?.replace(/-/g, '-') || 'pending'}
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              gap: '16px',
                              fontSize: '13px',
                              color: '#6b7280'
                            }}>
                              <div>
                                <strong>Client:</strong> {task.clientName}
                              </div>
                              <div>
                                <strong>Department:</strong> <span style={{ textTransform: 'uppercase', fontWeight: '700', color: task.department === 'video' ? '#dc2626' : task.department === 'graphics' ? '#db2777' : '#059669' }}>{task.department}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '4px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    {/* Calendar Days Header */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '12px 8px',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '13px',
                        borderRadius: '8px'
                      }}>
                        {day}
                      </div>
                    ))}

                    {/* Calendar Days */}
                    {(() => {
                      const year = parseInt(selectedMonth.split('-')[0]);
                      const month = parseInt(selectedMonth.split('-')[1]) - 1;
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const days = [];
                      const today = new Date();
                      // Use local date to avoid timezone issues
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                      // Empty cells for days before month starts
                      for (let i = 0; i < firstDay; i++) {
                        days.push(<div key={`empty-${i}`} style={{ minHeight: '60px' }}></div>);
                      }

                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        // Use local date components to avoid timezone shifts
                        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = dateString === todayStr;
                        // Only show approved tasks in calendar (addedToCalendar: true)
                        const dayTasks = allMonthTasks.filter(task =>
                          task.postDate === dateString && task.addedToCalendar === true
                        );

                        days.push(
                          <div
                            key={day}
                            onClick={() => handleDateClick(dateString, dayTasks)}
                            style={{
                              background: isToday ? '#e0e7ff' : 'white',
                              borderRadius: '8px',
                              minHeight: '60px',
                              padding: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: isToday ? '700' : '500',
                              color: isToday ? '#667eea' : '#374151',
                              border: dayTasks.length > 0 ? '2px solid #10b981' : '1px solid #e5e7eb',
                              cursor: dayTasks.length > 0 ? 'pointer' : 'default',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (dayTasks.length > 0) {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <span>{day}</span>
                            {dayTasks.length > 0 && (
                              <span style={{
                                marginTop: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                color: '#10b981',
                                backgroundColor: '#d1fae5',
                                padding: '2px 6px',
                                borderRadius: '10px'
                              }}>
                                {dayTasks.length}
                              </span>
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
          )
        }

        {/* Edit Employee Modal */}
        {
          showEditEmployeeModal && (
            <>
              {/* Modal Backdrop */}
              <div
                onClick={() => {
                  setShowEditEmployeeModal(false);
                  setEditingEmployee(null);
                  setEditEmployeeName('');
                  setEditEmployeePassword('');
                  setEditEmployeeRole('employee');
                }}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 1000,
                  backdropFilter: 'blur(4px)'
                }}
              />

              {/* Modal Content */}
              <div
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  zIndex: 1001,
                  maxWidth: '500px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '20px 24px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>✏️ Edit Employee</h3>
                  <button
                    onClick={() => {
                      setShowEditEmployeeModal(false);
                      setEditingEmployee(null);
                      setEditEmployeeName('');
                      setEditEmployeePassword('');
                      setEditEmployeeRole('employee');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      color: 'white',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      fontWeight: 'bold'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Employee Name
                    </label>
                    <input
                      type="text"
                      value={editEmployeeName}
                      onChange={(e) => setEditEmployeeName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Role
                    </label>
                    <select
                      value={editEmployeeRole}
                      onChange={(e) => setEditEmployeeRole(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="employee">👤 Employee</option>
                      <option value="head">👑 Department Head</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Password (leave blank to keep current)
                    </label>
                    <input
                      type="password"
                      value={editEmployeePassword}
                      onChange={(e) => setEditEmployeePassword(e.target.value)}
                      placeholder="Enter new password or leave blank"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setShowEditEmployeeModal(false);
                        setEditingEmployee(null);
                        setEditEmployeeName('');
                        setEditEmployeePassword('');
                        setEditEmployeeRole('employee');
                      }}
                      style={{
                        padding: '10px 20px',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateEmployee}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Update Employee
                    </button>
                  </div>
                </div>
              </div>
            </>
          )
        }

        {/* Unsent Clients Table */}
        <div style={{ padding: '20px 0' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                margin: 0
              }}>
                📋 Clients Not Sent to Strategy Head
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#6b7280',
                  background: '#f3f4f6',
                  padding: '4px 12px',
                  borderRadius: '12px'
                }}>
                  {getActiveClients().filter(c => c.sentToStrategyHead !== true).length} Total
                </span>
              </h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {!showUnsentCheckboxes ? (
                  <button
                    onClick={() => setShowUnsentCheckboxes(true)}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
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
                    <CheckSquare size={16} />
                    Send Strategy Head
                  </button>
                ) : (
                  <>
                    {selectedClients.size > 0 && (
                      <button
                        onClick={handleSendSelectedClientsToStrategyHead}
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
                        <UserPlus size={16} />
                        Send Selected ({selectedClients.size})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowUnsentCheckboxes(false);
                        setSelectedClients(new Set());
                      }}
                      style={{
                        padding: '10px 20px',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#4b5563';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#6b7280';
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    {showUnsentCheckboxes && (
                      <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', width: '50px' }}>
                        <input
                          type="checkbox"
                          checked={selectedClients.size === getActiveClients().filter(c => c.sentToStrategyHead !== true && c.clientName).length && getActiveClients().filter(c => c.sentToStrategyHead !== true && c.clientName).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const unsentClients = getActiveClients().filter(c => c.sentToStrategyHead !== true && c.clientName);
                              setSelectedClients(new Set(unsentClients.map(c => c.id)));
                            } else {
                              setSelectedClients(new Set());
                            }
                          }}
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        />
                      </th>
                    )}
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600' }}>CLIENT ID</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600' }}>CLIENT NAME</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {getActiveClients()
                    .filter(c => c.sentToStrategyHead !== true)
                    .filter(c => c && c.clientName)
                    .length > 0 ? (
                    getActiveClients()
                      .filter(c => c.sentToStrategyHead !== true)
                      .filter(c => c && c.clientName)
                      .map((client, index) => (
                        <tr key={client.id || index} style={{
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
                          {showUnsentCheckboxes && (
                            <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <input
                                type="checkbox"
                                checked={selectedClients.has(client.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedClients);
                                  if (e.target.checked) {
                                    newSelected.add(client.id);
                                  } else {
                                    newSelected.delete(client.id);
                                  }
                                  setSelectedClients(newSelected);
                                }}
                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                            <span style={{ fontWeight: '600', color: '#667eea', fontSize: '14px' }}>
                              {client.clientId || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '16px'
                              }}>
                                {(client.clientName && typeof client.clientName === 'string')
                                  ? client.clientName.charAt(0).toUpperCase()
                                  : 'C'}
                              </div>
                              <span style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                                {client.clientName || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendClientToStrategyHead(client.clientId, client.clientName);
                              }}
                              style={{
                                padding: '8px 16px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                              }}
                            >
                              <UserPlus size={14} />
                              Send to Strategy
                            </button>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={showUnsentCheckboxes ? 4 : 3} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
                        <div style={{ fontSize: '16px', fontWeight: '500' }}>All clients have been sent</div>
                        <div style={{ fontSize: '14px', marginTop: '8px' }}>All clients have been sent to Strategy Head</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Tasks by Client - Only showing clients sent to Strategy Head */}
        <div ref={tasksTableRef} className="production-card">
          <div className="production-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <h2 className="production-card-title" style={{ margin: 0 }}>Assign Tasks</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {getTasksGroupedByClient().length > 0 && (
                <>
                  {selectedTasks.size > 0 && (
                    <div style={{
                      padding: '8px 16px',
                      backgroundColor: '#e0e7ff',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#4B49AC'
                    }}>
                      {selectedTasks.size} task(s) selected
                    </div>
                  )}
                  {selectedClients.size > 0 && (
                    <div style={{
                      padding: '8px 16px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#92400e'
                    }}>
                      {selectedClients.size} client(s) selected
                    </div>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    backgroundColor: 'white',
                    cursor: 'pointer',
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
                  <option value="day">📅 Today</option>
                  <option value="week">📆 This Week</option>
                  <option value="month">🗓️ This Month</option>
                </select>

                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    backgroundColor: 'white',
                    cursor: 'pointer',
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
                  <option value="all">All Departments</option>
                  <option value="video">📹 Video</option>
                  <option value="graphics">🎨 Graphics</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    backgroundColor: 'white',
                    cursor: 'pointer',
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
                  <option value="all">All Status</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="in-progress">🔄 In Progress</option>
                  <option value="completed">✅ Completed</option>
                </select>
              </div>
              <div style={{ position: 'relative' }}>
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  style={{
                    padding: '10px 40px 10px 40px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    width: '250px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#4B49AC';
                    e.target.style.boxShadow = '0 0 0 3px rgba(75, 73, 172, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {clientSearchQuery && (
                  <button
                    onClick={() => setClientSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f3f4f6';
                      e.target.style.color = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#9ca3af';
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {getTasksGroupedByClient().length > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto' }}>
                <select
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'excel-all') {
                      handleDownloadExcel();
                    } else if (value === 'pdf-all') {
                      handleDownloadReport();
                    } else if (value === 'excel-selected' || value === 'pdf-selected') {
                      setShowTasksCheckboxes(true);
                    }
                    e.target.value = ''; // Reset dropdown
                  }}
                  style={{
                    padding: '10px 16px',
                    border: '2px solid #10b981',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#059669',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s',
                    minWidth: '180px'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#059669';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">📥 Download...</option>
                  <option value="excel-all">📊 Excel - All Tasks</option>
                  <option value="pdf-all">📄 PDF - All Tasks</option>
                  <option value="excel-selected">📊 Excel - Select Tasks</option>
                  <option value="pdf-selected">📄 PDF - Select Tasks</option>
                </select>

                {showTasksCheckboxes && (
                  <>
                    {selectedTasks.size > 0 && (
                      <>
                        <button
                          onClick={handleDownloadExcel}
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
                          Excel ({selectedTasks.size})
                        </button>

                        <button
                          onClick={handleDownloadReport}
                          style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
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
                            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                          }}
                        >
                          📄 PDF ({selectedTasks.size})
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowTasksCheckboxes(false);
                        setSelectedTasks(new Set());
                      }}
                      style={{
                        padding: '10px 20px',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#4b5563';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#6b7280';
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {selectedClients.size > 0 && (
                  <button
                    onClick={handleSendSelectedClientsToStrategyHead}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                    <UserPlus size={18} />
                    Send Selected to Strategy ({selectedClients.size})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {
          getTasksGroupedByClient().length === 0 ? (
            <div className="production-empty-state">
              {clientSearchQuery.trim() ? (
                <>
                  <h3>No Clients Found</h3>
                  <p>No clients match your search "{clientSearchQuery}"</p>
                  <button
                    onClick={() => setClientSearchQuery('')}
                    style={{
                      marginTop: '16px',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
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
                    Clear Search
                  </button>
                </>
              ) : (
                <>
                  <h3>No Tasks Available</h3>
                  <p>No tasks received from Strategy Department calendar. Tasks will appear here after Strategy Department sends the calendar to Production Incharge.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="production-table-container">
                <table className="production-clients-table">
                  <thead>
                    <tr>
                      {showTasksCheckboxes && (
                        <th style={{ width: '5%', textAlign: 'center' }}>
                          <CheckSquare size={16} color="#9ca3af" />
                        </th>
                      )}
                      <th>Name</th>
                      <th>Total Tasks</th>
                      <th>In Progress</th>
                      <th>Completed</th>
                      <th>📹 Video</th>
                      <th>🎨 Graphics</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedTasks().tasks.map((clientGroup, clientIndex) => {
                      const isExpanded = expandedClients.has(clientGroup.clientName);
                      const totalTasks = clientGroup.tasks.length;
                      const completedTasks = clientGroup.tasks.filter(t =>
                        t.status === 'posted'
                      ).length;
                      const inProgressTasks = totalTasks - completedTasks;

                      // Count video and graphics tasks by extracting numbers from task names
                      const videoTasks = clientGroup.tasks
                        .filter(t => t.department === 'video')
                        .reduce((sum, task) => {
                          // Try to extract number from task name (e.g., "2 reels" -> 2)
                          const match = task.taskName?.match(/^(\d+)/);
                          return sum + (match ? parseInt(match[1]) : 1);
                        }, 0);

                      const graphicsTasks = clientGroup.tasks
                        .filter(t => t.department === 'graphics')
                        .reduce((sum, task) => {
                          // Try to extract number from task name (e.g., "2 images" -> 2)
                          const match = task.taskName?.match(/^(\d+)/);
                          return sum + (match ? parseInt(match[1]) : 1);
                        }, 0);

                      const latestTask = clientGroup.tasks.sort((a, b) => new Date(b.postDate) - new Date(a.postDate))[0];

                      // Find the client data to get sentToStrategyHeadDate
                      const clientData = clients.find(c => c.clientName === clientGroup.clientName || c.clientId === clientGroup.clientId);
                      const sentDate = clientData?.sentToStrategyHeadDate;

                      return (
                        <Fragment key={clientGroup.clientName}>
                          <tr
                            className="production-client-row"
                            style={{
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#f9fafb' : 'white',
                              transition: 'background-color 0.2s'
                            }}
                            onClick={() => toggleClientExpansion(clientGroup.clientName)}
                          >
                            {showTasksCheckboxes && (
                              <td style={{ textAlign: 'center', width: '5%' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedClients.has(clientGroup.clientName)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const newSelectedClients = new Set(selectedClients);
                                    const newSelectedTasks = new Set(selectedTasks);

                                    if (newSelectedClients.has(clientGroup.clientName)) {
                                      // Deselect client and all its tasks
                                      newSelectedClients.delete(clientGroup.clientName);
                                      clientGroup.tasks.forEach(task => {
                                        newSelectedTasks.delete(task.id);
                                      });
                                    } else {
                                      // Select client and all its tasks
                                      newSelectedClients.add(clientGroup.clientName);
                                      clientGroup.tasks.forEach(task => {
                                        newSelectedTasks.add(task.id);
                                      });
                                    }

                                    setSelectedClients(newSelectedClients);
                                    setSelectedTasks(newSelectedTasks);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#667eea' }}
                                />
                              </td>
                            )}
                            <td className="production-client-name">
                              <div className="client-name-container">
                                <div className="client-avatar">
                                  {(clientGroup.clientName && typeof clientGroup.clientName === 'string')
                                    ? clientGroup.clientName.charAt(0).toUpperCase()
                                    : '?'}
                                </div>
                                <span>{clientGroup.clientName || 'Unknown Client'}</span>
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '12px',
                                  color: '#9ca3af',
                                  transition: 'transform 0.2s',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  display: 'inline-block'
                                }}>
                                  ▼
                                </span>
                              </div>
                            </td>
                            <td className="production-client-total" style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                                fontWeight: '600',
                                fontSize: '13px'
                              }}>
                                {totalTasks}
                              </span>
                            </td>
                            <td className="production-client-progress" style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                fontWeight: '600',
                                fontSize: '13px'
                              }}>
                                {inProgressTasks}
                              </span>
                            </td>
                            <td className="production-client-completed" style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                backgroundColor: '#d1fae5',
                                color: '#065f46',
                                fontWeight: '600',
                                fontSize: '13px'
                              }}>
                                {completedTasks}
                              </span>
                            </td>
                            <td className="production-client-video" style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                fontWeight: '600',
                                fontSize: '13px'
                              }}>
                                {videoTasks}
                              </span>
                            </td>
                            <td className="production-client-graphics" style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                backgroundColor: '#fce7f3',
                                color: '#831843',
                                fontWeight: '600',
                                fontSize: '13px'
                              }}>
                                {graphicsTasks}
                              </span>
                            </td>
                            <td className="production-client-date" style={{ whiteSpace: 'nowrap' }}>
                              {sentDate ? new Date(sentDate).toLocaleDateString('en-GB') : 'N/A'}
                            </td>
                            <td className="production-client-actions" onClick={(e) => e.stopPropagation()}>
                              {clientData?.sentToStrategyHead === true ? (
                                <span style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  backgroundColor: '#d1fae5',
                                  color: '#065f46',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  ✓ Sent
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendClientToStrategyHead(clientGroup.clientId, clientGroup.clientName);
                                  }}
                                  style={{
                                    padding: '6px 16px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseOver={(e) => {
                                    e.target.style.transform = 'translateY(-2px)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                >
                                  <UserPlus size={14} />
                                  Send to Strategy
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Tasks Row */}
                          {isExpanded && (
                            <tr className="production-expanded-row">
                              <td colSpan="9" className="production-expanded-content" style={{ padding: '0', backgroundColor: '#f9fafb' }}>
                                <div style={{ padding: '16px 24px' }}>
                                  {console.log(`ProductionIncharge: Rendering expanded view for ${clientGroup.clientName}, tasks count: ${clientGroup.tasks.length}`, clientGroup.tasks)}
                                  <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                  }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', width: '3%' }}>
                                          <input
                                            type="checkbox"
                                            checked={clientGroup.tasks.every(t => selectedTasks.has(t.id))}
                                            onChange={() => handleSelectAllClientTasks(clientGroup.tasks)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                                          />
                                        </th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>IDEAS</th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>CONTENT</th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>REFERENCE LINK</th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>SPECIAL NOTES</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>DEPARTMENT</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>DATE</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>COMPLETE DATE</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>STAGE</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {clientGroup.tasks.length === 0 ? (
                                        <tr>
                                          <td colSpan="9" style={{
                                            padding: '40px',
                                            textAlign: 'center',
                                            color: '#9ca3af',
                                            fontSize: '14px'
                                          }}>
                                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                                            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No tasks found for this client</div>
                                            <div style={{ fontSize: '13px' }}>Tasks will appear here once they are added for the selected month</div>
                                          </td>
                                        </tr>
                                      ) : (
                                        clientGroup.tasks.map((task, taskIndex) => {
                                          // Different background colors for different departments
                                          const getDepartmentBg = (dept) => {
                                            if (dept === 'video') return '#eff6ff'; // Light blue
                                            if (dept === 'graphics') return '#fef3f3'; // Light pink
                                            if (dept === 'social-media') return '#f0fdf4'; // Light green
                                            if (dept === 'production') return '#f5f3ff'; // Light purple
                                            if (dept === 'strategy') return '#fffbeb'; // Light yellow
                                            return 'white';
                                          };

                                          return (
                                            <tr
                                              key={task.id}
                                              style={{
                                                borderBottom: '1px solid #f3f4f6',
                                                transition: 'background-color 0.2s',
                                                backgroundColor: getDepartmentBg(task.department),
                                                borderLeft: `4px solid ${task.department === 'video' ? '#3b82f6' : task.department === 'graphics' ? '#ec4899' : task.department === 'social-media' ? '#10b981' : task.department === 'production' ? '#7c3aed' : task.department === 'strategy' ? '#f59e0b' : 'transparent'}`
                                              }}
                                              onMouseEnter={(e) => {
                                                const hoverBg = task.department === 'video' ? '#dbeafe' :
                                                  task.department === 'graphics' ? '#fce7f3' :
                                                    task.department === 'social-media' ? '#d1fae5' :
                                                      task.department === 'production' ? '#ede9fe' :
                                                        task.department === 'strategy' ? '#fef3c7' : '#f9fafb';
                                                e.currentTarget.style.backgroundColor = hoverBg;
                                              }}
                                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = getDepartmentBg(task.department)}
                                            >
                                              <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                <input
                                                  type="checkbox"
                                                  checked={selectedTasks.has(task.id)}
                                                  onChange={() => handleTaskSelection(task.id)}
                                                  style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                                                />
                                              </td>
                                              <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                  <span style={{ fontSize: '16px' }}>
                                                    {task.department === 'video' ? '🎥' :
                                                      task.department === 'graphics' ? '🎨' :
                                                        task.department === 'social-media' ? '📱' : '📋'}
                                                  </span>
                                                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                                                    {task.taskName || 'Untitled'}
                                                  </span>
                                                </div>
                                              </td>
                                              <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280', maxWidth: '150px' }}>
                                                <div style={{
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap'
                                                }} title={task.description || ''}>
                                                  {task.description || '-'}
                                                </div>
                                              </td>
                                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                                {task.referenceLink ? (
                                                  <a
                                                    href={task.referenceLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{
                                                      color: '#667eea',
                                                      textDecoration: 'none',
                                                      fontSize: '13px',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '4px'
                                                    }}
                                                  >
                                                    🔗 {task.referenceLink.substring(0, 30)}...
                                                  </a>
                                                ) : (
                                                  <span style={{ fontSize: '13px', color: '#9ca3af' }}>-</span>
                                                )}
                                              </td>
                                              <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280', maxWidth: '120px' }}>
                                                <div style={{
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap'
                                                }} title={task.clientInstructions || ''}>
                                                  {task.clientInstructions || '-'}
                                                </div>
                                              </td>
                                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                  padding: '4px 10px',
                                                  borderRadius: '12px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  backgroundColor: task.department === 'video' ? '#dbeafe' : task.department === 'graphics' ? '#fce7f3' : '#e0e7ff',
                                                  color: task.department === 'video' ? '#1e40af' : task.department === 'graphics' ? '#831843' : '#4338ca',
                                                  textTransform: 'uppercase'
                                                }}>
                                                  {task.department || 'N/A'}
                                                </span>
                                              </td>
                                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                                                {task.postDate ? new Date(task.postDate).toLocaleDateString('en-GB') : '-'}
                                              </td>
                                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                                                {task.completedDate ? new Date(task.completedDate).toLocaleDateString('en-GB') : '-'}
                                              </td>
                                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                  padding: '6px 12px',
                                                  borderRadius: '12px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  display: 'inline-block',
                                                  backgroundColor: (() => {
                                                    switch (task.status) {
                                                      case 'pending-production': return '#fef3c7';
                                                      case 'approved': return '#dbeafe';
                                                      case 'assigned-to-department': return '#e0e7ff';
                                                      case 'in-progress': return '#fef3c7';
                                                      case 'completed': return '#d1fae5';
                                                      case 'pending-client-approval': return '#fef3c7';
                                                      case 'revision-required': return '#fee2e2';
                                                      case 'posted': return '#d1fae5';
                                                      default: return '#f3f4f6';
                                                    }
                                                  })(),
                                                  border: `1px solid ${(() => {
                                                    switch (task.status) {
                                                      case 'pending-production': return '#fde68a';
                                                      case 'approved': return '#bfdbfe';
                                                      case 'assigned-to-department': return '#c7d2fe';
                                                      case 'in-progress': return '#fde68a';
                                                      case 'completed': return '#bbf7d0';
                                                      case 'pending-client-approval': return '#fde68a';
                                                      case 'revision-required': return '#fecaca';
                                                      case 'posted': return '#bbf7d0';
                                                      default: return '#e5e7eb';
                                                    }
                                                  })()}`,
                                                  color: (() => {
                                                    switch (task.status) {
                                                      case 'pending-production': return '#92400e';
                                                      case 'approved': return '#1e40af';
                                                      case 'assigned-to-department': return '#4338ca';
                                                      case 'in-progress': return '#92400e';
                                                      case 'completed': return '#065f46';
                                                      case 'pending-client-approval': return '#92400e';
                                                      case 'revision-required': return '#991b1b';
                                                      case 'posted': return '#065f46';
                                                      default: return '#374151';
                                                    }
                                                  })()
                                                }}>
                                                  {(() => {
                                                    switch (task.status) {
                                                      case 'pending-production': return 'Pending';
                                                      case 'approved': return 'Approved';
                                                      case 'assigned-to-department': return 'Assigned';
                                                      case 'in-progress': return 'In Progress';
                                                      case 'completed': return 'Completed';
                                                      case 'pending-client-approval': return 'Client Review';
                                                      case 'revision-required': return 'Revision';
                                                      case 'posted': return 'Posted';
                                                      default: return task.status || 'Unknown';
                                                    }
                                                  })()}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {getPaginatedTasks().totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderTop: '2px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      Showing {((currentPage - 1) * tasksPerPage) + 1} to {Math.min(currentPage * tasksPerPage, getPaginatedTasks().totalTasks)} of {getPaginatedTasks().totalTasks} clients
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!getPaginatedTasks().hasPrevPage}
                        style={{
                          padding: '8px 16px',
                          background: getPaginatedTasks().hasPrevPage ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
                          color: getPaginatedTasks().hasPrevPage ? 'white' : '#9ca3af',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: getPaginatedTasks().hasPrevPage ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => {
                          if (getPaginatedTasks().hasPrevPage) {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        ← Previous
                      </button>

                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center'
                      }}>
                        {[...Array(getPaginatedTasks().totalPages)].map((_, index) => {
                          const pageNum = index + 1;
                          // Show first page, last page, current page, and pages around current
                          if (
                            pageNum === 1 ||
                            pageNum === getPaginatedTasks().totalPages ||
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                style={{
                                  padding: '8px 12px',
                                  background: currentPage === pageNum ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                                  color: currentPage === pageNum ? 'white' : '#374151',
                                  border: currentPage === pageNum ? 'none' : '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  minWidth: '40px'
                                }}
                                onMouseEnter={(e) => {
                                  if (currentPage !== pageNum) {
                                    e.target.style.borderColor = '#667eea';
                                    e.target.style.color = '#667eea';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (currentPage !== pageNum) {
                                    e.target.style.borderColor = '#e5e7eb';
                                    e.target.style.color = '#374151';
                                  }
                                }}
                              >
                                {pageNum}
                              </button>
                            );
                          } else if (
                            pageNum === currentPage - 2 ||
                            pageNum === currentPage + 2
                          ) {
                            return <span key={pageNum} style={{ color: '#9ca3af', padding: '0 4px' }}>...</span>;
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!getPaginatedTasks().hasNextPage}
                        style={{
                          padding: '8px 16px',
                          background: getPaginatedTasks().hasNextPage ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
                          color: getPaginatedTasks().hasNextPage ? 'white' : '#9ca3af',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: getPaginatedTasks().hasNextPage ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => {
                          if (getPaginatedTasks().hasNextPage) {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Mobile Card View */}
              <div className="client-card-mobile">
                {getPaginatedTasks().tasks.map((clientGroup) => {
                  const totalTasks = clientGroup.tasks.length;
                  const completedTasks = clientGroup.tasks.filter(t => t.status === 'posted').length;
                  const inProgressTasks = totalTasks - completedTasks;

                  const videoTasks = clientGroup.tasks
                    .filter(t => t.department === 'video')
                    .reduce((sum, task) => {
                      const match = task.taskName?.match(/^(\d+)/);
                      return sum + (match ? parseInt(match[1]) : 1);
                    }, 0);

                  const graphicsTasks = clientGroup.tasks
                    .filter(t => t.department === 'graphics')
                    .reduce((sum, task) => {
                      const match = task.taskName?.match(/^(\d+)/);
                      return sum + (match ? parseInt(match[1]) : 1);
                    }, 0);

                  const latestTask = clientGroup.tasks.sort((a, b) => new Date(b.postDate) - new Date(a.postDate))[0];

                  return (
                    <div key={clientGroup.clientName} className="client-task-card">
                      {/* Card Header */}
                      <div className="client-task-card-header">
                        <div className="client-task-card-info">
                          <div className="client-avatar">
                            {(clientGroup.clientName && typeof clientGroup.clientName === 'string')
                              ? clientGroup.clientName.charAt(0).toUpperCase()
                              : '?'}
                          </div>
                          <div className="client-task-card-name-section">
                            <h3 className="client-task-card-name">{clientGroup.clientName || 'Unknown Client'}</h3>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          className="client-task-card-checkbox"
                          checked={isClientFullySelected(clientGroup.tasks)}
                          onChange={() => handleClientSelect(clientGroup.clientName, clientGroup.tasks)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Card Body */}
                      <div className="client-task-card-body">
                        {/* Total Tasks */}
                        <div className="client-task-card-row">
                          <span className="client-task-card-label">Total Tasks</span>
                          <span className="client-task-card-value">{totalTasks}</span>
                        </div>

                        {/* In Progress */}
                        <div className="client-task-card-row">
                          <span className="client-task-card-label">In Progress</span>
                          <span className="client-task-stat-badge in-progress">{inProgressTasks}</span>
                        </div>

                        {/* Completed */}
                        <div className="client-task-card-row">
                          <span className="client-task-card-label">Completed</span>
                          <span className="client-task-stat-badge completed">{completedTasks}</span>
                        </div>

                        {/* Video & Graphics */}
                        <div className="client-task-card-row">
                          <span className="client-task-card-label">Tasks by Type</span>
                          <div className="client-task-card-stats">
                            <span className="client-task-stat-badge video">📹 {videoTasks}</span>
                            <span className="client-task-stat-badge graphics">🎨 {graphicsTasks}</span>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="client-task-card-row">
                          <span className="client-task-card-label">Latest Date</span>
                          <span className="client-task-card-date">
                            {latestTask ? new Date(latestTask.postDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="client-task-card-footer">
                        <button
                          className="client-task-card-btn view-btn"
                          onClick={() => toggleClientExpansion(clientGroup.clientName)}
                        >
                          {expandedClients.has(clientGroup.clientName) ? '👁️ Hide Tasks' : '👁️ View Tasks'}
                        </button>
                        <button
                          className="client-task-card-btn add-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTaskFormForClient(clientGroup);
                          }}
                        >
                          <Plus size={16} /> Add Task
                        </button>
                      </div>

                      {/* Expanded Tasks (Mobile Card View) */}
                      {expandedClients.has(clientGroup.clientName) && (
                        <div className="task-detail-card-mobile" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #e5e7eb' }}>
                          {clientGroup.tasks.map((task) => (
                            <div key={task.id} className="task-detail-card">
                              <div className="task-detail-card-header">
                                <div>
                                  <div className="task-detail-card-title">
                                    <span>📝</span>
                                    {task.taskName || 'Untitled Task'}
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  className="task-detail-card-checkbox"
                                  checked={selectedTasks.has(task.id)}
                                  onChange={() => handleTaskSelect(task.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="task-detail-card-body">
                                {/* Department */}
                                <div className="task-detail-card-row">
                                  <span className="task-detail-card-label">Department</span>
                                  <span className={`department-badge ${task.department || 'unassigned'}`}>
                                    {task.department === 'video' ? '📹 Video' :
                                      task.department === 'graphics' ? '🎨 Graphics' :
                                        task.department === 'social-media' ? '📱 Social Media' :
                                          'Unassigned'}
                                  </span>
                                </div>

                                {/* Post Date */}
                                <div className="task-detail-card-row">
                                  <span className="task-detail-card-label">Post Date</span>
                                  <span className="task-detail-card-value">
                                    {task.postDate ? new Date(task.postDate).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>

                                {/* Deadline */}
                                <div className="task-detail-card-row">
                                  <span className="task-detail-card-label">Deadline</span>
                                  <span className="task-detail-card-value">
                                    {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>

                                {/* Status */}
                                <div className="task-detail-card-row">
                                  <span className="task-detail-card-label">Status</span>
                                  <select
                                    value={task.status || 'pending-production'}
                                    onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      border: '1px solid',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.025em',
                                      backgroundColor: (() => {
                                        switch (task.status) {
                                          case 'pending-production': return '#fef3c7';
                                          case 'approved': return '#dbeafe';
                                          case 'assigned-to-department': return '#e0e7ff';
                                          case 'in-progress': return '#fef3c7';
                                          case 'completed': return '#d1fae5';
                                          case 'pending-client-approval': return '#fef3c7';
                                          case 'revision-required': return '#fee2e2';
                                          case 'posted': return '#d1fae5';
                                          default: return '#f3f4f6';
                                        }
                                      })(),
                                      borderColor: (() => {
                                        switch (task.status) {
                                          case 'pending-production': return '#fde68a';
                                          case 'approved': return '#bfdbfe';
                                          case 'assigned-to-department': return '#c7d2fe';
                                          case 'in-progress': return '#fde68a';
                                          case 'completed': return '#bbf7d0';
                                          case 'pending-client-approval': return '#fde68a';
                                          case 'revision-required': return '#fecaca';
                                          case 'posted': return '#bbf7d0';
                                          default: return '#e5e7eb';
                                        }
                                      })(),
                                      color: (() => {
                                        switch (task.status) {
                                          case 'pending-production': return '#92400e';
                                          case 'approved': return '#1e40af';
                                          case 'assigned-to-department': return '#4338ca';
                                          case 'in-progress': return '#92400e';
                                          case 'completed': return '#065f46';
                                          case 'pending-client-approval': return '#92400e';
                                          case 'revision-required': return '#991b1b';
                                          case 'posted': return '#065f46';
                                          default: return '#374151';
                                        }
                                      })()
                                    }}
                                  >
                                    <option value="pending-production">Pending Production</option>
                                    <option value="approved">Approved</option>
                                    <option value="assigned-to-department">Assigned to Department</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="pending-client-approval">Pending Client Approval</option>
                                    <option value="revision-required">Revision Required</option>
                                    <option value="posted">Posted</option>
                                  </select>
                                </div>

                                {/* Description */}
                                {task.description && (
                                  <div className="task-detail-card-description">
                                    {task.description}
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              {task.status === 'pending-production' && (
                                <div className="task-detail-card-actions">
                                  <button
                                    className="task-detail-card-btn assign-btn"
                                    onClick={() => handleStatusUpdate(task.id, 'approved')}
                                  >
                                    ✅ Approve
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Mobile Pagination Controls */}
                {getPaginatedTasks().totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '20px',
                    borderTop: '2px solid #e5e7eb',
                    backgroundColor: '#f9fafb'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      fontWeight: '500',
                      textAlign: 'center'
                    }}>
                      Page {currentPage} of {getPaginatedTasks().totalPages} ({getPaginatedTasks().totalTasks} clients)
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'center'
                    }}>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!getPaginatedTasks().hasPrevPage}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          background: getPaginatedTasks().hasPrevPage ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
                          color: getPaginatedTasks().hasPrevPage ? 'white' : '#9ca3af',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: getPaginatedTasks().hasPrevPage ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s'
                        }}
                      >
                        ← Previous
                      </button>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!getPaginatedTasks().hasNextPage}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          background: getPaginatedTasks().hasNextPage ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
                          color: getPaginatedTasks().hasNextPage ? 'white' : '#9ca3af',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: getPaginatedTasks().hasNextPage ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s'
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )
        }
      </div >



      {/* Add Client Form Modal */}
      {
        showAddClientForm && (
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
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '40px',
              maxWidth: '650px',
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>👤 Add New Client</h2>
                <button
                  onClick={() => setShowAddClientForm(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '4px'
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddClient}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Client ID *
                  </label>
                  <input
                    type="text"
                    value={newClient.clientId}
                    readOnly
                    placeholder="Auto-generated"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      color: '#6b7280',
                      cursor: 'not-allowed'
                    }}
                  />
                  <small style={{
                    display: 'block',
                    marginTop: '6px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    Auto-generated sequentially (1, 2, 3...)
                  </small>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newClient.clientName}
                    onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
                    placeholder="Enter client name"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    value={newClient.contactNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 10) {
                        setNewClient({ ...newClient, contactNumber: value });
                      }
                    }}
                    placeholder="Enter 10-digit mobile number"
                    required
                    pattern="[0-9]{10}"
                    maxLength="10"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                  <small style={{
                    display: 'block',
                    marginTop: '6px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    Must be exactly 10 digits
                  </small>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Email ID *
                  </label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="client@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Video Instructions (Optional)
                  </label>
                  <textarea
                    value={newClient.videoInstructions}
                    onChange={(e) => setNewClient({ ...newClient, videoInstructions: e.target.value })}
                    placeholder="Special instructions for video content..."
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      resize: 'vertical'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
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
                  }}>
                    Graphics Instructions (Optional)
                  </label>
                  <textarea
                    value={newClient.graphicsInstructions}
                    onChange={(e) => setNewClient({ ...newClient, graphicsInstructions: e.target.value })}
                    placeholder="Special instructions for graphics content..."
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      resize: 'vertical'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowAddClientForm(false)}
                    style={{
                      padding: '12px 24px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      color: '#6b7280',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.borderColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.borderColor = '#e5e7eb';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '12px 24px',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #4B49AC 0%, #7DA0FA 100%)',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 8px 20px rgba(75,73,172,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <Plus size={16} />
                    Add Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Date Tasks Modal */}
      {
        showDateTasksModal && (
          <div className="strategy-modal" onClick={closeDateTasksModal} style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
            <div className="strategy-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh' }}>
              <div className="strategy-modal-header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  📅 Tasks for {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  }) : ''}
                </h3>
                <button onClick={closeDateTasksModal} className="strategy-modal-close">×</button>
              </div>
              <div className="strategy-modal-body" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '16px', textAlign: 'center', color: '#667eea', fontWeight: '600', fontSize: '16px' }}>
                  {selectedDateTasks.length} task{selectedDateTasks.length > 1 ? 's' : ''} scheduled
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedDateTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        background: 'white',
                        border: '2px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '20px',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#667eea';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '24px' }}>
                          {task.department === 'video' ? '📹' : task.department === 'graphics' ? '🎨' : '📱'}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                          {task.taskName || 'Untitled Task'}
                        </h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: '#6b7280' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: '#374151' }}>Client:</span>
                          <span>{task.clientName || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: '#374151' }}>Department:</span>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: task.department === 'video' ? '#dbeafe' : task.department === 'graphics' ? '#fef3c7' : '#e0e7ff',
                            color: task.department === 'video' ? '#1e40af' : task.department === 'graphics' ? '#92400e' : '#4338ca'
                          }}>
                            {task.department === 'video' ? 'VIDEO' : task.department === 'graphics' ? 'GRAPHICS' : 'SOCIAL MEDIA'}
                          </span>
                        </div>
                        {task.description && (
                          <div style={{ display: 'flex', alignItems: 'start', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontWeight: '600', color: '#374151' }}>Description:</span>
                            <span>{task.description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Client Tasks Modal - Same as Strategy Dashboard */}
      {
        showClientTasksModal && selectedClientForModal && (
          <>
            {/* Modal Backdrop */}
            <div
              onClick={handleCloseClientTasksModal}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 9998,
                backdropFilter: 'blur(4px)'
              }}
            />

            {/* Modal Content */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                maxWidth: '1200px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                border: '1px solid #e5e7eb'
              }}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px 32px',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ClipboardList size={24} />
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                    Tasks for {selectedClientForModal.clientName}
                  </h2>
                </div>
                <button
                  onClick={handleCloseClientTasksModal}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px' }}>
                {selectedClientTasksForModal.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <p>No tasks found for this client.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>TASK NAME</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>DESCRIPTION</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>REFERENCE LINK</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>IDEA POINT</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>DEPARTMENT</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>DATE</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>COMPLETE DATE</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>STAGE</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClientTasksForModal.map(task => {
                          const stages = {
                            'pending-production': { name: 'Pending Production', color: '#fef3c7', borderColor: '#f59e0b', textColor: '#92400e' },
                            'approved': { name: 'Approved', color: '#dbeafe', borderColor: '#3b82f6', textColor: '#1e40af' },
                            'assigned-to-department': { name: 'Assigned to Department', color: '#dcfce7', borderColor: '#16a34a', textColor: '#16a34a' },
                            'in-progress': { name: 'In Progress', color: '#e0e7ff', borderColor: '#6366f1', textColor: '#4338ca' },
                            'completed': { name: 'Completed', color: '#dcfce7', borderColor: '#16a34a', textColor: '#16a34a' },
                            'pending-client-approval': { name: 'Pending Client Approval', color: '#fef3c7', borderColor: '#f59e0b', textColor: '#92400e' },
                            'revision-required': { name: 'Revision Required', color: '#fee2e2', borderColor: '#ef4444', textColor: '#991b1b' },
                            'posted': { name: 'Posted', color: '#dcfce7', borderColor: '#16a34a', textColor: '#16a34a' }
                          };
                          const stageInfo = stages[task.status] || { name: task.status || 'Unknown', color: '#f3f4f6', borderColor: '#9ca3af', textColor: '#6b7280' };

                          return (
                            <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '16px' }}>📝</span>
                                  <span style={{ fontWeight: '500', color: '#374151' }}>{task.taskName || 'Untitled Task'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.description || ''}>
                                  {task.description || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                {task.referenceLink ? (
                                  <a
                                    href={task.referenceLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#667eea', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title={task.referenceLink}
                                  >
                                    🔗 Link
                                  </a>
                                ) : (
                                  <span style={{ fontSize: '13px', color: '#9ca3af' }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'left' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.ideaPoint || ''}>
                                  {task.ideaPoint || '-'}
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
                                {task.postDate ? new Date(task.postDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                                {task.completedDate ? new Date(task.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
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
                                    style={{
                                      padding: '6px 12px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    style={{
                                      padding: '6px 12px',
                                      background: '#ef4444',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer'
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
          </>
        )
      }
    </div >
  );
};

export default ProductionIncharge;
