import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, push } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Image, LogOut, CheckCircle, XCircle, Clock, Calendar, ChevronLeft, ChevronRight, Search, Download, FileText, List, Grid, Bell, User, Users, Plus, Send, BarChart3, PieChart, TrendingUp, PlayCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import confetti from 'canvas-confetti';
import './GraphicsDashboard.css';

const GraphicsDashboard = ({ initialView = 'dashboard', isSuperAdmin = false, employeeFilter = 'all' }) => {
  const [tasks, setTasks] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStatus, setSelectedStatus] = useState('all'); // New state for selected status
  const [searchQuery, setSearchQuery] = useState(''); // New state for search
  const [selectedTasks, setSelectedTasks] = useState({}); // New state for selected tasks by client
  const [viewMode, setViewMode] = useState('list'); // New state for view mode: 'list' or 'card'
  const [selectedClientForCardView, setSelectedClientForCardView] = useState(null); // New state for selected client in card view
  const [taskAssignmentFilter, setTaskAssignmentFilter] = useState('all'); // New state for filtering by assignment: 'all', 'head', 'employee'

  // Reports section filter states
  const [reportsSearchQuery, setReportsSearchQuery] = useState(''); // Search for reports
  const [reportsEmployeeFilter, setReportsEmployeeFilter] = useState('all'); // Employee filter for reports
  const [reportsClientFilter, setReportsClientFilter] = useState('all'); // Client filter for reports
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all'); // Status filter for reports
  const [reportTimePeriod, setReportTimePeriod] = useState('month'); // 'day', 'week', 'month'
  const [expandedReportClients, setExpandedReportClients] = useState({}); // Track expanded clients in reports table
  const [selectedReportTasks, setSelectedReportTasks] = useState({}); // Track selected tasks per client in reports
  const [selectedClients, setSelectedClients] = useState([]); // Track selected clients for bulk download
  const [selectAllClientsMode, setSelectAllClientsMode] = useState(false); // Track if "Select All Clients" is active

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
  const [showAddExtraTaskModal, setShowAddExtraTaskModal] = useState(initialView === 'addExtraTask');
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false);
  const [showSocialMediaEmployeeModal, setShowSocialMediaEmployeeModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [showReports, setShowReports] = useState(initialView === 'reports');
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [selectedTaskForSending, setSelectedTaskForSending] = useState(null);
  const [showDashboardOnly, setShowDashboardOnly] = useState(true); // New state to show only dashboard cards
  const [employees, setEmployees] = useState([]); // Store ALL employees
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateTasks, setSelectedDateTasks] = useState([]);
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

  // Create ref for scrolling to tasks section
  const tasksSectionRef = useRef(null);

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

  // Function to toggle all tasks for a client
  const toggleAllTasksForClient = (clientName, clientTasks) => {
    setSelectedTasks(prev => {
      const clientTaskIds = clientTasks.map(t => t.id);
      const currentSelected = prev[clientName] || [];

      // If all are selected, deselect all; otherwise select all
      if (currentSelected.length === clientTaskIds.length) {
        return {
          ...prev,
          [clientName]: []
        };
      } else {
        return {
          ...prev,
          [clientName]: clientTaskIds
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

  // Function to handle status update
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

    // Add completion timestamp if status is completed
    if (newStatus === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    update(taskRef, updateData)
      .then(() => {
        showToast(`🎉 Task status updated to ${newStatus.replace(/-/g, ' ')}!`, 'success');

        // Trigger rocket fireworks animation when task is completed
        if (newStatus === 'completed') {
          // Create congratulations message overlay
          const congratsDiv = document.createElement('div');
          congratsDiv.innerHTML = `
            <div style="
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: linear-gradient(135deg, #e91e63 0%, #f48fb1 100%);
              color: white;
              padding: 40px 60px;
              border-radius: 20px;
              font-size: 32px;
              font-weight: bold;
              text-align: center;
              z-index: 10000;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              animation: bounceIn 0.6s ease-out;
            ">
              <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
              <div>Congratulations!</div>
              <div style="font-size: 24px; margin-top: 10px; font-weight: 500;">You completed your task!</div>
              <div style="font-size: 18px; margin-top: 15px; opacity: 0.9;">Great work! Keep it up! 💪</div>
            </div>
          `;

          // Add animation keyframes
          const style = document.createElement('style');
          style.textContent = `
            @keyframes bounceIn {
              0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
              50% { transform: translate(-50%, -50%) scale(1.05); }
              70% { transform: translate(-50%, -50%) scale(0.9); }
              100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes fadeOut {
              0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
          `;
          document.head.appendChild(style);
          document.body.appendChild(congratsDiv);

          // Remove message after 4 seconds with fade out
          setTimeout(() => {
            congratsDiv.firstElementChild.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => {
              document.body.removeChild(congratsDiv);
              document.head.removeChild(style);
            }, 500);
          }, 4000);

          // Function to play rocket launch sound using Web Audio API
          const playRocketSound = () => {
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);

              oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
              oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.5);

              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
              console.log('Audio not supported');
            }
          };

          // Function to play explosion sound using Web Audio API
          const playExplosionSound = () => {
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const bufferSize = audioContext.sampleRate * 0.5;
              const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
              const data = buffer.getChannelData(0);

              for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize / 3));
              }

              const source = audioContext.createBufferSource();
              const gainNode = audioContext.createGain();

              source.buffer = buffer;
              source.connect(gainNode);
              gainNode.connect(audioContext.destination);

              gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

              source.start();
            } catch (e) {
              console.log('Audio not supported');
            }
          };

          // Create rocket fireworks animation
          const launchRocket = () => {
            // Play rocket launch sound
            playRocketSound();

            // Rocket shooting up effect with trail
            const end = Date.now() + 800;
            const colors = ['#ff0000', '#ff7700', '#ffdd00'];

            (function frame() {
              confetti({
                particleCount: 2,
                angle: 90,
                spread: 10,
                origin: { x: 0.5, y: 1 },
                colors: colors,
                ticks: 50,
                gravity: -3,
                decay: 0.95,
                startVelocity: 50,
                scalar: 1.5,
                zIndex: 9999
              });

              if (Date.now() < end) {
                requestAnimationFrame(frame);
              }
            }());

            // Explosion at the top after delay
            setTimeout(() => {
              // Play explosion sound
              playExplosionSound();

              // Big explosion burst
              confetti({
                particleCount: 200,
                spread: 360,
                startVelocity: 60,
                origin: { x: 0.5, y: 0.2 },
                colors: ['#ff0000', '#ff7700', '#ffdd00', '#00ff00', '#0099ff', '#9933ff', '#ff1493'],
                ticks: 300,
                gravity: 1,
                scalar: 2,
                zIndex: 9999,
                shapes: ['circle', 'square']
              });

              // Multiple smaller bursts for crackling effect
              for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                  confetti({
                    particleCount: 50,
                    spread: 360,
                    startVelocity: 35,
                    origin: {
                      x: Math.random() * 0.6 + 0.2,
                      y: Math.random() * 0.3 + 0.1
                    },
                    colors: ['#ff0000', '#ff7700', '#ffdd00', '#00ff00', '#0099ff', '#9933ff'],
                    ticks: 200,
                    gravity: 1.2,
                    scalar: 1.5,
                    zIndex: 9999
                  });
                }, i * 200);
              }
            }, 800);
          };

          // Launch multiple rockets
          launchRocket();
          setTimeout(launchRocket, 1000);
          setTimeout(launchRocket, 2000);
        }
      })
      .catch((error) => {
        console.error('Error updating status:', error);
        showToast('Failed to update status', 'error');
      });
  };

  // Function to handle statistic box click
  const handleStatBoxClick = (status) => {
    setSelectedStatus(status);

    // Scroll to tasks section
    setTimeout(() => {
      if (tasksSectionRef.current) {
        tasksSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  // Function to get tasks based on selected status
  const getFilteredTasksByStatus = () => {
    if (selectedStatus === 'all') {
      return filteredTasks;
    } else if (selectedStatus === 'total') {
      return filteredTasks;
    } else if (selectedStatus === 'in-progress') {
      return filteredTasks.filter(t => t.status === 'assigned' || t.status === 'in-progress');
    } else if (selectedStatus === 'pending-approval') {
      return filteredTasks.filter(t => t.status === 'pending-client-approval');
    } else if (selectedStatus === 'completed') {
      return filteredTasks.filter(t => t.status === 'completed');
    } else if (selectedStatus === 'approved') {
      return filteredTasks.filter(t => t.status === 'approved' || t.status === 'posted');
    }

    return filteredTasks;
  };

  // Load logged-in user info from sessionStorage
  useEffect(() => {
    const employeeName = sessionStorage.getItem('employeeName');
    const employeeDataStr = sessionStorage.getItem('employeeData');

    if (employeeName) {
      setLoggedInUserName(employeeName);
      console.log('GraphicsDashboard - Logged in user:', employeeName);
    }

    if (employeeDataStr) {
      try {
        const employeeData = JSON.parse(employeeDataStr);
        if (employeeData.email) {
          setLoggedInUserEmail(employeeData.email);
          console.log('GraphicsDashboard - User email:', employeeData.email);
        }
      } catch (error) {
        console.error('Error parsing employee data:', error);
      }
    }
  }, []);

  // Handle initialView prop changes
  useEffect(() => {
    setShowCalendar(initialView === 'calendar');
    setShowMyTasks(initialView === 'myTasks');
    setShowEmployeeTasks(initialView === 'employeeTasks');
    setShowAllTasks(initialView === 'allTasks');
    setShowExtraTasks(initialView === 'extraTasks');
    setShowReports(initialView === 'reports');
    setShowAddExtraTaskModal(initialView === 'addExtraTask');

    // Set showDashboardOnly to false when any view other than dashboard is active
    if (initialView !== 'dashboard') {
      setShowDashboardOnly(false);
    } else {
      setShowDashboardOnly(true);
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

          // Show tasks assigned by Production Incharge, Strategy Department, Graphics Head, or Social Media
          const isAssignedByAuthorized =
            task.assignedBy === 'Production Incharge' ||
            task.assignedBy === 'Strategy Department' ||
            task.assignedBy === 'Graphics Head' ||
            task.assignedBy === 'Super Admin' || // Added Super Admin
            task.assignedFromSocialMedia === true || // Tasks from Social Media Dashboard
            (task.assignedBy && task.assignedBy.includes('Social Media')); // Social Media employees
          const isGraphicsTask = task.department === 'graphics' || task.assignedToDept === 'graphics';
          const isOfficiallyAssigned = task.status === 'assigned-to-department' ||
            task.status === 'assigned' ||
            task.status === 'in-progress' ||
            task.status === 'completed' ||
            task.status === 'pending-client-approval' ||
            task.status === 'approved' ||
            task.status === 'posted' ||
            task.status === 'revision-required' ||
            task.status === 'pending';

          return isAssignedByAuthorized && isGraphicsTask && isOfficiallyAssigned;
        });

        console.log('All tasks:', allTasks.length);
        console.log('Graphics tasks (active clients only):', tasksList.length);
        console.log('Graphics tasks details:', tasksList);
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
        console.log('All employees loaded:', employeesList);

        // Security Check: functionality to ensure deleted/inactive users are logged out
        if (loggedInUserEmail && !isSuperAdmin) {
          // Skip check for hardcoded/system accounts that might not be in DB
          if (loggedInUserEmail !== 'graphics@gmail.com') {
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
            client.status !== 'disabled' &&
            client.deleted !== true
          ); // Hide inactive, disabled, and deleted clients
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

    // Ensure department is set to graphics (preserve existing or set new)
    if (!currentTask?.department) {
      updateData.department = 'graphics';
    }

    // Set originalDepartment if not already set
    if (!currentTask?.originalDepartment) {
      updateData.originalDepartment = 'graphics';
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

  const getStatusIcon = (status) => {
    if (status === 'posted') return <CheckCircle size={18} color="green" />;
    if (status === 'approved') return <CheckCircle size={18} color="green" />;
    if (status === 'completed') return <CheckCircle size={18} color="blue" />;
    if (status === 'revision-required') return <XCircle size={18} color="red" />;
    return <Clock size={18} color="orange" />;
  };

  const filteredTasks = tasks.filter(task => {
    const taskDate = task.deadline || task.postDate;
    const monthMatch = taskDate && taskDate.startsWith(selectedMonth);

    // Check if task belongs to graphics department
    const isGraphicsDepartment = task.department === 'graphics' || task.originalDepartment === 'graphics';

    // Apply sidebar filter
    let myTasksMatch = true;
    if (showMyTasks) {
      // Show tasks assigned to logged-in Graphics Head specifically
      // Must have assignedTo field set and match logged-in user
      myTasksMatch = task.assignedTo &&
        task.assignedTo !== '' &&
        task.assignedTo !== 'Not Assigned' &&
        (task.assignedTo === loggedInUserName || task.assignedTo === 'Graphics Head');
    } else if (showEmployeeTasks) {
      // Show tasks assigned to employees only (not to any head)
      myTasksMatch = task.assignedTo &&
        task.assignedTo !== '' &&
        task.assignedTo !== 'Not Assigned' &&
        task.assignedTo !== loggedInUserName &&
        task.assignedTo !== 'Graphics Head';
    } else if (showAllTasks) {
      // Show all graphics department tasks (including extra tasks)
      myTasksMatch = true;
    } else if (showExtraTasks) {
      // Show only extra tasks (tasks added via Add Extra Task feature OR assigned from Social Media Dashboard)
      myTasksMatch = task.assignedBy === 'Graphics Head' ||
        task.assignedBy === loggedInUserName ||
        task.assignedBy === 'Video Head' ||
        task.assignedBy === 'Social Media Head' ||
        (task.assignedBy && task.assignedBy.includes('Social Media')) || // Social Media employees
        task.assignedFromSocialMedia === true; // Flag for tasks from social media
      if (myTasksMatch) {
        console.log('Extra task found:', task.taskName, 'assignedBy:', task.assignedBy, 'department:', task.department);
      }
    } else {
      // Default view - show only graphics department tasks
      myTasksMatch = isGraphicsDepartment;
    }

    // Apply SuperAdmin employee filter (only when in SuperAdmin context)
    let employeeFilterMatch = true;
    if (isSuperAdmin && employeeFilter !== 'all') {
      employeeFilterMatch = task.assignedTo === employeeFilter;
    }

    // For Extra Tasks, don't require department match (they can be from other departments)
    const departmentMatch = showExtraTasks ? true : isGraphicsDepartment;

    return monthMatch && myTasksMatch && employeeFilterMatch && departmentMatch;
  });

  const statusFilteredTasks = getFilteredTasksByStatus();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
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

  // Handle Add Extra Task form submission
  const handleAddExtraTask = () => {
    // Validation
    if (!newTask.clientName || !newTask.ideas || !newTask.department || !newTask.taskType || !newTask.postDate) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const tasksRef = ref(database, 'tasks');
      push(tasksRef, {
        clientName: newTask.clientName,
        clientId: newTask.clientId || newTask.clientName,
        taskName: newTask.ideas,
        taskDescription: newTask.content || '',
        referenceLink: newTask.referenceLink || '',
        specialNotes: newTask.specialNotes || '',
        department: newTask.department,
        taskType: newTask.taskType,
        postDate: newTask.postDate,
        deadline: newTask.postDate,
        status: 'pending',
        assignedTo: '', // Empty - not assigned to anyone initially
        assignedBy: loggedInUserName || 'Graphics Head',
        createdAt: new Date().toISOString()
      });

      showToast('Extra task added successfully!', 'success');
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

      // Automatically switch to Extra Tasks view to show the newly added task
      setShowExtraTasks(true);
      setShowMyTasks(false);
      setShowEmployeeTasks(false);
      setShowAllTasks(false);

      // Scroll to tasks section after a short delay
      setTimeout(() => {
        const tasksSection = document.querySelector('.strategy-tasks-card');
        if (tasksSection) {
          tasksSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 300);
    } catch (error) {
      console.error('Error adding extra task:', error);
      showToast('Failed to add task', 'error');
    }
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
      submittedBy: 'Graphics Head',
      department: 'social-media',
      socialMediaAssignedTo: selectedEmployee,
      originalDepartment: 'graphics',
      lastUpdated: new Date().toISOString(),
      revisionMessage: null
    };

    update(taskRef, updateData);
    showToast(`✅ Task sent to ${selectedEmployee} for client approval!`, 'success');
    setShowSocialMediaEmployeeModal(false);
    setSelectedTaskForSending(null);
  };

  // Format date safely
  const formatDateSafe = (date) => {
    try {
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Date formatting error:', error);
      return '';
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

  // Function to get status display text
  const getStatusDisplayText = () => {
    switch (selectedStatus) {
      case 'total': return 'All Tasks';
      case 'in-progress': return 'In Progress Tasks';
      case 'pending-approval': return 'Pending Approval Tasks';
      case 'completed': return 'Completed Tasks';
      case 'approved': return 'Posted/Approved Tasks';
      default: return 'Graphics Tasks';
    }
  };

  // Function to filter tasks by search query and assignment
  const getSearchFilteredTasks = () => {
    let filtered = statusFilteredTasks;

    // Apply assignment filter
    if (taskAssignmentFilter === 'head') {
      // Show only tasks assigned to Graphics Head or logged-in user (if they are the head)
      filtered = filtered.filter(task =>
        task.assignedTo === 'Graphics Head' ||
        task.assignedTo === loggedInUserName
      );
    } else if (taskAssignmentFilter === 'employee') {
      // Show only tasks assigned to employees (not heads)
      filtered = filtered.filter(task =>
        task.assignedTo &&
        task.assignedTo !== '' &&
        task.assignedTo !== 'Not Assigned' &&
        task.assignedTo !== 'Graphics Head' &&
        task.assignedTo !== loggedInUserName
      );
    }

    // Apply search filter
    if (!searchQuery.trim()) {
      return filtered;
    }

    const query = searchQuery.toLowerCase();
    return filtered.filter(task => {
      return (
        task.clientName?.toLowerCase().includes(query) ||
        task.clientId?.toLowerCase().includes(query) ||
        task.taskName?.toLowerCase().includes(query) ||
        task.projectName?.toLowerCase().includes(query)
      );
    });
  };

  // Function to filter reports data based on search and filters
  const getReportsFilteredTasks = () => {
    let filtered = filteredTasks;

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

  // Function to download work report for a specific client
  const downloadClientReport = (clientName, clientTasks, selectedOnly = false) => {
    // Filter tasks if selectedOnly is true
    const tasksToDownload = selectedOnly
      ? clientTasks.filter(task => isTaskSelected(clientName, task.id))
      : clientTasks;

    if (tasksToDownload.length === 0) {
      showToast('Please select at least one task to download', 'warning');
      return;
    }
    // Prepare report data
    const reportData = {
      clientName: clientName,
      reportDate: new Date().toLocaleDateString(),
      month: new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalTasks: tasksToDownload.length,
      completedTasks: tasksToDownload.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length,
      inProgressTasks: tasksToDownload.filter(t => t.status === 'in-progress').length,
      pendingApprovalTasks: tasksToDownload.filter(t => t.status === 'pending-client-approval').length,
      tasks: tasksToDownload.map(task => ({
        taskName: task.taskName,
        projectName: task.projectName,
        status: task.status,
        deadline: task.deadline,
        assignedTo: task.assignedTo || 'Not Assigned',
        revisionCount: task.revisionCount || 0,
        createdAt: task.createdAt,
        completedAt: task.completedAt || 'N/A'
      }))
    };

    // Create PDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Graphics Department Work Report', 14, 20);

    // Client Info
    doc.setFontSize(12);
    doc.text(`Client: ${clientName}`, 14, 30);
    doc.text(`Report Generated: ${reportData.reportDate}`, 14, 37);
    doc.text(`Period: ${reportData.month}`, 14, 44);

    if (selectedOnly) {
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text(`Selected Tasks: ${tasksToDownload.length} of ${clientTasks.length}`, 14, 51);
    }

    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(14, selectedOnly ? 56 : 50, 182, 30, 'F');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text('Summary:', 18, selectedOnly ? 64 : 58);
    doc.text(`Total Tasks: ${reportData.totalTasks}`, 18, selectedOnly ? 71 : 65);
    doc.text(`Completed: ${reportData.completedTasks}`, 70, selectedOnly ? 71 : 65);
    doc.text(`In Progress: ${reportData.inProgressTasks}`, 122, selectedOnly ? 71 : 65);
    doc.text(`Pending Approval: ${reportData.pendingApprovalTasks}`, 18, selectedOnly ? 78 : 72);

    // Task Details Table
    doc.setTextColor(40, 40, 40);
    doc.text('Task Details:', 14, selectedOnly ? 96 : 90);

    const tableData = reportData.tasks.map(task => [
      task.taskName,
      task.projectName,
      task.status.replace(/-/g, ' '),
      new Date(task.deadline).toLocaleDateString(),
      task.assignedTo,
      task.revisionCount
    ]);

    autoTable(doc, {
      startY: selectedOnly ? 101 : 95,
      head: [['Task Name', 'Project', 'Status', 'Deadline', 'Assigned To', 'Revisions']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [116, 185, 255], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 },
        5: { cellWidth: 20 }
      }
    });

    const filename = selectedOnly
      ? `${clientName.replace(/\s+/g, '_')}_Selected_Tasks_${selectedMonth}.pdf`
      : `${clientName.replace(/\s+/g, '_')}_Graphics_Report_${selectedMonth}.pdf`;

    doc.save(filename);

    showToast(`PDF report downloaded for ${clientName}${selectedOnly ? ` (${tasksToDownload.length} tasks)` : ''}!`, 'success');
  };

  // Download Graphics Department Report as PDF with client-wise data
  const downloadGraphicsDepartmentReportAsPDF = () => {
    const [year, month] = selectedMonth.split('-');
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    // Count unique clients
    const uniqueClients = new Set(filteredTasks.map(t => t.clientName || 'Unknown')).size;

    // Count employees (assuming from tasks)
    const uniqueEmployees = new Set(filteredTasks.filter(t => t.assignedTo && t.assignedTo !== 'Not Assigned').map(t => t.assignedTo)).size;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>All Clients Report - ${monthName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 32px; font-weight: bold; margin: 0 0 5px 0; }
          .header .datetime { font-size: 14px; color: #666; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin: 30px 0 10px 0; }
          .generated { font-size: 14px; color: #666; margin-bottom: 30px; }
          .summary { margin: 20px 0; }
          .summary h3 { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .summary p { margin: 5px 0; font-size: 14px; }
          .total-clients { font-size: 18px; font-weight: bold; margin: 20px 0; }
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

        <div class="title">All Clients Report</div>
        <div class="generated">Generated: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>

        <div class="summary">
          <h3>Department Summary:</h3>
          <p>Graphics: ${uniqueEmployees} employees, ${filteredTasks.length} tasks</p>
        </div>

        <div class="total-clients">Total Clients: ${uniqueClients}</div>

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
            ${filteredTasks.map(task => {
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
    showToast('PDF report generated successfully!', 'success');
    setShowDownloadOptions(false);
  };

  // Download Graphics Department Report as Excel with client-wise data
  const downloadGraphicsDepartmentReportAsExcel = () => {
    const [year, month] = selectedMonth.split('-');
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Group tasks by client
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
    let csvContent = `Graphics Department Report - ${monthName}\n\n`;

    // Summary Stats
    csvContent += `Summary Statistics\n`;
    csvContent += `Total Tasks,${filteredTasks.length}\n`;
    csvContent += `Completed,${filteredTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length}\n`;
    csvContent += `In Progress,${filteredTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length}\n`;
    csvContent += `Pending,${filteredTasks.filter(t => t.status === 'pending-client-approval').length}\n\n`;

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
    filteredTasks.forEach(task => {
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
    link.download = `graphics-department-report-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Excel report downloaded successfully!', 'success');
    setShowDownloadOptions(false);
  };

  // Download Individual Client Report as PDF for Graphics
  const downloadIndividualGraphicsClientReport = (clientData) => {
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    // Get all tasks for this client
    const clientTasks = filteredTasks.filter(task => task.clientName === clientData.clientName);
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

  // Function to download all clients report
  const downloadAllClientsReport = () => {
    const groupedTasks = groupTasksByClient(getSearchFilteredTasks());
    const reportDate = new Date().toLocaleDateString();
    const period = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Create PDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Graphics Department - All Clients Report', 14, 20);

    // Report Info
    doc.setFontSize(11);
    doc.text(`Report Generated: ${reportDate}`, 14, 30);
    doc.text(`Period: ${period}`, 14, 37);

    let yPosition = 50;

    Object.entries(groupedTasks).forEach(([clientName, clientTasks], index) => {
      const completed = clientTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
      const inProgress = clientTasks.filter(t => t.status === 'in-progress').length;

      // Add new page if needed
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Client Header
      doc.setFillColor(116, 185, 255);
      doc.rect(14, yPosition, 182, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(`Client: ${clientName}`, 18, yPosition + 6);

      yPosition += 12;

      // Client Summary
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.text(`Total: ${clientTasks.length} | Completed: ${completed} | In Progress: ${inProgress}`, 18, yPosition);

      yPosition += 8;

      // Task Table
      const tableData = clientTasks.map(task => [
        task.taskName.substring(0, 25),
        task.projectName.substring(0, 20),
        task.status.replace(/-/g, ' ').substring(0, 15),
        new Date(task.deadline).toLocaleDateString(),
        (task.assignedTo || 'Not Assigned').substring(0, 15),
        task.revisionCount || 0
      ]);

      const tableResult = autoTable(doc, {
        startY: yPosition,
        head: [['Task', 'Project', 'Status', 'Deadline', 'Assigned', 'Rev']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [74, 185, 255], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 35 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 15 }
        },
        margin: { left: 14, right: 14 }
      });

      // Get the final Y position after the table
      yPosition = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : yPosition + 50;
    });

    doc.save(`All_Clients_Graphics_Report_${selectedMonth}.pdf`);

    showToast('PDF report downloaded for all clients!', 'success');
  };

  // Function to download multiple clients' tasks as PDF
  const downloadMultipleClientsPDF = (tasks) => {
    if (tasks.length === 0) {
      showToast('No tasks to download', 'warning');
      return;
    }

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
        <title>Employee Report</title>
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

        <div class="title">Graphics Department</div>
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

    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

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
    let csvContent = `Client Report\n`;
    csvContent += `Digi Sayhadri,${currentDateTime}\n`;
    csvContent += `Total Clients: ${Object.keys(tasksByClient).length} | Total Tasks: ${tasks.length}\n\n`;

    // Add data for each client
    Object.entries(tasksByClient).forEach(([clientName, clientTasks]) => {
      const completed = clientTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
      const inProgress = clientTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length;
      const pending = clientTasks.filter(t => t.status === 'pending-client-approval').length;

      csvContent += `\nClient: ${clientName}\n`;
      csvContent += `Total Tasks: ${clientTasks.length} | Completed: ${completed} | In Progress: ${inProgress} | Pending: ${pending}\n`;
      csvContent += `Task Name,Department,Post Date,Assigned Employee,Status\n`;

      clientTasks.forEach(task => {
        let taskPostDate = 'N/A';
        if (task.postDate) {
          const date = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
          taskPostDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        }

        csvContent += `"${task.taskName || 'N/A'}","${task.department || 'N/A'}","${taskPostDate}","${task.assignedTo || 'Unassigned'}","${task.status?.replace(/-/g, ' ') || 'N/A'}"\n`;
      });
      csvContent += `\n`;
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `client_report_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast(`Excel file downloaded for ${Object.keys(tasksByClient).length} client(s) with ${tasks.length} task(s)`, 'success');
  };

  // Function to download selected tasks as PDF
  const downloadSelectedTasksPDF = (clientName, selectedTasks) => {
    if (selectedTasks.length === 0) {
      showToast('Please select at least one task', 'warning');
      return;
    }

    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentDateTime = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Selected Tasks - ${clientName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 32px; font-weight: bold; margin: 0 0 5px 0; }
          .header .datetime { font-size: 14px; color: #666; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin: 30px 0 10px 0; }
          .generated { font-size: 14px; color: #666; margin-bottom: 30px; }
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

        <div class="title">Selected Tasks Report - ${clientName}</div>
        <div class="generated">Generated: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>

        <div class="summary">
          <h3>Summary:</h3>
          <p>Total Selected Tasks: ${selectedTasks.length}</p>
          <p>Completed: ${selectedTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length}</p>
          <p>In Progress: ${selectedTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length}</p>
          <p>Pending: ${selectedTasks.filter(t => t.status === 'pending-client-approval').length}</p>
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
            ${selectedTasks.map(task => {
      let statusText = task.status?.replace(/-/g, ' ') || 'N/A';
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

      return `
                <tr>
                  <td>${task.taskName || 'N/A'}</td>
                  <td>${task.department || 'N/A'}</td>
                  <td>${taskPostDate}</td>
                  <td>${taskDeadline}</td>
                  <td>${statusText}</td>
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
    showToast(`PDF generated for ${selectedTasks.length} selected task(s)`, 'success');
  };

  // Function to download selected tasks as Excel
  const downloadSelectedTasksExcel = (clientName, selectedTasks) => {
    if (selectedTasks.length === 0) {
      showToast('Please select at least one task', 'warning');
      return;
    }

    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Prepare CSV content
    let csvContent = `Selected Tasks Report - ${clientName}\n`;
    csvContent += `Generated: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}\n\n`;

    // Summary
    csvContent += `Summary\n`;
    csvContent += `Total Selected Tasks,${selectedTasks.length}\n`;
    csvContent += `Completed,${selectedTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length}\n`;
    csvContent += `In Progress,${selectedTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length}\n`;
    csvContent += `Pending,${selectedTasks.filter(t => t.status === 'pending-client-approval').length}\n\n`;

    // Tasks Detail
    csvContent += `Task Details\n`;
    csvContent += `Task Name,Department,Post Date,Deadline,Status\n`;
    selectedTasks.forEach(task => {
      let statusText = task.status?.replace(/-/g, ' ') || 'N/A';
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

      csvContent += `"${task.taskName || 'N/A'}","${task.department || 'N/A'}","${taskPostDate}","${taskDeadline}","${statusText}"\n`;
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clientName.replace(/\s+/g, '_')}_selected_tasks_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast(`Excel file downloaded for ${selectedTasks.length} selected task(s)`, 'success');
  };

  // Function to download single task report
  const downloadSingleTaskReport = (task) => {
    const reportDate = new Date().toLocaleDateString();

    // Create PDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Graphics Department - Task Report', 14, 20);

    // Report Info
    doc.setFontSize(11);
    doc.text(`Report Generated: ${reportDate}`, 14, 30);
    doc.text(`Task ID: ${task.id}`, 14, 37);

    // Task Details Box
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 45, 182, 90, 'F');

    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text('Task Details:', 18, 53);

    doc.setFontSize(10);
    let yPos = 62;
    const details = [
      ['Task Name:', task.taskName],
      ['Client:', task.clientName],
      ['Client ID:', task.clientId || 'N/A'],
      ['Project:', task.projectName],
      ['Department:', task.department],
      ['Status:', task.status.replace(/-/g, ' ')],
      ['Deadline:', new Date(task.deadline).toLocaleDateString()],
      ['Assigned To:', task.assignedTo || 'Not Assigned'],
      ['Revision Count:', task.revisionCount || 0],
      ['Created At:', task.createdAt || 'N/A'],
      ['Last Updated:', task.lastUpdated || 'N/A'],
      ['Completed At:', task.completedAt || 'N/A']
    ];

    details.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, 18, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), 60, yPos);
      yPos += 7;
    });

    // Description
    if (task.description) {
      yPos += 5;
      doc.setFont(undefined, 'bold');
      doc.text('Description:', 18, yPos);
      yPos += 7;
      doc.setFont(undefined, 'normal');
      const splitDescription = doc.splitTextToSize(task.description, 170);
      doc.text(splitDescription, 18, yPos);
      yPos += splitDescription.length * 7;
    }

    // Revision Info
    if (task.revisionCount > 0 && task.lastRevisionAt) {
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.text('Last Revision:', 18, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(task.lastRevisionAt, 60, yPos);
    }

    doc.save(`Task_${task.taskName.replace(/\s+/g, '_')}_${task.id}.pdf`);

    showToast(`PDF task report downloaded: ${task.taskName}`, 'success');
  };

  return (
    <div className="dashboard">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar Navigation */}
      <div className="strategy-sidebar">
        <div className="strategy-sidebar-header">
          <div className="strategy-sidebar-logo">
            <div className="strategy-sidebar-logo-icon">
              <Image size={24} />
            </div>
            <div className="strategy-sidebar-logo-text">
              <h2>Graphics</h2>
              <p>Department</p>
            </div>
          </div>
        </div>

        <nav className="strategy-sidebar-nav">
          <div className="strategy-sidebar-section">
            <h3 className="strategy-sidebar-section-title">Main</h3>
            <ul className="strategy-sidebar-menu">
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowDashboardOnly(true);
                    setShowCalendar(false);
                    setShowReports(false);
                    setShowMyTasks(false);
                    setShowEmployeeTasks(false);
                    setShowAllTasks(false);
                    setShowExtraTasks(false);
                  }}
                  className={`strategy-sidebar-menu-link ${showDashboardOnly ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: showDashboardOnly ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <Image size={20} />
                  </div>
                  Dashboard
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowCalendar(true);
                    setShowReports(false);
                    setShowDashboardOnly(false);
                    setShowMyTasks(false);
                    setShowEmployeeTasks(false);
                    setShowAllTasks(false);
                    setShowExtraTasks(false);
                  }}
                  className={`strategy-sidebar-menu-link ${showCalendar ? 'active' : ''}`}
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
                  <div className="strategy-sidebar-menu-icon">
                    <Calendar size={20} />
                  </div>
                  Show Calendar
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    const newShowMyTasks = !showMyTasks;
                    setShowMyTasks(newShowMyTasks);
                    setShowReports(false);
                    setShowDashboardOnly(false);
                    setShowCalendar(false);

                    // Turn off Employee Tasks, All Tasks, and Extra Tasks if My Tasks is being turned on
                    if (newShowMyTasks) {
                      setShowEmployeeTasks(false);
                      setShowExtraTasks(false);
                      setShowAllTasks(false);
                    }

                    // Show toast notification
                    if (newShowMyTasks) {
                      const myTasksCount = tasks.filter(t => t.assignedTo === loggedInUserName || t.assignedTo === 'Graphics Head').length;
                      showToast(`Showing ${myTasksCount} task(s) assigned to you`, 'info');

                      // Scroll to tasks section
                      setTimeout(() => {
                        if (tasksSectionRef.current) {
                          tasksSectionRef.current.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    } else {
                      showToast('Showing all graphics tasks', 'info');
                    }
                  }}
                  className={`strategy-sidebar-menu-link ${showMyTasks ? 'active' : ''}`}
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
                  <div className="strategy-sidebar-menu-icon">
                    <User size={20} />
                  </div>
                  My Tasks
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                {/* <button 
                  onClick={() => {
                    const newShowEmployeeTasks = !showEmployeeTasks;
                    setShowEmployeeTasks(newShowEmployeeTasks);
                    setShowReports(false);
                    setShowDashboardOnly(false);
                    setShowCalendar(false);
                    
                    // Turn off My Tasks, All Tasks, and Extra Tasks if Employee Tasks is being turned on
                    if (newShowEmployeeTasks) {
                      setShowMyTasks(false);
                      setShowExtraTasks(false);
                      setShowAllTasks(false);
                    }
                    
                    // Show toast notification
                    if (newShowEmployeeTasks) {
                      const employeeTasksCount = tasks.filter(t => t.assignedTo && t.assignedTo !== loggedInUserName && t.assignedTo !== 'Graphics Head').length;
                      showToast(`Showing ${employeeTasksCount} task(s) assigned to employees`, 'info');
                      
                      // Scroll to tasks section
                      setTimeout(() => {
                        if (tasksSectionRef.current) {
                          tasksSectionRef.current.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start' 
                          });
                        }
                      }, 100);
                    } else {
                      showToast('Showing all graphics tasks', 'info');
                    }
                  }}
                  className={`strategy-sidebar-menu-link ${showEmployeeTasks ? 'active' : ''}`}
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
                 
                 
                </button> */}
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    const newShowAllTasks = !showAllTasks;
                    setShowAllTasks(newShowAllTasks);
                    setShowReports(false);
                    setShowDashboardOnly(false);
                    setShowCalendar(false);

                    // Turn off My Tasks, Employee Tasks, and Extra Tasks if All Tasks is being turned on
                    if (newShowAllTasks) {
                      setShowMyTasks(false);
                      setShowExtraTasks(false);
                      setShowEmployeeTasks(false);
                    }
                  }}
                  className={`strategy-sidebar-menu-link ${showAllTasks ? 'active' : ''}`}
                  style={{
                    background: showAllTasks ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 20px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: showAllTasks ? '600' : '500',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <List size={20} />
                  </div>
                  All Tasks
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    const newShowExtraTasks = !showExtraTasks;
                    setShowExtraTasks(newShowExtraTasks);
                    setShowReports(false);
                    setShowDashboardOnly(false);
                    setShowCalendar(false);

                    // Turn off other filters if Extra Tasks is being turned on
                    if (newShowExtraTasks) {
                      setShowMyTasks(false);
                      setShowEmployeeTasks(false);
                      setShowAllTasks(false);
                    }

                    // Show toast notification
                    if (newShowExtraTasks) {
                      const extraTasksCount = tasks.filter(t => t.assignedBy === 'Graphics Head').length;
                      console.log('Graphics Dashboard - All tasks:', tasks.length);
                      console.log('Graphics Dashboard - Extra tasks:', tasks.filter(t => t.assignedBy === 'Graphics Head'));
                      showToast(`Showing ${extraTasksCount} extra task(s)`, 'info');

                      // Scroll to tasks section
                      setTimeout(() => {
                        const tasksSection = document.querySelector('.strategy-tasks-card');
                        if (tasksSection) {
                          tasksSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    } else {
                      showToast('Showing default graphics tasks', 'info');
                    }
                  }}
                  className={`strategy-sidebar-menu-link ${showExtraTasks ? 'active' : ''}`}
                  style={{
                    background: showExtraTasks ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 20px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <Plus size={20} />
                  </div>
                  Extra Tasks
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowReports(!showReports);
                    setShowDashboardOnly(false);
                    if (!showReports) {
                      setShowMyTasks(false);
                      setShowEmployeeTasks(false);
                      setShowAllTasks(false);
                      setShowExtraTasks(false);
                      setShowCalendar(false);
                    }
                  }}
                  className="strategy-sidebar-menu-link"
                  style={{
                    background: showReports ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 20px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  Reports
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="strategy-sidebar-user">
          <div className="strategy-sidebar-user-info">
            <div className="strategy-sidebar-user-avatar">
              {loggedInUserName ? loggedInUserName.charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="strategy-sidebar-user-details">
              <h4>{loggedInUserName || 'Graphics Manager'}</h4>
              <p>{loggedInUserEmail || 'graphics@company.com'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="strategy-btn strategy-btn-logout" style={{ marginTop: '12px', width: '100%' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="strategy-main-content">
        {/* Dashboard Header and Statistics - Hide when showing Reports */}
        {!showReports && (
          <>
            <div className="strategy-header">
              <div className="strategy-header-content">
                <div className="strategy-header-left">
                  <div className="strategy-header-title">
                    <h1>Graphics Department Dashboard</h1>
                    <p>Create graphic content and send for approval</p>
                  </div>
                </div>
                <div className="strategy-header-right">
                  {/* Month Filter */}
                  <div className="strategy-filter-group" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
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
                        backgroundColor: '#f9fafb'
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

            {/* Statistics - Hide when viewing My Tasks, All Tasks, or Extra Tasks */}
            {!showMyTasks && !showAllTasks && !showExtraTasks && !showEmployeeTasks && (
              <div className="card full-width">
                <div className="card-header">
                  <h2>📊 Graphics Statistics</h2>
                  {selectedStatus !== 'all' && (
                    <div style={{
                      padding: '8px 16px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1976d2'
                    }}>
                      Currently viewing: {getStatusDisplayText()} ({statusFilteredTasks.length})
                    </div>
                  )}
                </div>
                <div className="stats-row">
                  <div
                    className="stat-card stat-total"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      boxShadow: selectedStatus === 'total' ? '0 8px 25px rgba(102, 126, 234, 0.6)' : '0 4px 12px rgba(102,126,234,0.2)',
                      cursor: 'pointer',
                      transform: selectedStatus === 'total' ? 'scale(1.05)' : 'scale(1)',
                      border: selectedStatus === 'total' ? '3px solid white' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => handleStatBoxClick('total')}
                    onMouseEnter={(e) => {
                      if (selectedStatus !== 'total') {
                        e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedStatus !== 'total') {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.2)';
                      }
                    }}
                  >
                    <h3>{filteredTasks.length}</h3>
                    <p>Total Tasks</p>
                  </div>
                  <div
                    className="stat-card stat-progress"
                    style={{
                      background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
                      color: 'white',
                      boxShadow: selectedStatus === 'in-progress' ? '0 8px 25px rgba(116, 185, 255, 0.6)' : '0 4px 12px rgba(116,185,255,0.2)',
                      cursor: 'pointer',
                      transform: selectedStatus === 'in-progress' ? 'scale(1.05)' : 'scale(1)',
                      border: selectedStatus === 'in-progress' ? '3px solid white' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => handleStatBoxClick('in-progress')}
                    onMouseEnter={(e) => {
                      if (selectedStatus !== 'in-progress') {
                        e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(116, 185, 255, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedStatus !== 'in-progress') {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(116,185,255,0.2)';
                      }
                    }}
                  >
                    <h3>{filteredTasks.filter(t => t.status === 'assigned' || t.status === 'in-progress').length}</h3>
                    <p>In Progress</p>
                  </div>
                  <div
                    className="stat-card stat-pending"
                    style={{
                      background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                      color: 'white',
                      boxShadow: selectedStatus === 'pending-approval' ? '0 8px 25px rgba(255, 107, 107, 0.6)' : '0 4px 12px rgba(255,107,107,0.2)',
                      cursor: 'pointer',
                      transform: selectedStatus === 'pending-approval' ? 'scale(1.05)' : 'scale(1)',
                      border: selectedStatus === 'pending-approval' ? '3px solid white' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => handleStatBoxClick('pending-approval')}
                    onMouseEnter={(e) => {
                      if (selectedStatus !== 'pending-approval') {
                        e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 107, 107, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedStatus !== 'pending-approval') {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,107,107,0.2)';
                      }
                    }}
                  >
                    <h3>{filteredTasks.filter(t => t.status === 'pending-client-approval').length}</h3>
                    <p>Pending Approval</p>
                  </div>
                  <div
                    className="stat-card stat-completed"
                    style={{
                      background: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                      color: 'white',
                      boxShadow: selectedStatus === 'completed' ? '0 8px 25px rgba(86, 171, 47, 0.6)' : '0 4px 12px rgba(86,171,47,0.2)',
                      cursor: 'pointer',
                      transform: selectedStatus === 'completed' ? 'scale(1.05)' : 'scale(1)',
                      border: selectedStatus === 'completed' ? '3px solid white' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => handleStatBoxClick('completed')}
                    onMouseEnter={(e) => {
                      if (selectedStatus !== 'completed') {
                        e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(86, 171, 47, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedStatus !== 'completed') {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(86,171,47,0.2)';
                      }
                    }}
                  >
                    <h3>{filteredTasks.filter(t => t.status === 'completed').length}</h3>
                    <p>Completed</p>
                  </div>
                  <div
                    className="stat-card stat-approved"
                    style={{
                      background: 'linear-gradient(135deg, #1dd1a1 0%, #55efc4 100%)',
                      color: 'white',
                      boxShadow: selectedStatus === 'approved' ? '0 8px 25px rgba(0, 184, 148, 0.6)' : '0 4px 12px rgba(0,184,148,0.2)',
                      cursor: 'pointer',
                      transform: selectedStatus === 'approved' ? 'scale(1.05)' : 'scale(1)',
                      border: selectedStatus === 'approved' ? '3px solid white' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => handleStatBoxClick('approved')}
                    onMouseEnter={(e) => {
                      if (selectedStatus !== 'approved') {
                        e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 184, 148, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedStatus !== 'approved') {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,184,148,0.2)';
                      }
                    }}
                  >
                    <h3>{filteredTasks.filter(t => t.status === 'approved' || t.status === 'posted').length}</h3>
                    <p>Posted/Approved</p>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Report and Weekly Summary Section - Only show when dashboard is active and calendar is hidden */}
            {showDashboardOnly && !showCalendar && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                marginTop: '24px'
              }}>
                {/* Daily Report Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>📊</span>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Daily Report</h3>
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      <span>🎨 Graphics</span>
                    </div>
                  </div>

                  <div style={{
                    fontSize: '13px',
                    marginBottom: '20px',
                    opacity: 0.9
                  }}>
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          return filteredTasks.filter(t => {
                            const taskDate = t.deadline || t.postDate;
                            return taskDate === today;
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>Today's Tasks</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          return filteredTasks.filter(t => {
                            const taskDate = t.deadline || t.postDate;
                            return taskDate === today && (t.status === 'completed' || t.status === 'posted' || t.status === 'approved');
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>Completed</div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          // Count ALL overdue tasks in the department, not just today's
                          const now = new Date();
                          const overdue = filteredTasks.filter(t => {
                            if (!t.deadline) return false;
                            const deadline = new Date(t.deadline);
                            return now > deadline && t.status !== 'completed' && t.status !== 'posted' && t.status !== 'approved';
                          }).length;
                          return overdue;
                        })()}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>Overdue</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          const todayTasks = filteredTasks.filter(t => {
                            const taskDate = t.deadline || t.postDate;
                            return taskDate === today;
                          });
                          const completed = todayTasks.filter(t =>
                            t.status === 'completed' || t.status === 'posted' || t.status === 'approved'
                          ).length;
                          const total = todayTasks.length;
                          return total > 0 ? Math.round((completed / total) * 100) : 0;
                        })()}%
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>Success Rate</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowMyTasks(true);
                      setShowEmployeeTasks(false);
                      setShowAllTasks(false);
                      setShowExtraTasks(false);
                      setShowDashboardOnly(false);
                      setTimeout(() => {
                        if (tasksSectionRef.current) {
                          tasksSectionRef.current.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    <span>👁️</span> View Today's Tasks
                  </button>
                </div>

                {/* Weekly Summary Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(86, 171, 47, 0.3)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>📅</span>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Weekly Summary</h3>
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      This Week
                    </div>
                  </div>

                  <div style={{
                    fontSize: '13px',
                    marginBottom: '20px',
                    opacity: 0.9
                  }}>
                    {(() => {
                      const now = new Date();
                      const startOfWeek = new Date(now);
                      startOfWeek.setDate(now.getDate() - now.getDay());
                      const endOfWeek = new Date(startOfWeek);
                      endOfWeek.setDate(startOfWeek.getDate() + 6);
                      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                    })()}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          const now = new Date();
                          const startOfWeek = new Date(now);
                          startOfWeek.setDate(now.getDate() - now.getDay());
                          const endOfWeek = new Date(startOfWeek);
                          endOfWeek.setDate(startOfWeek.getDate() + 6);

                          return filteredTasks.filter(t => {
                            const taskDate = new Date(t.deadline || t.postDate);
                            return taskDate >= startOfWeek && taskDate <= endOfWeek;
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>Weekly Tasks</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          const now = new Date();
                          const startOfWeek = new Date(now);
                          startOfWeek.setDate(now.getDate() - now.getDay());
                          const endOfWeek = new Date(startOfWeek);
                          endOfWeek.setDate(startOfWeek.getDate() + 6);

                          return filteredTasks.filter(t => {
                            const taskDate = new Date(t.deadline || t.postDate);
                            return taskDate >= startOfWeek && taskDate <= endOfWeek &&
                              (t.status === 'completed' || t.status === 'posted' || t.status === 'approved');
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>Completed</div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          const now = new Date();
                          const startOfWeek = new Date(now);
                          startOfWeek.setDate(now.getDate() - now.getDay());
                          const endOfWeek = new Date(startOfWeek);
                          endOfWeek.setDate(startOfWeek.getDate() + 6);

                          return filteredTasks.filter(t => {
                            const taskDate = new Date(t.deadline || t.postDate);
                            return taskDate >= startOfWeek && taskDate <= endOfWeek &&
                              (t.status === 'in-progress' || t.status === 'assigned');
                          }).length;
                        })()}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>In Progress</div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {(() => {
                          const now = new Date();
                          const startOfWeek = new Date(now);
                          startOfWeek.setDate(now.getDate() - now.getDay());
                          const endOfWeek = new Date(startOfWeek);
                          endOfWeek.setDate(startOfWeek.getDate() + 6);

                          const weekTasks = filteredTasks.filter(t => {
                            const taskDate = new Date(t.deadline || t.postDate);
                            return taskDate >= startOfWeek && taskDate <= endOfWeek;
                          });
                          const completed = weekTasks.filter(t =>
                            t.status === 'completed' || t.status === 'posted' || t.status === 'approved'
                          ).length;
                          const total = weekTasks.length;
                          return total > 0 ? Math.round((completed / total) * 100) : 0;
                        })()}%
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.9 }}>My Efficiency</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowAllTasks(true);
                      setShowMyTasks(false);
                      setShowEmployeeTasks(false);
                      setShowExtraTasks(false);
                      setShowDashboardOnly(false);
                      setTimeout(() => {
                        if (tasksSectionRef.current) {
                          tasksSectionRef.current.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }, 100);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    <span>📋</span> View All Tasks
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Calendar View - Remains exactly the same */}
        {showCalendar && (
          <div className="strategy-card" style={{ marginBottom: '24px' }}>
            <div className="strategy-modal-header" style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Calendar size={20} />
                <h3 style={{ margin: 0, fontSize: '18px' }}>
                  📅 Graphics Task Calendar
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setShowCalendar(false)}
                  className="strategy-modal-close"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 24px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '16px'
              }}>
                <button
                  onClick={() => {
                    const date = new Date(selectedMonth + '-01');
                    date.setMonth(date.getMonth() - 1);
                    setSelectedMonth(date.toISOString().slice(0, 7));
                  }}
                  className="strategy-btn strategy-btn-calendar"
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    minWidth: 'auto'
                  }}
                >
                  ← Prev
                </button>
                <h4 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '600',
                  minWidth: '150px',
                  textAlign: 'center'
                }}>
                  {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </h4>
                <button
                  onClick={() => {
                    const date = new Date(selectedMonth + '-01');
                    date.setMonth(date.getMonth() + 1);
                    setSelectedMonth(date.toISOString().slice(0, 7));
                  }}
                  className="strategy-btn strategy-btn-calendar"
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    minWidth: 'auto'
                  }}
                >
                  Next →
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '2px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '8px',
                maxWidth: '100%'
              }}>
                {/* Calendar Days Header */}
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                  <div key={day} style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '8px 4px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '12px',
                    borderRadius: '4px'
                  }}>
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {(() => {
                  const year = parseInt(selectedMonth.split('-')[0]);
                  const month = parseInt(selectedMonth.split('-')[1]) - 1;
                  const firstDay = new Date(year, month, 1);
                  const startDate = new Date(firstDay);
                  startDate.setDate(startDate.getDate() - firstDay.getDay());

                  const days = [];
                  for (let i = 0; i < 42; i++) {
                    const currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + i);

                    const isCurrentMonth = currentDate.getMonth() === month;
                    const isToday = currentDate.toDateString() === new Date().toDateString();
                    const dateString = formatDateSafe(currentDate);

                    const dayTasks = filteredTasks.filter(task => {
                      const matchesDate = (task.deadline === dateString);
                      return matchesDate;
                    });

                    days.push(
                      <div
                        key={i}
                        onClick={() => handleDateClick(dateString, dayTasks)}
                        style={{
                          background: isCurrentMonth ? 'white' : 'transparent',
                          borderRadius: '4px',
                          minHeight: '32px',
                          padding: '4px',
                          cursor: dayTasks.length > 0 ? 'pointer' : 'default',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: isToday ? '700' : '500',
                          color: isCurrentMonth ? (isToday ? '#667eea' : '#374151') : '#9ca3af',
                          backgroundColor: isToday ? '#e0e7ff' : (dayTasks.length > 0 ? '#dcfce7' : 'white'),
                          border: dayTasks.length > 0 ? '1px solid #10b981' : '1px solid transparent',
                          transition: 'all 0.2s ease'
                        }}
                        title={dayTasks.length > 0 ? `${dayTasks.length} task(s) on this date` : ''}
                        onMouseEnter={(e) => {
                          if (dayTasks.length > 0) {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <span>{currentDate.getDate()}</span>
                        {dayTasks.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            width: '6px',
                            height: '6px',
                            backgroundColor: '#10b981',
                            borderRadius: '50%',
                            fontSize: '8px'
                          }}></div>
                        )}
                        {dayTasks.length > 1 && (
                          <span style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            fontSize: '8px',
                            fontWeight: '700',
                            color: '#10b981'
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
                  Graphics Department Reports
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
                      onClick={downloadGraphicsDepartmentReportAsPDF}
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
                      onClick={downloadGraphicsDepartmentReportAsExcel}
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
                    const reportsTasks = getReportsFilteredTasks();
                    const completed = reportsTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
                    return reportsTasks.length > 0 ? Math.round((completed / reportsTasks.length) * 100) : 0;
                  })()}%
                </div>
                <div style={{ fontSize: '13px', opacity: 0.95 }}>Completion Rate</div>
              </div>
            </div>

            {/* Search and Filter Section */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
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
                  const reportsTasks = getReportsFilteredTasks();
                  const statusData = [
                    { label: 'In Progress', count: reportsTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length, color: '#3b82f6', gradient: 'url(#blueGradientGraphics)' },
                    { label: 'Completed', count: reportsTasks.filter(t => t.status === 'completed').length, color: '#10b981', gradient: 'url(#greenGradientGraphics)' },
                    { label: 'Pending', count: reportsTasks.filter(t => t.status === 'pending-client-approval').length, color: '#f59e0b', gradient: 'url(#orangeGradientGraphics)' },
                    { label: 'Posted', count: reportsTasks.filter(t => t.status === 'posted' || t.status === 'approved').length, color: '#8b5cf6', gradient: 'url(#purpleGradientGraphics)' }
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
                          <linearGradient id="blueGradientGraphics" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="greenGradientGraphics" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#34d399', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="orangeGradientGraphics" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#fbbf24', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#f59e0b', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="purpleGradientGraphics" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
                          </linearGradient>
                          <filter id="shadowGraphics">
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
                        <circle cx={centerX} cy={centerY} r="50" fill="#ffffff" stroke="#f3f4f6" strokeWidth="2" filter="url(#shadowGraphics)" />
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
                  const reportsTasks = getReportsFilteredTasks();
                  const today = new Date();
                  const last7Days = [];
                  for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    last7Days.push(date);
                  }

                  const dailyData = last7Days.map(date => {
                    const dateStr = date.toISOString().split('T')[0];

                    const dayTasks = reportsTasks.filter(task => {
                      if (!task.postDate) return false;
                      const taskDate = task.postDate.toDate ? task.postDate.toDate() : new Date(task.postDate);
                      return taskDate.toISOString().split('T')[0] === dateStr;
                    });

                    const completed = reportsTasks.filter(task => {
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
                          <linearGradient id="totalGradientGraphics" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: '#667eea', stopOpacity: 0.05 }} />
                          </linearGradient>
                          <linearGradient id="completedGradientGraphics" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.4 }} />
                            <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0.05 }} />
                          </linearGradient>
                          <filter id="lineShadowGraphics">
                            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.2" />
                          </filter>
                        </defs>

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

                        <path d={totalAreaPath} fill="url(#totalGradientGraphics)" />
                        <path d={completedAreaPath} fill="url(#completedGradientGraphics)" />

                        <path d={totalPath} stroke="#667eea" strokeWidth="3" fill="none" filter="url(#lineShadowGraphics)" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={completedPath} stroke="#10b981" strokeWidth="3" fill="none" filter="url(#lineShadowGraphics)" strokeLinecap="round" strokeLinejoin="round" />

                        {totalPoints.map((point, i) => (
                          <g key={`total-${i}`}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#667eea" stroke="#ffffff" strokeWidth="2.5" filter="url(#lineShadowGraphics)" />
                            {point.value > 0 && (
                              <text x={point.x} y={point.y - 12} fontSize="10" fill="#667eea" textAnchor="middle" fontWeight="700">
                                {point.value}
                              </text>
                            )}
                          </g>
                        ))}
                        {completedPoints.map((point, i) => (
                          <g key={`completed-${i}`}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" filter="url(#lineShadowGraphics)" />
                            {point.value > 0 && (
                              <text x={point.x} y={point.y - 12} fontSize="10" fill="#10b981" textAnchor="middle" fontWeight="700">
                                {point.value}
                              </text>
                            )}
                          </g>
                        ))}

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
                    const reportsTasks = getReportsFilteredTasks();
                    const employeeCounts = {};
                    reportsTasks.forEach(task => {
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
                      const completionRate = (counts.completed / counts.total) * 100;
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
                      color: '#667eea',
                      fontWeight: '600',
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
                      if (!selectAllClientsMode) {
                        // First click: Show checkboxes and select all clients
                        setSelectAllClientsMode(true);

                        // Get all employees and select them
                        const reportsTasks = getReportsFilteredTasks();
                        const employeeData = {};
                        const employeeTasksMap = {};

                        reportsTasks.forEach(task => {
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
                    Select All Employees
                  </button>
                  {selectAllClientsMode && (
                    <button
                      onClick={() => {
                        // Hide checkboxes and clear all selections
                        setSelectAllClientsMode(false);
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
                          const reportsTasks = getReportsFilteredTasks();
                          // Filter tasks based on selected tasks per employee
                          const selectedClientsTasks = reportsTasks.filter(t => {
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
                          const reportsTasks = getReportsFilteredTasks();
                          // Filter tasks based on selected tasks per employee
                          const selectedClientsTasks = reportsTasks.filter(t => {
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
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937', width: '40px' }}></th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#1f2937' }}>Employee Name</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Total Tasks</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Completed</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Pending</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>In Progress</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const reportsTasks = getReportsFilteredTasks();
                      const employeeData = {};

                      // Group tasks by employee
                      reportsTasks.forEach(task => {
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

                      return employeeArray.length > 0 ? employeeArray.flatMap((employee, index) => {
                        const completionRate = employee.totalTasks > 0 ? Math.round((employee.completedTasks / employee.totalTasks) * 100) : 0;
                        const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                        const isExpanded = expandedReportClients[employee.employeeName];

                        // Get all tasks for this employee
                        const employeeTasks = reportsTasks.filter(t => (t.assignedTo || 'Unassigned') === employee.employeeName);

                        const rows = [
                          // Main client row
                          <tr key={`client-${index}`} style={{
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
                          </tr>
                        ];

                        // Expanded tasks rows - show clients grouped under employee
                        if (isExpanded) {
                          rows.push(
                            <tr key={`tasks-${index}`}>
                              <td colSpan="7" style={{ padding: '0', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)' }}>
                                  <h4 style={{
                                    margin: '0 0 12px 0',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#667eea',
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
                                            <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {clientTasks.map((task, taskIndex) => {
                                            const taskRowBg = taskIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
                                            const statusColors = {
                                              'completed': '#10b981',
                                              'posted': '#10b981',
                                              'approved': '#10b981',
                                              'in-progress': '#3b82f6',
                                              'assigned': '#3b82f6',
                                              'pending-client-approval': '#f59e0b',
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
                                                    background: task.department === 'graphics' ? '#e0e7ff' : '#fce7f3',
                                                    color: task.department === 'graphics' ? '#667eea' : '#ec4899',
                                                    fontWeight: '600'
                                                  }}>
                                                    {task.department || 'N/A'}
                                                  </span>
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                                                  {task.postDate ? new Date(task.postDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px' }}>
                                                  <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    background: `${statusColor}20`,
                                                    color: statusColor,
                                                    fontWeight: '600',
                                                    textTransform: 'capitalize'
                                                  }}>
                                                    {task.status?.replace(/-/g, ' ') || 'N/A'}
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
                          );
                        }

                        return rows;
                      }) : (
                        <tr>
                          <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                            No client data available
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Section with ref - Only minor updates to show filtered tasks */}
        {!showReports && !showDashboardOnly && !showCalendar && (
          <div ref={tasksSectionRef} className="dashboard-grid">
            <div className="card full-width" style={{ marginBottom: '30px' }}>
              <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
                  <div>
                    <h2>
                      {selectedStatus === 'all' ? '🎨 Graphics Tasks' : `🎨 ${getStatusDisplayText()}`}
                    </h2>
                    <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                      {selectedStatus === 'all'
                        ? 'Create graphic content and send for client approval'
                        : `Showing ${statusFilteredTasks.length} task${statusFilteredTasks.length !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {showExtraTasks && (
                      <button
                        onClick={() => {
                          setShowAddExtraTaskModal(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 20px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                        }}
                      >
                        <Plus size={18} />
                        Add Extra Task
                      </button>
                    )}
                    {selectedStatus !== 'all' && (
                      <button
                        onClick={() => setSelectedStatus('all')}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}
                      >
                        Show All Tasks
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Bar and Download Options */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  width: '100%',
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
                      placeholder="Search clients, tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: 'none',
                        background: 'transparent',
                        fontSize: '14px',
                        flex: 1,
                        outline: 'none'
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
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

                  {/* View Toggle Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    padding: '4px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <button
                      onClick={() => setViewMode('list')}
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
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <List size={16} />
                      List View
                    </button>
                    <button
                      onClick={() => setViewMode('card')}
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
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Grid size={16} />
                      Card View
                    </button>
                  </div>

                  {/* Task Assignment Filter Dropdown - Only show in All Tasks view */}
                  {showAllTasks && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <Users size={18} style={{ color: '#667eea' }} />
                      <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Filter:</label>
                      <select
                        value={taskAssignmentFilter}
                        onChange={(e) => setTaskAssignmentFilter(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          backgroundColor: '#f9fafb',
                          color: '#374151',
                          cursor: 'pointer',
                          outline: 'none',
                          minWidth: '150px'
                        }}
                      >
                        <option value="all">All Tasks</option>
                        <option value="head">Head Tasks</option>
                        <option value="employee">Employee Tasks</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ overflowX: 'auto', padding: '20px' }}>
                {searchQuery && (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1976d2',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>
                      🔍 Search results for "{searchQuery}" - Found {getSearchFilteredTasks().length} task(s)
                    </span>
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#1976d2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      Clear Search
                    </button>
                  </div>
                )}
                {getSearchFilteredTasks().length === 0 ? (
                  <div className="empty-state">
                    <p>
                      {searchQuery
                        ? `No tasks found matching "${searchQuery}"`
                        : selectedStatus === 'all'
                          ? 'No tasks in Graphics department for this month'
                          : `No ${getStatusDisplayText().toLowerCase()} for this month`
                      }
                    </p>
                  </div>
                ) : viewMode === 'list' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {Object.entries(groupTasksByClient(getSearchFilteredTasks())).map(([clientName, clientTasks]) => {
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
                            style={{
                              padding: '20px',
                              background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
                              color: 'white',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div
                              onClick={() => toggleClientExpansion(clientName)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                flex: 1,
                                cursor: 'pointer'
                              }}
                            >
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
                                  {totalTasks} graphics task{totalTasks !== 1 ? 's' : ''} • {completedTasks} completed • {inProgressTasks} in progress
                                  {getSelectedTasksCount(clientName) > 0 && (
                                    <span style={{
                                      marginLeft: '8px',
                                      padding: '2px 8px',
                                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '700'
                                    }}>
                                      {getSelectedTasksCount(clientName)} selected
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {getSelectedTasksCount(clientName) > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadClientReport(clientName, clientTasks, true);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    backgroundColor: 'rgba(40, 167, 69, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '8px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(40, 167, 69, 1)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                  }}
                                >
                                  <Download size={16} />
                                  Download Selected ({getSelectedTasksCount(clientName)})
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadClientReport(clientName, clientTasks, false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 16px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  border: '1px solid rgba(255, 255, 255, 0.3)',
                                  borderRadius: '8px',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <Download size={16} />
                                Download All
                              </button>
                              <div
                                onClick={() => toggleClientExpansion(clientName)}
                                style={{
                                  fontSize: '24px',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.3s ease',
                                  cursor: 'pointer',
                                  padding: '0 8px'
                                }}
                              >
                                ▼
                              </div>
                            </div>
                          </div>

                          {/* Client Graphics Tasks - This part remains exactly the same */}
                          {isExpanded && (
                            <div style={{ padding: '0', overflowX: 'auto', width: '100%' }}>
                              <table style={{
                                width: '100%',
                                minWidth: showMyTasks ? '1400px' : '100%',
                                borderCollapse: 'collapse'
                              }}>
                                <thead>
                                  <tr style={{
                                    backgroundColor: '#f8f9fa',
                                    borderBottom: '2px solid #e9ecef'
                                  }}>
                                    {/* Conditional headers based on My Tasks view */}
                                    {showMyTasks ? (
                                      <>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '150px' }}>Task Name</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '180px' }}>Content</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '100px' }}>Reference Link</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '180px' }}>Special Notes</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '100px' }}>Deadline</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '100px' }}>Start</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '100px' }}>Done</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '120px' }}>Revision Timeline</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '100px' }}>Status</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '80px' }}>Revisions</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '120px' }}>Actions</th>
                                      </>
                                    ) : (
                                      <>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', width: '50px' }}>
                                          <input
                                            type="checkbox"
                                            checked={getSelectedTasksCount(clientName) === clientTasks.length && clientTasks.length > 0}
                                            onChange={() => toggleAllTasksForClient(clientName, clientTasks)}
                                            style={{
                                              width: '18px',
                                              height: '18px',
                                              cursor: 'pointer'
                                            }}
                                          />
                                        </th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Task Name</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Project</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Due Date</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Status</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Revisions</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Assigned To</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6c757d', textTransform: 'uppercase' }}>Action</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientTasks.map(task => (
                                    <tr key={task.id} style={{
                                      borderBottom: clientTasks.indexOf(task) < clientTasks.length - 1 ? '1px solid #f1f3f4' : 'none',
                                      backgroundColor: isTaskSelected(clientName, task.id) ? '#e3f2fd' : 'transparent'
                                    }}>
                                      {/* Conditional rendering based on My Tasks view */}
                                      {showMyTasks ? (
                                        <>
                                          {/* Task Name */}
                                          <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '14px' }}>
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
                                          <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '13px' }}>
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
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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
                                          <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '13px' }}>
                                            {task.specialNotes ? (
                                              <button
                                                onClick={() => {
                                                  alert(task.specialNotes);
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
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric'
                                            }) : 'N/A'}
                                          </td>

                                          {/* Start */}
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            {task.startedAt ? (
                                              <div>
                                                <div>{new Date(task.startedAt).toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric'
                                                })}</div>
                                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                  {new Date(task.startedAt).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  })}
                                                </div>
                                              </div>
                                            ) : (
                                              <span style={{ color: '#999', fontSize: '12px' }}>No timeline</span>
                                            )}
                                          </td>

                                          {/* Done */}
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            {task.completedAt ? new Date(task.completedAt).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric'
                                            }) : (
                                              <span style={{ color: '#999', fontSize: '12px' }}>No timeline</span>
                                            )}
                                          </td>

                                          {/* Revision Timeline */}
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            {task.lastRevisionAt ? new Date(task.lastRevisionAt).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric'
                                            }) : (
                                              <span style={{ color: '#999', fontSize: '12px' }}>No timeline</span>
                                            )}
                                          </td>

                                          {/* Status */}
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <span style={{
                                              padding: '6px 12px',
                                              borderRadius: '8px',
                                              fontSize: '12px',
                                              fontWeight: '600',
                                              backgroundColor: getStatusColor(task.status),
                                              color: 'white',
                                              display: 'inline-block',
                                              textTransform: 'capitalize'
                                            }}>
                                              {task.status?.replace(/-/g, ' ') || 'Pending'}
                                            </span>
                                          </td>

                                          {/* Revisions */}
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <input
                                              type="checkbox"
                                              checked={isTaskSelected(clientName, task.id)}
                                              onChange={() => toggleTaskSelection(clientName, task.id)}
                                              style={{
                                                width: '18px',
                                                height: '18px',
                                                cursor: 'pointer'
                                              }}
                                            />
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              {getStatusIcon(task.status)}
                                              <div>
                                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{task.taskName}</div>
                                                {isTaskOverdue(task.deadline) && task.status !== 'posted' && task.status !== 'completed' && (
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
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            <span className="project-badge">{task.projectName}</span>
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                            {new Date(task.deadline).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric'
                                            })}
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <span style={{
                                              padding: '6px 12px',
                                              borderRadius: '8px',
                                              fontSize: '12px',
                                              fontWeight: '600',
                                              backgroundColor: getStatusColor(task.status),
                                              color: 'white',
                                              display: 'inline-block',
                                              textTransform: 'capitalize'
                                            }}>
                                              {task.status.replace(/-/g, ' ')}
                                            </span>
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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
                                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
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
                                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                              {(task.status === 'assigned-to-department' || !task.assignedTo) && (
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
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                  }}
                                                >
                                                  Assign Member
                                                </button>
                                              )}
                                              {task.status !== 'assigned-to-department' && task.assignedTo && (
                                                <button className="action-btn view-btn" style={{
                                                  backgroundColor: '#6c757d',
                                                  color: 'white',
                                                  border: 'none',
                                                  padding: '6px 12px',
                                                  borderRadius: '6px',
                                                  cursor: 'pointer',
                                                  fontSize: '12px',
                                                  fontWeight: '600'
                                                }}>
                                                  View Details
                                                </button>
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
                ) : (
                  /* Card View - Grouped by Client */
                  <div>
                    {/* Back Button and Download Section - Show when a client is selected */}
                    {selectedClientForCardView && (
                      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setSelectedClientForCardView(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#2563eb';
                            e.target.style.transform = 'translateX(-4px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#3b82f6';
                            e.target.style.transform = 'translateX(0)';
                          }}
                        >
                          ← Back to All Clients
                        </button>

                        {/* Download All Button */}
                        <button
                          onClick={() => {
                            const clientTasks = groupTasksByClient(getSearchFilteredTasks())[selectedClientForCardView];
                            downloadClientReport(selectedClientForCardView, clientTasks, false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#7DA0FA',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#4B49AC';
                            e.target.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#7DA0FA';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          <Download size={16} />
                          Download All
                        </button>

                        {/* Download Selected Button */}
                        {getSelectedTasksCount(selectedClientForCardView) > 0 && (
                          <button
                            onClick={() => {
                              const clientTasks = groupTasksByClient(getSearchFilteredTasks())[selectedClientForCardView];
                              downloadClientReport(selectedClientForCardView, clientTasks, true);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 24px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#059669';
                              e.target.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#10b981';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            <Download size={16} />
                            Download Selected ({getSelectedTasksCount(selectedClientForCardView)})
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
                      {Object.entries(groupTasksByClient(getSearchFilteredTasks()))
                        .filter(([clientName]) => !selectedClientForCardView || clientName === selectedClientForCardView)
                        .map(([clientName, clientTasks]) => {
                          const isExpanded = expandedClients[clientName];
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
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                      overflow: 'hidden',
                                      border: '1px solid #e9ecef',
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
                                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                              {task.taskName}
                                            </h3>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                                              {task.clientName}
                                            </p>
                                          </div>
                                          <input
                                            type="checkbox"
                                            checked={isTaskSelected(task.clientName, task.id)}
                                            onChange={() => toggleTaskSelection(task.clientName, task.id)}
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
                                            <span style={{
                                              padding: '6px 12px',
                                              borderRadius: '8px',
                                              fontSize: '12px',
                                              fontWeight: '600',
                                              backgroundColor: getStatusColor(task.status),
                                              color: 'white',
                                              display: 'inline-block',
                                              textTransform: 'capitalize'
                                            }}>
                                              {task.status.replace(/-/g, ' ')}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                          {(task.status === 'assigned-to-department' || !task.assignedTo) && (
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
                                          {task.status !== 'assigned-to-department' && task.assignedTo && (
                                            <button style={{
                                              flex: 1,
                                              padding: '12px',
                                              backgroundColor: '#6b7280',
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
                                            }}>
                                              View Details
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Overdue Badge - Top Right Corner */}
                                      {isTaskOverdue(task.deadline) && task.status !== 'posted' && task.status !== 'completed' && (
                                        <div style={{
                                          position: 'absolute',
                                          top: '12px',
                                          right: '12px',
                                          backgroundColor: '#dc3545',
                                          color: 'white',
                                          padding: '6px 12px',
                                          borderRadius: '6px',
                                          fontSize: '10px',
                                          fontWeight: 'bold',
                                          zIndex: 10,
                                          boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)',
                                          letterSpacing: '0.5px'
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* All modals and other components remain exactly the same */}
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
                  <option value="Graphics Head" style={{ fontWeight: 'bold', backgroundColor: '#f0f7ff' }}>
                    👤 Graphics Head (Myself)
                  </option>
                  {employees
                    .filter(emp => emp.department === 'graphics' && emp.status === 'active')
                    .map(emp => (
                      <option key={emp.id} value={emp.employeeName}>
                        {emp.employeeName}
                      </option>
                    ))}
                  {employees.filter(emp => emp.department === 'graphics' && emp.status === 'active').length === 0 && (
                    <option disabled>No graphics employees available</option>
                  )}
                </select>
                {employees.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#dc3545', marginTop: '8px', fontWeight: '500' }}>
                    ⚠️ No graphics employees found. Please add employees first.
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

      {/* Task Modal */}
      {showTaskModal && (
        <div className="strategy-modal" onClick={closeTaskModal}>
          <div className="strategy-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="strategy-modal-header">
              <h3>
                📅 Tasks for {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', {
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
                ×
              </button>
            </div>
            <div className="strategy-modal-body">
              {selectedDateTasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedDateTasks.map((task, index) => (
                    <div key={index} style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #e9ecef',
                      transition: 'all 0.2s ease'
                    }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}>
                      {/* Task Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🎨</span>
                            <h4 style={{
                              margin: 0,
                              fontSize: '18px',
                              fontWeight: '600',
                              color: '#212529'
                            }}>
                              {task.taskName || 'Untitled Task'}
                            </h4>
                          </div>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                            fontSize: '14px',
                            color: '#666'
                          }}>
                            <span>   <strong>Client:</strong> {task.clientName || 'N/A'}</span>
                            <span>📅 <strong>Deadline:</strong> {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</span>
                            {task.assignedTo && <span>👨‍💼 <strong>Assigned:</strong> {task.assignedTo}</span>}
                          </div>
                        </div>
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
                      </div>

                      {/* Task Description */}
                      {task.description && (
                        <div style={{
                          backgroundColor: '#e3f2fd',
                          padding: '12px',
                          borderRadius: '8px',
                          marginTop: '12px'
                        }}>
                          <p style={{
                            margin: 0,
                            fontSize: '14px',
                            color: '#1976d2',
                            lineHeight: '1.5'
                          }}>
                            <strong>📝 Description:</strong> {task.description}
                          </p>
                        </div>
                      )}

                      {/* Client Instructions */}
                      {task.clientInstructions && (
                        <div style={{
                          backgroundColor: '#fff3e0',
                          padding: '12px',
                          borderRadius: '8px',
                          marginTop: '12px',
                          border: '2px solid #ff9800'
                        }}>
                          <p style={{
                            margin: 0,
                            fontSize: '14px',
                            color: '#e65100',
                            lineHeight: '1.5',
                            fontWeight: '500'
                          }}>
                            <strong>⚠️ Client Instructions:</strong> {task.clientInstructions}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666'
                }}>
                  <p>No tasks scheduled for this date</p>
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
              {employees.filter(emp => emp.department === 'social-media' && emp.status === 'active').length > 0 ? (
                employees
                  .filter(emp => emp.department === 'social-media' && emp.status === 'active')
                  .map(emp => (
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
              )}
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

export default GraphicsDashboard;