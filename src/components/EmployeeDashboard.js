import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { CheckCircle, XCircle, Clock, LogOut, User, Calendar, AlertCircle, PlayCircle, Send, Filter, Video, Image, LayoutDashboard, Search, List, Grid, Download, BarChart3, PieChart, TrendingUp, Briefcase } from 'lucide-react';
import { useToast, ToastContainer } from './Toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import RevisionNotificationPopup from './RevisionNotificationPopup';
import './Dashboard.css';
import './EmployeeDashboard.css';

const EmployeeDashboard = ({ employeeData = null, isEmbedded = false }) => {
  const [tasks, setTasks] = useState([]);
  const [employeeName, setEmployeeName] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeFilter, setActiveFilter] = useState('all'); // For statistics card filtering
  const [selectedTasks, setSelectedTasks] = useState({}); // For task selection by client
  const [showNameSelector, setShowNameSelector] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [employeeDepartment, setEmployeeDepartment] = useState('');
  const [clients, setClients] = useState([]);
  const [expandedClients, setExpandedClients] = useState({});
  const [searchQuery, setSearchQuery] = useState(''); // For search functionality
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card' view mode
  const [selectedClientForCardView, setSelectedClientForCardView] = useState(null); // For card view client selection
  const [showSocialMediaEmployeeModal, setShowSocialMediaEmployeeModal] = useState(false);
  const [selectedTaskForSending, setSelectedTaskForSending] = useState(null);
  const [showRevisionNoteModal, setShowRevisionNoteModal] = useState(false);
  const [selectedRevisionNote, setSelectedRevisionNote] = useState('');
  const [showReports, setShowReports] = useState(false); // For Reports section
  const [showDownloadOptions, setShowDownloadOptions] = useState(false); // For download dropdown
  const [showReportCheckboxes, setShowReportCheckboxes] = useState(false); // For report selection checkboxes
  const [selectedReportClients, setSelectedReportClients] = useState(new Set()); // Selected clients for download
  const [selectedReportTaskIds, setSelectedReportTaskIds] = useState(new Set()); // Selected task IDs for download
  const [showReportFormatDropdown, setShowReportFormatDropdown] = useState(false); // Format dropdown for reports

  // Reports filter states
  const [reportsSearchQuery, setReportsSearchQuery] = useState('');
  const [reportsTimeFilter, setReportsTimeFilter] = useState('month'); // 'today', 'week', 'month'
  const [reportsClientFilter, setReportsClientFilter] = useState('all');
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all');
  const [showDashboard, setShowDashboard] = useState(true); // Dashboard view state

  // Modal states for viewing full content
  const [showContentModal, setShowContentModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');

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

  // Detect employee's department based on their name from database
  const getEmployeeDepartment = (name) => {
    const employee = employees.find(emp => emp.employeeName === name);
    if (employee) {
      return employee.department;
    }
    // Fallback to old detection method for backward compatibility
    if (name.includes('Video Editor') || name.includes('Videographer')) {
      return 'video';
    } else if (name.includes('Graphic Designer') || name.includes('Illustrator')) {
      return 'graphics';
    } else if (name.includes('Social Media')) {
      return 'social-media';
    }
    return null;
  };

  // Detect department from email
  const getDepartmentFromEmail = (email) => {
    if (!email) return null;
    const emailLower = email.toLowerCase();
    if (emailLower.includes('video')) return 'video';
    if (emailLower.includes('graphic')) return 'graphics';
    if (emailLower.includes('social')) return 'social-media';
    return null;
  };

  // Get current employee's department (from name or email)
  const getCurrentDepartment = () => {
    // First try to get from sessionStorage (set during login)
    const storedDepartment = sessionStorage.getItem('employeeDepartment');
    if (storedDepartment) {
      return storedDepartment;
    }

    // Try to get from stored employee data
    const storedEmployeeData = sessionStorage.getItem('employeeData');
    if (storedEmployeeData) {
      try {
        const employeeData = JSON.parse(storedEmployeeData);
        if (employeeData.department) {
          return employeeData.department.toLowerCase();
        }
      } catch (e) {
        console.error('Error parsing employee data:', e);
      }
    }

    // Try to get from employee name
    if (employeeName) {
      return getEmployeeDepartment(employeeName);
    }

    // If no name yet, try to get from email
    const user = auth.currentUser;
    if (user && user.email) {
      return getDepartmentFromEmail(user.email);
    }
    return null;
  };

  const currentDepartment = getCurrentDepartment();

  // Fetch employees from database
  useEffect(() => {
    const employeesRef = ref(database, 'employees');
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const employeesList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setEmployees(employeesList);

        // Check if current logged-in employee is inactive
        if (!isEmbedded) {
          const storedEmail = sessionStorage.getItem('employeeData');
          if (storedEmail) {
            try {
              const empData = JSON.parse(storedEmail);
              const currentEmp = employeesList.find(e => e.email === empData.email);

              // If employee is not found (deleted) or status is inactive/disabled
              if (!currentEmp || currentEmp.status === 'inactive' || currentEmp.status === 'disabled' || currentEmp.deleted === true) {
                // Employee has been deleted or disabled, log them out
                console.log('Employee account deleted or disabled. Logging out...');
                sessionStorage.clear();
                localStorage.clear();
                showToast('Your account has been deleted or disabled. Logging out...', 'error');
                setTimeout(() => {
                  navigate('/');
                }, 2000);
              }
            } catch (e) {
              console.error('Error checking employee status:', e);
            }
          }
        }
      } else {
        setEmployees([]);
      }
    });
    return () => unsubscribe();
  }, [isEmbedded, navigate, showToast]);

  // Initialize employee data from props (when embedded) or sessionStorage (set during login)
  useEffect(() => {
    // If embedded in SuperAdmin with employee data, use that directly
    if (isEmbedded && employeeData) {
      setEmployeeName(employeeData.employeeName);
      setEmployeeDepartment(employeeData.department);
      console.log('Loaded employee info from props:', employeeData);
      return;
    }

    // Otherwise, load from sessionStorage
    const storedDepartment = sessionStorage.getItem('employeeDepartment');
    const storedName = sessionStorage.getItem('employeeName');
    const storedEmployeeData = sessionStorage.getItem('employeeData');

    // If we have sessionStorage data (from employee login), use it and clear localStorage
    if (storedDepartment || storedName || storedEmployeeData) {
      // Clear old localStorage data to prevent conflicts
      localStorage.removeItem('employeeName');
      localStorage.removeItem('employeeDepartment');
      localStorage.removeItem('employeeEmail');

      if (storedDepartment) {
        setEmployeeDepartment(storedDepartment);
      }

      if (storedName) {
        setEmployeeName(storedName);
      }

      if (storedEmployeeData) {
        try {
          const employeeData = JSON.parse(storedEmployeeData);
          if (employeeData.employeeName && !storedName) {
            setEmployeeName(employeeData.employeeName);
          }
          if (employeeData.department && !storedDepartment) {
            setEmployeeDepartment(employeeData.department);
          }
        } catch (e) {
          console.error('Error parsing employee data:', e);
        }
      }
    }
  }, [employeeData, isEmbedded]);

  // Fetch clients (only active ones)
  useEffect(() => {
    const clientsRef = ref(database, 'clients');
    const unsubscribe = onValue(clientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const clientsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(client =>
          client.status !== 'inactive' &&
          client.deleted !== true
        ); // Hide inactive and deleted clients
        setClients(clientsList);
      } else {
        setClients([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Get employee names for name selector based on current department
  const getEmployeeNamesForSelector = () => {
    if (currentDepartment) {
      return employees
        .filter(emp => emp.department === currentDepartment)
        .map(emp => emp.employeeName);
    }
    // If no department detected, show all employee names
    return employees.map(emp => emp.employeeName);
  };

  const employeeNames = getEmployeeNamesForSelector();

  useEffect(() => {
    // Get employee name from sessionStorage (priority) or localStorage or auth
    const user = auth.currentUser;
    const sessionName = sessionStorage.getItem('employeeName');
    const savedName = localStorage.getItem('employeeName');

    // Prioritize sessionStorage (set during employee login)
    if (sessionName) {
      setEmployeeName(sessionName);
      return;
    }

    if (savedName && user && user.email) {
      // Check if saved name's department matches email's department
      const savedNameDept = getEmployeeDepartment(savedName);
      const emailDept = getDepartmentFromEmail(user.email);

      if (emailDept && savedNameDept !== emailDept) {
        // Department mismatch! Clear saved name and show selector
        localStorage.removeItem('employeeName');
        setShowNameSelector(true);
      } else {
        setEmployeeName(savedName);
      }
    } else if (savedName) {
      setEmployeeName(savedName);
    } else if (user && user.email) {
      // Detect department from email
      const deptFromEmail = getDepartmentFromEmail(user.email);

      // If we can detect department from email, show name selector
      // Otherwise use email username
      if (deptFromEmail) {
        setShowNameSelector(true);
      } else {
        const name = user.displayName || user.email?.split('@')[0] || '';
        if (name) {
          setEmployeeName(name);
        } else {
          setShowNameSelector(true);
        }
      }
    } else {
      setShowNameSelector(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');

    // Find employee with matching email and password
    const employee = employees.find(emp =>
      emp.email === loginEmail && emp.password === loginPassword
    );

    if (employee) {
      setEmployeeName(employee.employeeName);
      setEmployeeDepartment(employee.department);
      localStorage.setItem('employeeName', employee.employeeName);
      localStorage.setItem('employeeEmail', employee.email);
      localStorage.setItem('employeeDepartment', employee.department);
      setShowNameSelector(false);
      showToast(`Welcome, ${employee.employeeName}!`, 'success');
    } else {
      setLoginError('Invalid email or password');
      showToast('Invalid email or password', 'error');
    }
  };

  const handleNameSelect = (name) => {
    const oldName = employeeName;
    setEmployeeName(name);
    localStorage.setItem('employeeName', name);
    setShowNameSelector(false);
    setCustomNameInput(''); // Reset custom input
    if (oldName && oldName !== name) {
      showToast(`Name changed from ${oldName} to ${name}!`, 'success');
    } else {
      showToast(`Welcome, ${name}!`, 'success');
    }
  };

  useEffect(() => {
    if (!employeeName) return;

    const employeeDepartment = getEmployeeDepartment(employeeName);

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

    // Fetch tasks assigned to this employee ONLY from their department
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

          // Show tasks assigned to this employee
          // Keep showing tasks even after they're sent for approval or department changes
          const isAssignedToMe = task.assignedTo &&
            task.assignedTo.toLowerCase().trim() === employeeName.toLowerCase().trim();

          // Also check if task was submitted by this employee (to keep visibility after sending)
          const wasSubmittedByMe = task.submittedBy === employeeName;

          // Also check if task was originally from employee's department
          const isMyDepartment = employeeDepartment ?
            (task.department === employeeDepartment ||
              task.originalDepartment === employeeDepartment) : true;

          return (isAssignedToMe || wasSubmittedByMe) && isMyDepartment;
        });

        // Sort by deadline (upcoming first)
        tasksList.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        });

        setTasks(tasksList);
      } else {
        setTasks([]);
      }
    }, (error) => {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    });

    return () => {
      unsubscribeClients();
      unsubscribeStrategyClients();
      unsubscribeStrategyHeadClients();
      unsubscribeTasks();
    };
  }, [employeeName]);

  const handleStartWork = (taskId) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const currentTask = tasks.find(t => t.id === taskId);

    const updateData = {
      status: 'in-progress',
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Preserve revision count and related data
    if (currentTask?.revisionCount) {
      updateData.revisionCount = currentTask.revisionCount;
    }
    if (currentTask?.lastRevisionAt) {
      updateData.lastRevisionAt = currentTask.lastRevisionAt;
    }

    update(taskRef, updateData);
    showToast('Task started! You can now work on it.', 'success');
  };

  const handleStartTask = (taskId) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const currentTask = tasks.find(t => t.id === taskId);

    const updateData = {
      status: 'in-progress',
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    update(taskRef, updateData);
    showToast('🚀 Task started! The start time has been recorded.', 'success');
  };

  const handleMarkComplete = (taskId) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const currentTask = tasks.find(t => t.id === taskId);

    const updateData = {
      status: 'completed',
      completedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Preserve revision count and related data
    if (currentTask?.revisionCount) {
      updateData.revisionCount = currentTask.revisionCount;
    }
    if (currentTask?.lastRevisionAt) {
      updateData.lastRevisionAt = currentTask.lastRevisionAt;
    }

    update(taskRef, updateData);
    showToast('🎉 Task marked as completed! Click "Send for Approval" to submit for client review.', 'success');

    // Create congratulations message overlay
    const congratsDiv = document.createElement('div');
    congratsDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  };

  const handleSendForApproval = (taskId, task) => {
    // Show modal to select social media employee
    setSelectedTaskForSending(task);
    setShowSocialMediaEmployeeModal(true);
  };

  const handleSendToSocialMediaEmployee = (selectedEmployee) => {
    if (!selectedEmployee || !selectedTaskForSending) return;

    const taskRef = ref(database, `tasks/${selectedTaskForSending.id}`);
    const currentTask = tasks.find(t => t.id === selectedTaskForSending.id);

    const updateData = {
      status: 'pending-client-approval',
      submittedAt: new Date().toISOString(),
      submittedBy: employeeName,
      department: 'social-media',
      socialMediaAssignedTo: selectedEmployee,
      originalDepartment: currentDepartment || currentTask?.originalDepartment,
      lastUpdated: new Date().toISOString(),
      revisionMessage: null // Clear revision message when re-submitting
    };

    // Preserve revision count and related data
    if (currentTask?.revisionCount) {
      updateData.revisionCount = currentTask.revisionCount;
    }
    if (currentTask?.lastRevisionAt) {
      updateData.lastRevisionAt = currentTask.lastRevisionAt;
    }

    update(taskRef, updateData);
    showToast(`✅ Task sent to ${selectedEmployee} for client approval!`, 'success', 5000);
    setShowSocialMediaEmployeeModal(false);
    setSelectedTaskForSending(null);
  };

  const handleStartRevision = (taskId) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const currentTask = tasks.find(t => t.id === taskId);

    const updateData = {
      status: 'in-progress',
      revisionStartedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Preserve revision count and related data
    if (currentTask?.revisionCount) {
      updateData.revisionCount = currentTask.revisionCount;
    }
    if (currentTask?.lastRevisionAt) {
      updateData.lastRevisionAt = currentTask.lastRevisionAt;
    }

    update(taskRef, updateData);
    showToast('Started working on revisions.', 'info');
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

  const handleLogout = () => {
    auth.signOut().then(() => {
      navigate('/');
    });
  };

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

  const getSimplifiedStatus = (status) => {
    if (!status) return 'Pending';

    // Map all statuses to simplified versions
    if (status === 'completed' || status === 'approved' || status === 'pending-client-approval') {
      return 'Completed';
    } else if (status === 'posted') {
      return 'Posted';
    } else {
      return 'Pending';
    }
  };

  const getStatusColor = (status) => {
    const simplified = getSimplifiedStatus(status);
    switch (simplified) {
      case 'Completed':
        return '#10b981'; // Brighter green for better visibility
      case 'Posted':
        return '#06b6d4'; // Brighter cyan
      case 'Pending':
        return '#f59e0b'; // Brighter orange
      default:
        return '#6b7280'; // Gray
    }
  };

  const getDepartmentColor = (dept) => {
    switch (dept) {
      case 'strategy': return '#9b59b6';
      case 'video': return '#e74c3c';
      case 'graphics': return '#3498db';
      case 'social-media': return '#1abc9c';
      default: return '#95a5a6';
    }
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
        <title>${employeeName} - ${clientName} Tasks Report</title>
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
          <h1>Task Report - ${clientName}</h1>
          <p>Employee: ${employeeName}</p>
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
              <th>Department</th>
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
                <td style="text-transform: uppercase">${task.department || 'N/A'}</td>
                <td>${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</td>
                <td><span class="status">${task.status?.replace(/-/g, ' ') || 'N/A'}</span></td>
                <td>${task.revisionCount || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated from the Employee Dashboard</p>
          <p>Employee: ${employeeName} | Client: ${clientName}</p>
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

  // Handle statistics card clicks
  const handleStatCardClick = (filterType) => {
    setActiveFilter(filterType);
    setSelectedStatus('all'); // Reset dropdown filter

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

  // Function to download all clients report
  const downloadAllClientsReport = () => {
    const groupedTasks = groupTasksByClient(getSearchFilteredTasks());
    const reportDate = new Date().toLocaleDateString();
    const period = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${employeeName} - All Clients Report</title>
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
          <h1>${employeeName} - All Clients Report</h1>
          <p>Generated on ${reportDate}</p>
        
        </div>
        
        <div class="summary">
          <h3>Report Summary</h3>
          <p><strong>Total Tasks:</strong> ${getSearchFilteredTasks().length}</p>
          <p><strong>Total Clients:</strong> ${Object.keys(groupedTasks).length}</p>
          <p><strong>Employee:</strong> ${employeeName}</p>
        </div>

        ${Object.entries(groupedTasks).map(([clientName, clientTasks]) => {
      const completed = clientTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
      const inProgress = clientTasks.filter(t => t.status === 'in-progress').length;

      return `
          <div class="client-section">
            <div class="client-header">
              <h2 style="margin: 0; font-size: 16px;">${clientName} (${clientTasks.length} tasks)</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Completed: ${completed} | In Progress: ${inProgress}</p>
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
                ${clientTasks.map(task => `
                  <tr>
                    <td><strong>${task.taskName || 'N/A'}</strong></td>
                    <td>${task.projectName || 'N/A'}</td>
                    <td style="text-transform: uppercase">${task.department || 'N/A'}</td>
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
          <p>This report was generated from the Employee Dashboard</p>
          <p>Employee: ${employeeName}</p>
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

    showToast(`PDF report generated with ${getSearchFilteredTasks().length} task(s) from ${Object.keys(groupedTasks).length} client(s)`, 'success');
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = selectedStatus === 'all' || task.status === selectedStatus;
    const deptMatch = selectedDepartment === 'all' || task.department === selectedDepartment;
    const taskDate = task.deadline;
    const monthMatch = taskDate && taskDate.startsWith(selectedMonth);

    // Apply active filter from statistics cards
    let cardFilterMatch = false;
    if (activeFilter === 'all') {
      cardFilterMatch = true;
    } else {
      cardFilterMatch = task.status === activeFilter;
    }

    return statusMatch && deptMatch && monthMatch && cardFilterMatch;
  });

  const stats = {
    total: tasks.length,
    assigned: tasks.filter(t => t.status === 'assigned').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pendingApproval: tasks.filter(t => t.status === 'pending-client-approval').length,
    approved: tasks.filter(t => t.status === 'approved').length,
    posted: tasks.filter(t => t.status === 'posted').length,
    revisionRequired: tasks.filter(t => t.status === 'revision-required').length
  };

  const isTaskOverdue = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date() && new Date(deadline).toDateString() !== new Date().toDateString();
  };

  // Employee Login Modal
  if (showNameSelector) {
    return (
      <div className="dashboard">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
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
      </div >
    );
  }

  return (
    <div className={`employee-dashboard ${currentDepartment === 'video' ? 'video-theme' : currentDepartment === 'graphics' ? 'graphics-theme' : ''}`}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Revision Notification Popup - Only show for video and graphics employees */}
      {employeeName && (currentDepartment === 'video' || currentDepartment === 'graphics') && (
        <RevisionNotificationPopup
          employeeName={employeeName}
          department={currentDepartment}
        />
      )}

      {/* Sidebar Navigation */}
      <div className="employee-sidebar">
        <div className="employee-sidebar-header">
          <div className="employee-sidebar-logo">
            <div className="employee-sidebar-logo-icon">
              {currentDepartment === 'video' && <Video size={24} />}
              {currentDepartment === 'graphics' && <Image size={24} />}
              {!currentDepartment && <User size={24} />}
            </div>
            <div className="employee-sidebar-logo-text">
              <h2>
                {currentDepartment === 'video' && 'Video'}
                {currentDepartment === 'graphics' && 'Graphics'}
                {currentDepartment === 'social-media' && 'Social Media'}
                {!currentDepartment && 'Employee'}
              </h2>
              <p>Employee</p>
            </div>
          </div>
        </div>

        <nav className="employee-sidebar-nav">
          <div className="employee-sidebar-section">

            <ul className="employee-sidebar-menu">
              <li className="employee-sidebar-menu-item">
                <button
                  onClick={() => {
                    setShowDashboard(true);
                    setShowReports(false);
                    showToast('Showing dashboard overview', 'info');
                  }}
                  className={`employee-sidebar-menu-link ${showDashboard && !showReports ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: (showDashboard && !showReports) ? 'rgba(255, 255, 255, 0.1)' : 'none',
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
                    showToast('Showing my tasks', 'info');
                  }}
                  className={`employee-sidebar-menu-link ${!showDashboard && !showReports ? 'active' : ''}`}
                  style={{
                    border: 'none',
                    background: (!showDashboard && !showReports) ? 'rgba(255, 255, 255, 0.1)' : 'none',
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
                    setShowReports(!showReports);
                    setShowDashboard(false);
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

        {/* User Profile Section */}
        <div className="employee-sidebar-user">
          <div className="employee-sidebar-user-info">
            <div className="employee-sidebar-user-avatar">
              {employeeName ? employeeName.charAt(0).toUpperCase() : 'E'}
            </div>
            <div className="employee-sidebar-user-details">
              <h4>{employeeName || 'Employee'}</h4>
              <p>
                {currentDepartment === 'video' && 'Video Team'}
                {currentDepartment === 'graphics' && 'Graphics Team'}
                {currentDepartment === 'social-media' && 'Social Media Team'}
                {!currentDepartment && 'Team Member'}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="employee-btn employee-btn-logout" style={{ marginTop: '12px', width: '100%' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="employee-main-content">
        {/* Page Header - Hidden when Reports is active */}
        {!showReports && (
          <>
            <div className="employee-header">
              <div className="employee-header-content">
                <div className="employee-header-left">
                  <div className="employee-header-title">
                    <h1>
                      {currentDepartment === 'video' && '📹 Video Employee Dashboard'}
                      {currentDepartment === 'graphics' && '🎨 Graphics Employee Dashboard'}
                      {currentDepartment === 'social-media' && '📱 Social Media Employee Dashboard'}
                      {!currentDepartment && 'My Tasks Dashboard'}
                    </h1>
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

            {/* Statistics Cards - Only show in dashboard view */}
            {showDashboard && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  marginBottom: '32px',
                  padding: '0'
                }}>
                  {/* Total Tasks */}
                  <div
                    onClick={() => handleStatCardClick('all')}
                    style={{
                      background: activeFilter === 'all'
                        ? 'linear-gradient(135deg, #FF8C4F 0%, #FF4D51 100%)'
                        : 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
                      borderRadius: '20px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: activeFilter === 'all'
                        ? '0 10px 25px rgba(255, 94, 98, 0.4)'
                        : '0 4px 15px rgba(255, 94, 98, 0.15)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      transform: activeFilter === 'all' ? 'translateY(-5px) scale(1.02)' : 'scale(1)',
                      border: activeFilter === 'all' ? '3px solid white' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Briefcase size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '32px', margin: '0 0 2px 0', lineHeight: 1, fontWeight: '800' }}>{stats.total}</h3>
                      <p style={{ fontSize: '15px', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Total Tasks</p>
                      <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '2px' }}>All tasks of month</span>
                    </div>
                  </div>

                  {/* In Progress */}
                  <div
                    onClick={() => handleStatCardClick('in-progress')}
                    style={{
                      background: activeFilter === 'in-progress'
                        ? 'linear-gradient(135deg, #3E94FE 0%, #00E1FE 100%)'
                        : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      borderRadius: '20px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: activeFilter === 'in-progress'
                        ? '0 10px 25px rgba(79, 172, 254, 0.4)'
                        : '0 4px 15px rgba(79, 172, 254, 0.15)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      transform: activeFilter === 'in-progress' ? 'translateY(-5px) scale(1.02)' : 'scale(1)',
                      border: activeFilter === 'in-progress' ? '3px solid white' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Clock size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '32px', margin: '0 0 2px 0', lineHeight: 1, fontWeight: '800' }}>{stats.inProgress}</h3>
                      <p style={{ fontSize: '15px', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>In Progress</p>
                      <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '2px' }}>Tasks being worked on</span>
                    </div>
                  </div>

                  {/* Completed */}
                  <div
                    onClick={() => handleStatCardClick('completed')}
                    style={{
                      background: activeFilter === 'completed'
                        ? 'linear-gradient(135deg, #39D96D 0%, #2ED9C5 100%)'
                        : 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                      borderRadius: '20px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: activeFilter === 'completed'
                        ? '0 10px 25px rgba(67, 233, 123, 0.4)'
                        : '0 4px 15px rgba(67, 233, 123, 0.15)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      transform: activeFilter === 'completed' ? 'translateY(-5px) scale(1.02)' : 'scale(1)',
                      border: activeFilter === 'completed' ? '3px solid white' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <CheckCircle size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '32px', margin: '0 0 2px 0', lineHeight: 1, fontWeight: '800' }}>{stats.completed}</h3>
                      <p style={{ fontSize: '15px', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Completed</p>
                      <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '2px' }}>Finished tasks</span>
                    </div>
                  </div>

                  {/* Pending Client Approval */}
                  <div
                    onClick={() => handleStatCardClick('pending-client-approval')}
                    style={{
                      background: activeFilter === 'pending-client-approval'
                        ? 'linear-gradient(135deg, #E8452D 0%, #D43022 100%)'
                        : 'linear-gradient(135deg, #f85032 0%, #e73827 100%)',
                      borderRadius: '20px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: activeFilter === 'pending-client-approval'
                        ? '0 10px 25px rgba(248, 80, 50, 0.4)'
                        : '0 4px 15px rgba(248, 80, 50, 0.15)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      transform: activeFilter === 'pending-client-approval' ? 'translateY(-5px) scale(1.02)' : 'scale(1)',
                      border: activeFilter === 'pending-client-approval' ? '3px solid white' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <AlertCircle size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '32px', margin: '0 0 2px 0', lineHeight: 1, fontWeight: '800' }}>{stats.pendingApproval}</h3>
                      <p style={{ fontSize: '15px', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Pending</p>
                      <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '2px' }}>Awaiting client feedback</span>
                    </div>
                  </div>

                  {/* Approved */}
                  <div
                    onClick={() => handleStatCardClick('approved')}
                    style={{
                      background: activeFilter === 'approved'
                        ? 'linear-gradient(135deg, #5A6EDC 0%, #6A41B6 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '20px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: activeFilter === 'approved'
                        ? '0 10px 25px rgba(102, 126, 234, 0.4)'
                        : '0 4px 15px rgba(102, 126, 234, 0.15)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      transform: activeFilter === 'approved' ? 'translateY(-5px) scale(1.02)' : 'scale(1)',
                      border: activeFilter === 'approved' ? '3px solid white' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <CheckCircle size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '32px', margin: '0 0 2px 0', lineHeight: 1, fontWeight: '800' }}>{stats.approved}</h3>
                      <p style={{ fontSize: '15px', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Approved</p>
                      <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '2px' }}>Approved by staff</span>
                    </div>
                  </div>

                  {/* Posted */}
                  <div
                    onClick={() => handleStatCardClick('posted')}
                    style={{
                      background: activeFilter === 'posted'
                        ? 'linear-gradient(135deg, #1C85A0 0%, #66BED4 100%)'
                        : 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
                      borderRadius: '20px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: activeFilter === 'posted'
                        ? '0 10px 25px rgba(33, 147, 176, 0.4)'
                        : '0 4px 15px rgba(33, 147, 176, 0.15)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      transform: activeFilter === 'posted' ? 'translateY(-5px) scale(1.02)' : 'scale(1)',
                      border: activeFilter === 'posted' ? '3px solid white' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Send size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '32px', margin: '0 0 2px 0', lineHeight: 1, fontWeight: '800' }}>{stats.posted}</h3>
                      <p style={{ fontSize: '15px', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Posted</p>
                      <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '2px' }}>Tasks published</span>
                    </div>
                  </div>

                  {/* Revision Required */}
                  <div
                    onClick={() => handleStatCardClick('revision-required')}
                    style={{
                      background: activeFilter === 'revision-required'
                        ? 'linear-gradient(135deg, #E08AFB 0%, #E5475C 100%)'
                        : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      borderRadius: '20px',
                      padding: '24px',
                      color: 'white',
                      boxShadow: activeFilter === 'revision-required'
                        ? '0 10px 25px rgba(240, 147, 251, 0.4)'
                        : '0 4px 15px rgba(240, 147, 251, 0.15)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      transform: activeFilter === 'revision-required' ? 'translateY(-5px) scale(1.02)' : 'scale(1)',
                      border: activeFilter === 'revision-required' ? '3px solid white' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <AlertCircle size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '32px', margin: '0 0 2px 0', lineHeight: 1, fontWeight: '800' }}>{stats.revisionRequired}</h3>
                      <p style={{ fontSize: '15px', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Revision</p>
                      <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '2px' }}>Needs correction</span>
                    </div>
                  </div>
                </div>
                {/* Daily Report and Team Performance Cards */}
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
                        {currentDepartment === 'video' ? '📹 Video' : currentDepartment === 'graphics' ? '🎨 Graphics' : '📱 Social Media'}
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
                            return tasks.filter(task =>
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
                            return tasks.filter(task =>
                              task.completedAt && task.completedAt.startsWith(today)
                            ).length;
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
                            const today = new Date();
                            return tasks.filter(task => {
                              if (!task.deadline) return false;
                              const deadline = new Date(task.deadline);
                              return deadline <= today && (task.status === 'assigned' || task.status === 'in-progress');
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
                            const totalTasks = tasks.length;
                            const completedTasks = tasks.filter(t =>
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
                        const todayTasks = tasks.filter(task =>
                          task.deadline === today || task.postDate === today
                        );
                        if (todayTasks.length > 0) {
                          // Scroll to tasks section
                          const tasksSection = document.querySelector('.card.full-width');
                          if (tasksSection) {
                            tasksSection.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start'
                            });
                          }
                        } else {
                          alert('No tasks scheduled for today!');
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

                  {/* Team Performance Card */}
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
                            const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
                            const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                            return tasks.filter(task => {
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
                          {tasks.filter(t =>
                            t.status === 'completed' || t.status === 'approved' || t.status === 'posted'
                          ).length}
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
                          {tasks.filter(t => t.status === 'in-progress').length}
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>In Progress</div>
                      </div>

                      {/* Personal Efficiency */}
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
                            const inProgress = tasks.filter(t => t.status === 'in-progress').length;
                            const completed = tasks.filter(t =>
                              t.status === 'completed' || t.status === 'approved' || t.status === 'posted'
                            ).length;
                            const total = inProgress + completed;
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
                        const tasksSection = document.querySelector('.card.full-width');
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
                      📋 View All Tasks
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Tasks Table - Only show when not in dashboard view and not in reports view */}
            {!showDashboard && !showReports && (
              <div className="card full-width" style={{ marginBottom: '30px' }}>
                <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '16px' }}>
                    <div>
                      <h2>My Tasks ({getSearchFilteredTasks().length})</h2>
                      <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>Tasks assigned to you, organized by client. Select tasks to download report.</p>
                    </div>
                  </div>

                  {/* Search Bar, View Toggle, and Download All Button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    flexWrap: 'wrap'
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
                          fontSize: '13px',
                          fontWeight: '600',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <List size={16} />
                        List View
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
                          fontSize: '13px',
                          fontWeight: '600',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Grid size={16} />
                        Card View
                      </button>
                    </div>

                    {/* Download All Reports Button - Hide when viewing specific client tasks in card view */}
                    {!(viewMode === 'card' && selectedClientForCardView) && (
                      <button
                        onClick={() => downloadAllClientsReport()}
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
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
                      >
                        <Download size={18} />
                        Download All Reports (PDF)
                      </button>
                    )}
                  </div>

                  {/* Search Results Info */}
                  {searchQuery && (
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '8px',
                      marginTop: '16px',
                      fontSize: '14px',
                      color: '#1976d2'
                    }}>
                      Found {getSearchFilteredTasks().length} task(s) matching "{searchQuery}"
                      {getSearchFilteredTasks().length !== filteredTasks.length && (
                        <span style={{ marginLeft: '8px', opacity: 0.8 }}>
                          (filtered from {filteredTasks.length} total)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {getSearchFilteredTasks().length === 0 ? (
                  <div className="empty-state">
                    <p>{searchQuery ? `No tasks found matching "${searchQuery}"` : 'No tasks assigned to you yet.'}</p>
                  </div>
                ) : viewMode === 'card' ? (
                  /* Card View - Client Cards */
                  selectedClientForCardView ? (
                    /* Show tasks for selected client */
                    <div style={{ padding: '20px' }}>
                      {/* Back Button */}
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
                          padding: '20px',
                          background: currentDepartment === 'video'
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : currentDepartment === 'graphics'
                              ? 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)'
                              : 'linear-gradient(135deg, #1dd1a1 0%, #55efc4 100%)',
                          color: 'white',
                          textAlign: 'center'
                        }}>
                          <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
                            {selectedClientForCardView}
                          </h3>
                          <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                            {groupTasksByClient(getSearchFilteredTasks())[selectedClientForCardView]?.length || 0} task(s)
                          </p>
                        </div>
                      </div>

                      {/* Task Cards Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '20px'
                      }}>
                        {(groupTasksByClient(getSearchFilteredTasks())[selectedClientForCardView] || []).map(task => {
                          const gradientColors = currentDepartment === 'video'
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : currentDepartment === 'graphics'
                              ? 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)'
                              : 'linear-gradient(135deg, #1dd1a1 0%, #55efc4 100%)';

                          const clientInitial = (task.clientName || 'U').charAt(0).toUpperCase();
                          const isOverdue = isTaskOverdue(task.deadline);

                          return (
                            <div
                              key={task.id}
                              style={{
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%'
                              }}
                            >
                              {/* Overdue Badge - Top Right */}
                              {isOverdue && task.status !== 'completed' && task.status !== 'posted' && (
                                <div style={{
                                  position: 'absolute',
                                  top: '12px',
                                  right: '12px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  zIndex: 10
                                }}>
                                  OVERDUE
                                </div>
                              )}

                              {/* Notification Bell Icon for Revision - Below Overdue Badge */}
                              {task.revisionMessage && (
                                <button
                                  onClick={() => {
                                    setSelectedRevisionNote(task.revisionMessage);
                                    setShowRevisionNoteModal(true);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: isOverdue && task.status !== 'completed' && task.status !== 'posted' ? '48px' : '12px',
                                    right: '12px',
                                    backgroundColor: '#ffc107',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    zIndex: 10,
                                    boxShadow: '0 2px 8px rgba(255, 193, 7, 0.4)',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.transform = 'scale(1.1)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.6)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.transform = 'scale(1)';
                                    e.target.style.boxShadow = '0 2px 8px rgba(255, 193, 7, 0.4)';
                                  }}
                                >
                                  <AlertCircle size={18} />
                                </button>
                              )}

                              {/* Checkbox - Top Left Corner */}
                              <input
                                type="checkbox"
                                checked={isTaskSelected(task.clientName, task.id)}
                                onChange={() => toggleTaskSelection(task.clientName, task.id)}
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  left: '8px',
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  zIndex: 10,
                                  accentColor: '#3b82f6'
                                }}
                              />

                              {/* Card Header with Gradient */}
                              <div style={{
                                background: gradientColors,
                                padding: '20px',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                                gap: '12px'
                              }}>
                                <div style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '50%',
                                  backgroundColor: 'rgba(255,255,255,0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '20px',
                                  fontWeight: '700',
                                  flexShrink: 0
                                }}>
                                  {clientInitial}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {task.taskName}
                                  </div>
                                  <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                    {task.clientName}
                                  </div>
                                </div>
                              </div>

                              {/* Card Body - Info Grid */}
                              <div style={{ padding: '16px', backgroundColor: '#f8f9fa', flex: 1 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                  {/* Project Name */}
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Project</div>
                                    <div style={{
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      backgroundColor: '#e3f2fd',
                                      color: '#1976d2',
                                      textAlign: 'center'
                                    }}>
                                      {task.projectName || 'N/A'}
                                    </div>
                                  </div>

                                  {/* Deadline */}
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Due Date</div>
                                    <div style={{
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      backgroundColor: isOverdue ? '#fee2e2' : '#f3f4f6',
                                      color: isOverdue ? '#dc2626' : '#374151',
                                      textAlign: 'center'
                                    }}>
                                      {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not set'}
                                    </div>
                                  </div>

                                  {/* Revisions */}
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Revisions</div>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '6px',
                                      borderRadius: '6px',
                                      backgroundColor: 'white'
                                    }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        backgroundColor: (task.revisionCount || 0) > 0 ? '#dc3545' : '#10b981',
                                        color: 'white'
                                      }}>
                                        {task.revisionCount || 0}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Department */}
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Department</div>
                                    <div style={{
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      backgroundColor: getDepartmentColor(task.department),
                                      color: 'white',
                                      textAlign: 'center',
                                      textTransform: 'uppercase'
                                    }}>
                                      {task.department}
                                    </div>
                                  </div>
                                </div>

                                {/* Assigned To */}
                                <div style={{ marginBottom: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Assigned To:</div>
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                                    {task.assignedTo || 'Unassigned'}
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer - Status & Actions */}
                              <div style={{ padding: '16px', backgroundColor: 'white', flexShrink: 0 }}>
                                {/* Status Dropdown */}
                                <div style={{ marginBottom: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', textAlign: 'center' }}>Status:</div>
                                  <select
                                    value={task.status}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: '2px solid #e5e7eb',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      backgroundColor: getStatusColor(task.status),
                                      color: 'white',
                                      textAlign: 'center'
                                    }}
                                  >
                                    <option value="assigned" style={{ backgroundColor: '#fff', color: '#333' }}>Assigned</option>
                                    <option value="in-progress" style={{ backgroundColor: '#fff', color: '#333' }}>In Progress</option>
                                    <option value="completed" style={{ backgroundColor: '#fff', color: '#333' }}>Completed</option>
                                    <option value="pending-client-approval" style={{ backgroundColor: '#fff', color: '#333' }}>Pending Approval</option>
                                    <option value="approved" style={{ backgroundColor: '#fff', color: '#333' }}>Approved</option>
                                    <option value="posted" style={{ backgroundColor: '#fff', color: '#333' }}>Posted</option>
                                    <option value="revision-required" style={{ backgroundColor: '#fff', color: '#333' }}>Revision Required</option>
                                  </select>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {task.status === 'assigned' && (
                                    <button
                                      onClick={() => handleStartWork(task.id)}
                                      style={{
                                        width: '100%',
                                        backgroundColor: '#3b82f6',
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
                                        gap: '6px'
                                      }}
                                    >
                                      <PlayCircle size={14} /> Start Work
                                    </button>
                                  )}

                                  {task.status === 'revision-required' && (
                                    <button
                                      onClick={() => handleStartRevision(task.id)}
                                      style={{
                                        width: '100%',
                                        backgroundColor: '#f59e0b',
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
                                        gap: '6px'
                                      }}
                                    >
                                      <PlayCircle size={14} /> Start Revision
                                    </button>
                                  )}

                                  {/* Start Button - Shows when task is assigned or pending */}
                                  {(task.status === 'assigned' || task.status === 'assigned-to-department' || task.status === 'pending' || task.status === 'approved') && (
                                    <button
                                      onClick={() => handleStartTask(task.id)}
                                      style={{
                                        width: '100%',
                                        backgroundColor: '#3b82f6',
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
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#2563eb';
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#3b82f6';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    >
                                      <PlayCircle size={14} /> Start Task
                                    </button>
                                  )}

                                  {/* Complete Button - Shows when task is in progress */}
                                  {task.status === 'in-progress' && (
                                    <button
                                      onClick={() => handleMarkComplete(task.id)}
                                      style={{
                                        width: '100%',
                                        backgroundColor: '#10b981',
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
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#059669';
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#10b981';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    >
                                      <CheckCircle size={14} /> Mark Complete
                                    </button>
                                  )}

                                  {/* Send for Approval Button - Shows when task is completed */}
                                  {task.status === 'completed' && (
                                    <button
                                      onClick={() => handleSendForApproval(task.id, task)}
                                      style={{
                                        width: '100%',
                                        backgroundColor: '#8b5cf6',
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
                                        gap: '6px'
                                      }}
                                    >
                                      <Send size={14} /> Send for Approval
                                    </button>
                                  )}

                                  {(task.status === 'pending-client-approval' || task.status === 'approved' || task.status === 'posted') && (
                                    <div style={{
                                      width: '100%',
                                      padding: '10px 16px',
                                      backgroundColor: '#e7f3ff',
                                      borderRadius: '8px',
                                      fontSize: '13px',
                                      color: '#0066cc',
                                      fontWeight: '600',
                                      textAlign: 'center',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px'
                                    }}>
                                      <CheckCircle size={14} /> {task.status === 'pending-client-approval' ? '✓ Awaiting Approval' : task.status === 'approved' ? '✓ Approved' : '✓ Posted'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Show client cards */
                    <div style={{ padding: '20px' }}>
                      {/* Action Buttons Row */}
                      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Download All Button */}
                        <button
                          onClick={() => downloadAllClientsReport()}
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
                            gap: '8px'
                          }}
                        >
                          📥 Download All
                        </button>
                      </div>

                      {/* Client Cards Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '20px'
                      }}>
                        {Object.entries(groupTasksByClient(getSearchFilteredTasks())).map(([clientName, clientTasks]) => {
                          // Determine gradient color based on employee department
                          let gradientColors = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

                          if (currentDepartment === 'video') {
                            gradientColors = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                          } else if (currentDepartment === 'graphics') {
                            gradientColors = 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)';
                          } else if (currentDepartment === 'social-media') {
                            gradientColors = 'linear-gradient(135deg, #1dd1a1 0%, #55efc4 100%)';
                          }

                          const clientInitial = (clientName || 'U').charAt(0).toUpperCase();
                          const totalTasks = clientTasks.length;
                          const completedTasks = clientTasks.filter(t => t.status === 'completed' || t.status === 'posted').length;
                          const inProgressTasks = clientTasks.filter(t => t.status === 'in-progress').length;

                          return (
                            <div
                              key={clientName}
                              onClick={() => setSelectedClientForCardView(clientName)}
                              style={{
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                border: '1px solid #e9ecef'
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
                                background: gradientColors,
                                padding: '24px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                              }}>
                                {/* Client Avatar */}
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

                                {/* Client Info */}
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

                              {/* Task Stats */}
                              <div style={{
                                padding: '20px',
                                display: 'flex',
                                justifyContent: 'space-around',
                                gap: '12px'
                              }}>
                                {/* Total Tasks */}
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

                                {/* Completed */}
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

                                {/* In Progress */}
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

                              {/* View Details Button */}
                              <div style={{
                                padding: '0 20px 20px 20px'
                              }}>
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
                    </div>
                  )
                ) : (
                  /* List View - Grouped by Client */
                  <div style={{ padding: '0' }}>
                    {Object.entries(groupTasksByClient(getSearchFilteredTasks())).map(([clientName, clientGroup]) => {
                      const isExpanded = expandedClients[clientName];
                      const totalTasks = clientGroup.length;
                      const completedTasks = clientGroup.filter(t => t.status === 'completed' || t.status === 'posted').length;
                      const inProgressTasks = clientGroup.filter(t => t.status === 'in-progress').length;

                      return (
                        <div key={clientName} style={{
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          overflow: 'hidden',
                          border: '1px solid #e9ecef',
                          marginBottom: '16px'
                        }}>
                          <div
                            onClick={() => toggleClientExpansion(clientName)}
                            style={{
                              padding: '20px',
                              background: currentDepartment === 'video'
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : currentDepartment === 'graphics'
                                  ? 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)'
                                  : 'linear-gradient(135deg, #1dd1a1 0%, #55efc4 100%)',
                              color: 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600'
                              }}>
                                {totalTasks}
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                  {clientName}
                                </h3>
                                <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>
                                  {totalTasks} task{totalTasks !== 1 ? 's' : ''} • {completedTasks} completed • {inProgressTasks} in progress
                                </div>
                              </div>
                            </div>
                            <div style={{
                              fontSize: '24px',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.3s ease'
                            }}>
                              ▼
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0', overflowX: 'auto', width: '100%' }}>
                              <table style={{
                                width: '100%',
                                minWidth: '1400px',
                                borderCollapse: 'collapse'
                              }}>
                                <thead>
                                  <tr style={{
                                    backgroundColor: '#f8f9fa',
                                    borderBottom: '2px solid #e9ecef'
                                  }}>
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
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientGroup.map(task => (
                                    <tr key={task.id} style={{
                                      borderBottom: '1px solid #f1f3f4'
                                    }}>
                                      <td style={{ padding: '12px 16px', textAlign: 'left', color: '#495057', fontSize: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                          {getStatusIcon(task.status)}
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{task.taskName}</div>
                                            {isTaskOverdue(task.deadline) && task.status !== 'posted' && task.status !== 'completed' && (
                                              <span style={{
                                                backgroundColor: '#dc3545',
                                                color: 'white',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                marginRight: '6px'
                                              }}>
                                                OVERDUE
                                              </span>
                                            )}
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
                                        </div>
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'left', color: '#6c757d', fontSize: '13px', maxWidth: '200px' }}>
                                        {(task.content || task.taskDescription || task.description) ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                              lineHeight: '1.4',
                                              flex: 1
                                            }}>
                                              {task.content || task.taskDescription || task.description}
                                            </div>
                                            <button
                                              onClick={() => {
                                                setModalTitle('Content');
                                                setModalContent(task.content || task.taskDescription || task.description);
                                                setShowContentModal(true);
                                              }}
                                              style={{
                                                padding: '4px 8px',
                                                background: '#667eea',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              View More
                                            </button>
                                          </div>
                                        ) : (
                                          <span style={{ color: '#adb5bd' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        {task.referenceLink ? (
                                          <a
                                            href={task.referenceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              color: '#667eea',
                                              textDecoration: 'none',
                                              fontWeight: '500',
                                              fontSize: '13px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                            onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                                            onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                                          >
                                            🔗 View
                                          </a>
                                        ) : (
                                          <span style={{ color: '#adb5bd', fontSize: '13px' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'left', color: '#6c757d', fontSize: '13px', maxWidth: '200px' }}>
                                        {task.specialNotes ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                              lineHeight: '1.4',
                                              flex: 1
                                            }}>
                                              {task.specialNotes}
                                            </div>
                                            <button
                                              onClick={() => {
                                                setModalTitle('Special Notes');
                                                setModalContent(task.specialNotes);
                                                setShowNotesModal(true);
                                              }}
                                              style={{
                                                padding: '4px 8px',
                                                background: '#667eea',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              View More
                                            </button>
                                          </div>
                                        ) : (
                                          <span style={{ color: '#adb5bd' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '13px' }}>
                                        {task.deadline ? (
                                          <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: isTaskOverdue(task.deadline) ? '#dc3545' : '#495057'
                                          }}>
                                            <Calendar size={14} />
                                            {new Date(task.deadline).toLocaleDateString()}
                                          </span>
                                        ) : '-'}
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '12px' }}>
                                        {task.startedAt ? (
                                          <div>
                                            <div style={{ fontWeight: '600', color: '#10b981' }}>
                                              {new Date(task.startedAt).toLocaleDateString()}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                              {new Date(task.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                          </div>
                                        ) : (
                                          <span style={{ color: '#adb5bd', fontSize: '13px' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '12px' }}>
                                        {task.completedAt ? (
                                          <div>
                                            <div style={{ fontWeight: '600', color: '#8b5cf6' }}>
                                              {new Date(task.completedAt).toLocaleDateString()}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                              {new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                          </div>
                                        ) : '-'}
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#495057', fontSize: '11px' }}>
                                        {task.lastRevisionAt || task.submittedAt ? (
                                          <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            alignItems: 'center'
                                          }}>
                                            {task.lastRevisionAt && (
                                              <div style={{
                                                padding: '6px 10px',
                                                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                                borderRadius: '6px',
                                                border: '1px solid #fbbf24',
                                                width: '100%'
                                              }}>
                                                <div style={{ fontWeight: '700', color: '#92400e', fontSize: '10px', marginBottom: '2px' }}>
                                                  ⚠️ REVISION
                                                </div>
                                                <div style={{ fontWeight: '600', color: '#78350f' }}>
                                                  {new Date(task.lastRevisionAt).toLocaleDateString()}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#92400e' }}>
                                                  {new Date(task.lastRevisionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                              </div>
                                            )}
                                            {task.submittedAt && (
                                              <div style={{
                                                padding: '6px 10px',
                                                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                                borderRadius: '6px',
                                                border: '1px solid #60a5fa',
                                                width: '100%'
                                              }}>
                                                <div style={{ fontWeight: '700', color: '#1e40af', fontSize: '10px', marginBottom: '2px' }}>
                                                  ✓ SUBMITTED
                                                </div>
                                                <div style={{ fontWeight: '600', color: '#1e3a8a' }}>
                                                  {new Date(task.submittedAt).toLocaleDateString()}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#1e40af' }}>
                                                  {new Date(task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No timeline</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{
                                          display: 'inline-block',
                                          padding: '10px 20px',
                                          borderRadius: '8px',
                                          fontSize: '13px',
                                          fontWeight: '700',
                                          backgroundColor: getStatusColor(task.status),
                                          color: 'white',
                                          textTransform: 'capitalize',
                                          whiteSpace: 'nowrap',
                                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                          letterSpacing: '0.3px'
                                        }}>
                                          {getSimplifiedStatus(task.status)}
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
                                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                          {task.status === 'assigned' && (
                                            <button
                                              onClick={() => handleStartWork(task.id)}
                                              style={{
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontWeight: '500'
                                              }}
                                            >
                                              <PlayCircle size={12} /> Start
                                            </button>
                                          )}

                                          {task.status === 'revision-required' && (
                                            <button
                                              onClick={() => handleStartRevision(task.id)}
                                              style={{
                                                backgroundColor: '#f59e0b',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontWeight: '500'
                                              }}
                                            >
                                              <PlayCircle size={12} /> Start Revision
                                            </button>
                                          )}

                                          {task.status === 'in-progress' && (
                                            <button
                                              onClick={() => handleMarkComplete(task.id)}
                                              style={{
                                                backgroundColor: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontWeight: '500'
                                              }}
                                            >
                                              <CheckCircle size={12} /> Complete
                                            </button>
                                          )}

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
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontWeight: '500'
                                              }}
                                            >
                                              <Send size={12} /> Send for Approval
                                            </button>
                                          )}

                                          {(task.status === 'pending-client-approval' || task.status === 'approved' || task.status === 'posted') && (
                                            <span style={{
                                              padding: '6px 12px',
                                              backgroundColor: '#e7f3ff',
                                              borderRadius: '6px',
                                              fontSize: '11px',
                                              color: '#0066cc',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              fontWeight: '500'
                                            }}>
                                              <CheckCircle size={12} /> {task.status === 'pending-client-approval' ? 'Awaiting Approval' : task.status === 'approved' ? 'Approved' : 'Posted'}
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
            )}
          </>
        )}

        {/* Reports Section */}
        {showReports && (() => {
          let allMonthTasks = filteredTasks;

          // Apply time filter
          if (reportsTimeFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            allMonthTasks = allMonthTasks.filter(t => t.deadline && t.deadline.startsWith(today));
          } else if (reportsTimeFilter === 'week') {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            allMonthTasks = allMonthTasks.filter(t => {
              if (!t.deadline) return false;
              const taskDate = new Date(t.deadline);
              return taskDate >= weekStart && taskDate <= weekEnd;
            });
          }

          // Apply search filter
          if (reportsSearchQuery.trim()) {
            const query = reportsSearchQuery.toLowerCase();
            allMonthTasks = allMonthTasks.filter(t =>
              t.taskName?.toLowerCase().includes(query) ||
              t.clientName?.toLowerCase().includes(query) ||
              t.projectName?.toLowerCase().includes(query)
            );
          }

          // Apply client filter
          if (reportsClientFilter !== 'all') {
            allMonthTasks = allMonthTasks.filter(t => t.clientName === reportsClientFilter);
          }

          // Apply status filter
          if (reportsStatusFilter !== 'all') {
            if (reportsStatusFilter === 'completed') {
              allMonthTasks = allMonthTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved');
            } else if (reportsStatusFilter === 'in-progress') {
              allMonthTasks = allMonthTasks.filter(t => t.status === 'in-progress');
            } else if (reportsStatusFilter === 'pending') {
              allMonthTasks = allMonthTasks.filter(t => t.status === 'pending-client-approval');
            }
          }

          const completedTasks = allMonthTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length;
          const completionRate = allMonthTasks.length > 0 ? Math.round((completedTasks / allMonthTasks.length) * 100) : 0;

          return (
            <div style={{ width: '100%', maxWidth: '100%', minHeight: '100vh', boxSizing: 'border-box', overflowX: 'hidden' }}>
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
                    {currentDepartment === 'video' && 'Video Employee Reports'}
                    {currentDepartment === 'graphics' && 'Graphics Employee Reports'}
                    {!currentDepartment && 'Employee Reports'}
                  </h2>
                  <p style={{ margin: '6px 0 0 36px', color: '#6b7280', fontSize: '13px' }}>
                    Your performance metrics and task analytics
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
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
                      placeholder="Search tasks, clients..."
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

                  {/* Time Period Filter Dropdown */}
                  <select
                    value={reportsTimeFilter}
                    onChange={(e) => setReportsTimeFilter(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#1f2937',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      outline: 'none',
                      minWidth: '120px'
                    }}
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
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
                      const uniqueClients = [...new Set(tasks
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
                    <option value="pending">Pending</option>
                  </select>

                  {/* Clear Filters */}
                  {(reportsSearchQuery || reportsTimeFilter !== 'month' || reportsClientFilter !== 'all' || reportsStatusFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setReportsSearchQuery('');
                        setReportsTimeFilter('month');
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
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Clear
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
                      { label: 'Pending', count: allMonthTasks.filter(t => t.status === 'pending-client-approval' || t.status === 'pending' || t.status === 'assigned-to-department' || t.status === 'pending-production').length, color: '#f59e0b' },
                      { label: 'Posted', count: allMonthTasks.filter(t => t.status === 'posted' || t.status === 'approved').length, color: '#8b5cf6' }
                    ];
                    const total = statusData.reduce((sum, item) => sum + item.count, 0);
                    const nonZeroStatuses = statusData.filter(item => item.count > 0);

                    if (total === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                          <PieChart size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                          <p style={{ fontSize: '13px', fontWeight: '500' }}>No tasks available</p>
                        </div>
                      );
                    }

                    const radius = 70;
                    const centerX = 100;
                    const centerY = 100;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                        <svg width="200" height="200" viewBox="0 0 200 200">
                          {nonZeroStatuses.length === 1 ? (
                            // If only one status, draw a full circle
                            <circle
                              cx={centerX}
                              cy={centerY}
                              r={radius}
                              fill={nonZeroStatuses[0].color}
                              stroke="white"
                              strokeWidth="2"
                            />
                          ) : (
                            // Multiple statuses, draw pie slices
                            (() => {
                              let currentAngle = 0;
                              return statusData.map((item, index) => {
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
                              });
                            })()
                          )}
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

                {/* Completion Timeline - Line Chart */}
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
                                let yPosition = 15;

                                // Company Name - Top Center
                                doc.setFontSize(16);
                                doc.setFont('helvetica', 'bold');
                                doc.setTextColor(102, 126, 234);
                                doc.text('Digi Sayhadri', pageWidth / 2, yPosition, { align: 'center' });

                                // Generated Date/Time - Top Right
                                doc.setFontSize(9);
                                doc.setFont('helvetica', 'normal');
                                doc.setTextColor(100, 100, 100);
                                const generatedText = `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                doc.text(generatedText, pageWidth - 15, yPosition, { align: 'right' });

                                yPosition += 10;

                                // Department Report Title - Center
                                doc.setFontSize(20);
                                doc.setFont('helvetica', 'bold');
                                doc.setTextColor(102, 126, 234);
                                doc.text(`${currentDepartment === 'video' ? 'Video' : currentDepartment === 'graphics' ? 'Graphics' : 'Employee'} Report`, pageWidth / 2, yPosition, { align: 'center' });

                                yPosition += 8;
                                doc.setFontSize(11);
                                doc.setFont('helvetica', 'normal');
                                doc.setTextColor(100, 100, 100);
                                doc.text(`Employee: ${employeeName}`, 20, yPosition);
                                yPosition += 6;
                                doc.text(`Period: ${selectedMonth}`, 20, yPosition);
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

                                    // Only show post date/time if task is actually posted or approved
                                    if (task.status === 'posted' || task.status === 'approved') {
                                      if (task.postDate) {
                                        try {
                                          const date = new Date(task.postDate);
                                          postDate = date.toLocaleDateString('en-GB');
                                          postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        } catch (e) {
                                          postDate = task.postDate;
                                        }
                                      } else if (task.postedAt) {
                                        try {
                                          const date = new Date(task.postedAt);
                                          postDate = date.toLocaleDateString('en-GB');
                                          postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        } catch (e) {
                                          postDate = 'Posted';
                                        }
                                      }
                                    } else {
                                      postDate = 'Not Posted';
                                      postTime = '-';
                                    }

                                    // Get status text
                                    const getStatusText = (status) => {
                                      switch (status) {
                                        case 'completed':
                                        case 'posted':
                                        case 'approved':
                                          return 'Completed';
                                        case 'in-progress':
                                          return 'In Progress';
                                        case 'pending-client-approval':
                                          return 'Pending';
                                        case 'revision-required':
                                          return 'Revision';
                                        case 'assigned':
                                          return 'Assigned';
                                        default:
                                          return status || 'Unknown';
                                      }
                                    };

                                    return [
                                      clientData.clientId,
                                      clientName.substring(0, 20),
                                      (task.taskName || task.description || 'N/A').substring(0, 30),
                                      getStatusText(task.status),
                                      postDate,
                                      postTime
                                    ];
                                  });

                                  autoTable(doc, {
                                    startY: yPosition,
                                    head: [['Client ID', 'Client Name', 'Task Name', 'Status', 'Post Date', 'Post Time']],
                                    body: tableData,
                                    theme: 'striped',
                                    headStyles: {
                                      fillColor: [102, 126, 234],
                                      textColor: 255,
                                      fontSize: 9,
                                      fontStyle: 'bold'
                                    },
                                    bodyStyles: {
                                      fontSize: 8,
                                      textColor: 50
                                    },
                                    alternateRowStyles: {
                                      fillColor: [248, 250, 252]
                                    },
                                    columnStyles: {
                                      0: { cellWidth: 20 },
                                      1: { cellWidth: 30 },
                                      2: { cellWidth: 45 },
                                      3: { cellWidth: 25 },
                                      4: { cellWidth: 25 },
                                      5: { cellWidth: 25 }
                                    },
                                    margin: { left: 15, right: 15 }
                                  });

                                  yPosition = doc.lastAutoTable.finalY + 12;
                                });

                                doc.save(`${currentDepartment || 'employee'}-report-${selectedMonth}.pdf`);
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
                                  [`${currentDepartment === 'video' ? 'Video' : currentDepartment === 'graphics' ? 'Graphics' : 'Employee'} Report`],
                                  [],
                                  [`Employee: ${employeeName}`],
                                  [`Period: ${selectedMonth}`],
                                  [`Generated: ${new Date().toLocaleDateString()}`],
                                  []
                                ];

                                let allData = [...headerData];

                                Object.entries(selectedClientGroups).forEach(([clientName, clientData]) => {
                                  // Client header
                                  allData.push([`${clientName} (ID: ${clientData.clientId})`, '', '', '', '', '']);
                                  allData.push(['Client ID', 'Client Name', 'Task Name (Ideas)', 'Status', 'Post Date', 'Post Time']);

                                  // Client tasks
                                  clientData.tasks.forEach(task => {
                                    let postDate = 'N/A';
                                    let postTime = 'N/A';

                                    // Only show post date/time if task is actually posted or approved
                                    if (task.status === 'posted' || task.status === 'approved') {
                                      if (task.postDate) {
                                        try {
                                          const date = new Date(task.postDate);
                                          postDate = date.toLocaleDateString('en-GB');
                                          postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        } catch (e) {
                                          postDate = task.postDate;
                                        }
                                      } else if (task.postedAt) {
                                        try {
                                          const date = new Date(task.postedAt);
                                          postDate = date.toLocaleDateString('en-GB');
                                          postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        } catch (e) {
                                          postDate = 'Posted';
                                        }
                                      }
                                    } else {
                                      postDate = 'Not Posted';
                                      postTime = '-';
                                    }

                                    // Get status text
                                    const getStatusText = (status) => {
                                      switch (status) {
                                        case 'completed':
                                        case 'posted':
                                        case 'approved':
                                          return 'Completed';
                                        case 'in-progress':
                                          return 'In Progress';
                                        case 'pending-client-approval':
                                          return 'Pending';
                                        case 'revision-required':
                                          return 'Revision';
                                        case 'assigned':
                                          return 'Assigned';
                                        default:
                                          return status || 'Unknown';
                                      }
                                    };

                                    allData.push([
                                      clientData.clientId,
                                      clientName,
                                      task.taskName || task.description || 'N/A',
                                      getStatusText(task.status),
                                      postDate,
                                      postTime
                                    ]);
                                  });

                                  allData.push([]); // Empty row between clients
                                });

                                const ws = XLSX.utils.aoa_to_sheet(allData);
                                ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

                                XLSX.utils.book_append_sheet(wb, ws, 'Employee Report');
                                XLSX.writeFile(wb, `${currentDepartment || 'employee'}-report-${selectedMonth}.xlsx`);

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
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{
                    width: '100%',
                    minWidth: '1200px',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: '#f9fafb',
                        borderBottom: '2px solid #e5e7eb'
                      }}>
                        {showReportCheckboxes && (
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            width: '60px'
                          }}>
                            <input
                              type="checkbox"
                              checked={(() => {
                                const clientGroups = {};
                                allMonthTasks.forEach(task => {
                                  const clientName = task.clientName || 'Unknown Client';
                                  if (!clientGroups[clientName]) {
                                    clientGroups[clientName] = { tasks: [] };
                                  }
                                  clientGroups[clientName].tasks.push(task);
                                });
                                const allClientNames = Object.keys(clientGroups);
                                return allClientNames.length > 0 && allClientNames.every(name => selectedReportClients.has(name));
                              })()}
                              onChange={(e) => {
                                const clientGroups = {};
                                allMonthTasks.forEach(task => {
                                  const clientName = task.clientName || 'Unknown Client';
                                  if (!clientGroups[clientName]) {
                                    clientGroups[clientName] = { tasks: [] };
                                  }
                                  clientGroups[clientName].tasks.push(task);
                                });
                                const allClientNames = Object.keys(clientGroups);
                                const newSelectedClients = new Set(selectedReportClients);
                                const newSelectedTasks = new Set(selectedReportTaskIds);

                                if (e.target.checked) {
                                  allClientNames.forEach(name => newSelectedClients.add(name));
                                  allMonthTasks.forEach(task => newSelectedTasks.add(task.id));
                                } else {
                                  newSelectedClients.clear();
                                  newSelectedTasks.clear();
                                }

                                setSelectedReportClients(newSelectedClients);
                                setSelectedReportTaskIds(newSelectedTasks);
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
                        }}>Client Name</th>
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
                        }}>In Progress</th>
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
                        }}>Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
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
                          const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                          const isExpanded = expandedClients[clientName];

                          // Determine avatar color based on department
                          const avatarGradient = currentDepartment === 'video'
                            ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
                            : currentDepartment === 'graphics'
                              ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

                          const arrowColor = currentDepartment === 'video'
                            ? '#e74c3c'
                            : currentDepartment === 'graphics'
                              ? '#3498db'
                              : '#667eea';

                          return (
                            <React.Fragment key={clientName}>
                              <tr style={{
                                borderBottom: '1px solid #f1f3f4',
                                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                                cursor: 'pointer'
                              }}
                                onClick={() => {
                                  setExpandedClients(prev => ({
                                    ...prev,
                                    [clientName]: !prev[clientName]
                                  }));
                                }}
                              >
                                {showReportCheckboxes && (
                                  <td style={{
                                    padding: '14px 16px',
                                    textAlign: 'center'
                                  }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedReportClients.has(clientName)}
                                      onChange={(e) => {
                                        const newSelectedClients = new Set(selectedReportClients);
                                        const newSelectedTasks = new Set(selectedReportTaskIds);

                                        if (e.target.checked) {
                                          newSelectedClients.add(clientName);
                                          clientData.tasks.forEach(task => newSelectedTasks.add(task.id));
                                        } else {
                                          newSelectedClients.delete(clientName);
                                          clientData.tasks.forEach(task => newSelectedTasks.delete(task.id));
                                        }

                                        setSelectedReportClients(newSelectedClients);
                                        setSelectedReportTaskIds(newSelectedTasks);
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
                                      color: arrowColor,
                                      transition: 'transform 0.2s',
                                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                    }}>
                                      ▶
                                    </div>
                                    <div style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '50%',
                                      background: avatarGradient,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: '14px',
                                      fontWeight: '700',
                                      flexShrink: 0
                                    }}>
                                      {clientName.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      color: '#1f2937'
                                    }}>
                                      {clientName}
                                    </span>
                                  </div>
                                </td>
                                <td style={{
                                  padding: '14px 16px',
                                  textAlign: 'center'
                                }}>
                                  <span style={{
                                    fontSize: '16px',
                                    fontWeight: '700',
                                    color: '#1f2937'
                                  }}>
                                    {totalTasks}
                                  </span>
                                </td>
                                <td style={{
                                  padding: '14px 16px',
                                  textAlign: 'center'
                                }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    backgroundColor: '#dbeafe',
                                    color: '#1e40af'
                                  }}>
                                    {inProgressTasks}
                                  </span>
                                </td>
                                <td style={{
                                  padding: '14px 16px',
                                  textAlign: 'center'
                                }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    backgroundColor: '#d1fae5',
                                    color: '#065f46'
                                  }}>
                                    {completedTasks}
                                  </span>
                                </td>
                                <td style={{
                                  padding: '14px 16px',
                                  textAlign: 'center'
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                  }}>
                                    <div style={{
                                      flex: 1,
                                      maxWidth: '120px',
                                      height: '8px',
                                      background: '#e5e7eb',
                                      borderRadius: '4px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${completionRate}%`,
                                        height: '100%',
                                        background: completionRate >= 75 ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : completionRate >= 50 ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '4px'
                                      }}></div>
                                    </div>
                                    <span style={{
                                      fontSize: '13px',
                                      fontWeight: '700',
                                      color: completionRate >= 75 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444',
                                      minWidth: '40px'
                                    }}>
                                      {completionRate}%
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Task Details */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={showReportCheckboxes ? 7 : 6} style={{ padding: 0, backgroundColor: '#f9fafb' }}>
                                    <div style={{
                                      padding: '20px',
                                      borderTop: '1px solid #e5e7eb'
                                    }}>
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: showReportCheckboxes ? '50px 100px 150px 1fr 130px 120px 120px' : '100px 150px 1fr 130px 120px 120px',
                                        gap: '12px',
                                        padding: '10px 16px',
                                        backgroundColor: '#f3f4f6',
                                        borderRadius: '6px',
                                        marginBottom: '8px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#6b7280',
                                        textTransform: 'uppercase'
                                      }}>
                                        {showReportCheckboxes && <div style={{ textAlign: 'center' }}>
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
                                        </div>}
                                        <div>Client ID</div>
                                        <div>Client Name</div>
                                        <div>Task Name (Ideas)</div>
                                        <div style={{ textAlign: 'center' }}>Status</div>
                                        <div style={{ textAlign: 'center' }}>Post Date</div>
                                        <div style={{ textAlign: 'center' }}>Post Time</div>
                                      </div>
                                      {clientData.tasks.map((task, taskIndex) => {
                                        let postDate = 'N/A';
                                        let postTime = 'N/A';

                                        // Only show post date/time if task is actually posted or approved
                                        if (task.status === 'posted' || task.status === 'approved') {
                                          if (task.postDate) {
                                            try {
                                              const date = new Date(task.postDate);
                                              postDate = date.toLocaleDateString('en-GB');
                                              postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                            } catch (e) {
                                              postDate = task.postDate;
                                            }
                                          } else if (task.postedAt) {
                                            try {
                                              const date = new Date(task.postedAt);
                                              postDate = date.toLocaleDateString('en-GB');
                                              postTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                            } catch (e) {
                                              postDate = 'Posted';
                                            }
                                          }
                                        } else {
                                          // For non-posted tasks, show deadline or "Not Posted"
                                          postDate = 'Not Posted';
                                          postTime = '-';
                                        }

                                        // Get status display info
                                        const getStatusDisplay = (status) => {
                                          switch (status) {
                                            case 'completed':
                                            case 'posted':
                                            case 'approved':
                                              return { text: 'Completed', color: '#10b981', bg: '#d1fae5' };
                                            case 'in-progress':
                                              return { text: 'In Progress', color: '#3b82f6', bg: '#dbeafe' };
                                            case 'pending-client-approval':
                                              return { text: 'Pending', color: '#f59e0b', bg: '#fef3c7' };
                                            case 'revision-required':
                                              return { text: 'Revision', color: '#ef4444', bg: '#fee2e2' };
                                            case 'assigned':
                                              return { text: 'Assigned', color: '#6b7280', bg: '#f3f4f6' };
                                            default:
                                              return { text: status || 'Unknown', color: '#6b7280', bg: '#f3f4f6' };
                                          }
                                        };

                                        const statusInfo = getStatusDisplay(task.status);

                                        return (
                                          <div key={task.id} style={{
                                            display: 'grid',
                                            gridTemplateColumns: showReportCheckboxes ? '50px 100px 150px 1fr 130px 120px 120px' : '100px 150px 1fr 130px 120px 120px',
                                            gap: '12px',
                                            padding: '12px 16px',
                                            backgroundColor: taskIndex % 2 === 0 ? '#ffffff' : '#f9fafb',
                                            borderRadius: '6px',
                                            marginBottom: '4px',
                                            alignItems: 'center',
                                            fontSize: '12px',
                                            color: '#1f2937'
                                          }}>
                                            {showReportCheckboxes && (
                                              <div style={{ textAlign: 'center' }}>
                                                <input
                                                  type="checkbox"
                                                  checked={selectedReportTaskIds.has(task.id)}
                                                  onChange={(e) => {
                                                    const newSelectedTasks = new Set(selectedReportTaskIds);
                                                    const newSelectedClients = new Set(selectedReportClients);

                                                    if (e.target.checked) {
                                                      newSelectedTasks.add(task.id);
                                                      const allTasksSelected = clientData.tasks.every(t =>
                                                        t.id === task.id || newSelectedTasks.has(t.id)
                                                      );
                                                      if (allTasksSelected) {
                                                        newSelectedClients.add(clientName);
                                                      }
                                                    } else {
                                                      newSelectedTasks.delete(task.id);
                                                      newSelectedClients.delete(clientName);
                                                    }

                                                    setSelectedReportTaskIds(newSelectedTasks);
                                                    setSelectedReportClients(newSelectedClients);
                                                  }}
                                                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                />
                                              </div>
                                            )}
                                            <div>{clientData.clientId}</div>
                                            <div style={{ fontWeight: '500' }}>{clientName}</div>
                                            <div>{task.taskName || task.description || 'N/A'}</div>
                                            <div style={{ textAlign: 'center' }}>
                                              <span style={{
                                                display: 'inline-block',
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                backgroundColor: statusInfo.bg,
                                                color: statusInfo.color
                                              }}>
                                                {statusInfo.text}
                                              </span>
                                            </div>
                                            <div style={{ textAlign: 'center', color: '#6b7280' }}>{postDate}</div>
                                            <div style={{ textAlign: 'center', color: '#6b7280', fontWeight: '500' }}>{postTime}</div>
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
              </div>
            </div>
          );
        })()}

        {/* Revision Note Modal */}
        {showRevisionNoteModal && (
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  backgroundColor: '#ffc107',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <AlertCircle size={24} />
                </div>
                <h3 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>Revision Required</h3>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#856404',
                  lineHeight: '1.6'
                }}>
                  {selectedRevisionNote}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowRevisionNoteModal(false);
                  setSelectedRevisionNote('');
                }}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )
        }
        {/* )} */}

        {/* Social Media Employee Selection Modal */}
        {
          showSocialMediaEmployeeModal && (
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
                padding: '40px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937',
                  textAlign: 'center'
                }}>Select Social Media Employee</h3>
                <p style={{
                  margin: '0 0 32px 0',
                  fontSize: '14px',
                  color: '#6b7280',
                  textAlign: 'center'
                }}>Choose who will handle client approval for this task</p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  {employees
                    .filter(emp => emp.department === 'social-media' && emp.status === 'active')
                    .map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => handleSendToSocialMediaEmployee(emp.employeeName)}
                        style={{
                          background: 'linear-gradient(135deg, #1dd1a1 0%, #55efc4 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 4px 12px rgba(29, 209, 161, 0.3)'
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
                    ))}
                </div>

                <button
                  onClick={() => {
                    setShowSocialMediaEmployeeModal(false);
                    setSelectedTaskForSending(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )
        }

        {/* Content Modal */}
        {
          showContentModal && (
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
            }}
              onClick={() => setShowContentModal(false)}
            >
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{
                  margin: '0 0 20px 0',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>{modalTitle}</h3>
                <div style={{
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: '#4b5563',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {modalContent}
                </div>
                <button
                  onClick={() => setShowContentModal(false)}
                  style={{
                    marginTop: '24px',
                    padding: '10px 24px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )
        }

        {/* Special Notes Modal */}
        {
          showNotesModal && (
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
            }}
              onClick={() => setShowNotesModal(false)}
            >
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{
                  margin: '0 0 20px 0',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>{modalTitle}</h3>
                <div style={{
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: '#4b5563',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {modalContent}
                </div>
                <button
                  onClick={() => setShowNotesModal(false)}
                  style={{
                    marginTop: '24px',
                    padding: '10px 24px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
}

export default EmployeeDashboard;
