import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push } from 'firebase/database';
import { database, auth, secondaryAuth } from '../firebase';
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  LogOut,
  Users,
  User,
  Briefcase,
  Video,
  Image,
  Share2,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  BarChart3,
  PieChart,
  Activity,
  FileText,
  Download,
  Search,
  X,
  Filter,
  ClipboardList,
  Plus
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useToast, ToastContainer } from './Toast';
import ProductionIncharge from './ProductionIncharge';
import StrategyHead from './StrategyHead';
import StrategyDashboard from './StrategyDashboard';
import VideoDashboard from './VideoDashboard';
import GraphicsDashboard from './GraphicsDashboard';
import SocialMediaDashboard from './SocialMediaDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import SocialMediaEmpDashboard from './SocialMediaEmpDashboard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './SuperAdmin.css';

const SYSTEM_EMPLOYEES = [
  { id: 'sys_1', employeeName: 'Super Admin', email: 'superadmin@gmail.com', department: 'Management', role: 'admin', status: 'active', isSystem: true, createdAt: '2025-11-03T00:00:00.000Z' },
  { id: 'sys_2', employeeName: 'Production Incharge', email: 'productionincharge@gmail.com', department: 'production', role: 'head', status: 'active', isSystem: true, createdAt: '2025-11-03T00:00:00.000Z' },
  { id: 'sys_3', employeeName: 'Production Incharge (Alt)', email: 'proin@gmail.com', department: 'production', role: 'head', status: 'active', isSystem: true, createdAt: '2025-11-03T00:00:00.000Z' },
  { id: 'sys_4', employeeName: 'Video Head', email: 'video@gmail.com', department: 'video', role: 'head', status: 'active', isSystem: true, createdAt: '2025-12-22T00:00:00.000Z' },
  { id: 'sys_5', employeeName: 'Graphics Head', email: 'graphics@gmail.com', department: 'graphics', role: 'head', status: 'active', isSystem: true, createdAt: '2025-11-03T00:00:00.000Z' },
  { id: 'sys_6', employeeName: 'Social Media Head', email: 'social@gmail.com', department: 'social-media', role: 'head', status: 'active', isSystem: true, createdAt: '2025-11-03T00:00:00.000Z' },
  { id: 'sys_7', employeeName: 'Strategy Head', email: 'head@gmail.com', department: 'strategy', role: 'head', status: 'active', isSystem: true, createdAt: '2025-12-22T00:00:00.000Z' },
  { id: 'sys_8', employeeName: 'Strategy Management', email: 'strategy@gmail.com', department: 'strategy', role: 'head', status: 'active', isSystem: true, createdAt: '2025-11-25T00:00:00.000Z' },
  { id: 'sys_9', employeeName: 'Social Media Emp', email: 'socialemp@gmail.com', department: 'social-media', role: 'employee', status: 'active', isSystem: true, createdAt: '2025-12-22T00:00:00.000Z' },
  { id: 'sys_10', employeeName: 'Strategy Emp', email: 'strategyemp@gmail.com', department: 'strategy', role: 'employee', status: 'active', isSystem: true, createdAt: '2025-12-22T00:00:00.000Z' },
  { id: 'sys_11', employeeName: 'Graphics Emp', email: 'graphicemp@gmail.com', department: 'graphics', role: 'employee', status: 'active', isSystem: true, createdAt: '2025-12-22T00:00:00.000Z' },
  { id: 'sys_12', employeeName: 'Video Emp', email: 'videoemp@gmail.com', department: 'video', role: 'employee', status: 'active', isSystem: true, createdAt: '2025-12-22T00:00:00.000Z' },
  { id: 'sys_13', employeeName: 'Production Admin', email: 'admin@gmail.com', department: 'production', role: 'admin', status: 'active', isSystem: true, createdAt: '2025-11-03T00:00:00.000Z' },
];

const SuperAdmin = () => {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedView, setSelectedView] = useState('overview');
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedVideoEmployeeFilter, setSelectedVideoEmployeeFilter] = useState('all');
  const [selectedGraphicsEmployeeFilter, setSelectedGraphicsEmployeeFilter] = useState('all');
  const [selectedSocialMediaEmployeeFilter, setSelectedSocialMediaEmployeeFilter] = useState('all');
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const [expandedOverviewCards, setExpandedOverviewCards] = useState({});
  const [expandedReportCards, setExpandedReportCards] = useState({});
  // Selected tasks for download
  const [selectedTasks, setSelectedTasks] = useState({});
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(null);
  const [employeeFilter, setEmployeeFilter] = useState(null);
  // Change Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  // Edit Employee states
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeePassword, setEditEmployeePassword] = useState('');
  // Expanded employees for showing clients
  const [expandedEmployees, setExpandedEmployees] = useState({});
  // Status filter for Reports section
  const [statusFilter, setStatusFilter] = useState(null);
  // Add Employee states - now using page view instead of modal
  const [newEmployee, setNewEmployee] = useState({
    employeeName: '',
    department: '',
    role: 'employee',
    email: '',
    password: '',
    status: 'active'
  });

  // View Clients states
  const [clientListSearch, setClientListSearch] = useState('');
  const [newClient, setNewClient] = useState({
    clientId: '',
    clientName: '',
    contactNumber: '',
    email: '',
    videoInstructions: '',
    graphicsInstructions: '',
    status: 'active'
  });

  // Strategy My Task states
  const [showTaskAssignmentForm, setShowTaskAssignmentForm] = useState(false);
  const [selectedClientForTask, setSelectedClientForTask] = useState(null);
  const [showClientWorkflowModal, setShowClientWorkflowModal] = useState(false);
  const [selectedClientForWorkflow, setSelectedClientForWorkflow] = useState(null);
  const [taskForm, setTaskForm] = useState({
    taskName: '',
    description: '',
    referenceLink: '',
    specialNotes: '',
    department: '',
    taskType: '',
    postDate: ''
  });
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        // Only redirect if we're sure user is logged out (not just a temporary state)
        console.log('⚠️ Auth state changed: User is null, redirecting to login');
        navigate('/');
      } else {
        console.log('✅ Auth state: User is logged in:', user.email);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const tasksRef = ref(database, 'tasks');
    const unsubTasks = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tasksArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(task => !task.deleted);
        setTasks(tasksArray);
      } else {
        setTasks([]);
      }
    });

    const clientsRef = ref(database, 'clients');
    const unsubClients = onValue(clientsRef, (snapshot) => {
      const data = snapshot.val();
      const clientsArray = [];

      if (data) {
        Object.keys(data).forEach(key => {
          const client = { id: key, ...data[key] };
          if (!client.deleted) {
            clientsArray.push(client);
          }
        });
      }

      console.log('Loaded clients from clients node:', clientsArray);
      setClients(clientsArray);
    });

    // Also listen to strategyClients for clients assigned by Strategy Head
    const strategyClientsRef = ref(database, 'strategyClients');
    const unsubStrategyClients = onValue(strategyClientsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Strategy clients data:', data);

      if (data) {
        const strategyClientsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
          source: 'strategy' // Mark as coming from strategy
        }));

        console.log('Loaded strategy clients:', strategyClientsArray);

        // Merge with existing clients
        setClients(prevClients => {
          const merged = [...prevClients];

          strategyClientsArray.forEach(strategyClient => {
            // Check if client already exists by clientId
            const existingIndex = merged.findIndex(c => c.clientId === strategyClient.clientId);

            if (existingIndex === -1) {
              // Add new client
              merged.push(strategyClient);
              console.log('Added new strategy client:', strategyClient.clientName);
            } else {
              // Update existing client with strategy assignment info
              merged[existingIndex] = {
                ...merged[existingIndex],
                assignedToEmployee: strategyClient.assignedToEmployee,
                assignedToEmployeeName: strategyClient.assignedToEmployeeName,
                allocationDate: strategyClient.allocationDate,
                stage: strategyClient.stage,
                source: 'strategy'
              };
              console.log('Updated existing client with strategy info:', merged[existingIndex].clientName);
            }
          });

          console.log('Final merged clients:', merged);
          return merged;
        });
      }
    });

    const employeesRef = ref(database, 'employees');
    const unsubEmployees = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const dbEmployees = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));

        // Merge system employees with database employees (avoiding duplicates if they were added to DB)
        const dbEmails = new Set(dbEmployees.map(e => e.email?.toLowerCase()));
        const uniqueSystemEmployees = SYSTEM_EMPLOYEES.filter(se => !dbEmails.has(se.email?.toLowerCase()));

        const combinedEmployees = [...uniqueSystemEmployees, ...dbEmployees];
        console.log('Combined employees (System + DB):', combinedEmployees);
        setEmployees(combinedEmployees);
      } else {
        setEmployees(SYSTEM_EMPLOYEES);
      }
    });

    return () => {
      unsubTasks();
      unsubClients();
      unsubStrategyClients();
      unsubEmployees();
    };
  }, []);

  // Auto-generate Client ID when Add Client form opens
  useEffect(() => {
    if (selectedView === 'add-client') {
      console.log('Auto-generating client ID, current clients:', clients.length);

      if (clients.length === 0) {
        setNewClient(prev => ({ ...prev, clientId: '1' }));
      } else {
        const numericIds = clients
          .map(client => {
            const match = client.clientId?.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
          })
          .filter(num => !isNaN(num));

        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const nextId = maxId + 1;

        setNewClient(prev => ({ ...prev, clientId: String(nextId) }));
      }
    }
  }, [selectedView, clients]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Handle Edit Employee
  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEditEmployeeName(employee.employeeName);
    setEditEmployeePassword(employee.password || '');
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
    } catch (error) {
      console.error('Error updating employee:', error);
      showToast('Failed to update employee', 'error');
    }
  };

  // Handle Delete Employee
  const handleDeleteEmployee = async (employee) => {
    if (!employee || (!employee.id && !employee.email)) {
      showToast('❌ Invalid employee data', 'error');
      return;
    }

    if (employee.email === 'superadmin@gmail.com') {
      showToast('❌ The primary Super Admin account cannot be deleted.', 'error');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to PERMANENTLY delete employee "${employee.employeeName || employee.email}"?\n\nThis action will:\n✓ Remove the employee from database\n✓ Unassign their tasks and clients\n✓ Mark their Firebase Auth account for deletion\n\nThis cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      console.log('🗑️ Starting deletion for employee:', employee);
      const updates = {};

      // 1. Unassign Tasks
      if (Array.isArray(tasks)) {
        const empTasks = tasks.filter(t =>
          t.assignedTo === employee.id ||
          t.assignedTo === employee.email ||
          (employee.employeeName && t.assignedTo === employee.employeeName) ||
          t.assignedEmployee === employee.id ||
          t.assignedEmployee === employee.email ||
          (employee.employeeName && t.assignedEmployee === employee.employeeName)
        );

        console.log(`Found ${empTasks.length} tasks to unassign`);
        empTasks.forEach(task => {
          updates[`tasks/${task.id}/assignedTo`] = null;
          updates[`tasks/${task.id}/assignedEmployee`] = null;
          updates[`tasks/${task.id}/assignedToEmployeeName`] = null;

          if (task.status === 'in-progress' || task.status === 'assigned-to-department') {
            updates[`tasks/${task.id}/status`] = 'pending';
          }
        });
      }

      // 2. Unassign Clients
      if (Array.isArray(clients)) {
        const empClients = clients.filter(c =>
          c.assignedToEmployee === employee.id ||
          c.assignedToEmployee === employee.email ||
          (employee.employeeName && c.assignedToEmployee === employee.employeeName) ||
          c.assignedEmployee === employee.id ||
          c.assignedEmployee === employee.email ||
          (employee.employeeName && c.assignedEmployee === employee.employeeName)
        );

        console.log(`Found ${empClients.length} clients to unassign`);
        empClients.forEach(client => {
          const basePath = client.source === 'strategy' ? 'strategyClients' : 'clients';
          updates[`${basePath}/${client.id}/assignedToEmployee`] = null;
          updates[`${basePath}/${client.id}/assignedEmployee`] = null;
          updates[`${basePath}/${client.id}/assignedToEmployeeName`] = null;
        });
      }

      // 3. Mark employee as deleted and store Firebase UID for manual cleanup
      if (employee.firebaseUid) {
        updates[`deletedAuthAccounts/${employee.firebaseUid}`] = {
          email: employee.email,
          employeeName: employee.employeeName || 'Unknown',
          deletedAt: new Date().toISOString(),
          deletedBy: 'Super Admin',
          note: 'Requires manual deletion from Firebase Authentication Console'
        };
      }

      // 4. Delete Employee from database
      if (employee.id) {
        updates[`employees/${employee.id}`] = null;
      } else if (employee.email) {
        // Find ID by email if missing
        const foundEmp = employees.find(e => e.email === employee.email);
        if (foundEmp && foundEmp.id) {
          updates[`employees/${foundEmp.id}`] = null;
        }
      }

      console.log('Sending updates to Firebase:', updates);
      await update(ref(database), updates);

      // Show appropriate message based on whether Firebase UID exists
      if (employee.firebaseUid) {
        showToast(
          `✅ Employee deleted from database!\n⚠️ IMPORTANT: Please manually delete their Firebase Auth account:\n📧 Email: ${employee.email}\n🔑 UID: ${employee.firebaseUid}\n\nGo to Firebase Console → Authentication → Find user → Delete`,
          'warning',
          10000
        );

        console.warn('🔴 MANUAL ACTION REQUIRED: Delete Firebase Auth account for', employee.email);
      } else {
        showToast('✅ Employee permanently deleted and data unassigned!', 'success');
      }

      if (selectedEmployee && (selectedEmployee.id === employee.id || selectedEmployee.email === employee.email)) {
        setSelectedEmployee(null);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      showToast('❌ Failed to delete employee: ' + error.message, 'error');
    }
  };


  // Toggle employee expansion to show clients
  const toggleEmployeeExpansion = (employeeId) => {
    console.log('Toggling employee:', employeeId);
    setExpandedEmployees(prev => {
      const newState = {
        ...prev,
        [employeeId]: !prev[employeeId]
      };
      console.log('New expanded state:', newState);
      return newState;
    });
  };

  // Get clients assigned to an employee
  const getEmployeeClients = (employeeName, employeeEmail) => {
    console.log('Getting clients for:', employeeName, employeeEmail);
    console.log('All clients:', clients);

    // Check both clients and strategyClients for assigned clients
    const assignedClients = clients.filter(client => {
      const assignedToEmployee = client.assignedToEmployee || client.assignedEmployee || client.assignedTo || '';
      const assignedToEmployeeName = client.assignedToEmployeeName || client.assignedEmployeeName || '';

      console.log('Checking client:', client.clientName, {
        assignedToEmployee,
        assignedToEmployeeName,
        matches: assignedToEmployee === employeeEmail ||
          assignedToEmployee === employeeName ||
          assignedToEmployeeName === employeeName ||
          assignedToEmployeeName === employeeEmail
      });

      // Match by email or name
      return assignedToEmployee === employeeEmail ||
        assignedToEmployee === employeeName ||
        assignedToEmployeeName === employeeName ||
        assignedToEmployeeName === employeeEmail;
    });

    console.log('Found clients:', assignedClients);
    return assignedClients;
  };


  // Handle Password Change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordChangeMessage('');
    setPasswordChangeError('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordChangeError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters long');
      return;
    }

    try {
      // Get current user
      const user = auth.currentUser;
      if (!user) {
        setPasswordChangeError('No user logged in');
        return;
      }

      // Re-authenticate user with current password
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);

      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      setPasswordChangeMessage('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        setPasswordChangeMessage('');
      }, 5000);
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        setPasswordChangeError('Current password is incorrect');
      } else if (error.code === 'auth/weak-password') {
        setPasswordChangeError('New password is too weak');
      } else {
        setPasswordChangeError('Failed to change password. Please try again.');
      }
    }
  };

  // Report Generation Functions
  const generateAllDepartmentsReport = (format) => {
    const departments = ['production', 'strategy', 'video', 'graphics', 'social-media'];

    if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Add company name at center
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      const companyName = 'Digi Sayhadri';
      const companyNameWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - companyNameWidth) / 2, 15);

      // Add current date and time at top right
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
      doc.setFont(undefined, 'normal');
      const timeWidth = doc.getTextWidth(dateTimeString);
      doc.text(dateTimeString, pageWidth - timeWidth - 14, 15);

      // Add report title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('All Departments Report', 14, 28);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Month: ${selectedMonth}`, 14, 36);

      const tableData = departments.map(dept => {
        const deptEmployees = employees.filter(e => e.department === dept && e.status === 'active');
        const deptTasks = filteredTasks.filter(t => t.department === dept);
        return [
          dept.charAt(0).toUpperCase() + dept.slice(1).replace('-', ' '),
          deptEmployees.length,
          deptTasks.length,
          deptTasks.filter(t => t.status === 'completed' || t.status === 'posted').length
        ];
      });

      autoTable(doc, {
        startY: 45,
        head: [['Department', 'Employees', 'Total Tasks', 'Completed']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] }
      });

      doc.save(`all-departments-${selectedMonth}.pdf`);
      showToast('All departments PDF downloaded!', 'success');
    } else {
      const data = departments.map(dept => {
        const deptEmployees = employees.filter(e => e.department === dept && e.status === 'active');
        const deptTasks = filteredTasks.filter(t => t.department === dept);
        return {
          'Department': dept.charAt(0).toUpperCase() + dept.slice(1).replace('-', ' '),
          'Employees': deptEmployees.length,
          'Total Tasks': deptTasks.length,
          'Completed': deptTasks.filter(t => t.status === 'completed' || t.status === 'posted').length,
          'In Progress': deptTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Departments');
      XLSX.writeFile(wb, `all-departments-${selectedMonth}.xlsx`);
      showToast('All departments Excel downloaded!', 'success');
    }
  };

  const generateEmployeeTasksReport = (format) => {
    if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Add company name at center
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      const companyName = 'Digi Sayhadri';
      const companyNameWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - companyNameWidth) / 2, 15);

      // Add current date and time at top right
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
      doc.setFont(undefined, 'normal');
      const timeWidth = doc.getTextWidth(dateTimeString);
      doc.text(dateTimeString, pageWidth - timeWidth - 14, 15);

      // Add report title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Employee Tasks Report', 14, 28);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Month: ${selectedMonth}`, 14, 36);

      const tableData = [];

      // Get all active employees
      const activeEmployees = employees.filter(e => e.status === 'active');

      activeEmployees.forEach(emp => {
        // Filter tasks by employee name, email, or ID
        const empTasks = filteredTasks.filter(t => {
          const assignedToMatch = t.assignedTo === emp.employeeName ||
            t.assignedTo === emp.email ||
            t.assignedTo === emp.id;
          const assignedEmployeeMatch = t.assignedEmployee === emp.employeeName ||
            t.assignedEmployee === emp.email ||
            t.assignedEmployee === emp.id;
          return (assignedToMatch || assignedEmployeeMatch);
        });

        const completedCount = empTasks.filter(t => t.status === 'completed' || t.status === 'posted').length;
        const pendingCount = empTasks.filter(t =>
          t.status !== 'completed' && t.status !== 'posted'
        ).length;

        tableData.push([
          emp.employeeName || 'N/A',
          emp.department?.charAt(0).toUpperCase() + emp.department?.slice(1).replace('-', ' ') || 'N/A',
          empTasks.length.toString(),
          completedCount.toString(),
          pendingCount.toString()
        ]);
      });

      autoTable(doc, {
        startY: 45,
        head: [['Employee Name', 'Department', 'Total Tasks', 'Completed', 'Pending']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 }
        }
      });

      doc.save(`employee-tasks-${selectedMonth}.pdf`);
      showToast('Employee tasks PDF downloaded!', 'success');
    } else {
      const data = [];
      const activeEmployees = employees.filter(e => e.status === 'active');

      activeEmployees.forEach(emp => {
        // Filter tasks by employee name, email, or ID
        const empTasks = filteredTasks.filter(t => {
          const assignedToMatch = t.assignedTo === emp.employeeName ||
            t.assignedTo === emp.email ||
            t.assignedTo === emp.id;
          const assignedEmployeeMatch = t.assignedEmployee === emp.employeeName ||
            t.assignedEmployee === emp.email ||
            t.assignedEmployee === emp.id;
          return (assignedToMatch || assignedEmployeeMatch);
        });

        const completedCount = empTasks.filter(t => t.status === 'completed' || t.status === 'posted').length;
        const pendingCount = empTasks.filter(t =>
          t.status !== 'completed' && t.status !== 'posted'
        ).length;

        data.push({
          'Employee Name': emp.employeeName || 'N/A',
          'Department': emp.department?.charAt(0).toUpperCase() + emp.department?.slice(1).replace('-', ' ') || 'N/A',
          'Total Tasks': empTasks.length,
          'Completed': completedCount,
          'Pending': pendingCount
        });
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Tasks');
      XLSX.writeFile(wb, `employee-tasks-${selectedMonth}.xlsx`);
      showToast('Employee tasks Excel downloaded!', 'success');
    }
  };

  const generateAllEmployeesReport = (format) => {
    const activeEmployees = employees.filter(e => e.status === 'active');

    // Department order for consistent flow
    const departmentOrder = ['video', 'graphics', 'social-media', 'strategy', 'production'];
    const departmentNames = {
      'video': 'Video',
      'graphics': 'Graphics',
      'social-media': 'Social Media',
      'strategy': 'Strategy',
      'production': 'Production'
    };

    // Sort employees by department
    const sortedEmployees = activeEmployees.sort((a, b) => {
      const deptA = a.department?.toLowerCase().trim() || 'zzz';
      const deptB = b.department?.toLowerCase().trim() || 'zzz';
      const indexA = departmentOrder.indexOf(deptA);
      const indexB = departmentOrder.indexOf(deptB);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Add company name at center
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      const companyName = 'Digi Sayhadri';
      const companyNameWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - companyNameWidth) / 2, 15);

      // Add current date and time at top right
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
      doc.setFont(undefined, 'normal');
      const timeWidth = doc.getTextWidth(dateTimeString);
      doc.text(dateTimeString, pageWidth - timeWidth - 14, 15);

      // Add report title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('All Employees Report', 14, 28);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);
      doc.text(`Total Employees: ${activeEmployees.length}`, 14, 43);

      // Prepare table data with task counts
      const tableData = sortedEmployees.map(emp => {
        // Find all tasks assigned to this employee
        const empTasks = filteredTasks.filter(t => {
          const assignedToMatch = t.assignedTo === emp.employeeName || t.assignedTo === emp.email || t.assignedTo === emp.id;
          const assignedEmployeeMatch = t.assignedEmployee === emp.employeeName || t.assignedEmployee === emp.email || t.assignedEmployee === emp.id;
          return (assignedToMatch || assignedEmployeeMatch);
        });

        const totalTasks = empTasks.length;
        const completedTasks = empTasks.filter(t => t.status === 'completed' || t.status === 'posted').length;
        const pendingTasks = totalTasks - completedTasks;
        const deptDisplay = departmentNames[emp.department] || emp.department?.charAt(0).toUpperCase() + emp.department?.slice(1).replace('-', ' ') || 'N/A';

        return [
          emp.employeeName || 'N/A',
          deptDisplay,
          totalTasks,
          completedTasks,
          pendingTasks
        ];
      });

      autoTable(doc, {
        startY: 52,
        head: [['Employee Name', 'Department', 'Total Tasks', 'Completed', 'Pending']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 45 },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' }
        },
        didDrawPage: function (data) {
          // Add department separators
          let currentDept = null;
          data.table.body.forEach((row, index) => {
            const empDept = sortedEmployees[index]?.department;
            if (empDept !== currentDept) {
              currentDept = empDept;
              // Visual separator is handled by the sorting
            }
          });
        }
      });

      doc.save(`all-employees-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('All employees PDF downloaded!', 'success');
    } else {
      const data = sortedEmployees.map(emp => {
        // Find all tasks assigned to this employee
        const empTasks = filteredTasks.filter(t => {
          const assignedToMatch = t.assignedTo === emp.employeeName || t.assignedTo === emp.email || t.assignedTo === emp.id;
          const assignedEmployeeMatch = t.assignedEmployee === emp.employeeName || t.assignedEmployee === emp.email || t.assignedEmployee === emp.id;
          return (assignedToMatch || assignedEmployeeMatch);
        });

        const totalTasks = empTasks.length;
        const completedTasks = empTasks.filter(t => t.status === 'completed' || t.status === 'posted').length;
        const pendingTasks = totalTasks - completedTasks;
        const deptDisplay = departmentNames[emp.department] || emp.department?.charAt(0).toUpperCase() + emp.department?.slice(1).replace('-', ' ') || 'N/A';

        return {
          'Employee Name': emp.employeeName || 'N/A',
          'Email': emp.email || 'N/A',
          'Department': deptDisplay,
          'Total Tasks': totalTasks,
          'Completed Tasks': completedTasks,
          'Pending Tasks': pendingTasks,
          'Status': emp.status || 'N/A'
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Employees');
      XLSX.writeFile(wb, `all-employees-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('All employees Excel downloaded!', 'success');
    }
  };

  // Generate individual department report
  const generateDepartmentReport = (department, format) => {
    const deptName = department.charAt(0).toUpperCase() + department.slice(1).replace('-', ' ');
    // Filter employees by department (case-insensitive and flexible matching)
    const deptEmployees = employees.filter(e => {
      if (!e.department) return false;
      const empDept = e.department.toLowerCase().trim();
      const targetDept = department.toLowerCase().trim();
      return empDept === targetDept || empDept.includes(targetDept);
    });
    const deptTasks = filteredTasks.filter(t => {
      if (!t.department) return false;
      const taskDept = t.department.toLowerCase().trim();
      const targetDept = department.toLowerCase().trim();
      return taskDept === targetDept || taskDept.includes(targetDept);
    });

    if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      const companyName = 'Digi Sayhadri';
      const companyNameWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - companyNameWidth) / 2, 15);

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
      doc.setFont(undefined, 'normal');
      const timeWidth = doc.getTextWidth(dateTimeString);
      doc.text(dateTimeString, pageWidth - timeWidth - 14, 15);

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(`${deptName} Department Report`, 14, 28);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Month: ${selectedMonth}`, 14, 36);

      const activeEmployees = deptEmployees.filter(e => e.status === 'active');
      const inactiveEmployees = deptEmployees.filter(e => e.status === 'inactive');

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Department Summary:', 14, 48);
      doc.setFont(undefined, 'normal');
      doc.text(`Total Employees: ${deptEmployees.length} (Active: ${activeEmployees.length}, Inactive: ${inactiveEmployees.length})`, 14, 56);
      doc.text(`Total Tasks: ${deptTasks.length}`, 14, 63);
      doc.text(`Completed: ${deptTasks.filter(t => t.status === 'completed' || t.status === 'posted').length}`, 14, 70);
      doc.text(`In Progress: ${deptTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length}`, 14, 77);

      const tableData = deptEmployees.map(emp => {
        const empTasks = deptTasks.filter(t => {
          const assignedToMatch = t.assignedTo === emp.employeeName || t.assignedTo === emp.email || t.assignedTo === emp.id;
          const assignedEmployeeMatch = t.assignedEmployee === emp.employeeName || t.assignedEmployee === emp.email || t.assignedEmployee === emp.id;
          return (assignedToMatch || assignedEmployeeMatch);
        });
        return [
          emp.employeeName || 'N/A',
          emp.email || 'N/A',
          emp.status || 'N/A',
          empTasks.length,
          empTasks.filter(t => t.status === 'completed' || t.status === 'posted').length,
          empTasks.filter(t => t.status !== 'completed' && t.status !== 'posted').length
        ];
      });

      autoTable(doc, {
        startY: 85,
        head: [['Employee Name', 'Email', 'Status', 'Total Tasks', 'Completed', 'Pending']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 50 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 }
        }
      });

      doc.save(`${department}-report-${selectedMonth}.pdf`);
      showToast(`${deptName} department PDF downloaded!`, 'success');
    } else {
      const data = deptEmployees.map(emp => {
        const empTasks = deptTasks.filter(t => {
          const assignedToMatch = t.assignedTo === emp.employeeName || t.assignedTo === emp.email || t.assignedTo === emp.id;
          const assignedEmployeeMatch = t.assignedEmployee === emp.employeeName || t.assignedEmployee === emp.email || t.assignedEmployee === emp.id;
          return (assignedToMatch || assignedEmployeeMatch);
        });
        return {
          'Employee Name': emp.employeeName || 'N/A',
          'Email': emp.email || 'N/A',
          'Department': emp.department || 'N/A',
          'Status': emp.status || 'N/A',
          'Role': emp.role || 'N/A',
          'Total Tasks': empTasks.length,
          'Completed': empTasks.filter(t => t.status === 'completed' || t.status === 'posted').length,
          'In Progress': empTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length,
          'Pending': empTasks.filter(t => t.status !== 'completed' && t.status !== 'posted' && t.status !== 'in-progress' && t.status !== 'assigned-to-department').length
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, deptName);
      XLSX.writeFile(wb, `${department}-report-${selectedMonth}.xlsx`);
      showToast(`${deptName} department Excel downloaded!`, 'success');
    }
  };

  // Generate All Clients Report
  const generateAllClientsReport = (format) => {
    // Department order for consistent flow
    const departmentOrder = ['video', 'graphics', 'social-media', 'strategy', 'production'];
    const departmentNames = {
      'video': 'Video',
      'graphics': 'Graphics',
      'social-media': 'Social Media',
      'strategy': 'Strategy',
      'production': 'Production'
    };

    if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Add company name at center
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      const companyName = 'Digi Sayhadri';
      const companyNameWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - companyNameWidth) / 2, 15);

      // Add current date and time at top right
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
      doc.setFont(undefined, 'normal');
      const timeWidth = doc.getTextWidth(dateTimeString);
      doc.text(dateTimeString, pageWidth - timeWidth - 14, 15);

      // Add report title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('All Clients Report', 14, 28);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

      // Department-wise summary
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Department Summary:', 14, 48);
      doc.setFont(undefined, 'normal');
      let yPos = 56;
      departmentOrder.forEach(dept => {
        const deptEmployees = employees.filter(e => e.department === dept && e.status === 'active');
        const deptTasks = filteredTasks.filter(t => {
          const taskDept = t.department?.toLowerCase().trim();
          return taskDept === dept;
        });
        // Always show all departments, even if they have 0 employees and 0 tasks
        doc.text(`${departmentNames[dept]}: ${deptEmployees.length} employees, ${deptTasks.length} tasks`, 14, yPos);
        yPos += 7;
      });

      doc.setFont(undefined, 'bold');
      doc.text(`Total Clients: ${clients.length}`, 14, yPos + 5);
      doc.setFont(undefined, 'normal');

      // Prepare table data organized by client and department flow
      const tableData = [];
      clients.forEach(client => {
        const clientTasks = filteredTasks.filter(t => t.clientId === client.id || t.clientName === client.clientName);

        if (clientTasks.length > 0) {
          // Sort tasks by department order
          const sortedTasks = clientTasks.sort((a, b) => {
            const deptA = a.department?.toLowerCase().trim() || 'zzz';
            const deptB = b.department?.toLowerCase().trim() || 'zzz';
            const indexA = departmentOrder.indexOf(deptA);
            const indexB = departmentOrder.indexOf(deptB);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });

          sortedTasks.forEach((task, index) => {
            // Find assigned employee
            const assignedEmp = employees.find(e =>
              e.id === task.assignedTo ||
              e.email === task.assignedTo ||
              e.employeeName === task.assignedTo ||
              e.id === task.assignedEmployee ||
              e.email === task.assignedEmployee ||
              e.employeeName === task.assignedEmployee
            );

            const empName = assignedEmp?.employeeName || task.assignedEmployee || task.assignedTo || 'Unassigned';
            const empDept = assignedEmp?.department || task.department || 'N/A';
            const deptDisplay = departmentNames[empDept] || empDept.charAt(0).toUpperCase() + empDept.slice(1).replace('-', ' ');
            const taskStatus = task.status === 'completed' || task.status === 'posted' ? 'Completed' : 'Pending';

            tableData.push([
              index === 0 ? client.clientId || 'N/A' : '',
              index === 0 ? client.clientName || 'N/A' : '',
              task.taskName || 'N/A',
              empName,
              deptDisplay,
              taskStatus
            ]);
          });
        } else {
          // Client with no tasks
          tableData.push([
            client.clientId || 'N/A',
            client.clientName || 'N/A',
            'No tasks',
            '-',
            '-',
            '-'
          ]);
        }
      });

      autoTable(doc, {
        startY: yPos + 15,
        head: [['Client ID', 'Client Name', 'Task', 'Assigned Employee', 'Department', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 35 },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30 },
          5: { cellWidth: 25 }
        }
      });

      doc.save(`all-clients-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('All clients PDF downloaded!', 'success');
    } else {
      // Excel format
      const data = [];
      clients.forEach(client => {
        const clientTasks = filteredTasks.filter(t => t.clientId === client.id || t.clientName === client.clientName);

        if (clientTasks.length > 0) {
          // Sort tasks by department order
          const sortedTasks = clientTasks.sort((a, b) => {
            const deptA = a.department?.toLowerCase().trim() || 'zzz';
            const deptB = b.department?.toLowerCase().trim() || 'zzz';
            const indexA = departmentOrder.indexOf(deptA);
            const indexB = departmentOrder.indexOf(deptB);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });

          sortedTasks.forEach(task => {
            // Find assigned employee
            const assignedEmp = employees.find(e =>
              e.id === task.assignedTo ||
              e.email === task.assignedTo ||
              e.employeeName === task.assignedTo ||
              e.id === task.assignedEmployee ||
              e.email === task.assignedEmployee ||
              e.employeeName === task.assignedEmployee
            );

            const empName = assignedEmp?.employeeName || task.assignedEmployee || task.assignedTo || 'Unassigned';
            const empEmail = assignedEmp?.email || 'N/A';
            const empDept = assignedEmp?.department || task.department || 'N/A';
            const deptDisplay = departmentNames[empDept] || empDept.charAt(0).toUpperCase() + empDept.slice(1).replace('-', ' ');
            const taskStatus = task.status === 'completed' || task.status === 'posted' ? 'Completed' : 'Pending';

            data.push({
              'Client ID': client.clientId || 'N/A',
              'Client Name': client.clientName || 'N/A',
              'Task Name': task.taskName || 'N/A',
              'Task Description': task.taskDescription || 'N/A',
              'Assigned Employee': empName,
              'Employee Email': empEmail,
              'Department': deptDisplay,
              'Status': taskStatus,
              'Post Date': task.postDate || 'N/A',
              'Deadline': task.deadline || 'N/A'
            });
          });
        } else {
          // Client with no tasks
          data.push({
            'Client ID': client.clientId || 'N/A',
            'Client Name': client.clientName || 'N/A',
            'Task Name': 'No tasks',
            'Task Description': '-',
            'Assigned Employee': '-',
            'Employee Email': '-',
            'Department': '-',
            'Status': '-',
            'Post Date': '-',
            'Deadline': '-'
          });
        }
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'All Clients');
      XLSX.writeFile(wb, `all-clients-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('All clients Excel downloaded!', 'success');
    }
  };

  // Handle task selection
  const handleTaskSelection = (taskId, sectionKey) => {
    setSelectedTasks(prev => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [taskId]: !(prev[sectionKey]?.[taskId])
      }
    }));
  };

  // Handle select all tasks in a section
  const handleSelectAllTasks = (tasks, sectionKey) => {
    const allSelected = tasks.every(task => selectedTasks[sectionKey]?.[task.id]);
    const newSelection = {};
    tasks.forEach(task => {
      newSelection[task.id] = !allSelected;
    });
    setSelectedTasks(prev => ({
      ...prev,
      [sectionKey]: newSelection
    }));
  };

  // Get selected tasks for a section
  const getSelectedTasksForSection = (sectionKey) => {
    return Object.keys(selectedTasks[sectionKey] || {}).filter(taskId => selectedTasks[sectionKey][taskId]);
  };

  // Download selected tasks
  const downloadSelectedTasks = (sectionKey, sectionName, format) => {
    const selectedTaskIds = getSelectedTasksForSection(sectionKey);
    if (selectedTaskIds.length === 0) {
      showToast('Please select at least one task', 'error');
      return;
    }

    const tasksToDownload = filteredTasks.filter(t => selectedTaskIds.includes(t.id));

    if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Add company name
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      const companyName = 'Digi Sayhadri';
      const companyNameWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - companyNameWidth) / 2, 15);

      // Add date and time
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
      doc.setFont(undefined, 'normal');
      const timeWidth = doc.getTextWidth(dateTimeString);
      doc.text(dateTimeString, pageWidth - timeWidth - 14, 15);

      // Add report title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(`Selected Tasks - ${sectionName}`, 14, 28);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Total Selected: ${tasksToDownload.length}`, 14, 36);

      // Prepare table data
      const tableData = tasksToDownload.map(task => {
        const assignedEmp = employees.find(e =>
          e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
          e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
        );
        return [
          task.taskName || 'N/A',
          task.clientName || 'N/A',
          assignedEmp?.employeeName || 'Unassigned',
          task.department?.charAt(0).toUpperCase() + task.department?.slice(1).replace('-', ' ') || 'N/A',
          task.status?.replace('-', ' ') || 'Unknown'
        ];
      });

      autoTable(doc, {
        startY: 45,
        head: [['Task Name', 'Client', 'Employee', 'Department', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] }
      });

      doc.save(`selected-tasks-${sectionKey}-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast(`${tasksToDownload.length} tasks downloaded as PDF!`, 'success');
    } else {
      const data = tasksToDownload.map(task => {
        const assignedEmp = employees.find(e =>
          e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
          e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
        );
        return {
          'Task Name': task.taskName || 'N/A',
          'Client': task.clientName || 'N/A',
          'Employee': assignedEmp?.employeeName || 'Unassigned',
          'Department': task.department?.charAt(0).toUpperCase() + task.department?.slice(1).replace('-', ' ') || 'N/A',
          'Status': task.status?.replace('-', ' ') || 'Unknown',
          'Post Date': task.postDate || 'N/A',
          'Deadline': task.deadline || 'N/A'
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Selected Tasks');
      XLSX.writeFile(wb, `selected-tasks-${sectionKey}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`${tasksToDownload.length} tasks downloaded as Excel!`, 'success');
    }

    // Clear selection after download
    setSelectedTasks(prev => ({
      ...prev,
      [sectionKey]: {}
    }));
  };

  // Handle adding new client
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
        createdBy: 'Super Admin',
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
      setSelectedView('view-clients');
    } catch (error) {
      console.error('Error adding client:', error);
      showToast('❌ Error adding client', 'error', 3000);
    }
  };
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!database) {
      showToast('Database not initialized', 'error');
      return;
    }

    try {
      // Check if email already exists in database
      const emailExists = employees.some(emp => emp.email.toLowerCase() === newEmployee.email.toLowerCase());
      if (emailExists) {
        showToast('An employee with this email already exists!', 'error');
        return;
      }

      // Validate password length
      if (newEmployee.password.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
      }

      // Step 1: Create Firebase Authentication account using secondary auth
      console.log('Creating Firebase Auth account for:', newEmployee.email);
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newEmployee.email,
        newEmployee.password
      );

      console.log('✅ Firebase Auth account created:', userCredential.user.uid);

      // Step 2: Sign out from secondary auth immediately to prevent session conflicts
      await signOut(secondaryAuth);
      console.log('✅ Signed out from secondary auth');

      // Step 3: Add employee to Realtime Database
      const employeesRef = ref(database, 'employees');
      await push(employeesRef, {
        employeeName: newEmployee.employeeName,
        email: newEmployee.email,
        password: newEmployee.password,
        department: newEmployee.department,
        role: newEmployee.role || 'employee',
        firebaseUid: userCredential.user.uid, // Store Firebase Auth UID
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      showToast(`✅ Employee ${newEmployee.employeeName} added successfully with Firebase Auth account!`, 'success');

      // Reset form
      setNewEmployee({
        employeeName: '',
        department: '',
        role: 'employee',
        email: '',
        password: '',
        status: 'active'
      });

      // Navigate to employees view
      setSelectedView('employees');
    } catch (error) {
      console.error('Error adding employee:', error);

      // Provide specific error messages
      if (error.code === 'auth/email-already-in-use') {
        showToast('❌ This email is already registered in Firebase Authentication', 'error');
      } else if (error.code === 'auth/invalid-email') {
        showToast('❌ Invalid email address', 'error');
      } else if (error.code === 'auth/weak-password') {
        showToast('❌ Password is too weak. Use at least 6 characters', 'error');
      } else {
        showToast(`❌ Failed to add employee: ${error.message}`, 'error');
      }
    }
  };

  // Filter and Search Logic
  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter(null);
    setEmployeeFilter(null);
  };

  const filteredTasks = tasks.filter(task => {
    if (!task.postDate) return false;

    // Month filter
    const matchesMonth = task.postDate.startsWith(selectedMonth);
    if (!matchesMonth) return false;

    // Department filter
    if (departmentFilter && task.department !== departmentFilter) {
      return false;
    }

    // Employee filter
    if (employeeFilter) {
      const taskAssignedTo = task.assignedTo || task.assignedEmployee;
      // Check if task is assigned to the selected employee by ID, name, or email
      const employee = employees.find(e => e.id === employeeFilter);
      if (employee) {
        const matchesById = taskAssignedTo === employee.id;
        const matchesByName = taskAssignedTo === employee.employeeName;
        const matchesByEmail = taskAssignedTo === employee.email;

        // Debug logging
        if (departmentFilter === 'video') {
          console.log('Employee Filter Debug:', {
            taskName: task.taskName,
            taskAssignedTo,
            employeeId: employee.id,
            employeeName: employee.employeeName,
            employeeEmail: employee.email,
            matchesById,
            matchesByName,
            matchesByEmail
          });
        }

        if (!matchesById && !matchesByName && !matchesByEmail) {
          return false;
        }
      } else if (taskAssignedTo !== employeeFilter) {
        return false;
      }
    }

    // Status filter
    if (statusFilter && task.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTaskName = task.taskName?.toLowerCase().includes(query);
      const matchesClientName = task.clientName?.toLowerCase().includes(query);
      const matchesDepartment = task.department?.toLowerCase().includes(query);
      const matchesStatus = task.status?.toLowerCase().includes(query);

      return matchesTaskName || matchesClientName || matchesDepartment || matchesStatus;
    }

    return true;
  });

  // Debug: Log filter results
  if (departmentFilter || employeeFilter || statusFilter) {
    console.log('Filter Applied:', {
      departmentFilter,
      employeeFilter,
      statusFilter,
      totalTasks: tasks.length,
      filteredTasksCount: filteredTasks.length,
      filteredTasks: filteredTasks.map(t => ({
        name: t.taskName,
        dept: t.department,
        assignedTo: t.assignedTo || t.assignedEmployee,
        status: t.status
      }))
    });
  }

  const filteredEmployees = employees.filter(emp => {
    // Department filter
    if (departmentFilter && emp.department !== departmentFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = emp.employeeName?.toLowerCase().includes(query);
      const matchesEmail = emp.email?.toLowerCase().includes(query);
      const matchesDepartment = emp.department?.toLowerCase().includes(query);

      return matchesName || matchesEmail || matchesDepartment;
    }

    return true;
  });

  const filteredClients = clients.filter(client => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = client.clientName?.toLowerCase().includes(query);
      const matchesEmail = client.email?.toLowerCase().includes(query);

      return matchesName || matchesEmail;
    }

    return true;
  });

  // Get available employees for employee filter dropdown
  const availableEmployees = departmentFilter
    ? employees.filter(e => e.department === departmentFilter && e.status === 'active')
    : employees.filter(e => e.status === 'active');


  const getDepartmentStats = (department) => {
    const deptTasks = filteredTasks.filter(t => t.department === department);
    const deptEmployees = employees.filter(e => e.department === department && e.status === 'active');

    // Debug: Log task statuses for video and graphics
    if (department === 'video' || department === 'graphics') {
      console.log(`${department} tasks:`, deptTasks.length);
      console.log(`${department} task statuses:`, deptTasks.map(t => t.status));
    }

    return {
      totalTasks: deptTasks.length,
      completedTasks: deptTasks.filter(t => t.status === 'completed' || t.status === 'posted' || t.status === 'approved').length,
      inProgressTasks: deptTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length,
      pendingTasks: deptTasks.filter(t => t.status === 'pending' || t.status === 'pending-production' || t.status === 'pending-client-approval' || t.status === 'revision-required').length,
      employees: deptEmployees.length
    };
  };

  const videoStats = getDepartmentStats('video');
  const graphicsStats = getDepartmentStats('graphics');
  const socialMediaStats = getDepartmentStats('social-media');
  const strategyEmployees = employees.filter(e => e.department === 'strategy' && e.status === 'active').length;

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'completed' || t.status === 'posted').length;
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length;
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending' || t.status === 'pending-production' || t.status === 'approved').length;
  const activeClients = filteredClients.filter(c => c.status === 'active').length;
  const activeEmployees = filteredEmployees.filter(e => e.status === 'active').length;

  const DepartmentCard = ({ title, icon, color, stats, departmentKey }) => {
    const handleDepartmentClick = () => {
      setSelectedView('department');
      setSelectedDepartment(departmentKey);
      setSelectedEmployee(null);
    };

    return (
      <div
        className="superadmin-dept-card"
        style={{
          borderLeft: `4px solid ${color}`,
          cursor: 'pointer',
          padding: '20px 24px',
          transition: 'all 0.2s ease',
          background: 'white'
        }}
        onClick={handleDepartmentClick}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            className="superadmin-dept-icon"
            style={{
              background: `${color}20`,
              color,
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 4px 0'
            }}>
              {title}
            </h3>
            <p style={{
              fontSize: '13px',
              color: '#6b7280',
              margin: 0
            }}>
              {stats.employees} Active Employees
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="superadmin-dashboard">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="superadmin-sidebar">
        <div className="superadmin-sidebar-header">
          <div className="superadmin-sidebar-logo">
            <div className="superadmin-sidebar-logo-icon">
              <Shield size={24} />
            </div>
            <div className="superadmin-sidebar-logo-text">
              <h2>Super Admin</h2>
              <p>Control Panel</p>
            </div>
          </div>
        </div>

        <nav className="superadmin-sidebar-nav">
          <div className="superadmin-sidebar-section">
            <ul className="superadmin-sidebar-menu">
              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${selectedView === 'overview' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('overview');
                    setSelectedDepartment(null);
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <TrendingUp size={20} />
                  </div>
                  Admin
                </button>
              </li>
              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${selectedView === 'employees' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('employees');
                    setSelectedDepartment(null);
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <Users size={20} />
                  </div>
                  All Employees
                </button>
              </li>
              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${selectedView === 'department' && selectedDepartment === 'production' && !selectedEmployee ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('department');
                    setSelectedDepartment('production');
                    setSelectedEmployee(null);
                    setExpandedDepartments(prev => ({ ...prev, production: !prev.production }));
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <Briefcase size={20} />
                  </div>
                  <span style={{ flex: 1 }}>Production</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDepartments(prev => ({
                        ...prev,
                        production: !prev.production
                      }));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {expandedDepartments.production ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </button>
                {expandedDepartments.production && (
                  <ul style={{ paddingLeft: '40px', marginTop: '4px' }}>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'add-employee' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('add-employee');
                          setSelectedDepartment(null);
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Users size={16} />
                        </div>
                        Add Employee
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'add-client' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('add-client');
                          setSelectedDepartment('production');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Users size={16} />
                        </div>
                        Add Client
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'view-clients' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('view-clients');
                          setSelectedDepartment('production');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Users size={16} />
                        </div>
                        View Clients
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className="superadmin-sidebar-menu-link"
                        onClick={() => {
                          setSelectedView('department');
                          setSelectedDepartment('production');
                          setSelectedEmployee(null);
                          setTimeout(() => {
                            const uploadExcelBtn = document.querySelector('[data-action="upload-excel"]');
                            if (uploadExcelBtn) uploadExcelBtn.click();
                          }, 100);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <FileText size={16} />
                        </div>
                        Upload Excel
                      </button>
                    </li>
                  </ul>
                )}
              </li>

              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${(selectedView === 'department' || selectedView === 'strategy-employees' || selectedView === 'strategy-report' || selectedView === 'strategy-my-task' || selectedView === 'strategy-clients') && selectedDepartment === 'strategy' && !selectedEmployee ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('department');
                    setSelectedDepartment('strategy');
                    setSelectedEmployee(null);
                    setExpandedDepartments(prev => ({ ...prev, strategy: !prev.strategy }));
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <TrendingUp size={20} />
                  </div>
                  <span style={{ flex: 1 }}>Strategy</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDepartments(prev => ({
                        ...prev,
                        strategy: !prev.strategy
                      }));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {expandedDepartments.strategy ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </button>
                {expandedDepartments.strategy && (
                  <ul style={{ paddingLeft: '40px', marginTop: '4px' }}>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'department' && selectedDepartment === 'strategy' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('department');
                          setSelectedDepartment('strategy');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <BarChart3 size={16} />
                        </div>
                        Dashboard
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'strategy-my-task' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('strategy-my-task');
                          setSelectedDepartment('strategy');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <ClipboardList size={16} />
                        </div>
                        My Task
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'strategy-clients' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('strategy-clients');
                          setSelectedDepartment('strategy');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Users size={16} />
                        </div>
                        Clients
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'strategy-employees' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('strategy-employees');
                          setSelectedDepartment('strategy');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Users size={16} />
                        </div>
                        Employees
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'strategy-report' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('strategy-report');
                          setSelectedDepartment('strategy');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <FileText size={16} />
                        </div>
                        Report
                      </button>
                    </li>
                  </ul>
                )}
              </li>

              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${(selectedView === 'department' || selectedView === 'video-calendar' || selectedView === 'video-my-tasks' || selectedView === 'video-employee-tasks' || selectedView === 'video-all-tasks' || selectedView === 'video-extra-tasks' || selectedView === 'video-add-extra-task' || selectedView === 'video-reports') && selectedDepartment === 'video' && !selectedEmployee ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('department');
                    setSelectedDepartment('video');
                    setSelectedEmployee(null);
                    setExpandedDepartments(prev => ({ ...prev, video: !prev.video }));
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <Video size={20} />
                  </div>
                  <span style={{ flex: 1 }}>Video</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDepartments(prev => ({
                        ...prev,
                        video: !prev.video
                      }));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {expandedDepartments.video ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </button>
                {expandedDepartments.video && (
                  <ul style={{ paddingLeft: '40px', marginTop: '4px' }}>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'department' && selectedDepartment === 'video' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('department');
                          setSelectedDepartment('video');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <BarChart3 size={16} />
                        </div>
                        Dashboard
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'video-calendar' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('video-calendar');
                          setSelectedDepartment('video');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Calendar size={16} />
                        </div>
                        Show Calendar
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'video-my-tasks' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('video-my-tasks');
                          setSelectedDepartment('video');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Users size={16} />
                        </div>
                        My Tasks
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'video-all-tasks' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('video-all-tasks');
                          setSelectedDepartment('video');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <FileText size={16} />
                        </div>
                        All Tasks
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'video-extra-tasks' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('video-extra-tasks');
                          setSelectedDepartment('video');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <FileText size={16} />
                        </div>
                        Extra Tasks
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'video-reports' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('video-reports');
                          setSelectedDepartment('video');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <BarChart3 size={16} />
                        </div>
                        Reports
                      </button>
                    </li>
                  </ul>
                )}
              </li>

              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${(selectedView === 'department' || selectedView === 'graphics-calendar' || selectedView === 'graphics-my-tasks' || selectedView === 'graphics-employee-tasks' || selectedView === 'graphics-all-tasks' || selectedView === 'graphics-extra-tasks' || selectedView === 'graphics-add-extra-task' || selectedView === 'graphics-reports') && selectedDepartment === 'graphics' && !selectedEmployee ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('department');
                    setSelectedDepartment('graphics');
                    setSelectedEmployee(null);
                    setExpandedDepartments(prev => ({ ...prev, graphics: !prev.graphics }));
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <Image size={20} />
                  </div>
                  <span style={{ flex: 1 }}>Graphics</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDepartments(prev => ({
                        ...prev,
                        graphics: !prev.graphics
                      }));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {expandedDepartments.graphics ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </button>
                {expandedDepartments.graphics && (
                  <ul style={{ paddingLeft: '40px', marginTop: '4px' }}>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'department' && selectedDepartment === 'graphics' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('department');
                          setSelectedDepartment('graphics');
                          setSelectedEmployee(null);
                          setEmployeeFilter(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <BarChart3 size={16} />
                        </div>
                        Dashboard
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'graphics-calendar' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('graphics-calendar');
                          setSelectedDepartment('graphics');
                          setSelectedEmployee(null);
                          setEmployeeFilter(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Calendar size={16} />
                        </div>
                        Show Calendar
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'graphics-my-tasks' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('graphics-my-tasks');
                          setSelectedDepartment('graphics');
                          setSelectedEmployee(null);
                          setEmployeeFilter(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Users size={16} />
                        </div>
                        My Tasks
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'graphics-all-tasks' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('graphics-all-tasks');
                          setSelectedDepartment('graphics');
                          setSelectedEmployee(null);
                          setEmployeeFilter(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <FileText size={16} />
                        </div>
                        All Tasks
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'graphics-extra-tasks' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('graphics-extra-tasks');
                          setSelectedDepartment('graphics');
                          setSelectedEmployee(null);
                          setEmployeeFilter(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <FileText size={16} />
                        </div>
                        Extra Tasks
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'graphics-reports' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('graphics-reports');
                          setSelectedDepartment('graphics');
                          setSelectedEmployee(null);
                          setEmployeeFilter(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <BarChart3 size={16} />
                        </div>
                        Reports
                      </button>
                    </li>
                  </ul>
                )}
              </li>

              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${(selectedView === 'department' || selectedView === 'social-media-calendar' || selectedView === 'social-media-my-tasks' || selectedView === 'social-media-reports') && selectedDepartment === 'social-media' && !selectedEmployee ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('department');
                    setSelectedDepartment('social-media');
                    setSelectedEmployee(null);
                    setExpandedDepartments(prev => ({ ...prev, socialMedia: !prev.socialMedia }));
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <Share2 size={20} />
                  </div>
                  <span style={{ flex: 1 }}>Social Media</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDepartments(prev => ({
                        ...prev,
                        socialMedia: !prev.socialMedia
                      }));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {expandedDepartments.socialMedia ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </button>
                {expandedDepartments.socialMedia && (
                  <ul style={{ paddingLeft: '40px', marginTop: '4px' }}>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'department' && selectedDepartment === 'social-media' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('department');
                          setSelectedDepartment('social-media');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <BarChart3 size={16} />
                        </div>
                        Dashboard
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'social-media-calendar' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('social-media-calendar');
                          setSelectedDepartment('social-media');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <Calendar size={16} />
                        </div>
                        Show Calendar
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'social-media-my-tasks' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('social-media-my-tasks');
                          setSelectedDepartment('social-media');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <User size={16} />
                        </div>
                        My Tasks
                      </button>
                    </li>
                    <li style={{ marginBottom: '4px' }}>
                      <button
                        className={`superadmin-sidebar-menu-link ${selectedView === 'social-media-reports' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedView('social-media-reports');
                          setSelectedDepartment('social-media');
                          setSelectedEmployee(null);
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        <div className="superadmin-sidebar-menu-icon">
                          <BarChart3 size={16} />
                        </div>
                        Reports
                      </button>
                    </li>
                  </ul>
                )}
              </li>
              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${selectedView === 'reports' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('reports');
                    setSelectedDepartment(null);
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <FileText size={20} />
                  </div>
                  Reports
                </button>
              </li>
              <li className="superadmin-sidebar-menu-item">
                <button
                  className={`superadmin-sidebar-menu-link ${selectedView === 'change-password' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedView('change-password');
                    setSelectedDepartment(null);
                    setSelectedEmployee(null);
                  }}
                >
                  <div className="superadmin-sidebar-menu-icon">
                    <Shield size={20} />
                  </div>
                  Change Password
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <div className="superadmin-sidebar-user">
          <div className="superadmin-sidebar-user-info">
            {/* <div className="superadmin-sidebar-user-avatar">SA</div>
            <div className="superadmin-sidebar-user-details">
              <h4>Super Admin</h4>
              <p>superadmin@gmail.com</p>
            </div> */}
          </div>
          <button onClick={handleLogout} className="superadmin-btn-logout">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="superadmin-main-content">
        <div className="superadmin-header">
          {/* Month filter in header - Hide in Reports view, Change Password, and Add Employee */}
          {selectedView !== 'reports' && selectedView !== 'change-password' && selectedView !== 'add-employee' && selectedView !== 'add-client' && (
            <div className="superadmin-header-content" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: '16px' }}>
              <div className="superadmin-header-right" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="superadmin-filter-group">
                  <Calendar size={18} />
                  <label>Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="superadmin-month-input"
                  />
                </div>
                {/* Employee Filter - Only show when viewing Strategy department */}
                {selectedView === 'department' && selectedDepartment === 'strategy' && (
                  <div className="superadmin-filter-group">
                    <Users size={18} />
                    <label>Employee:</label>
                    <select
                      value={employeeFilter || ''}
                      onChange={(e) => setEmployeeFilter(e.target.value || null)}
                      className="superadmin-month-input"
                      style={{
                        padding: '8px 12px',
                        minWidth: '180px'
                      }}
                    >
                      <option value="">All Employees</option>
                      {employees
                        .filter(emp => emp.department === 'strategy' && emp.status === 'active')
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.employeeName}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                {/* Employee Filter - Only show when viewing Video department */}
                {(selectedView === 'department' || selectedView === 'video-calendar' || selectedView === 'video-my-tasks' ||
                  selectedView === 'video-employee-tasks' || selectedView === 'video-all-tasks' ||
                  selectedView === 'video-extra-tasks' || selectedView === 'video-add-extra-task' ||
                  selectedView === 'video-reports') && selectedDepartment === 'video' && (
                    <div className="superadmin-filter-group">
                      <Users size={18} />
                      <label>Employee:</label>
                      <select
                        value={employeeFilter || ''}
                        onChange={(e) => setEmployeeFilter(e.target.value || null)}
                        className="superadmin-month-input"
                        style={{
                          padding: '8px 12px',
                          minWidth: '180px'
                        }}
                      >
                        <option value="">All Employees</option>
                        {employees
                          .filter(emp => emp.department === 'video' && emp.status === 'active')
                          .map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.employeeName}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Reports Heading with Month Filter - Only show in Reports view */}
          {selectedView === 'reports' && (
            <div style={{
              marginTop: '24px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 className="superadmin-section-title" style={{ margin: 0 }}>Reports</h2>
              <div className="superadmin-filter-group">
                <Calendar size={18} />
                <label>Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="superadmin-month-input"
                />
              </div>
            </div>
          )}

          {/* Analytics & Charts Section - Only show in Reports view */}
          {selectedView === 'reports' && (() => {
            // Use filteredTasks which includes all filters (department, employee, status, search)
            const chartTasks = filteredTasks;

            // Calculate filtered statistics
            const filteredStats = {
              total: chartTasks.length,
              completed: chartTasks.filter(t => t.status === 'completed' || t.status === 'posted').length,
              inProgress: chartTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length,
              pending: chartTasks.filter(t => t.status === 'pending' || t.status === 'pending-production' || t.status === 'revision-required').length
            };

            // Get department-wise data for filtered tasks
            const deptData = ['production', 'strategy', 'video', 'graphics', 'social-media'].map(dept => ({
              name: dept === 'social-media' ? 'Social' : dept.charAt(0).toUpperCase() + dept.slice(1),
              value: chartTasks.filter(t => t.department === dept).length,
              completed: chartTasks.filter(t => t.department === dept && (t.status === 'completed' || t.status === 'posted')).length,
              inProgress: chartTasks.filter(t => t.department === dept && (t.status === 'in-progress' || t.status === 'assigned-to-department')).length,
              pending: chartTasks.filter(t => t.department === dept && (t.status === 'pending' || t.status === 'pending-production' || t.status === 'revision-required')).length
            })).filter(d => d.value > 0); // Only show departments with tasks

            return (
              <div style={{ marginBottom: '24px' }}>
                {/* Filter Status Banner */}
                {(statusFilter || departmentFilter || employeeFilter) && (
                  <div style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <Filter size={16} color="#0284c7" />
                      <span style={{ fontSize: '14px', color: '#0c4a6e', fontWeight: '600' }}>
                        Active Filters:
                      </span>
                      {departmentFilter && (
                        <span style={{ fontSize: '13px', color: '#0369a1', background: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                          {departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1).replace('-', ' ')}
                        </span>
                      )}
                      {employeeFilter && (
                        <span style={{ fontSize: '13px', color: '#0369a1', background: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                          {employees.find(e => e.id === employeeFilter)?.employeeName}
                        </span>
                      )}
                      {statusFilter && (
                        <span style={{ fontSize: '13px', color: '#0369a1', background: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                          {statusFilter === 'in-progress' ? 'In Progress' : statusFilter === 'revision-required' ? 'Revert' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                        </span>
                      )}
                      <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: '600' }}>
                        ({chartTasks.length} tasks)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setStatusFilter(null);
                        setDepartmentFilter(null);
                        setEmployeeFilter(null);
                      }}
                      style={{
                        background: 'white',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        color: '#0284c7',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <X size={14} />
                      Clear All
                    </button>
                  </div>
                )}

                {/* Summary Stats Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '10px',
                    padding: '16px',
                    color: 'white'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Total Tasks</div>
                    <div style={{ fontSize: '28px', fontWeight: '700' }}>{filteredStats.total}</div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '10px',
                    padding: '16px',
                    color: 'white'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Completed</div>
                    <div style={{ fontSize: '28px', fontWeight: '700' }}>{filteredStats.completed}</div>
                    <div style={{ fontSize: '11px', opacity: 0.8 }}>
                      {filteredStats.total > 0 ? Math.round((filteredStats.completed / filteredStats.total) * 100) : 0}% completion
                    </div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    borderRadius: '10px',
                    padding: '16px',
                    color: 'white'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>In Progress</div>
                    <div style={{ fontSize: '28px', fontWeight: '700' }}>{filteredStats.inProgress}</div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    borderRadius: '10px',
                    padding: '16px',
                    color: 'white'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Pending</div>
                    <div style={{ fontSize: '28px', fontWeight: '700' }}>{filteredStats.pending}</div>
                  </div>
                </div>

                {/* Charts Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px'
                }}>
                  {/* Line Chart - Task Timeline */}
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '12px', textAlign: 'center' }}>
                      📈 Task Status Breakdown
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={deptData}
                        margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" style={{ fontSize: '11px' }} />
                        <YAxis style={{ fontSize: '11px' }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
                        <Line type="monotone" dataKey="inProgress" stroke="#f59e0b" strokeWidth={2} name="In Progress" />
                        <Line type="monotone" dataKey="pending" stroke="#ef4444" strokeWidth={2} name="Pending" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Donut Chart - Status Distribution */}
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '12px', textAlign: 'center' }}>
                      🎯 Status Distribution
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: 'Completed', value: filteredStats.completed, color: '#10b981' },
                            { name: 'In Progress', value: filteredStats.inProgress, color: '#f59e0b' },
                            { name: 'Pending', value: filteredStats.pending, color: '#ef4444' }
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                          {[
                            { name: 'Completed', value: filteredStats.completed, color: '#10b981' },
                            { name: 'In Progress', value: filteredStats.inProgress, color: '#f59e0b' },
                            { name: 'Pending', value: filteredStats.pending, color: '#ef4444' }
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stacked Bar Chart - Department Comparison */}
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '12px', textAlign: 'center' }}>
                      📊 Department Comparison
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={deptData}
                        margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" style={{ fontSize: '11px' }} />
                        <YAxis style={{ fontSize: '11px' }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                        <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" name="In Progress" />
                        <Bar dataKey="pending" stackId="a" fill="#ef4444" name="Pending" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Department Performance Table */}
                {deptData.length > 0 && (
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e5e7eb',
                    marginTop: '16px'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
                      📋 Department Performance Summary
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Department</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Total</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Completed</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>In Progress</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Pending</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Completion %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptData.map((dept, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '500', color: '#1f2937' }}>{dept.name}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#374151' }}>{dept.value}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#10b981', fontWeight: '600' }}>{dept.completed}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#f59e0b', fontWeight: '600' }}>{dept.inProgress}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#ef4444', fontWeight: '600' }}>{dept.pending}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
                              <span style={{
                                background: dept.value > 0 && (dept.completed / dept.value) >= 0.7 ? '#d1fae5' :
                                  dept.value > 0 && (dept.completed / dept.value) >= 0.4 ? '#fef3c7' : '#fee2e2',
                                color: dept.value > 0 && (dept.completed / dept.value) >= 0.7 ? '#065f46' :
                                  dept.value > 0 && (dept.completed / dept.value) >= 0.4 ? '#92400e' : '#991b1b',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px'
                              }}>
                                {dept.value > 0 ? Math.round((dept.completed / dept.value) * 100) : 0}%
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
          })()}

          {/* Search and Filter Bar - Hide in Overview, Change Password, and Add Employee */}
          {selectedView !== 'overview' && selectedView !== 'change-password' && selectedView !== 'add-employee' && selectedView !== 'add-client' && (
            <>
              <div className="superadmin-search-filter-bar">
                {/* Search Bar */}
                <div className="superadmin-search-container">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search tasks, employees, clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="superadmin-search-input"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="search-clear-btn"
                      title="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Department Filter */}
                <div className="superadmin-filter-dropdown">
                  <Filter size={16} className="filter-icon" />
                  <select
                    value={departmentFilter || ''}
                    onChange={(e) => {
                      setDepartmentFilter(e.target.value || null);
                      setEmployeeFilter(null); // Reset employee filter when department changes
                    }}
                    className="superadmin-filter-select"
                  >
                    <option value="">All Departments</option>
                    <option value="production">Production Incharge</option>
                    <option value="strategy">Strategy</option>
                    <option value="video">Video</option>
                    <option value="graphics">Graphics</option>
                    <option value="social-media">Social Media</option>
                  </select>
                </div>

                {/* Employee Filter */}
                <div className="superadmin-filter-dropdown">
                  <Users size={16} className="filter-icon" />
                  <select
                    value={employeeFilter || ''}
                    onChange={(e) => setEmployeeFilter(e.target.value || null)}
                    className="superadmin-filter-select"
                    disabled={!departmentFilter && availableEmployees.length === 0}
                  >
                    <option value="">All Employees</option>
                    {availableEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter - Only show in Reports view */}
                {selectedView === 'reports' && (
                  <div className="superadmin-filter-dropdown">
                    <Filter size={16} className="filter-icon" />
                    <select
                      value={statusFilter || ''}
                      onChange={(e) => setStatusFilter(e.target.value || null)}
                      className="superadmin-filter-select"
                      style={{ minWidth: '150px' }}
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="posted">Posted</option>
                      <option value="revision-required">Revert</option>
                    </select>
                  </div>
                )}

                {/* Clear Filters Button */}
                {(searchQuery || departmentFilter || employeeFilter || (selectedView === 'reports' && statusFilter)) && (
                  <button
                    onClick={() => {
                      clearFilters();
                      if (selectedView === 'reports') setStatusFilter(null);
                    }}
                    className="superadmin-clear-filters-btn"
                    title="Clear all filters"
                  >
                    <X size={16} />
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Active Filters Display */}
              {(searchQuery || departmentFilter || employeeFilter || (selectedView === 'reports' && statusFilter)) && (
                <div className="superadmin-active-filters">
                  <span className="active-filters-label">Active Filters:</span>
                  {searchQuery && (
                    <span className="filter-badge">
                      Search: "{searchQuery}"
                      <button onClick={() => setSearchQuery('')} className="filter-badge-close">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {departmentFilter && (
                    <span className="filter-badge">
                      Department: {departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1).replace('-', ' ')}
                      <button onClick={() => {
                        setDepartmentFilter(null);
                        setEmployeeFilter(null);
                      }} className="filter-badge-close">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {employeeFilter && (
                    <span className="filter-badge">
                      Employee: {availableEmployees.find(e => e.id === employeeFilter)?.employeeName}
                      <button onClick={() => setEmployeeFilter(null)} className="filter-badge-close">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {selectedView === 'reports' && statusFilter && (
                    <span className="filter-badge">
                      Status: {statusFilter === 'in-progress' ? 'In Progress' : statusFilter === 'revision-required' ? 'Revert' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                      <button onClick={() => setStatusFilter(null)} className="filter-badge-close">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {selectedView === 'overview' && (
          <>
            <div className="superadmin-stats-grid">
              <div className="superadmin-stat-card" style={{ background: 'linear-gradient(135deg, #FFCC80 0%, #FF9800 100%)' }}>
                <div className="stat-icon">
                  <Briefcase size={24} />
                </div>
                <div className="stat-content">
                  <h3>{totalTasks}</h3>
                  <p>Total Tasks</p>
                  <small>For selected month</small>
                </div>
              </div>

              <div className="superadmin-stat-card" style={{ background: 'linear-gradient(135deg, #80CBC4 0%, #009688 100%)' }}>
                <div className="stat-icon">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <h3>{completedTasks}</h3>
                  <p>Completed</p>
                  <small>{totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% completion rate</small>
                </div>
              </div>

              <div className="superadmin-stat-card" style={{ background: 'linear-gradient(135deg, #81D4FA 0%, #039BE5 100%)' }}>
                <div className="stat-icon">
                  <Clock size={24} />
                </div>
                <div className="stat-content">
                  <h3>{inProgressTasks}</h3>
                  <p>In Progress</p>
                  <small>Currently being worked on</small>
                </div>
              </div>

              <div className="superadmin-stat-card" style={{ background: 'linear-gradient(135deg, #EF9A9A 0%, #F44336 100%)' }}>
                <div className="stat-icon">
                  <AlertCircle size={24} />
                </div>
                <div className="stat-content">
                  <h3>{pendingTasks}</h3>
                  <p>Pending</p>
                  <small>Awaiting action</small>
                </div>
              </div>

              <div className="superadmin-stat-card" style={{ background: 'linear-gradient(135deg, #CE93D8 0%, #AB47BC 100%)' }}>
                <div className="stat-icon">
                  <Users size={24} />
                </div>
                <div className="stat-content">
                  <h3>{activeClients}</h3>
                  <p>Active Clients</p>
                  <small>Total clients</small>
                </div>
              </div>

              <div className="superadmin-stat-card" style={{ background: 'linear-gradient(135deg, #9FA8DA 0%, #5C6BC0 100%)' }}>
                <div className="stat-icon">
                  <Users size={24} />
                </div>
                <div className="stat-content">
                  <h3>{activeEmployees}</h3>
                  <p>Active Employees</p>
                  <small>Across all departments</small>
                </div>
              </div>
            </div>

            {/* Analytics Charts Section */}
            <div className="superadmin-section" style={{ marginTop: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '16px',
                marginBottom: '20px'
              }}>
                {/* Tasks Per Department - Area Chart */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#1f2937',
                      margin: 0
                    }}>
                      Tasks Per Department
                    </h3>
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      padding: '3px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <TrendingUp size={12} />
                      {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={[
                      { name: 'Production', tasks: totalTasks },
                      { name: 'Strategy', tasks: totalTasks },
                      { name: 'Video', tasks: videoStats.totalTasks },
                      { name: 'Graphics', tasks: graphicsStats.totalTasks },
                      { name: 'Social', tasks: socialMediaStats.totalTasks }
                    ]}>
                      <defs>
                        <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#667eea" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#667eea" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tasks"
                        stroke="#667eea"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorTasks)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                        {totalTasks + videoStats.totalTasks + graphicsStats.totalTasks + socialMediaStats.totalTasks}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Tasks</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                        {completedTasks + videoStats.completedTasks + graphicsStats.completedTasks + socialMediaStats.completedTasks}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>Completed</div>
                    </div>
                  </div>
                </div>

                {/* Department Distribution - Pie Chart */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '12px'
                  }}>
                    Department Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Production', value: totalTasks, color: '#667eea' },
                          { name: 'Strategy', value: totalTasks, color: '#10b981' },
                          { name: 'Video', value: videoStats.totalTasks, color: '#ef4444' },
                          { name: 'Graphics', value: graphicsStats.totalTasks, color: '#ec4899' },
                          { name: 'Social Media', value: socialMediaStats.totalTasks, color: '#06b6d4' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {[
                          { name: 'Production', value: totalTasks, color: '#667eea' },
                          { name: 'Strategy', value: totalTasks, color: '#10b981' },
                          { name: 'Video', value: videoStats.totalTasks, color: '#ef4444' },
                          { name: 'Graphics', value: graphicsStats.totalTasks, color: '#ec4899' },
                          { name: 'Social Media', value: socialMediaStats.totalTasks, color: '#06b6d4' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: '12px' }}>
                    {[
                      { name: 'Production', color: '#667eea', value: totalTasks },
                      { name: 'Strategy', color: '#10b981', value: totalTasks },
                      { name: 'Video', color: '#ef4444', value: videoStats.totalTasks },
                      { name: 'Graphics', color: '#ec4899', value: graphicsStats.totalTasks },
                      { name: 'Social Media', color: '#06b6d4', value: socialMediaStats.totalTasks }
                    ].map((dept, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: idx < 4 ? '1px solid #f3f4f6' : 'none'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: dept.color
                          }} />
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>{dept.name}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>
                          {dept.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Completion Rates - Progress Bars */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '12px'
                  }}>
                    Completion Rates
                  </h3>
                  <div style={{ marginTop: '12px' }}>
                    {[
                      {
                        name: 'Production',
                        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
                        color: '#667eea'
                      },
                      {
                        name: 'Strategy',
                        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
                        color: '#10b981'
                      },
                      {
                        name: 'Video',
                        percentage: videoStats.totalTasks > 0 ? Math.round((videoStats.completedTasks / videoStats.totalTasks) * 100) : 0,
                        color: '#ef4444'
                      },
                      {
                        name: 'Graphics',
                        percentage: graphicsStats.totalTasks > 0 ? Math.round((graphicsStats.completedTasks / graphicsStats.totalTasks) * 100) : 0,
                        color: '#ec4899'
                      },
                      {
                        name: 'Social Media',
                        percentage: socialMediaStats.totalTasks > 0 ? Math.round((socialMediaStats.completedTasks / socialMediaStats.totalTasks) * 100) : 0,
                        color: '#06b6d4'
                      }
                    ].map((dept, idx) => (
                      <div key={idx} style={{ marginBottom: '12px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '6px'
                        }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                            {dept.name}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: dept.color }}>
                            {dept.percentage}%
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          background: '#f3f4f6',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${dept.percentage}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${dept.color} 0%, ${dept.color}dd 100%)`,
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="superadmin-section" style={{ marginTop: '20px' }}>
              <h2 className="superadmin-section-title">Department Overview</h2>
              <div className="superadmin-dept-grid">
                <DepartmentCard
                  title="Production Department"
                  icon={<Briefcase size={24} />}
                  color="#667eea"
                  stats={{ totalTasks: totalTasks, completedTasks, inProgressTasks, pendingTasks, employees: 1 }}
                  employees={[{ id: 'prod', employeeName: 'Production Incharge', email: 'production@gmail.com' }]}
                  departmentKey="production"
                />

                <DepartmentCard
                  title="Strategy Department"
                  icon={<TrendingUp size={24} />}
                  color="#10b981"
                  stats={{ totalTasks: totalTasks, completedTasks, inProgressTasks, pendingTasks, employees: strategyEmployees + 1 }}
                  employees={[
                    { id: 'strat-head', employeeName: 'Strategy Head', email: 'head@gmail.com' },
                    ...employees.filter(e => e.department === 'strategy' && e.status === 'active')
                  ]}
                  departmentKey="strategy"
                />

                <DepartmentCard
                  title="Video Department"
                  icon={<Video size={24} />}
                  color="#ef4444"
                  stats={videoStats}
                  employees={employees.filter(e => e.department === 'video' && e.status === 'active')}
                  departmentKey="video"
                />

                <DepartmentCard
                  title="Graphics Department"
                  icon={<Image size={24} />}
                  color="#ec4899"
                  stats={graphicsStats}
                  employees={employees.filter(e => e.department === 'graphics' && e.status === 'active')}
                  departmentKey="graphics"
                />

                <DepartmentCard
                  title="Social Media Department"
                  icon={<Share2 size={24} />}
                  color="#06b6d4"
                  stats={socialMediaStats}
                  employees={employees.filter(e => e.department === 'social-media' && e.status === 'active')}
                  departmentKey="social-media"
                />
              </div>
            </div>
          </>
        )}

        {selectedView === 'department' && selectedDepartment && !selectedEmployee && (
          <div className="superadmin-embedded-dashboard">
            {selectedDepartment === 'production' && <ProductionIncharge key={selectedView + selectedDepartment} />}
            {selectedDepartment === 'strategy' && <StrategyHead initialView="dashboard" />}
            {selectedDepartment === 'video' && <VideoDashboard initialView="dashboard" />}
            {selectedDepartment === 'graphics' && <GraphicsDashboard initialView="dashboard" />}
            {selectedDepartment === 'social-media' && <SocialMediaDashboard initialView="dashboard" />}
          </div>
        )}

        {selectedView === 'strategy-report' && (
          <div className="superadmin-embedded-dashboard">
            <StrategyHead initialView="report" />
          </div>
        )}

        {selectedView === 'strategy-my-task' && (
          <div className="superadmin-content">
            <div className="superadmin-header">
              <div className="superadmin-header-content">
                <div className="superadmin-header-left">
                  <div className="superadmin-header-title">
                    <h1>My Task</h1>
                    <p>Work on clients assigned to you through all 4 stages</p>
                  </div>
                </div>
              </div>
            </div>

            {/* My Clients - Clients assigned to Strategy Head */}
            <div className="superadmin-card" style={{ marginBottom: '24px' }}>
              <div style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                color: 'white',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  📋 My Clients ({clients.filter(c => c.assignedToEmployee === 'head@gmail.com').length})
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  Clients assigned to you - Work through all 4 stages
                </p>
              </div>
              <div style={{ padding: '20px', background: 'white', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {clients.filter(c => c.assignedToEmployee === 'head@gmail.com').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>📋</div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>No clients assigned to you</h3>
                    <p style={{ margin: 0, fontSize: '14px' }}>Assign clients to yourself from the Clients section to start working on them</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '10%' }}>Client ID</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151', width: '25%' }}>Client Name</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '18%' }}>Stage</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '12%' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '15%' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '20%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.filter(c => c.assignedToEmployee === 'head@gmail.com').map((client) => (
                          <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#6366f1', fontWeight: '600' }}>
                              {client.clientId}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '16px',
                                  flexShrink: 0
                                }}>
                                  {(client.clientName && typeof client.clientName === 'string')
                                    ? client.clientName.charAt(0).toUpperCase()
                                    : 'C'}
                                </div>
                                <span style={{ fontWeight: '500', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {client.clientName || 'Unknown Client'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {(() => {
                                const stages = {
                                  'information-gathering': { name: 'Info Gathering', color: '#dbeafe', textColor: '#1e40af' },
                                  'strategy-preparation': { name: 'Strategy Prep', color: '#e0e7ff', textColor: '#4338ca' },
                                  'internal-approval': { name: 'Internal Approval', color: '#fce7f3', textColor: '#ec4899' },
                                  'client-approval': { name: 'Client Approval', color: '#fef3c7', textColor: '#f59e0b' }
                                };
                                const currentStage = client.stage || 'information-gathering';
                                const stageInfo = stages[currentStage] || stages['information-gathering'];
                                return (
                                  <span style={{
                                    padding: '6px 12px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: stageInfo.color,
                                    color: stageInfo.textColor,
                                    display: 'inline-block'
                                  }}>
                                    {stageInfo.name}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                              {client.sentAt ? new Date(client.sentAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: '#dcfce7',
                                color: '#16a34a',
                                display: 'inline-block'
                              }}>
                                In Progress
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setSelectedClientForWorkflow(client);
                                  setSelectedView('client-workflow');
                                }}
                                style={{
                                  background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.transform = 'translateY(-2px)';
                                  e.target.style.boxShadow = '0 4px 8px rgba(55, 180, 111, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.transform = 'translateY(0)';
                                  e.target.style.boxShadow = 'none';
                                }}
                              >
                                Work on Client
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedView === 'client-workflow' && selectedClientForWorkflow && (
          <div className="superadmin-content">
            <div className="superadmin-header">
              <div className="superadmin-header-content">
                <div className="superadmin-header-left">
                  <button
                    onClick={() => setSelectedView('strategy-my-task')}
                    style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginRight: '16px'
                    }}
                  >
                    ← Back
                  </button>
                  <div className="superadmin-header-title">
                    <h1>{selectedClientForWorkflow.clientName}</h1>
                    <p>Client ID: {selectedClientForWorkflow.clientId} | Work through all 4 stages</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="superadmin-card" style={{ padding: '32px' }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600', color: '#374151' }}>
                Client Progress
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '32px'
              }}>
                {(() => {
                  const allStages = [
                    { name: 'Information Gathering', status: 'information-gathering', color: '#dbeafe', borderColor: '#1e40af', textColor: '#1e40af' },
                    { name: 'Strategy Preparation', status: 'strategy-preparation', color: '#e0e7ff', borderColor: '#4338ca', textColor: '#4338ca' },
                    { name: 'Internal Approval', status: 'internal-approval', color: '#fce7f3', borderColor: '#ec4899', textColor: '#ec4899' },
                    { name: 'Client Approval', status: 'client-approval', color: '#fef3c7', borderColor: '#f59e0b', textColor: '#f59e0b' }
                  ];

                  const currentStage = selectedClientForWorkflow.stage || 'information-gathering';
                  let currentStageIndex = allStages.findIndex(s => s.status === currentStage);

                  // Fallback logic if stage is not found or relying on completions
                  if (currentStageIndex === -1) {
                    if (selectedClientForWorkflow.stageCompletions) {
                      const completedStages = Object.keys(selectedClientForWorkflow.stageCompletions);
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
                    const isActive = currentStage === stage.status;
                    const hasCompletionDate = selectedClientForWorkflow.stageCompletions && selectedClientForWorkflow.stageCompletions[stage.status];
                    const isCompleted = currentStageIndex > index || hasCompletionDate;
                    const isCurrent = isActive; // Define isCurrent for the new card view

                    return (
                      <div key={stage.status} style={{
                        padding: '24px',
                        borderRadius: '12px',
                        border: `3px solid ${isCurrent ? stage.borderColor : isCompleted ? '#10b981' : '#e5e7eb'}`,
                        background: isCurrent ? stage.color : isCompleted ? '#d1fae5' : 'white',
                        boxShadow: isCurrent ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                        transition: 'all 0.3s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '200px'
                      }}>
                        <div style={{
                          fontSize: '40px',
                          marginBottom: '12px',
                          textAlign: 'center'
                        }}>
                          {isCompleted ? '✅' : isCurrent ? stage.icon : '⏳'}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: isCurrent ? stage.textColor : isCompleted ? '#059669' : '#6b7280',
                          textAlign: 'center',
                          marginBottom: '8px',
                          lineHeight: '1.4'
                        }}>
                          {stage.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          textAlign: 'center',
                          fontWeight: '500',
                          marginBottom: isCurrent ? '16px' : '0'
                        }}>
                          {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Pending'}
                        </div>

                        {/* Action Buttons for Card View */}
                        {isCompleted && stage.status === 'strategy-preparation' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const tasksSection = document.getElementById('client-tasks-section');
                              if (tasksSection) {
                                tasksSection.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 16px',
                              background: 'white',
                              color: '#4338ca',
                              border: '1px solid #4338ca',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              marginBottom: '8px',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = '#e0e7ff';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'white';
                            }}
                          >
                            Show Tasks
                          </button>
                        )}


                        {isCurrent && stage.status === 'information-gathering' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Mark Information Gathering as complete and move to Strategy Preparation?')) {
                                try {
                                  const clientRef = ref(database, `strategyClients/${selectedClientForWorkflow.id}`);
                                  const completionDate = new Date().toISOString();
                                  const updates = {
                                    stage: 'strategy-preparation',
                                    lastUpdated: completionDate,
                                    [`stageCompletions/${stage.status}`]: completionDate
                                  };
                                  await update(clientRef, updates);
                                  setSelectedClientForWorkflow(prev => ({ ...prev, ...updates, stageCompletions: { ...prev.stageCompletions, [stage.status]: completionDate } }));
                                  showToast('✅ Moved to Strategy Preparation!', 'success');
                                } catch (error) {
                                  console.error(error);
                                  showToast('❌ Error updating stage', 'error');
                                }
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              marginTop: '8px',
                              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                            }}
                          >
                            Complete
                          </button>
                        )}

                        {isCurrent && stage.status === 'strategy-preparation' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Mark Strategy Preparation as complete and move to Internal Approval?')) {
                                try {
                                  const clientRef = ref(database, `strategyClients/${selectedClientForWorkflow.id}`);
                                  const completionDate = new Date().toISOString();
                                  const updates = {
                                    stage: 'internal-approval',
                                    lastUpdated: completionDate,
                                    [`stageCompletions/${stage.status}`]: completionDate
                                  };
                                  await update(clientRef, updates);
                                  setSelectedClientForWorkflow(prev => ({ ...prev, ...updates, stageCompletions: { ...prev.stageCompletions, [stage.status]: completionDate } }));
                                  showToast('✅ Moved to Internal Approval!', 'success');
                                } catch (error) {
                                  console.error(error);
                                  showToast('❌ Error updating stage', 'error');
                                }
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              marginTop: '8px',
                              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                            }}
                          >
                            Complete
                          </button>
                        )}

                        {isCurrent && stage.status === 'internal-approval' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Move client to Client Approval?')) {
                                try {
                                  const clientRef = ref(database, `strategyClients/${selectedClientForWorkflow.id}`);
                                  const completionDate = new Date().toISOString();
                                  const updates = {
                                    stage: 'client-approval',
                                    lastUpdated: completionDate,
                                    [`stageCompletions/${stage.status}`]: completionDate
                                  };
                                  await update(clientRef, updates);
                                  setSelectedClientForWorkflow(prev => ({ ...prev, ...updates, stageCompletions: { ...prev.stageCompletions, [stage.status]: completionDate } }));
                                  showToast('✅ Moved to Client Approval!', 'success');
                                } catch (error) {
                                  console.error(error);
                                  showToast('❌ Error updating stage', 'error');
                                }
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              marginTop: '8px',
                              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            Approve
                          </button>
                        )}

                        {isCurrent && stage.status === 'client-approval' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '8px' }}>
                            <button
                              onClick={async () => {
                                if (window.confirm('Approve all tasks and send to departments?')) {
                                  try {
                                    const clientTasks = tasks.filter(t => t.clientId === selectedClientForWorkflow.clientId || t.clientName === selectedClientForWorkflow.clientName);
                                    const updatePromises = clientTasks.map(task => {
                                      const taskRef = ref(database, `tasks/${task.id}`);
                                      return update(taskRef, {
                                        status: 'assigned-to-department',
                                        approvedAt: new Date().toISOString(),
                                        approvedBy: 'Super Admin',
                                        approvedForCalendar: true,
                                        assignedToDepartmentAt: new Date().toISOString(),
                                        assignedBy: 'Super Admin',
                                        assignedToDept: task.department,
                                        lastUpdated: new Date().toISOString()
                                      });
                                    });
                                    await Promise.all(updatePromises);

                                    const clientRef = ref(database, `strategyClients/${selectedClientForWorkflow.id}`);
                                    const completionDate = new Date().toISOString();
                                    const updates = {
                                      stage: 'information-gathering',
                                      completedAt: completionDate,
                                      lastUpdated: completionDate,
                                      'stageCompletions/information-gathering': null,
                                      'stageCompletions/strategy-preparation': null,
                                      'stageCompletions/internal-approval': null,
                                      'stageCompletions/client-approval': null
                                    };
                                    await update(clientRef, updates);
                                    setSelectedClientForWorkflow(prev => ({ ...prev, ...updates, stageCompletions: {} }));
                                    showToast('✅ Tasks approved & Client reset!', 'success');
                                  } catch (error) {
                                    console.error(error);
                                    showToast('❌ Error approving tasks', 'error');
                                  }
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('Reject and send back to Information Gathering? All progress will be reset.')) {
                                  try {
                                    const clientRef = ref(database, `strategyClients/${selectedClientForWorkflow.id}`);
                                    const updates = {
                                      stage: 'information-gathering',
                                      rejectedAt: new Date().toISOString(),
                                      rejectedBy: 'Super Admin',
                                      lastUpdated: new Date().toISOString(),
                                      'stageCompletions/information-gathering': null,
                                      'stageCompletions/strategy-preparation': null,
                                      'stageCompletions/internal-approval': null,
                                      'stageCompletions/client-approval': null
                                    };
                                    await update(clientRef, updates);
                                    setSelectedClientForWorkflow(prev => ({ ...prev, ...updates, stageCompletions: {} }));
                                    showToast('❌ Client rejected & reset!', 'success');
                                  } catch (error) {
                                    console.error(error);
                                    showToast('❌ Error rejecting client', 'error');
                                  }
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

              </div>

              {/* Client Tasks Section */}
              <div id="client-tasks-section" style={{ padding: '0 0 32px 0' }}>
                <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600', color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Tasks for {selectedClientForWorkflow.clientName}</span>
                </h3>

                {tasks.filter(t => t.clientId === selectedClientForWorkflow.clientId || t.clientName === selectedClientForWorkflow.clientName).length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#9ca3af',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px dashed #e5e7eb'
                  }}>
                    <p style={{ fontSize: '16px', margin: 0 }}>No tasks found for this client</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '15%' }}>IDEAS</th>
                          <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '20%' }}>CONTENT</th>
                          <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '15%' }}>REFERENCE LINK</th>
                          <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '15%' }}>SPECIAL NOTES</th>
                          <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '10%' }}>DEPARTMENT</th>
                          <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '10%' }}>DATE</th>
                          <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: '15%' }}>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks
                          .filter(t => (t.clientId === selectedClientForWorkflow.clientId || t.clientName === selectedClientForWorkflow.clientName) && !t.deleted)
                          .map(task => (
                            <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '16px', textAlign: 'left', verticalAlign: 'top' }}>
                                <span style={{ fontWeight: '500', color: '#374151', fontSize: '14px', display: 'block' }}>{task.taskName || 'Untitled Task'}</span>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'left', verticalAlign: 'top' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', maxHeight: '100px', overflowY: 'auto' }}>
                                  {task.description || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'left', verticalAlign: 'top' }}>
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
                                      wordBreak: 'break-all'
                                    }}
                                  >
                                    open link
                                  </a>
                                ) : (
                                  <span style={{ fontSize: '13px', color: '#9ca3af' }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: '16px', textAlign: 'left', verticalAlign: 'top' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', maxHeight: '100px', overflowY: 'auto' }}>
                                  {task.specialNotes || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'top' }}>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  background: task.department === 'video' ? '#dbeafe' : task.department === 'graphics' ? '#fce7f3' : '#e0e7ff',
                                  color: task.department === 'video' ? '#1e40af' : task.department === 'graphics' ? '#ec4899' : '#4338ca',
                                  textTransform: 'uppercase',
                                  display: 'inline-block'
                                }}>
                                  {task.department || 'N/A'}
                                </span>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'top' }}>
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                  {task.postDate ? new Date(task.postDate).toLocaleDateString() : '-'}
                                </div>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'top' }}>
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to delete the task "${task.taskName}"?`)) {
                                      try {
                                        const taskRef = ref(database, `tasks/${task.id}`);
                                        await update(taskRef, { deleted: true, deletedAt: new Date().toISOString() });
                                        showToast('✅ Task deleted successfully!', 'success', 3000);
                                      } catch (error) {
                                        console.error('Error deleting task:', error);
                                        showToast('❌ Error deleting task', 'error', 3000);
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = '#fecaca'}
                                  onMouseLeave={(e) => e.target.style.background = '#fee2e2'}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '24px'
              }}>
                <button
                  onClick={() => {
                    setSelectedClientForTask(selectedClientForWorkflow);
                    setShowTaskAssignmentForm(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 32px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(55, 180, 111, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(55, 180, 111, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(55, 180, 111, 0.3)';
                  }}
                >
                  <Plus size={18} />
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedView === 'strategy-clients' && (
          <div className="superadmin-embedded-dashboard">
            <StrategyHead initialView="clients" />
          </div>
        )}

        {selectedView === 'strategy-my-task' && (
          <div className="superadmin-embedded-dashboard">
            <StrategyHead initialView="mytask" selectedMonth={selectedMonth} />
          </div>
        )}

        {selectedView === 'strategy-employees' && (
          <div className="superadmin-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="superadmin-section-title" style={{ margin: 0 }}>
                Strategy Department Employees ({employees.filter(e => e.department === 'strategy' && e.status === 'active').length})
              </h2>
            </div>
            <div className="superadmin-table-container">
              <table className="superadmin-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}></th>
                    <th style={{ textAlign: 'left' }}>Name</th>
                    <th style={{ textAlign: 'left' }}>Email</th>
                    <th style={{ textAlign: 'center' }}>Password</th>
                    <th style={{ textAlign: 'center' }}>Clients</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {employees
                    .filter(emp => emp.department === 'strategy')
                    .map(emp => {
                      const employeeClients = getEmployeeClients(emp.employeeName, emp.email);
                      const isExpanded = expandedEmployees[emp.id];

                      return (
                        <React.Fragment key={emp.id}>
                          <tr
                            style={{
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#f9fafb' : 'transparent',
                              transition: 'background-color 0.2s'
                            }}
                            onClick={(e) => {
                              // Don't toggle if clicking on toggle switch
                              if (e.target.tagName !== 'BUTTON' && !e.target.closest('button') && e.target.tagName !== 'INPUT') {
                                toggleEmployeeExpansion(emp.id);
                              }
                            }}
                          >
                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <ChevronRight
                                size={20}
                                style={{
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s',
                                  color: '#6b7280'
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'left', padding: '12px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="employee-avatar">
                                  {emp.employeeName?.charAt(0).toUpperCase() || 'E'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '500' }}>{emp.employeeName}</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {employeeClients.length} client{employeeClients.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'left', padding: '12px 8px' }}>{emp.email}</td>
                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                padding: '4px 8px',
                                backgroundColor: '#f3f4f6',
                                borderRadius: '4px',
                                color: '#374151',
                                display: 'inline-block'
                              }}>
                                {emp.password || 'N/A'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '6px 12px',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '600',
                                background: employeeClients.length > 0 ? '#dcfce7' : '#f3f4f6',
                                color: employeeClients.length > 0 ? '#16a34a' : '#6b7280'
                              }}>
                                {employeeClients.length}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <span className={`status-badge ${emp.status || 'active'}`}>
                                {emp.status || 'active'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 8px', fontSize: '12px', color: '#6b7280' }}>
                              {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>

                          {/* Expanded row showing clients */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="7" style={{ padding: '0', backgroundColor: '#f9fafb', borderTop: 'none' }}>
                                <div style={{ padding: '16px 24px', borderLeft: '3px solid #667eea' }}>
                                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                    Assigned Clients ({employeeClients.length})
                                  </h4>
                                  {employeeClients.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                      {employeeClients.map(client => (
                                        <div
                                          key={client.id}
                                          style={{
                                            padding: '16px',
                                            background: 'white',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                            transition: 'all 0.2s'
                                          }}
                                          onMouseOver={(e) => {
                                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                          }}
                                          onMouseOut={(e) => {
                                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <div style={{
                                              width: '40px',
                                              height: '40px',
                                              borderRadius: '50%',
                                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: 'white',
                                              fontWeight: '600',
                                              fontSize: '16px',
                                              flexShrink: 0
                                            }}>
                                              {(client.clientName || 'C').charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {client.clientName || 'Unknown Client'}
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                ID: {client.clientId || 'N/A'}
                                              </div>
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {client.status && (
                                              <span style={{
                                                fontSize: '11px',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: client.status === 'active' ? '#dcfce7' : '#fee2e2',
                                                color: client.status === 'active' ? '#16a34a' : '#dc2626',
                                                fontWeight: '600'
                                              }}>
                                                {client.status}
                                              </span>
                                            )}
                                            {client.stage && (
                                              <span style={{
                                                fontSize: '11px',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: '#e0e7ff',
                                                color: '#4338ca',
                                                fontWeight: '600'
                                              }}>
                                                {client.stage.replace('-', ' ')}
                                              </span>
                                            )}
                                          </div>
                                          {client.allocationDate && (
                                            <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af' }}>
                                              Assigned: {new Date(client.allocationDate).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{
                                      padding: '24px',
                                      textAlign: 'center',
                                      color: '#9ca3af',
                                      fontSize: '13px',
                                      fontStyle: 'italic',
                                      background: 'white',
                                      borderRadius: '8px',
                                      border: '1px dashed #e5e7eb'
                                    }}>
                                      No clients assigned to this employee yet
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {employees.filter(e => e.department === 'strategy').length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '60px 24px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <Users size={48} style={{ color: '#d1d5db', margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  No Strategy Employees
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  There are no employees in the strategy department yet.
                </p>
              </div>
            )}
          </div>
        )}

        {selectedView === 'video-calendar' && (
          <div className="superadmin-embedded-dashboard">
            <VideoDashboard initialView="calendar" />
          </div>
        )}

        {selectedView === 'video-my-tasks' && (
          <div className="superadmin-embedded-dashboard">
            <VideoDashboard initialView="myTasks" />
          </div>
        )}

        {selectedView === 'video-employee-tasks' && (
          <div className="superadmin-embedded-dashboard">
            <VideoDashboard initialView="employeeTasks" />
          </div>
        )}

        {selectedView === 'video-all-tasks' && (
          <div className="superadmin-embedded-dashboard">
            {/* Employee Filter Dropdown */}
            <div style={{
              padding: '16px 24px',
              background: 'white',
              borderRadius: '12px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Users size={20} style={{ color: '#6b7280' }} />
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Filter by Employee:
              </label>
              <select
                value={selectedVideoEmployeeFilter}
                onChange={(e) => setSelectedVideoEmployeeFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  minWidth: '200px'
                }}
              >
                <option value="all">All Employees</option>
                <option value="Video Head">Video Head</option>
                {employees
                  .filter(emp => emp.department === 'video' && emp.status === 'active')
                  .map(emp => (
                    <option key={emp.id} value={emp.employeeName}>
                      {emp.employeeName}
                    </option>
                  ))}
              </select>
              {selectedVideoEmployeeFilter !== 'all' && (
                <button
                  onClick={() => setSelectedVideoEmployeeFilter('all')}
                  style={{
                    padding: '6px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
                >
                  Clear Filter
                </button>
              )}
            </div>
            <VideoDashboard
              initialView="allTasks"
              isSuperAdmin={true}
              employeeFilter={selectedVideoEmployeeFilter}
            />
          </div>
        )}

        {selectedView === 'video-extra-tasks' && (
          <div className="superadmin-embedded-dashboard">
            <VideoDashboard initialView="extraTasks" />
          </div>
        )}

        {selectedView === 'video-add-extra-task' && (
          <div className="superadmin-embedded-dashboard">
            <VideoDashboard initialView="addExtraTask" />
          </div>
        )}

        {selectedView === 'video-reports' && (
          <div className="superadmin-embedded-dashboard">
            <VideoDashboard initialView="reports" />
          </div>
        )}

        {selectedView === 'graphics-calendar' && (
          <div className="superadmin-embedded-dashboard">
            <GraphicsDashboard initialView="calendar" />
          </div>
        )}

        {selectedView === 'graphics-my-tasks' && (
          <div className="superadmin-embedded-dashboard">
            <GraphicsDashboard initialView="myTasks" />
          </div>
        )}

        {selectedView === 'graphics-employee-tasks' && (
          <div className="superadmin-embedded-dashboard">
            <GraphicsDashboard initialView="employeeTasks" />
          </div>
        )}

        {selectedView === 'graphics-all-tasks' && (
          <div className="superadmin-embedded-dashboard">
            {/* Employee Filter Dropdown */}
            <div style={{
              padding: '16px 24px',
              background: 'white',
              borderRadius: '12px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Users size={20} style={{ color: '#6b7280' }} />
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Filter by Employee:
              </label>
              <select
                value={selectedGraphicsEmployeeFilter}
                onChange={(e) => setSelectedGraphicsEmployeeFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  minWidth: '200px'
                }}
              >
                <option value="all">All Employees</option>
                <option value="Graphics Head">Graphics Head</option>
                {employees
                  .filter(emp => emp.department === 'graphics' && emp.status === 'active')
                  .map(emp => (
                    <option key={emp.id} value={emp.employeeName}>
                      {emp.employeeName}
                    </option>
                  ))}
              </select>
              {selectedGraphicsEmployeeFilter !== 'all' && (
                <button
                  onClick={() => setSelectedGraphicsEmployeeFilter('all')}
                  style={{
                    padding: '6px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
                >
                  Clear Filter
                </button>
              )}
            </div>
            <GraphicsDashboard
              initialView="allTasks"
              isSuperAdmin={true}
              employeeFilter={selectedGraphicsEmployeeFilter}
            />
          </div>
        )}

        {selectedView === 'graphics-extra-tasks' && (
          <div className="superadmin-embedded-dashboard">
            <GraphicsDashboard initialView="extraTasks" />
          </div>
        )}

        {selectedView === 'graphics-add-extra-task' && (
          <div className="superadmin-embedded-dashboard">
            <GraphicsDashboard initialView="addExtraTask" />
          </div>
        )}

        {selectedView === 'graphics-reports' && (
          <div className="superadmin-embedded-dashboard">
            <GraphicsDashboard initialView="reports" />
          </div>
        )}

        {selectedView === 'social-media-calendar' && (
          <div className="superadmin-embedded-dashboard">
            <SocialMediaDashboard initialView="calendar" />
          </div>
        )}

        {selectedView === 'social-media-my-tasks' && (
          <div className="superadmin-embedded-dashboard">
            {/* Employee Filter Dropdown */}
            <div style={{
              padding: '16px 24px',
              background: 'white',
              borderRadius: '12px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Users size={20} style={{ color: '#6b7280' }} />
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Filter by Employee:
              </label>
              <select
                value={selectedSocialMediaEmployeeFilter}
                onChange={(e) => setSelectedSocialMediaEmployeeFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  minWidth: '200px'
                }}
              >
                <option value="all">All Employees</option>
                <option value="Social Media Head">Social Media Head</option>
                {employees
                  .filter(emp => emp.department === 'social-media' && emp.status === 'active')
                  .map(emp => (
                    <option key={emp.id} value={emp.employeeName}>
                      {emp.employeeName}
                    </option>
                  ))}
              </select>
              {selectedSocialMediaEmployeeFilter !== 'all' && (
                <button
                  onClick={() => setSelectedSocialMediaEmployeeFilter('all')}
                  style={{
                    padding: '6px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
                >
                  Clear Filter
                </button>
              )}
            </div>
            <SocialMediaDashboard
              initialView="myTasks"
              isSuperAdmin={true}
              employeeFilter={selectedSocialMediaEmployeeFilter}
            />
          </div>
        )}

        {selectedView === 'social-media-reports' && (
          <div className="superadmin-embedded-dashboard">
            <SocialMediaDashboard initialView="reports" />
          </div>
        )}

        {selectedView === 'employee' && selectedEmployee && (
          <div className="superadmin-embedded-dashboard">
            {selectedDepartment === 'strategy' && <StrategyDashboard employeeData={selectedEmployee} isEmbedded={true} />}
            {selectedDepartment === 'social-media' && <SocialMediaEmpDashboard employeeData={selectedEmployee} isEmbedded={true} />}
            {(selectedDepartment === 'video' || selectedDepartment === 'graphics') && <EmployeeDashboard employeeData={selectedEmployee} isEmbedded={true} />}
          </div>
        )}

        {selectedView === 'change-password' && (
          <div className="superadmin-section">
            <h2 className="superadmin-section-title">Change Password</h2>
            <div style={{
              maxWidth: '500px',
              margin: '0 auto',
              background: 'white',
              padding: '32px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <form onSubmit={handlePasswordChange}>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
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
                    placeholder="Enter current password"
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
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    placeholder="Enter new password (min 6 characters)"
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
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordChangeError && (
                  <div style={{
                    padding: '12px',
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#dc2626',
                    fontSize: '14px',
                    marginBottom: '16px'
                  }}>
                    {passwordChangeError}
                  </div>
                )}

                {passwordChangeMessage && (
                  <div style={{
                    padding: '12px',
                    background: '#d1fae5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '8px',
                    color: '#059669',
                    fontSize: '14px',
                    marginBottom: '16px'
                  }}>
                    {passwordChangeMessage}
                  </div>
                )}

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Change Password
                </button>
              </form>
            </div>
          </div>
        )}

        {selectedView === 'add-employee' && (
          <div className="superadmin-section">
            <h2 className="superadmin-section-title">Add New Employee</h2>
            <div style={{
              maxWidth: '500px',
              margin: '0 auto',
              background: 'white',
              padding: '32px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <form onSubmit={handleAddEmployee}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Employee Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., harshada patil, janavi patil, sagar"
                    value={newEmployee.employeeName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, employeeName: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                    Department <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  >
                    <option value="">-- Select Department --</option>
                    <option value="video">Video</option>
                    <option value="graphics">Graphics</option>
                    <option value="social-media">Social Media</option>
                    <option value="strategy">Strategy</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Role <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  >
                    <option value="employee">👤 Employee</option>
                    <option value="head">👑 Head</option>
                  </select>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Employee: Regular employee dashboard | Head: Department head dashboard with full access
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="employee@company.com"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                    Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter password for employee login"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Minimum 6 characters, employee will use this to login
                  </p>
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Users size={16} />
                  Add Employee
                </button>
              </form>
            </div>
          </div>
        )}

        {selectedView === 'add-client' && (
          <div className="superadmin-section">
            <h2 className="superadmin-section-title">Add New Client</h2>
            <div style={{
              maxWidth: '650px',
              margin: '0 auto',
              background: 'white',
              padding: '32px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
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
                    onClick={() => setSelectedView('view-clients')}
                    style={{
                      padding: '12px 24px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      color: '#6b7280',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#4B49AC',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Users size={18} />
                    Add Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedView === 'view-clients' && (
          <div className="superadmin-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="superadmin-section-title" style={{ margin: 0 }}>All Clients ({clients.length})</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  <Users size={18} />
                  <span>Total: {clients.length} {clients.length === 1 ? 'Client' : 'Clients'}</span>
                </div>
                <button
                  onClick={() => setSelectedView('add-client')}
                  style={{
                    padding: '10px 16px',
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
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  <Plus size={16} />
                  Add Client
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
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
                  placeholder="Search clients by name, ID, email..."
                  value={clientListSearch}
                  onChange={(e) => setClientListSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 16px 10px 40px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s ease'
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
              </div>
              {clientListSearch && (
                <button
                  onClick={() => setClientListSearch('')}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>

            {/* Clients Table */}
            {(() => {
              const filteredClientsForView = clients.filter(client => {
                if (!clientListSearch) return true;
                const query = clientListSearch.toLowerCase();
                return (
                  client.clientName?.toLowerCase().includes(query) ||
                  client.clientId?.toLowerCase().includes(query) ||
                  client.email?.toLowerCase().includes(query)
                );
              });

              if (filteredClientsForView.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: '#9ca3af' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                      {clientListSearch ? 'No clients found' : 'No clients available'}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>
                      {clientListSearch ? 'Try adjusting your search criteria.' : 'Add clients to get started.'}
                    </p>
                  </div>
                );
              }

              return (
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  overflow: 'hidden'
                }}>
                  <div className="superadmin-table-container" style={{ overflowX: 'auto' }}>
                    <table className="superadmin-table" style={{ width: '100%', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Client ID</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Client Name</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Contact</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Email</th>
                          <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Video Instructions</th>
                          <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Graphics Instructions</th>
                          <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: '600', color: '#374151', fontSize: '13px' }}>Assigned Employee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClientsForView.map((client, index) => {
                          // Find assigned employee
                          const assignedEmployee = employees.find(emp =>
                            emp.id === client.assignedToEmployee ||
                            emp.email === client.assignedToEmployee ||
                            emp.employeeName === client.assignedToEmployeeName ||
                            emp.employeeName === client.assignedToEmployee
                          );

                          return (
                            <tr
                              key={client.id || index}
                              style={{
                                borderBottom: index < filteredClientsForView.length - 1 ? '1px solid #f1f5f9' : 'none',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td style={{ padding: '10px 8px', fontSize: '13px', color: '#374151' }}>
                                {client.clientId || 'N/A'}
                              </td>
                              <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '500', color: '#111827' }}>
                                {client.clientName || 'N/A'}
                              </td>
                              <td style={{ padding: '10px 8px', fontSize: '13px', color: '#374151' }}>
                                {client.contactNumber || 'N/A'}
                              </td>
                              <td style={{ padding: '10px 8px', fontSize: '13px', color: '#374151' }}>
                                {client.email || 'N/A'}
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  background: client.videoInstructions ? '#dcfce7' : '#f3f4f6',
                                  color: client.videoInstructions ? '#166534' : '#6b7280'
                                }}>
                                  {client.videoInstructions ? 'Available' : 'No instructions'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  background: client.graphicsInstructions ? '#dcfce7' : '#f3f4f6',
                                  color: client.graphicsInstructions ? '#166534' : '#6b7280'
                                }}>
                                  {client.graphicsInstructions ? 'Available' : 'No instructions'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  background: client.status === 'active' ? '#dcfce7' : '#fef3c7',
                                  color: client.status === 'active' ? '#166534' : '#92400e'
                                }}>
                                  {client.status === 'active' ? '✓ Active' : client.status || 'Unknown'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', color: '#374151' }}>
                                {assignedEmployee ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '10px',
                                      fontWeight: '600'
                                    }}>
                                      {assignedEmployee.employeeName?.charAt(0).toUpperCase() || 'E'}
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: '500' }}>
                                      {assignedEmployee.employeeName}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: '#9ca3af', fontSize: '13px' }}>Unassigned</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {selectedView === 'employees' && (
          <div className="superadmin-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 className="superadmin-section-title" style={{ margin: 0 }}>All Employees ({activeEmployees})</h2>
                <button
                  onClick={() => setSelectedView('add-employee')}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'transform 0.2s',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Plus size={14} />
                  Add Employee
                </button>
              </div>
            </div>
            <div className="superadmin-table-container" style={{ overflowX: 'auto', width: '100%' }}>
              <table className="superadmin-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 4px' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 4px' }}>Email</th>
                    <th style={{ textAlign: 'center', padding: '10px 4px' }}>Password</th>
                    <th style={{ textAlign: 'center', padding: '10px 4px' }}>Department</th>
                    <th style={{ textAlign: 'center', padding: '10px 4px' }}>Role</th>
                    <th style={{ textAlign: 'center', padding: '10px 4px' }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '10px 4px' }}>Created At</th>
                    <th style={{ textAlign: 'center', padding: '10px 4px' }}>Enable/Disable</th>
                    <th style={{ textAlign: 'center', padding: '10px 4px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    return (
                      <React.Fragment key={emp.id}>
                        <tr
                          style={{
                            backgroundColor: 'transparent'
                          }}
                        >
                          <td style={{ textAlign: 'left', padding: '10px 4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                              <div className="employee-avatar" style={{ flexShrink: 0 }}>
                                {emp.employeeName?.charAt(0).toUpperCase() || 'E'}
                              </div>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>{emp.employeeName}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'left', padding: '10px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>{emp.email}</td>
                          <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              padding: '2px 4px',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '4px',
                              color: '#374151',
                              display: 'inline-block',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {emp.password || 'N/A'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                            <span className={`dept-badge ${emp.department}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                              {emp.department === 'video' ? '📹 Video' :
                                emp.department === 'graphics' ? '🎨 Graphics' :
                                  emp.department === 'social-media' ? '📱 Social' :
                                    emp.department === 'strategy' ? '📊 Strategy' :
                                      emp.department === 'production' ? '🏭 Production' :
                                        emp.department}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: '600',
                              backgroundColor: emp.isSystem ? '#cffafe' : emp.role === 'head' ? '#fef3c7' : '#dbeafe',
                              color: emp.isSystem ? '#0891b2' : emp.role === 'head' ? '#92400e' : '#1e40af'
                            }}>
                              {emp.isSystem ? '🔒 System' : (emp.role === 'head' ? '👑 Head' : '👤 Employee')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                            <span className={`status-badge ${emp.status || 'active'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                              {emp.status || 'active'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 4px', fontSize: '12px' }}>{emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                            <button
                              onClick={async () => {
                                if (emp.isSystem) {
                                  showToast('System accounts cannot be disabled via this panel.', 'warning');
                                  return;
                                }
                                const newStatus = emp.status === 'active' ? 'inactive' : 'active';
                                try {
                                  const employeeRef = ref(database, `employees/${emp.id}`);
                                  await update(employeeRef, { status: newStatus });
                                  showToast(`Employee ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully!`, 'success');
                                } catch (error) {
                                  console.error('Error updating employee status:', error);
                                  showToast('Failed to update employee status', 'error');
                                }
                              }}
                              style={{
                                position: 'relative',
                                width: '50px',
                                height: '26px',
                                backgroundColor: emp.status === 'active' ? '#10b981' : '#e5e7eb',
                                borderRadius: '13px',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.3s',
                                padding: 0
                              }}
                            >
                              <div style={{
                                position: 'absolute',
                                top: '3px',
                                left: emp.status === 'active' ? '27px' : '3px',
                                width: '20px',
                                height: '20px',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                transition: 'left 0.3s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }} />
                            </button>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                onClick={() => {
                                  handleEditEmployee(emp);
                                }}
                                style={{
                                  padding: '6px 10px',
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = '#2563eb';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = '#3b82f6';
                                }}
                                title="Edit Employee"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (emp.email === 'superadmin@gmail.com') {
                                    showToast('The primary Super Admin account cannot be deleted for safety.', 'error');
                                    return;
                                  }
                                  handleDeleteEmployee(emp);
                                }}
                                style={{
                                  padding: '6px 10px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = '#dc2626';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = '#ef4444';
                                }}
                                title="Delete Employee"
                              >
                                🗑️ Delete
                              </button>

                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedView === 'reports' && (() => {
          // Define all available reports
          const allReports = [
            {
              id: 'all-departments',
              title: 'All Departments',
              description: 'Complete departments overview',
              department: null,
              searchTerms: ['department', 'departments', 'all', 'overview']
            },
            {
              id: 'all-employees',
              title: 'All Employees',
              description: 'Complete employee list',
              department: null,
              searchTerms: ['employee', 'employees', 'all', 'staff', 'team']
            },
            {
              id: 'all-clients',
              title: 'All Clients',
              description: 'Complete client list with tasks',
              department: null,
              searchTerms: ['client', 'clients', 'all', 'customer']
            },
            {
              id: 'production',
              title: 'Production Department',
              description: 'Production team report',
              department: 'production',
              searchTerms: ['production', 'department']
            },
            {
              id: 'video',
              title: 'Video Department',
              description: 'Video team report',
              department: 'video',
              searchTerms: ['video', 'department']
            },
            {
              id: 'graphics',
              title: 'Graphics Department',
              description: 'Graphics team report',
              department: 'graphics',
              searchTerms: ['graphics', 'design', 'department']
            },
            {
              id: 'social-media',
              title: 'Social Media Department',
              description: 'Social media team report',
              department: 'social-media',
              searchTerms: ['social', 'media', 'department']
            },
            {
              id: 'strategy',
              title: 'Strategy Department',
              description: 'Strategy team report',
              department: 'strategy',
              searchTerms: ['strategy', 'department']
            }
          ];

          // Filter reports based on search query and department filter
          const filteredReports = allReports.filter(report => {
            // Department filter
            if (departmentFilter && report.department !== departmentFilter) {
              return false;
            }

            // Search filter
            if (searchQuery) {
              const query = searchQuery.toLowerCase();
              const matchesTitle = report.title.toLowerCase().includes(query);
              const matchesDescription = report.description.toLowerCase().includes(query);
              const matchesSearchTerms = report.searchTerms.some(term => term.includes(query));

              if (!matchesTitle && !matchesDescription && !matchesSearchTerms) {
                return false;
              }
            }

            return true;
          });

          return (
            <div className="superadmin-section">
              {filteredReports.length < allReports.length && (
                <p style={{ color: '#6b7280', marginBottom: '32px' }}>
                  <span style={{ color: '#667eea', fontWeight: '600' }}>
                    Showing {filteredReports.length} of {allReports.length} reports
                  </span>
                </p>
              )}

              {filteredReports.length === 0 ? (
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '60px 24px',
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <Search size={48} style={{ color: '#d1d5db', margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    No reports found
                  </h3>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px' }}>

                  {/* All Departments Report */}
                  {filteredReports.find(r => r.id === 'all-departments') && (() => {
                    const isExpanded = expandedReportCards['all-departments'];
                    const departments = ['production', 'strategy', 'video', 'graphics', 'social-media'];
                    const departmentNames = {
                      'production': 'Production',
                      'strategy': 'Strategy',
                      'video': 'Video',
                      'graphics': 'Graphics',
                      'social-media': 'Social Media'
                    };

                    const departmentData = departments.map(dept => {
                      const deptEmployees = employees.filter(e => e.department === dept && e.status === 'active');
                      const deptTasks = filteredTasks.filter(t => t.department === dept);
                      return {
                        id: dept,
                        name: departmentNames[dept],
                        employees: deptEmployees.length,
                        totalTasks: deptTasks.length,
                        completed: deptTasks.filter(t => t.status === 'completed' || t.status === 'posted').length,
                        inProgress: deptTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length,
                        pending: deptTasks.filter(t => t.status === 'pending' || t.status === 'pending-production' || t.status === 'revision-required').length
                      };
                    });

                    const totalEmployees = departmentData.reduce((sum, d) => sum + d.employees, 0);
                    const totalTasks = departmentData.reduce((sum, d) => sum + d.totalTasks, 0);

                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div
                          onClick={() => setExpandedReportCards(prev => ({ ...prev, 'all-departments': !prev['all-departments'] }))}
                          style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><Briefcase size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>All Departments</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Complete departments overview</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Departments</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{departments.length}</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Employees</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{totalEmployees}</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Tasks</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{totalTasks}</div></div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateAllDepartmentsReport('pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateAllDepartmentsReport('excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Department Summary</h4>

                            {/* Detailed Table */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f3f4f6' }}>
                                  <tr>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employees</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tasks</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completed</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Progress</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completion %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {departmentData.map((dept, idx) => {
                                    const completionRate = dept.totalTasks > 0 ? Math.round((dept.completed / dept.totalTasks) * 100) : 0;
                                    return (
                                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#1f2937' }}>{dept.name}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#374151' }}>{dept.employees}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#374151', fontWeight: '600' }}>{dept.totalTasks}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#10b981', fontWeight: '600' }}>{dept.completed}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#f59e0b', fontWeight: '600' }}>{dept.inProgress}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#ef4444', fontWeight: '600' }}>{dept.pending}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                          <span style={{
                                            background: completionRate >= 70 ? '#d1fae5' : completionRate >= 40 ? '#fef3c7' : '#fee2e2',
                                            color: completionRate >= 70 ? '#065f46' : completionRate >= 40 ? '#92400e' : '#991b1b',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                          }}>
                                            {completionRate}%
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* All Employees Report */}
                  {filteredReports.find(r => r.id === 'all-employees') && (() => {
                    const isExpanded = expandedReportCards['all-employees'];
                    const employeeTasks = filteredTasks;

                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div
                          onClick={() => setExpandedReportCards(prev => ({ ...prev, 'all-employees': !prev['all-employees'] }))}
                          style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><Users size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>All Employees</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Complete employee list</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Total</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{employees.length}</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Active</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#10b981' }}>{activeEmployees}</div></div></div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateAllEmployeesReport('pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateAllEmployeesReport('excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>All Employee Tasks ({employeeTasks.length})</h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {getSelectedTasksForSection('all-employees').length > 0 && (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
                                      {getSelectedTasksForSection('all-employees').length} selected
                                    </span>
                                    <button
                                      onClick={() => downloadSelectedTasks('all-employees', 'All Employees', 'pdf')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                    <button
                                      onClick={() => downloadSelectedTasks('all-employees', 'All Employees', 'excel')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      Excel
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleSelectAllTasks(employeeTasks, 'all-employees')}
                                  style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  Select All
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                  <colgroup>
                                    <col style={{ width: '60px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '160px' }} />
                                  </colgroup>
                                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                      </th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Employee</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Name</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Department</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Client</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {employeeTasks.map(task => {
                                      const assignedEmp = employees.find(e =>
                                        e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
                                        e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
                                      );
                                      const statusColors = {
                                        'completed': '#10b981',
                                        'posted': '#10b981',
                                        'in-progress': '#3b82f6',
                                        'assigned-to-department': '#f59e0b',
                                        'pending': '#ef4444',
                                        'pending-production': '#f59e0b',
                                        'revision-required': '#ef4444'
                                      };
                                      const statusColor = statusColors[task.status] || '#6b7280';
                                      const isSelected = selectedTasks['all-employees']?.[task.id];

                                      return (
                                        <tr
                                          key={task.id}
                                          style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: isSelected ? '#f0f9ff' : 'white',
                                            transition: 'background 0.2s'
                                          }}
                                          onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                          onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                                        >
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected || false}
                                              onChange={() => handleTaskSelection(task.id, 'all-employees')}
                                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                                              {assignedEmp ? assignedEmp.employeeName : 'Unassigned'}
                                            </div>
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>
                                            {task.taskName || 'Untitled Task'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '6px 14px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: '700',
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.5px',
                                              background: task.department === 'video' ? '#fef2f2' :
                                                task.department === 'graphics' ? '#dbeafe' :
                                                  task.department === 'social-media' ? '#fef9c3' :
                                                    task.department === 'strategy' ? '#f3e8ff' : '#f3f4f6',
                                              color: task.department === 'video' ? '#991b1b' :
                                                task.department === 'graphics' ? '#1e40af' :
                                                  task.department === 'social-media' ? '#854d0e' :
                                                    task.department === 'strategy' ? '#6b21a8' : '#374151'
                                            }}>
                                              {task.department ? task.department.replace('-', ' ') : 'N/A'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {task.clientName || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280', fontSize: '12px', verticalAlign: 'middle' }}>
                                            {task.postDate || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '6px 16px',
                                              borderRadius: '16px',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              background: `${statusColor}20`,
                                              color: statusColor,
                                              textTransform: 'capitalize',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {task.status?.replace('-', ' ') || 'Unknown'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {employeeTasks.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '14px' }}>
                                <Users size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0 }}>No employee tasks found for the selected filters</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* All Clients Report */}
                  {filteredReports.find(r => r.id === 'all-clients') && (() => {
                    const isExpanded = expandedReportCards['all-clients'];

                    // Group tasks by client
                    const clientTasksMap = {};
                    clients.forEach(client => {
                      const clientTasks = filteredTasks.filter(t =>
                        t.clientId === client.id || t.clientName === client.clientName
                      );
                      if (clientTasks.length > 0) {
                        clientTasksMap[client.id] = {
                          client: client,
                          tasks: clientTasks
                        };
                      }
                    });

                    const totalClientTasks = Object.values(clientTasksMap).reduce((sum, item) => sum + item.tasks.length, 0);

                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div
                          onClick={() => setExpandedReportCards(prev => ({ ...prev, 'all-clients': !prev['all-clients'] }))}
                          style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><Users size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>All Clients</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Complete client list with tasks</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Total Clients</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{Object.keys(clientTasksMap).length}</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Total Tasks</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{totalClientTasks}</div></div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateAllClientsReport('pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateAllClientsReport('excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Client Summary</h4>

                            {/* Client Cards Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                              {Object.values(clientTasksMap).map((clientData, idx) => {
                                const { client, tasks } = clientData;
                                const completed = tasks.filter(t => t.status === 'completed' || t.status === 'posted').length;
                                const inProgress = tasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length;
                                const pending = tasks.filter(t => t.status === 'pending' || t.status === 'pending-production' || t.status === 'revision-required').length;
                                const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

                                // Assign colors based on index
                                const colors = ['#667eea', '#10b981', '#ef4444', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899'];
                                const color = colors[idx % colors.length];

                                return (
                                  <div key={client.id} style={{
                                    background: 'white',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    border: `2px solid ${color}20`,
                                    borderLeft: `4px solid ${color}`,
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'pointer'
                                  }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                      <h5 style={{ fontSize: '15px', fontWeight: '600', color: '#1f2937', margin: 0 }}>{client.clientName || 'Unknown Client'}</h5>
                                      <span style={{
                                        background: `${color}20`,
                                        color: color,
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '700'
                                      }}>
                                        {completionRate}%
                                      </span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                                      <div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Client ID</div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{client.clientId || 'N/A'}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Total Tasks</div>
                                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>{tasks.length}</div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                                      <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: '#d1fae520', borderRadius: '4px' }}>
                                        <div style={{ color: '#10b981', fontWeight: '600' }}>{completed}</div>
                                        <div style={{ color: '#6b7280' }}>Done</div>
                                      </div>
                                      <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: '#fef3c720', borderRadius: '4px' }}>
                                        <div style={{ color: '#f59e0b', fontWeight: '600' }}>{inProgress}</div>
                                        <div style={{ color: '#6b7280' }}>Progress</div>
                                      </div>
                                      <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: '#fee2e220', borderRadius: '4px' }}>
                                        <div style={{ color: '#ef4444', fontWeight: '600' }}>{pending}</div>
                                        <div style={{ color: '#6b7280' }}>Pending</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Detailed Table */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', marginTop: '24px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>All Client Tasks ({totalClientTasks})</h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {getSelectedTasksForSection('all-clients').length > 0 && (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
                                      {getSelectedTasksForSection('all-clients').length} selected
                                    </span>
                                    <button
                                      onClick={() => downloadSelectedTasks('all-clients', 'All Clients', 'pdf')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                    <button
                                      onClick={() => downloadSelectedTasks('all-clients', 'All Clients', 'excel')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      Excel
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => {
                                    const allTasks = Object.values(clientTasksMap).flatMap(item => item.tasks);
                                    handleSelectAllTasks(allTasks, 'all-clients');
                                  }}
                                  style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  Select All
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                  <colgroup>
                                    <col style={{ width: '60px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '160px' }} />
                                  </colgroup>
                                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                      </th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Client</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Name</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Department</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Assigned To</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.values(clientTasksMap).map((clientData, clientIndex) => {
                                      const { client, tasks } = clientData;
                                      return tasks.map((task, taskIndex) => {
                                        const assignedEmp = employees.find(e =>
                                          e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
                                          e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
                                        );
                                        const statusColors = {
                                          'completed': '#10b981',
                                          'posted': '#10b981',
                                          'in-progress': '#3b82f6',
                                          'assigned-to-department': '#f59e0b',
                                          'pending': '#ef4444',
                                          'pending-production': '#f59e0b',
                                          'revision-required': '#ef4444'
                                        };
                                        const statusColor = statusColors[task.status] || '#6b7280';
                                        const isSelected = selectedTasks['all-clients']?.[task.id];
                                        const isFirstTaskOfClient = taskIndex === 0;

                                        return (
                                          <tr
                                            key={task.id}
                                            style={{
                                              borderBottom: '1px solid #f3f4f6',
                                              background: isSelected ? '#f0f9ff' : 'white',
                                              transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                            onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                                          >
                                            <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                              <input
                                                type="checkbox"
                                                checked={isSelected || false}
                                                onChange={() => handleTaskSelection(task.id, 'all-clients')}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                              />
                                            </td>
                                            <td style={{
                                              padding: '16px 20px',
                                              borderBottom: '1px solid #f3f4f6',
                                              textAlign: 'center',
                                              verticalAlign: 'middle'
                                            }}>
                                              {isFirstTaskOfClient ? (
                                                <div>
                                                  <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600', marginBottom: '4px', lineHeight: '1.4' }}>
                                                    {client.clientName || 'Unknown'}
                                                  </div>
                                                  <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '400' }}>
                                                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                                                  </div>
                                                </div>
                                              ) : (
                                                <div>
                                                  <span style={{ fontSize: '16px', color: '#d1d5db', fontWeight: '300' }}>↳</span>
                                                </div>
                                              )}
                                            </td>
                                            <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>
                                              {task.taskName || 'Untitled Task'}
                                            </td>
                                            <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                              <span style={{
                                                display: 'inline-block',
                                                padding: '6px 14px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                background: task.department === 'video' ? '#fef2f2' :
                                                  task.department === 'graphics' ? '#dbeafe' :
                                                    task.department === 'social-media' ? '#fef9c3' :
                                                      task.department === 'strategy' ? '#f3e8ff' : '#f3f4f6',
                                                color: task.department === 'video' ? '#991b1b' :
                                                  task.department === 'graphics' ? '#1e40af' :
                                                    task.department === 'social-media' ? '#854d0e' :
                                                      task.department === 'strategy' ? '#6b21a8' : '#374151'
                                              }}>
                                                {task.department ? task.department.replace('-', ' ') : 'N/A'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                              {assignedEmp ? assignedEmp.employeeName : 'Unassigned'}
                                            </td>
                                            <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280', fontSize: '12px', verticalAlign: 'middle' }}>
                                              {task.postDate || 'N/A'}
                                            </td>
                                            <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                              <span style={{
                                                display: 'inline-block',
                                                padding: '6px 16px',
                                                borderRadius: '16px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                background: `${statusColor}20`,
                                                color: statusColor,
                                                textTransform: 'capitalize',
                                                whiteSpace: 'nowrap'
                                              }}>
                                                {task.status?.replace('-', ' ') || 'Unknown'}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      });
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {Object.keys(clientTasksMap).length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '14px' }}>
                                <Users size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0 }}>No client tasks found for the selected filters</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Production Department */}
                  {filteredReports.find(r => r.id === 'production') && (() => {
                    const isExpanded = expandedReportCards['production'];
                    const deptTasks = filteredTasks.filter(t => t.department === 'production');

                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div
                          onClick={() => setExpandedReportCards(prev => ({ ...prev, 'production': !prev['production'] }))}
                          style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><Briefcase size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>Production Department</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Production team report</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Employees</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{employees.filter(e => e.department === 'production' && e.status === 'active').length}</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Tasks</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{deptTasks.length}</div></div></div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('production', 'pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('production', 'excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>Production Tasks ({deptTasks.length})</h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {getSelectedTasksForSection('production').length > 0 && (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
                                      {getSelectedTasksForSection('production').length} selected
                                    </span>
                                    <button
                                      onClick={() => downloadSelectedTasks('production', 'Production', 'pdf')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                    <button
                                      onClick={() => downloadSelectedTasks('production', 'Production', 'excel')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      Excel
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleSelectAllTasks(deptTasks, 'production')} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                  Select All
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                  <colgroup>
                                    <col style={{ width: '60px' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '160px' }} />
                                  </colgroup>
                                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                      </th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Name</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Client</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Assigned To</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {deptTasks.map(task => {
                                      const assignedEmp = employees.find(e =>
                                        e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
                                        e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
                                      );
                                      const statusColors = {
                                        'completed': '#10b981',
                                        'posted': '#10b981',
                                        'in-progress': '#3b82f6',
                                        'assigned-to-department': '#f59e0b',
                                        'pending': '#ef4444',
                                        'pending-production': '#f59e0b',
                                        'revision-required': '#ef4444'
                                      };
                                      const statusColor = statusColors[task.status] || '#6b7280';
                                      const isSelected = selectedTasks['production']?.[task.id];

                                      return (
                                        <tr
                                          key={task.id}
                                          style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: isSelected ? '#f0f9ff' : 'white',
                                            transition: 'background 0.2s'
                                          }}
                                          onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                          onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                                        >
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected || false}
                                              onChange={() => handleTaskSelection(task.id, 'production')}
                                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>
                                            {task.taskName || 'Untitled Task'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {task.clientName || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {assignedEmp ? assignedEmp.employeeName : 'Unassigned'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280', fontSize: '12px', verticalAlign: 'middle' }}>
                                            {task.postDate || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '6px 16px',
                                              borderRadius: '16px',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              background: `${statusColor}20`,
                                              color: statusColor,
                                              textTransform: 'capitalize',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {task.status?.replace('-', ' ') || 'Unknown'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {deptTasks.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '14px' }}>
                                <Briefcase size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0 }}>No production tasks found for the selected filters</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Video Department */}
                  {filteredReports.find(r => r.id === 'video') && (() => {
                    const isExpanded = expandedReportCards['video'];
                    const deptTasks = filteredTasks.filter(t => t.department === 'video');
                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedReportCards(prev => ({ ...prev, 'video': !prev['video'] }))} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><Video size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>Video Department</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Video team report</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Employees</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{employees.filter(e => e.department === 'video' && e.status === 'active').length}</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Tasks</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{deptTasks.length}</div></div></div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('video', 'pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('video', 'excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>Video Tasks ({deptTasks.length})</h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {getSelectedTasksForSection('video').length > 0 && (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
                                      {getSelectedTasksForSection('video').length} selected
                                    </span>
                                    <button
                                      onClick={() => downloadSelectedTasks('video', 'Video', 'pdf')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                    <button
                                      onClick={() => downloadSelectedTasks('video', 'Video', 'excel')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      Excel
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleSelectAllTasks(deptTasks, 'video')} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                  Select All
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                  <colgroup>
                                    <col style={{ width: '60px' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '160px' }} />
                                  </colgroup>
                                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                      </th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Name</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Client</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Assigned To</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {deptTasks.map(task => {
                                      const assignedEmp = employees.find(e =>
                                        e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
                                        e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
                                      );
                                      const statusColors = {
                                        'completed': '#10b981',
                                        'posted': '#10b981',
                                        'in-progress': '#3b82f6',
                                        'assigned-to-department': '#f59e0b',
                                        'pending': '#ef4444',
                                        'pending-production': '#f59e0b',
                                        'revision-required': '#ef4444'
                                      };
                                      const statusColor = statusColors[task.status] || '#6b7280';
                                      const isSelected = selectedTasks['video']?.[task.id];

                                      return (
                                        <tr
                                          key={task.id}
                                          style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: isSelected ? '#f0f9ff' : 'white',
                                            transition: 'background 0.2s'
                                          }}
                                          onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                          onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                                        >
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected || false}
                                              onChange={() => handleTaskSelection(task.id, 'video')}
                                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>
                                            {task.taskName || 'Untitled Task'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {task.clientName || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {assignedEmp ? assignedEmp.employeeName : 'Unassigned'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280', fontSize: '12px', verticalAlign: 'middle' }}>
                                            {task.postDate || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '6px 16px',
                                              borderRadius: '16px',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              background: `${statusColor}20`,
                                              color: statusColor,
                                              textTransform: 'capitalize',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {task.status?.replace('-', ' ') || 'Unknown'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {deptTasks.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '14px' }}>
                                <Video size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0 }}>No video tasks found for the selected filters</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Graphics Department */}
                  {filteredReports.find(r => r.id === 'graphics') && (() => {
                    const isExpanded = expandedReportCards['graphics'];
                    const deptTasks = filteredTasks.filter(t => t.department === 'graphics');
                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedReportCards(prev => ({ ...prev, 'graphics': !prev['graphics'] }))} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><Image size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>Graphics Department</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Graphics team report</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Employees</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{employees.filter(e => e.department === 'graphics' && e.status === 'active').length}</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Tasks</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{deptTasks.length}</div></div></div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('graphics', 'pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('graphics', 'excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>Graphics Tasks ({deptTasks.length})</h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {getSelectedTasksForSection('graphics').length > 0 && (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
                                      {getSelectedTasksForSection('graphics').length} selected
                                    </span>
                                    <button
                                      onClick={() => downloadSelectedTasks('graphics', 'Graphics', 'pdf')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                    <button
                                      onClick={() => downloadSelectedTasks('graphics', 'Graphics', 'excel')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      Excel
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleSelectAllTasks(deptTasks, 'graphics')} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                  Select All
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                  <colgroup>
                                    <col style={{ width: '60px' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '160px' }} />
                                  </colgroup>
                                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                      </th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Name</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Client</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Assigned To</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {deptTasks.map(task => {
                                      const assignedEmp = employees.find(e =>
                                        e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
                                        e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
                                      );
                                      const statusColors = {
                                        'completed': '#10b981',
                                        'posted': '#10b981',
                                        'in-progress': '#3b82f6',
                                        'assigned-to-department': '#f59e0b',
                                        'pending': '#ef4444',
                                        'pending-production': '#f59e0b',
                                        'revision-required': '#ef4444'
                                      };
                                      const statusColor = statusColors[task.status] || '#6b7280';
                                      const isSelected = selectedTasks['graphics']?.[task.id];

                                      return (
                                        <tr
                                          key={task.id}
                                          style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: isSelected ? '#f0f9ff' : 'white',
                                            transition: 'background 0.2s'
                                          }}
                                          onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                          onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                                        >
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected || false}
                                              onChange={() => handleTaskSelection(task.id, 'graphics')}
                                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>
                                            {task.taskName || 'Untitled Task'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {task.clientName || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {assignedEmp ? assignedEmp.employeeName : 'Unassigned'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280', fontSize: '12px', verticalAlign: 'middle' }}>
                                            {task.postDate || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '6px 16px',
                                              borderRadius: '16px',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              background: `${statusColor}20`,
                                              color: statusColor,
                                              textTransform: 'capitalize',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {task.status?.replace('-', ' ') || 'Unknown'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {deptTasks.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '14px' }}>
                                <Image size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0 }}>No graphics tasks found for the selected filters</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Social Media Department */}
                  {filteredReports.find(r => r.id === 'social-media') && (() => {
                    const isExpanded = expandedReportCards['social-media'];
                    const deptTasks = filteredTasks.filter(t => t.department === 'social-media');
                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedReportCards(prev => ({ ...prev, 'social-media': !prev['social-media'] }))} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><Share2 size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>Social Media Department</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Social media team report</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Employees</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{employees.filter(e => e.department === 'social-media' && e.status === 'active').length}</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Tasks</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{deptTasks.length}</div></div></div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('social-media', 'pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('social-media', 'excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>Social Media Tasks ({deptTasks.length})</h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {getSelectedTasksForSection('social-media').length > 0 && (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
                                      {getSelectedTasksForSection('social-media').length} selected
                                    </span>
                                    <button
                                      onClick={() => downloadSelectedTasks('social-media', 'Social Media', 'pdf')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                    <button
                                      onClick={() => downloadSelectedTasks('social-media', 'Social Media', 'excel')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      Excel
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleSelectAllTasks(deptTasks, 'social-media')} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                  Select All
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                  <colgroup>
                                    <col style={{ width: '60px' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '160px' }} />
                                  </colgroup>
                                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                      </th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Name</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Client</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Assigned To</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {deptTasks.map(task => {
                                      const assignedEmp = employees.find(e =>
                                        e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
                                        e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
                                      );
                                      const statusColors = {
                                        'completed': '#10b981',
                                        'posted': '#10b981',
                                        'in-progress': '#3b82f6',
                                        'assigned-to-department': '#f59e0b',
                                        'pending': '#ef4444',
                                        'pending-production': '#f59e0b',
                                        'revision-required': '#ef4444'
                                      };
                                      const statusColor = statusColors[task.status] || '#6b7280';
                                      const isSelected = selectedTasks['social-media']?.[task.id];

                                      return (
                                        <tr
                                          key={task.id}
                                          style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: isSelected ? '#f0f9ff' : 'white',
                                            transition: 'background 0.2s'
                                          }}
                                          onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                          onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                                        >
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected || false}
                                              onChange={() => handleTaskSelection(task.id, 'social-media')}
                                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>
                                            {task.taskName || 'Untitled Task'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {task.clientName || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {assignedEmp ? assignedEmp.employeeName : 'Unassigned'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280', fontSize: '12px', verticalAlign: 'middle' }}>
                                            {task.postDate || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '6px 16px',
                                              borderRadius: '16px',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              background: `${statusColor}20`,
                                              color: statusColor,
                                              textTransform: 'capitalize',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {task.status?.replace('-', ' ') || 'Unknown'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {deptTasks.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '14px' }}>
                                <Share2 size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0 }}>No social media tasks found for the selected filters</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Strategy Department */}
                  {filteredReports.find(r => r.id === 'strategy') && (() => {
                    const isExpanded = expandedReportCards['strategy'];
                    const deptTasks = filteredTasks.filter(t => t.department === 'strategy');
                    return (
                      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedReportCards(prev => ({ ...prev, 'strategy': !prev['strategy'] }))} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><TrendingUp size={24} /></div>
                          <div style={{ flex: 1 }}><h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>Strategy Department</h3><p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Strategy team report</p></div>
                          <div style={{ display: 'flex', gap: '24px', paddingRight: '20px' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Employees</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{employees.filter(e => e.department === 'strategy' && e.status === 'active').length}</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Tasks</div><div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{deptTasks.length}</div></div></div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('strategy', 'pdf'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />PDF</button>
                            <button onClick={(e) => { e.stopPropagation(); generateDepartmentReport('strategy', 'excel'); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}><Download size={16} />Excel</button>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#f3f4f6', transition: 'transform 0.2s' }}>
                            {isExpanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>Strategy Tasks ({deptTasks.length})</h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {getSelectedTasksForSection('strategy').length > 0 && (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
                                      {getSelectedTasksForSection('strategy').length} selected
                                    </span>
                                    <button
                                      onClick={() => downloadSelectedTasks('strategy', 'Strategy', 'pdf')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                    <button
                                      onClick={() => downloadSelectedTasks('strategy', 'Strategy', 'excel')}
                                      style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={14} />
                                      Excel
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleSelectAllTasks(deptTasks, 'strategy')} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                  Select All
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                  <colgroup>
                                    <col style={{ width: '60px' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '140px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '160px' }} />
                                  </colgroup>
                                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                      </th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Name</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Client</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Assigned To</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</th>
                                      <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', borderBottom: '2px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {deptTasks.map(task => {
                                      const assignedEmp = employees.find(e =>
                                        e.id === task.assignedTo || e.email === task.assignedTo || e.employeeName === task.assignedTo ||
                                        e.id === task.assignedEmployee || e.email === task.assignedEmployee || e.employeeName === task.assignedEmployee
                                      );
                                      const statusColors = {
                                        'completed': '#10b981',
                                        'posted': '#10b981',
                                        'in-progress': '#3b82f6',
                                        'assigned-to-department': '#f59e0b',
                                        'pending': '#ef4444',
                                        'pending-production': '#f59e0b',
                                        'revision-required': '#ef4444'
                                      };
                                      const statusColor = statusColors[task.status] || '#6b7280';
                                      const isSelected = selectedTasks['strategy']?.[task.id];

                                      return (
                                        <tr
                                          key={task.id}
                                          style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: isSelected ? '#f0f9ff' : 'white',
                                            transition: 'background 0.2s'
                                          }}
                                          onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                          onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                                        >
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected || false}
                                              onChange={() => handleTaskSelection(task.id, 'strategy')}
                                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>
                                            {task.taskName || 'Untitled Task'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {task.clientName || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {assignedEmp ? assignedEmp.employeeName : 'Unassigned'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280', fontSize: '12px', verticalAlign: 'middle' }}>
                                            {task.postDate || 'N/A'}
                                          </td>
                                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '6px 16px',
                                              borderRadius: '16px',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              background: `${statusColor}20`,
                                              color: statusColor,
                                              textTransform: 'capitalize',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {task.status?.replace('-', ' ') || 'Unknown'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {deptTasks.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '14px' }}>
                                <TrendingUp size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0 }}>No strategy tasks found for the selected filters</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        {/* End of Reports Section */}
      </div>

      {/* Edit Employee Modal */}
      {showEditEmployeeModal && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '700', color: '#111827' }}>
              Edit Employee
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                Employee Name *
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
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                placeholder="Enter employee name"
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
                Password
              </label>
              <input
                type="text"
                value={editEmployeePassword}
                onChange={(e) => setEditEmployeePassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                placeholder="Enter new password (leave empty to keep current)"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditEmployeeModal(false);
                  setEditingEmployee(null);
                  setEditEmployeeName('');
                  setEditEmployeePassword('');
                }}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
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
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Update Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Assignment Form Modal */}
      {showTaskAssignmentForm && selectedClientForTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
          backdropFilter: 'blur(4px)',
          overflowY: 'auto'
        }}
          onClick={() => setShowTaskAssignmentForm(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '95vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
            margin: 'auto'
          }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #e5e7eb',
              background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
              color: 'white',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                Assign Task
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                Create new task for client
              </p>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto'
            }}>
              <form onSubmit={async (e) => {
                e.preventDefault();

                if (!taskForm.taskName || !taskForm.department || !taskForm.taskType || !taskForm.postDate) {
                  showToast('Please fill in required fields (Ideas, Department, Task Type, Post Date)', 'error');
                  return;
                }

                try {
                  const tasksRef = ref(database, 'tasks');

                  await push(tasksRef, {
                    clientId: selectedClientForTask.clientId,
                    clientName: selectedClientForTask.clientName,
                    taskName: taskForm.taskName,
                    ideas: taskForm.taskName,
                    content: taskForm.description,
                    description: taskForm.description,
                    referenceLink: taskForm.referenceLink || '',
                    specialNotes: taskForm.specialNotes || '',
                    department: taskForm.department,
                    taskType: taskForm.taskType,
                    postDate: taskForm.postDate,
                    deadline: taskForm.postDate,
                    status: 'strategy-preparation',
                    assignedToDept: taskForm.department,
                    assignedBy: 'Super Admin',
                    strategyHeadEmail: 'head@gmail.com',
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                  });

                  showToast('Task created successfully!', 'success');
                  setShowTaskAssignmentForm(false);
                  setTaskForm({
                    taskName: '',
                    description: '',
                    referenceLink: '',
                    specialNotes: '',
                    department: '',
                    taskType: '',
                    postDate: ''
                  });
                } catch (error) {
                  console.error('Error creating task:', error);
                  showToast('Error creating task', 'error');
                }
              }} style={{ padding: '24px' }}>

                {/* Client Info - Read Only */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Select Client *
                  </label>
                  <input
                    type="text"
                    value={`${selectedClientForTask.clientName} (${selectedClientForTask.clientId})`}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#f9fafb',
                      color: '#6b7280'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={selectedClientForTask.clientId}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#f9fafb',
                      color: '#6b7280'
                    }}
                  />
                </div>

                {/* Ideas */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Ideas *
                  </label>
                  <input
                    type="text"
                    value={taskForm.taskName}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, taskName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    placeholder="Enter ideas"
                    required
                  />
                </div>

                {/* Content */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Content
                  </label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                    placeholder="Enter content"
                    rows="3"
                  />
                </div>

                {/* Reference Link */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Reference Link
                  </label>
                  <input
                    type="url"
                    value={taskForm.referenceLink}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, referenceLink: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    placeholder="Enter reference link (e.g., https://example.com)"
                  />
                </div>

                {/* Special Notes */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Special Notes
                  </label>
                  <textarea
                    value={taskForm.specialNotes}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, specialNotes: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                    placeholder="Enter special notes or additional instructions"
                    rows="3"
                  />
                </div>

                {/* Assign to Department */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Assign to Department *
                  </label>
                  <select
                    value={taskForm.department}
                    onChange={(e) => {
                      setTaskForm(prev => ({
                        ...prev,
                        department: e.target.value,
                        taskType: '' // Reset task type when department changes
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    required
                  >
                    <option value="">-- Select department --</option>
                    <option value="video">Video Department</option>
                    <option value="graphics">Graphics Department</option>
                  </select>
                </div>

                {/* Task Type - Conditional based on department */}
                {taskForm.department && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Task Type *
                    </label>
                    <select
                      value={taskForm.taskType}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, taskType: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      required
                    >
                      <option value="">-- Select task type --</option>
                      {taskForm.department === 'video' && (
                        <>
                          <option value="long-video">Long Video</option>
                          <option value="reel">Reel</option>
                        </>
                      )}
                      {taskForm.department === 'graphics' && (
                        <>
                          <option value="festival-creative">Festival Creative</option>
                          <option value="business-creative">Business Creative</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                {/* Post Date */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Post Date *
                  </label>
                  <input
                    type="date"
                    value={taskForm.postDate}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, postDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    required
                  />
                </div>

                {/* Form Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTaskAssignmentForm(false);
                      setTaskForm({
                        taskName: '',
                        description: '',
                        referenceLink: '',
                        specialNotes: '',
                        department: '',
                        taskType: '',
                        postDate: ''
                      });
                    }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
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
                    }}
                  >
                    <Plus size={16} /> Assign Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Client Workflow Modal - Shows 4-Stage Progress */}
      {showClientWorkflowModal && selectedClientForWorkflow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
          backdropFilter: 'blur(4px)',
          overflowY: 'auto'
        }}
          onClick={() => setShowClientWorkflowModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '95%',
            maxWidth: '1200px',
            maxHeight: '95vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
            margin: 'auto'
          }}
            onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{
              padding: '24px 28px',
              background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
              color: 'white',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
                  {selectedClientForWorkflow.clientName}
                </h2>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.95 }}>
                  Client ID: {selectedClientForWorkflow.clientId} | Work through all 4 stages
                </p>
              </div>
              <button
                onClick={() => {
                  setShowClientWorkflowModal(false);
                  setSelectedClientForWorkflow(null);
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  fontSize: '28px',
                  cursor: 'pointer',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '32px'
            }}>
              {/* Client Progress - 4 Stages */}
              <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600', color: '#374151' }}>
                Client Progress
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '32px'
              }}>
                {(() => {
                  const allStages = [
                    { name: 'Information Gathering', status: 'information-gathering', icon: '📊', color: '#dbeafe', borderColor: '#1e40af', textColor: '#1e40af' },
                    { name: 'Strategy Preparation', status: 'strategy-preparation', icon: '⏳', color: '#e0e7ff', borderColor: '#4338ca', textColor: '#4338ca' },
                    { name: 'Internal Approval', status: 'internal-approval', icon: '⏳', color: '#fce7f3', borderColor: '#ec4899', textColor: '#ec4899' },
                    { name: 'Client Approval', status: 'client-approval', icon: '⏳', color: '#fef3c7', borderColor: '#f59e0b', textColor: '#f59e0b' }
                  ];

                  const currentStage = selectedClientForWorkflow.stage || 'information-gathering';
                  let currentStageIndex = allStages.findIndex(s => s.status === currentStage);
                  if (currentStageIndex === -1) currentStageIndex = 0;

                  return allStages.map((stage, index) => {
                    const isCompleted = index < currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    const isPending = index > currentStageIndex;

                    return (
                      <div key={stage.status} style={{
                        padding: '24px',
                        borderRadius: '12px',
                        border: `3px solid ${isCurrent ? stage.borderColor : isCompleted ? '#10b981' : '#e5e7eb'}`,
                        background: isCurrent ? stage.color : isCompleted ? '#d1fae5' : 'white',
                        boxShadow: isCurrent ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                        transition: 'all 0.3s'
                      }}>
                        <div style={{
                          fontSize: '40px',
                          marginBottom: '12px',
                          textAlign: 'center'
                        }}>
                          {isCompleted ? '✅' : isCurrent ? stage.icon : '⏳'}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: isCurrent ? stage.textColor : isCompleted ? '#059669' : '#6b7280',
                          textAlign: 'center',
                          marginBottom: '8px',
                          lineHeight: '1.4'
                        }}>
                          {stage.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          textAlign: 'center',
                          fontWeight: '500'
                        }}>
                          {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Pending'}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Add Task Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '24px'
              }}>
                <button
                  onClick={() => {
                    setSelectedClientForTask(selectedClientForWorkflow);
                    setShowTaskAssignmentForm(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 32px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(55, 180, 111, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(55, 180, 111, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(55, 180, 111, 0.3)';
                  }}
                >
                  <Plus size={18} />
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
