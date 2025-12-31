import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ref, onValue, push, get, update } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { TrendingUp, LogOut, BarChart3, Send, PieChart, Download, FileText, FileSpreadsheet, Search, ClipboardList, Users, Plus, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import './StrategyDashboard.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const StrategyHead = ({ initialView = 'dashboard', selectedMonth: propSelectedMonth }) => {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showClientTasks, setShowClientTasks] = useState(true);
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [myTaskSelectedMonth, setMyTaskSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedView, setSelectedView] = useState(initialView);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedClientForTasks, setSelectedClientForTasks] = useState(null);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [expandedReportClients, setExpandedReportClients] = useState(new Set());
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [selectedClientsForDownload, setSelectedClientsForDownload] = useState([]); // Track selected clients for bulk download
  const [selectedReportTasks, setSelectedReportTasks] = useState({}); // Track selected tasks per client in reports
  const [showCheckboxes, setShowCheckboxes] = useState(false); // Track whether to show checkboxes
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // My Task workflow states
  const [showClientWorkflowModal, setShowClientWorkflowModal] = useState(false);
  const [selectedClientForWorkflow, setSelectedClientForWorkflow] = useState(null);
  const [showStrategyPrepForm, setShowStrategyPrepForm] = useState(false);
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
  }]);

  // Reports section filter states
  const [reportsSearchQuery, setReportsSearchQuery] = useState(''); // Search for reports
  const [reportsEmployeeFilter, setReportsEmployeeFilter] = useState('all'); // Employee filter for reports
  const [reportsClientFilter, setReportsClientFilter] = useState('all'); // Client filter for reports
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all'); // Status filter for reports
  const [reportsTimePeriod, setReportsTimePeriod] = useState('month'); // 'day', 'week', 'month'
  const [myTaskFilter, setMyTaskFilter] = useState('all'); // 'all', 'today'
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();

  // Update view when initialView prop changes
  useEffect(() => {
    if (initialView) {
      setSelectedView(initialView);
    }
  }, [initialView]);

  useEffect(() => {
    if (propSelectedMonth) {
      setMyTaskSelectedMonth(propSelectedMonth);
      setSelectedMonth(propSelectedMonth);
    }
  }, [propSelectedMonth]);

  useEffect(() => {
    // Fetch all tasks
    const tasksRef = ref(database, 'tasks');
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tasksArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setTasks(tasksArray);
      } else {
        setTasks([]);
      }
    });

    // Fetch clients from strategyHeadClients (sent from Production Incharge)
    const clientsRef = ref(database, 'strategyHeadClients');
    onValue(clientsRef, (snapshot) => {
      console.log('StrategyHead: Loading clients from strategyHeadClients...');
      const data = snapshot.val();
      console.log('StrategyHead: Raw data:', data);
      if (data) {
        const clientsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }))
          // Filter out inactive/disabled clients
          .filter(client => client.status !== 'inactive' && client.status !== 'disabled');
        console.log('StrategyHead: Active clients loaded:', clientsArray.length, clientsArray);
        setClients(clientsArray);
      } else {
        console.log('StrategyHead: No clients found in strategyHeadClients');
        setClients([]);
      }
    });

    // Fetch employees
    const employeesRef = ref(database, 'employees');
    onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const employeesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setEmployees(employeesArray);
      } else {
        setEmployees([]);
      }
    });
  }, []);

  const handleLogout = () => {
    signOut(auth).then(() => {
      navigate('/login');
    });
  };

  // Handle sending clients to Strategy Department Employee
  const handleSendToStrategyDepartment = async () => {
    if (selectedClients.size === 0) {
      showToast('❌ Please select at least one client', 'error', 3000);
      return;
    }

    if (!selectedEmployee) {
      showToast('❌ Please select an employee first', 'error', 3000);
      return;
    }

    if (!database) {
      showToast('❌ Database not available', 'error', 3000);
      return;
    }

    try {
      // Check which clients have already been sent to Strategy Department
      const strategyClientsRef = ref(database, 'strategyClients');
      const snapshot = await get(strategyClientsRef);
      const existingStrategyClients = [];

      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.values(data).forEach(client => {
          existingStrategyClients.push(client.clientId);
        });
      }

      // Filter out clients that have already been sent
      const selectedClientsArray = clients.filter(c => selectedClients.has(c.id));
      const newClientsToSend = selectedClientsArray.filter(c =>
        !existingStrategyClients.includes(c.clientId)
      );
      const alreadySentClients = selectedClientsArray.filter(c =>
        existingStrategyClients.includes(c.clientId)
      );

      if (newClientsToSend.length === 0) {
        showToast('ℹ️ All selected clients have already been sent to Strategy Department', 'info', 3000);
        return;
      }

      // Get selected employee details
      const employee = employees.find(e => e.email === selectedEmployee);

      for (const client of newClientsToSend) {
        // Add to strategyClients
        await push(strategyClientsRef, {
          clientId: client.clientId,
          clientName: client.clientName,
          contactNumber: client.contactNumber || '',
          email: client.email || '',
          videoInstructions: client.videoInstructions || '',
          graphicsInstructions: client.graphicsInstructions || '',
          sentAt: new Date().toISOString(),
          sentBy: 'Strategy Head',
          sentFrom: 'strategyHeadClients',
          assignedToEmployee: selectedEmployee,
          assignedToEmployeeName: employee ? employee.employeeName : '',
          allocationDate: new Date().toISOString(),
          status: 'active',
          stage: client.stage || 'information-gathering',
          lastUpdated: new Date().toISOString()
        });

        // Update allocation status in strategyHeadClients
        const clientRef = ref(database, `strategyHeadClients/${client.id}`);
        await update(clientRef, {
          assignedToEmployee: selectedEmployee,
          assignedToEmployeeName: employee ? employee.employeeName : '',
          allocationDate: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }

      let successMessage = `✅ ${newClientsToSend.length} new client(s) sent to ${employee ? employee.employeeName : 'Strategy Employee'}!`;
      if (alreadySentClients.length > 0) {
        successMessage += ` (${alreadySentClients.length} already sent)`;
      }
      showToast(successMessage, 'success', 4000);
      setSelectedClients(new Set());
      setSelectedEmployee('');
    } catch (error) {
      console.error('Error sending clients to Strategy Department:', error);
      showToast('❌ Error sending clients to Strategy Department', 'error', 3000);
    }
  };

  // Group tasks by client and sort by date
  const groupTasksByClient = (tasksToGroup) => {
    const grouped = tasksToGroup.reduce((acc, task) => {
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

  // Filter tasks by selected month
  const filteredTasks = tasks.filter(task => {
    const postDate = task.postDate;
    const deadline = task.deadline;
    return (postDate && postDate.startsWith(selectedMonth)) ||
      (deadline && deadline.startsWith(selectedMonth));
  });

  // Handle client click to show tasks
  const handleClientClick = (clientName, clientId) => {
    setSelectedClientForTasks({ clientName, clientId });
    setShowTasksModal(true);
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

  // Handle task selection
  const handleTaskSelection = (taskId, clientName) => {
    const newSelected = new Set(selectedTasks);
    const taskKey = `${clientName}-${taskId}`;
    console.log('Task selection:', { taskId, clientName, taskKey });
    if (newSelected.has(taskKey)) {
      newSelected.delete(taskKey);
      console.log('Deselected task:', taskKey);
    } else {
      newSelected.add(taskKey);
      console.log('Selected task:', taskKey);
    }
    console.log('All selected tasks:', Array.from(newSelected));
    setSelectedTasks(newSelected);
  };

  // Handle select all tasks for a client
  const handleSelectAllClientTasks = (clientName, clientTasks) => {
    const newSelected = new Set(selectedTasks);
    const allSelected = clientTasks.every(task => newSelected.has(`${clientName}-${task.id}`));

    if (allSelected) {
      // Deselect all
      clientTasks.forEach(task => {
        newSelected.delete(`${clientName}-${task.id}`);
      });
    } else {
      // Select all
      clientTasks.forEach(task => {
        newSelected.add(`${clientName}-${task.id}`);
      });
    }
    setSelectedTasks(newSelected);
  };

  // Get selected tasks data
  const getSelectedTasksData = () => {
    const selectedTasksData = [];
    selectedTasks.forEach(taskKey => {
      // Split only on the first hyphen to handle client names with hyphens
      const firstHyphenIndex = taskKey.indexOf('-');
      if (firstHyphenIndex === -1) return;

      const clientName = taskKey.substring(0, firstHyphenIndex);
      const taskId = taskKey.substring(firstHyphenIndex + 1);

      const task = filteredTasks.find(t => t.id === taskId && t.clientName === clientName);
      if (task) {
        selectedTasksData.push(task);
      }
    });
    console.log('Selected tasks data:', selectedTasksData);
    return selectedTasksData;
  };

  // Download selected tasks as PDF
  const downloadSelectedTasksPDF = (clientName = null) => {
    console.log('PDF download clicked for client:', clientName);
    console.log('Selected tasks:', Array.from(selectedTasks));

    try {
      let selectedTasksData = getSelectedTasksData();

      // Filter by client if clientName is provided
      if (clientName) {
        selectedTasksData = selectedTasksData.filter(task => task.clientName === clientName);
      }

      console.log('Selected tasks data:', selectedTasksData);

      if (selectedTasksData.length === 0) {
        showToast('❌ Please select at least one task', 'error', 3000);
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

      // Add header
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
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 42);
      doc.text(`Total Tasks: ${selectedTasksData.length}`, 14, 48);

      // Prepare table data
      const tableData = selectedTasksData.map(task => [
        task.taskName || 'N/A',
        task.clientName || 'N/A',
        task.department || 'N/A',
        formatDate(task.postDate),
        task.assignedTo || 'Not Assigned',
        task.status || 'pending'
      ]);

      // Add table
      autoTable(doc, {
        startY: 55,
        head: [['Task Name', 'Client Name', 'Department', 'Post Date', 'Assigned To', 'Status']],
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
      showToast('✅ PDF downloaded successfully', 'success', 3000);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast('❌ Error downloading PDF: ' + error.message, 'error', 3000);
    }
  };

  // Download selected tasks as Excel
  const downloadSelectedTasksExcel = (clientName = null) => {
    console.log('Excel download clicked for client:', clientName);
    console.log('Selected tasks:', Array.from(selectedTasks));

    try {
      let selectedTasksData = getSelectedTasksData();

      // Filter by client if clientName is provided
      if (clientName) {
        selectedTasksData = selectedTasksData.filter(task => task.clientName === clientName);
      }

      console.log('Selected tasks data:', selectedTasksData);

      if (selectedTasksData.length === 0) {
        showToast('❌ Please select at least one task', 'error', 3000);
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

      // Prepare data for Excel
      const reportTitle = clientName ? `Tasks for ${clientName}` : 'Selected Tasks Report';
      const excelData = [
        ['Digi Sayhadri', '', '', '', '', currentDateTime],
        [],
        [reportTitle],
        [`Generated: ${new Date().toLocaleDateString()}`],
        [`Total Tasks: ${selectedTasksData.length}`],
        [],
        ['Task Name', 'Client Name', 'Department', 'Post Date', 'Assigned To', 'Status']
      ];

      selectedTasksData.forEach(task => {
        excelData.push([
          task.taskName || 'N/A',
          task.clientName || 'N/A',
          task.department || 'N/A',
          formatDate(task.postDate),
          task.assignedTo || 'Not Assigned',
          task.status || 'pending'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
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
      showToast('✅ Excel downloaded successfully', 'success', 3000);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('❌ Error downloading Excel: ' + error.message, 'error', 3000);
    }
  };

  // Get tasks for selected client
  const getClientTasks = () => {
    if (!selectedClientForTasks) return [];
    return filteredTasks.filter(task =>
      task.clientName === selectedClientForTasks.clientName ||
      task.clientId === selectedClientForTasks.clientId
    );
  };

  // Download multiple clients as PDF
  const downloadMultipleClientsPDF = () => {
    if (selectedClientsForDownload.length === 0) {
      showToast('❌ Please select at least one client', 'error', 3000);
      return;
    }

    try {
      const reportsTasks = getReportsFilteredTasks();
      const selectedTasks = reportsTasks.filter(task =>
        selectedClientsForDownload.includes(task.clientName || 'Unknown')
      );

      const doc = new jsPDF();
      const currentDateTime = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Add header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Digi Sayhadri', 105, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(currentDateTime, 190, 20, { align: 'right' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Strategy Department - Employee-wise Report', 14, 35);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 42);
      doc.text(`Total Clients: ${selectedClientsForDownload.length}`, 14, 48);
      doc.text(`Total Tasks: ${selectedTasks.length}`, 14, 54);

      // Group tasks by employee
      const tasksByEmployee = {};
      selectedTasks.forEach(task => {
        // Find the client to get assigned employee
        const client = clients.find(c =>
          c.clientName === task.clientName || c.clientId === task.clientId
        );

        // Handle employee name - check if assigned to Strategy Head
        let employeeName = 'Unassigned';
        let displayName = 'Not Assigned';

        if (client?.assignedToEmployee === 'head@gmail.com') {
          employeeName = 'Strategy Head';
          displayName = 'Strategy Head';
        } else if (client?.assignedToEmployeeName) {
          employeeName = client.assignedToEmployeeName;
          displayName = client.assignedToEmployeeName;
        }

        if (!tasksByEmployee[employeeName]) {
          tasksByEmployee[employeeName] = [];
        }
        tasksByEmployee[employeeName].push({
          ...task,
          strategyEmployee: displayName
        });
      });

      let startY = 60;

      // Generate table for each employee
      Object.keys(tasksByEmployee).sort().forEach((employeeName, index) => {
        const employeeTasks = tasksByEmployee[employeeName];

        // Add employee header
        if (index > 0) {
          startY += 10; // Add space between employee sections
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(55, 180, 111); // Green color
        doc.rect(14, startY, 182, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(employeeName, 16, startY + 5.5);
        doc.setTextColor(0, 0, 0);

        startY += 10;

        // Prepare table data for this employee
        const tableData = employeeTasks.map(task => [
          task.clientName || 'N/A',
          task.taskName || 'N/A',
          task.department || 'N/A',
          formatDate(task.postDate),
          task.strategyEmployee
        ]);

        // Add table
        autoTable(doc, {
          startY: startY,
          head: [['Client Name', 'Task Name', 'Department', 'Post Date', 'Assigned To']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [55, 180, 111],
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
          margin: { left: 14, right: 14 }
        });

        startY = doc.lastAutoTable.finalY + 2;

        // Add page break if needed
        if (startY > 250 && index < Object.keys(tasksByEmployee).length - 1) {
          doc.addPage();
          startY = 20;
        }
      });

      doc.save(`Strategy_Employee_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('✅ PDF downloaded successfully', 'success', 3000);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast('❌ Error downloading PDF: ' + error.message, 'error', 3000);
    }
  };

  // Download multiple clients as Excel
  const downloadMultipleClientsExcel = () => {
    if (selectedClientsForDownload.length === 0) {
      showToast('❌ Please select at least one client', 'error', 3000);
      return;
    }

    try {
      const reportsTasks = getReportsFilteredTasks();
      const selectedTasks = reportsTasks.filter(task =>
        selectedClientsForDownload.includes(task.clientName || 'Unknown')
      );

      const currentDateTime = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Group tasks by employee
      const tasksByEmployee = {};
      selectedTasks.forEach(task => {
        // Find the client to get assigned employee
        const client = clients.find(c =>
          c.clientName === task.clientName || c.clientId === task.clientId
        );

        // Handle employee name - check if assigned to Strategy Head
        let employeeName = 'Unassigned';
        let displayName = 'Not Assigned';

        if (client?.assignedToEmployee === 'head@gmail.com') {
          employeeName = 'Strategy Head';
          displayName = 'Strategy Head';
        } else if (client?.assignedToEmployeeName) {
          employeeName = client.assignedToEmployeeName;
          displayName = client.assignedToEmployeeName;
        }

        if (!tasksByEmployee[employeeName]) {
          tasksByEmployee[employeeName] = [];
        }
        tasksByEmployee[employeeName].push({
          ...task,
          strategyEmployee: displayName
        });
      });

      // Prepare data for Excel
      const excelData = [
        ['Digi Sayhadri', '', '', '', currentDateTime],
        [],
        ['Strategy Department - Employee-wise Report'],
        [`Generated: ${new Date().toLocaleDateString()}`],
        [`Total Clients: ${selectedClientsForDownload.length}`],
        [`Total Tasks: ${selectedTasks.length}`],
        []
      ];

      // Add data for each employee
      Object.keys(tasksByEmployee).sort().forEach((employeeName, index) => {
        const employeeTasks = tasksByEmployee[employeeName];

        // Add employee header
        if (index > 0) {
          excelData.push([]); // Empty row between employees
        }
        excelData.push([employeeName]);
        excelData.push(['Client Name', 'Task Name', 'Department', 'Post Date', 'Assigned To']);

        // Add tasks for this employee
        employeeTasks.forEach(task => {
          excelData.push([
            task.clientName || 'N/A',
            task.taskName || 'N/A',
            task.department || 'N/A',
            formatDate(task.postDate),
            task.strategyEmployee
          ]);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Report');
      XLSX.writeFile(wb, `Strategy_Employee_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('✅ Excel downloaded successfully', 'success', 3000);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('❌ Error downloading Excel: ' + error.message, 'error', 3000);
    }
  };

  // Download All Strategy Head Reports
  const downloadAllStrategyReports = () => {
    try {
      const allTasks = filteredTasks;
      const currentDateTime = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const doc = new jsPDF();

      // Add header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Digi Sayhadri', 105, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(currentDateTime, 190, 20, { align: 'right' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Strategy Department - Employee-wise Report', 14, 35);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 42);

      // Count unique clients
      const uniqueClients = [...new Set(allTasks.map(t => t.clientName).filter(Boolean))];
      doc.text(`Total Clients: ${uniqueClients.length}`, 14, 48);
      doc.text(`Total Tasks: ${allTasks.length}`, 14, 54);

      // Group tasks by employee
      const tasksByEmployee = {};
      allTasks.forEach(task => {
        // Find the client to get assigned employee
        const client = clients.find(c =>
          c.clientName === task.clientName || c.clientId === task.clientId
        );

        // Handle employee name - check if assigned to Strategy Head
        let employeeName = 'Unassigned';
        let displayName = 'Not Assigned';

        if (client?.assignedToEmployee === 'head@gmail.com') {
          employeeName = 'Strategy Head';
          displayName = 'Strategy Head';
        } else if (client?.assignedToEmployeeName) {
          employeeName = client.assignedToEmployeeName;
          displayName = client.assignedToEmployeeName;
        } else if (task.assignedTo) {
          // Check if task is assigned directly
          const assignedEmployee = employees.find(e => e.email === task.assignedTo);
          if (assignedEmployee) {
            employeeName = assignedEmployee.employeeName;
            displayName = assignedEmployee.employeeName;
          }
        }

        if (!tasksByEmployee[employeeName]) {
          tasksByEmployee[employeeName] = [];
        }
        tasksByEmployee[employeeName].push({
          ...task,
          strategyEmployee: displayName
        });
      });

      let startY = 60;

      // Generate table for each employee
      Object.keys(tasksByEmployee).sort().forEach((employeeName, index) => {
        const employeeTasks = tasksByEmployee[employeeName];

        // Add employee header
        if (index > 0) {
          startY += 10; // Add space between employee sections
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(55, 180, 111); // Green color
        doc.rect(14, startY, 182, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(employeeName, 16, startY + 5.5);
        doc.setTextColor(0, 0, 0);

        startY += 10;

        // Prepare table data for this employee
        const tableData = employeeTasks.map(task => [
          task.clientName || 'N/A',
          task.taskName || 'N/A',
          task.department || 'N/A',
          formatDate(task.postDate),
          task.strategyEmployee
        ]);

        // Add table
        autoTable(doc, {
          startY: startY,
          head: [['Client Name', 'Task Name', 'Department', 'Post Date', 'Assigned To']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [55, 180, 111],
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
          margin: { left: 14, right: 14 }
        });

        startY = doc.lastAutoTable.finalY + 2;

        // Add page break if needed
        if (startY > 250 && index < Object.keys(tasksByEmployee).length - 1) {
          doc.addPage();
          startY = 20;
        }
      });

      doc.save(`Strategy_Department_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('✅ Report downloaded successfully', 'success', 3000);
    } catch (error) {
      console.error('Error downloading report:', error);
      showToast('❌ Error downloading report: ' + error.message, 'error', 3000);
    }
  };

  // Function to filter reports data based on search and filters
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
        filtered = filtered.filter(t => t.status === 'completed' || t.status === 'approved');
      } else if (reportsStatusFilter === 'in-progress') {
        filtered = filtered.filter(t => t.status === 'in-progress');
      } else if (reportsStatusFilter === 'pending') {
        filtered = filtered.filter(t => t.status === 'pending');
      } else {
        filtered = filtered.filter(t => t.status === reportsStatusFilter);
      }
    }

    // Apply time period filter
    if (reportsTimePeriod !== 'month') {
      filtered = filtered.filter(task => {
        const taskDate = task.postDate ? new Date(task.postDate) : task.createdAt ? new Date(task.createdAt) : null;
        if (taskDate) {
          const now = new Date();

          if (reportsTimePeriod === 'day') {
            // Show tasks from today only
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
            return taskDay.getTime() === today.getTime();
          } else if (reportsTimePeriod === 'week') {
            // Show tasks from current week (last 7 days)
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return taskDate >= weekAgo && taskDate <= now;
          }
        }
        return false;
      });
    }

    return filtered;
  };

  // Render the dashboard
  return (
    <div className="strategy-dashboard">
      {/* Sidebar Navigation */}
      <div className="strategy-sidebar">
        <div className="strategy-sidebar-header">
          <a href="#" className="strategy-sidebar-logo">
            <div className="strategy-sidebar-logo-icon">
              <TrendingUp size={24} />
            </div>
            <div className="strategy-sidebar-logo-text">
              <h2>Strategy</h2>
              <span>Head</span>
            </div>
          </a>
        </div>

        <nav className="strategy-sidebar-nav">
          <div className="strategy-sidebar-section">
            <span className="strategy-sidebar-section-title">MAIN</span>
            <ul className="strategy-sidebar-menu">
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    setSelectedView('dashboard');
                    setShowClientWorkflowModal(false);
                    setSelectedClientForWorkflow(null);
                  }}
                  className={`strategy-sidebar-menu-link ${selectedView === 'dashboard' ? 'active' : ''}`}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  <span>Dashboard</span>
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    setSelectedView('mytask');
                    setMyTaskFilter('all');
                    setShowClientWorkflowModal(false);
                    setSelectedClientForWorkflow(null);
                  }}
                  className={`strategy-sidebar-menu-link ${selectedView === 'mytask' ? 'active' : ''}`}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <ClipboardList size={20} />
                  </div>
                  <span>My Task</span>
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    setSelectedView('clients');
                    setShowClientWorkflowModal(false);
                    setSelectedClientForWorkflow(null);
                  }}
                  className={`strategy-sidebar-menu-link ${selectedView === 'clients' ? 'active' : ''}`}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <Users size={20} />
                  </div>
                  <span>Clients</span>
                </button>
              </li>
              <li className="strategy-sidebar-menu-item">
                <button
                  onClick={() => {
                    setSelectedView('report');
                    setShowClientWorkflowModal(false);
                    setSelectedClientForWorkflow(null);
                  }}
                  className={`strategy-sidebar-menu-link ${selectedView === 'report' ? 'active' : ''}`}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit'
                  }}
                >
                  <div className="strategy-sidebar-menu-icon">
                    <BarChart3 size={20} />
                  </div>
                  <span>Report</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="strategy-sidebar-user">
          <div className="strategy-sidebar-user-info">
            <div className="strategy-sidebar-user-avatar">
              H
            </div>
            <div className="strategy-sidebar-user-details">
              <h4>Strategy Head</h4>
              <p>head@gmail.com</p>
            </div>
          </div>
          <button onClick={handleLogout} className="strategy-btn strategy-btn-logout" style={{ marginTop: '12px', width: '100%' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="strategy-main-content">
        {selectedView === 'dashboard' ? (
          <>
            <div className="strategy-header">
              <div className="strategy-header-content">
                <div className="strategy-header-left">
                  <div className="strategy-header-title">
                    <h1>Strategy Head Dashboard</h1>
                    <p>Monitor and oversee all strategy operations</p>
                  </div>
                </div>
                <div className="strategy-header-right">
                  <div className="strategy-header-filters">
                    <label htmlFor="month-select">Select Month:</label>
                    <input
                      id="month-select"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setCurrentPage(1); // Reset to first page when month changes
                      }}
                      className="strategy-filter-input"
                    />
                  </div>
                </div>
              </div>
            </div>

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
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{filteredTasks.length}</h3>
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
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{filteredTasks.filter(t => t.status === 'approved').length}</h3>
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
                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{filteredTasks.filter(t => t.status === 'pending' || t.status === 'pending-production').length}</h3>
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

            {/* Daily Report and Weekly Summary Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Daily Report Card */}
              <div className="employee-card daily-report-card" style={{
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
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
                        return filteredTasks.filter(task =>
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
                        return filteredTasks.filter(task => {
                          const isCompletedToday = task.completedAt && task.completedAt.startsWith(today);
                          const isCompleted = task.status === 'completed' || task.status === 'approved' || task.status === 'posted';
                          return isCompletedToday && isCompleted;
                        }).length;
                      })()}
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Completed</div>
                  </div>

                  {/* In Progress Tasks */}
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
                      {filteredTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned-to-department').length}
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>In Progress</div>
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
                        const totalTasks = filteredTasks.length;
                        const completedTasks = filteredTasks.filter(t =>
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
                    setSelectedView('mytask');
                    setMyTaskFilter('today');
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

                        return filteredTasks.filter(task => {
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

                        return filteredTasks.filter(task => {
                          const isCompleted = task.status === 'completed' || task.status === 'approved' || task.status === 'posted';
                          if (!isCompleted || !task.completedAt) return false;
                          const completedDate = new Date(task.completedAt);
                          return completedDate >= weekStart && completedDate <= weekEnd;
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
                        return filteredTasks.filter(task => {
                          if (!task.deadline) return false;
                          const today = new Date();
                          const taskDeadline = new Date(task.deadline);
                          return today > taskDeadline && task.status !== 'completed' && task.status !== 'approved' && task.status !== 'posted';
                        }).length;
                      })()}
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Overdue</div>
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

                        const weekTasks = filteredTasks.filter(task => {
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
                    setSelectedView('mytask');
                    setMyTaskFilter('all');
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

            {/* All Clients Section - Hidden in Dashboard, shown in My Task */}
            <div className="strategy-client-section" style={{ marginBottom: '24px', display: 'none' }}>
              <div style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                color: 'white',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  👥 All Clients ({clients.length})
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  Clients sent from Production Incharge
                </p>
              </div>
              <div style={{ padding: '20px' }}>
                {clients.length === 0 ? (
                  <div className="strategy-empty-state">
                    <h3>No clients found</h3>
                    <p>No clients have been sent from Production Incharge yet</p>
                  </div>
                ) : (
                  <>
                    {selectedClients.size > 0 && (
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          padding: '8px 16px',
                          backgroundColor: '#e0e7ff',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#4B49AC'
                        }}>
                          {selectedClients.size} client(s) selected
                        </div>

                        {/* Employee Selection Dropdown */}
                        <select
                          value={selectedEmployee}
                          onChange={(e) => setSelectedEmployee(e.target.value)}
                          style={{
                            padding: '10px 16px',
                            border: '2px solid #37B46F',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            outline: 'none',
                            cursor: 'pointer',
                            minWidth: '250px',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">Select Strategy Employee</option>
                          <option value="head@gmail.com" style={{ fontWeight: '600', color: '#37B46F' }}>👤 Assign to Myself (Strategy Head)</option>
                          <option disabled>──────────</option>
                          {(() => {
                            console.log('All employees:', employees);
                            const strategyEmployees = employees.filter(emp => {
                              console.log('Checking employee:', emp.employeeName, 'Department:', emp.department);
                              return emp.department &&
                                (emp.department.toLowerCase().includes('strategy'));
                            });
                            console.log('Filtered Strategy employees:', strategyEmployees);

                            // If no strategy employees found, show all employees for debugging
                            const employeesToShow = strategyEmployees.length > 0 ? strategyEmployees : employees;

                            return employeesToShow.map(emp => (
                              <option key={emp.id} value={emp.email}>
                                {emp.employeeName} {strategyEmployees.length === 0 ? `(${emp.department || 'No Dept'})` : ''}
                              </option>
                            ));
                          })()}
                        </select>

                        <button
                          onClick={handleSendToStrategyDepartment}
                          disabled={!selectedEmployee}
                          style={{
                            background: selectedEmployee
                              ? 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)'
                              : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: selectedEmployee ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            boxShadow: selectedEmployee ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: selectedEmployee ? 1 : 0.6
                          }}
                          onMouseEnter={(e) => {
                            if (selectedEmployee) {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = selectedEmployee ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none';
                          }}
                        >
                          <Send size={16} />
                          Send to Employee
                        </button>
                      </div>
                    )}
                    <div className="strategy-table-container">
                      <table className="strategy-clients-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '50px' }}>
                              <input
                                type="checkbox"
                                checked={selectedClients.size === clients.length && clients.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedClients(new Set(clients.map(c => c.id)));
                                  } else {
                                    setSelectedClients(new Set());
                                  }
                                }}
                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Client ID</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Client Name</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Contact</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Email</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Allocation Status</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Sent Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const paginatedClients = clients.slice(startIndex, endIndex);
                            return paginatedClients.map((client) => (
                              <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
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
                                <td style={{ padding: '12px', color: '#6366f1', fontWeight: '600' }}>
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
                                      fontSize: '16px'
                                    }}>
                                      {(client.clientName && typeof client.clientName === 'string')
                                        ? client.clientName.charAt(0).toUpperCase()
                                        : 'C'}
                                    </div>
                                    <span style={{ fontWeight: '500', color: '#374151' }}>
                                      {client.clientName || 'Unknown Client'}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px', color: '#6b7280' }}>
                                  {client.contactNumber || 'N/A'}
                                </td>
                                <td style={{ padding: '12px', color: '#6b7280' }}>
                                  {client.email || 'N/A'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {client.assignedToEmployee ? (
                                    <span style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      background: '#dcfce7',
                                      color: '#16a34a',
                                      display: 'inline-block'
                                    }}>
                                      ✓ Allocated
                                    </span>
                                  ) : (
                                    <span style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      display: 'inline-block'
                                    }}>
                                      Not Allocated
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                                  {client.sentAt ? new Date(client.sentAt).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {clients.length > itemsPerPage && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '20px',
                        padding: '16px 20px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, clients.length)} of {clients.length} clients
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '8px 16px',
                              background: currentPage === 1 ? '#e5e7eb' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                              color: currentPage === 1 ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: currentPage === 1 ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.2)'
                            }}
                          >
                            ← Previous
                          </button>
                          <div style={{
                            padding: '8px 16px',
                            background: '#ffffff',
                            border: '2px solid #37B46F',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#37B46F',
                            minWidth: '80px',
                            textAlign: 'center'
                          }}>
                            Page {currentPage} of {Math.ceil(clients.length / itemsPerPage)}
                          </div>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(clients.length / itemsPerPage), prev + 1))}
                            disabled={currentPage >= Math.ceil(clients.length / itemsPerPage)}
                            style={{
                              padding: '8px 16px',
                              background: currentPage >= Math.ceil(clients.length / itemsPerPage) ? '#e5e7eb' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                              color: currentPage >= Math.ceil(clients.length / itemsPerPage) ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: currentPage >= Math.ceil(clients.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: currentPage >= Math.ceil(clients.length / itemsPerPage) ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.2)'
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Client Tasks Section - REMOVED */}
            {false && showClientTasks && (
              <div className="strategy-client-section">
                <div style={{ padding: '20px' }}>
                  {Object.keys(groupTasksByClient(filteredTasks)).length === 0 ? (
                    <div className="strategy-empty-state">
                      <h3>No tasks found</h3>
                      <p>No tasks found for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    </div>
                  ) : (
                    <div className="strategy-table-container">
                      <table className="strategy-clients-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '12%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>CLIENT ID</th>
                            <th style={{ width: '28%', textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>NAME</th>
                            <th style={{ width: '12%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>TASKS</th>
                            <th style={{ width: '16%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>DATE</th>
                            <th style={{ width: '16%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>STATUS</th>
                            <th style={{ width: '16%', textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #e5e7eb' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(groupTasksByClient(filteredTasks)).map(([clientName, clientTasks]) => (
                            <React.Fragment key={clientName}>
                              <tr
                                className="strategy-client-row"
                                onClick={() => toggleClientExpansion(clientName)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{
                                    color: '#6366f1',
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                  }}>
                                    {clientTasks[0]?.clientId || 'N/A'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                  <div className="client-name-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="client-avatar">
                                      {(clientName && typeof clientName === 'string') ? clientName.charAt(0).toUpperCase() : 'C'}
                                    </div>
                                    <div>
                                      <div className="strategy-client-name">
                                        <span>{clientName || 'Unknown Client'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ fontWeight: '600', color: '#374151' }}>{clientTasks.length}</span>
                                </td>
                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                                    {formatDate(clientTasks[0]?.postDate || clientTasks[0]?.deadline)}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                  <span className={`status-badge ${clientTasks.some(t => t.status === 'pending') ? 'pending' : 'active'}`}>
                                    {clientTasks.some(t => t.status === 'pending') ? 'Pending' : 'Active'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                    View Details
                                  </span>
                                </td>
                              </tr>

                              {expandedClients.has(clientName) && (
                                <tr className="strategy-expanded-row">
                                  <td colSpan="6" className="strategy-expanded-content">
                                    <div className="expanded-tasks-container">
                                      <div className="tasks-table-container">
                                        <table className="tasks-detail-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                                          <thead>
                                            <tr>
                                              <th style={{ width: '25%', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>TASK NAME</th>
                                              <th style={{ width: '20%', textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>DEPARTMENT</th>
                                              <th style={{ width: '15%', textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>DATE</th>
                                              <th style={{ width: '20%', textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>ASSIGNED TO</th>
                                              <th style={{ width: '20%', textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>STATUS</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {clientTasks.map(task => (
                                              <tr key={task.id}>
                                                <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '8px 12px', borderBottom: '1px solid #f9fafb' }}>
                                                  <div className="task-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="task-icon">
                                                      📋
                                                    </span>
                                                    <span className="task-name" style={{ fontSize: '13px', color: '#374151' }}>{task.taskName || 'Untitled Task'}</span>
                                                  </div>
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 12px', borderBottom: '1px solid #f9fafb' }}>
                                                  <span className={`department-badge ${task.department || 'unassigned'}`} style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '11px',
                                                    fontWeight: '500',
                                                    backgroundColor: task.department === 'video' ? '#ddd6fe' : task.department === 'graphics' ? '#fce7f3' : '#dbeafe',
                                                    color: task.department === 'video' ? '#7c3aed' : task.department === 'graphics' ? '#ec4899' : '#2563eb'
                                                  }}>
                                                    {task.department || 'Unassigned'}
                                                  </span>
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 12px', borderBottom: '1px solid #f9fafb' }}>
                                                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                                    📅 {formatDate(task.postDate)}
                                                  </span>
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 12px', borderBottom: '1px solid #f9fafb' }}>
                                                  <span style={{ fontSize: '12px', color: '#374151' }}>
                                                    {task.assignedTo || 'Not assigned'}
                                                  </span>
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 12px', borderBottom: '1px solid #f9fafb' }}>
                                                  <span className={`task-status-badge ${task.status || 'pending'}`} style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '11px',
                                                    fontWeight: '500',
                                                    backgroundColor: task.status === 'approved' ? '#dcfce7' : task.status === 'pending' ? '#fef3c7' : '#f3f4f6',
                                                    color: task.status === 'approved' ? '#16a34a' : task.status === 'pending' ? '#d97706' : '#6b7280'
                                                  }}>
                                                    {task.status || 'pending'}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : selectedView === 'mytask' ? (
          <>
            <div className="strategy-header">
              <div className="strategy-header-content">
                <div className="strategy-header-left">
                  <div className="strategy-header-title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h1>My Task</h1>
                      {myTaskFilter === 'today' && (
                        <button
                          onClick={() => setMyTaskFilter('all')}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            border: '1px solid #fca5a5',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Today's Tasks ✕
                        </button>
                      )}
                    </div>
                    <p>Work on clients assigned to you through all 4 stages</p>
                  </div>
                </div>
                <div className="strategy-header-right">
                  <div className="strategy-header-filters">
                    <label htmlFor="mytask-month-select">Select Month:</label>
                    <input
                      id="mytask-month-select"
                      type="month"
                      value={myTaskSelectedMonth}
                      onChange={(e) => setMyTaskSelectedMonth(e.target.value)}
                      className="strategy-filter-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* My Clients - Clients assigned to Strategy Head */}
            <div className="strategy-client-section" style={{ marginBottom: '24px' }}>
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
                {(() => {
                  // Filter tasks by the month selected in "My Task" view or by today's date if filter is 'today'
                  const myTaskFilteredTasks = tasks.filter(task => {
                    if (myTaskFilter === 'today') {
                      const today = new Date().toISOString().split('T')[0];
                      return task.postDate === today || task.deadline === today;
                    }

                    const postDate = task.postDate;
                    const deadline = task.deadline;
                    return (postDate && postDate.startsWith(myTaskSelectedMonth)) ||
                      (deadline && deadline.startsWith(myTaskSelectedMonth));
                  });

                  const myClients = clients.filter(c => c.assignedToEmployee === 'head@gmail.com');

                  return myClients.length === 0 ? (
                    <div className="strategy-empty-state">
                      <h3>No clients assigned to you</h3>
                      <p>Assign clients to yourself from the section below to start working on them</p>
                    </div>
                  ) : (
                    <div className="strategy-table-container" style={{ overflowX: 'auto' }}>
                      <table className="strategy-clients-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '10%' }}>Client ID</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151', width: '25%' }}>Client Name</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '12%' }}>Tasks</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '15%' }}>Stage</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '12%' }}>Date</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '13%' }}>Status</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '13%' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myClients.map((client) => {
                            // Filter tasks for this specific client from the monthly filtered tasks
                            const clientTasks = myTaskFilteredTasks.filter(t =>
                              t.clientName === client.clientName || t.clientId === client.clientId
                            );

                            return (
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
                                  <span style={{ fontWeight: '600', color: '#374151' }}>{clientTasks.length}</span>
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
                                  {clientTasks.length > 0
                                    ? formatDate(clientTasks[0]?.postDate || clientTasks[0]?.deadline)
                                    : formatDate(client.sentAt)}
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
                                      setShowClientWorkflowModal(true);
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
                                      e.target.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
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
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

          </>
        ) : selectedView === 'clients' ? (
          <>
            <div className="strategy-header">
              <div className="strategy-header-content">
                <div className="strategy-header-left">
                  <div className="strategy-header-title">
                    <h1>Clients Management</h1>
                    <p>Manage and allocate clients to strategy employees</p>
                  </div>
                </div>
              </div>
            </div>

            {/* All Clients Section */}
            <div className="strategy-client-section" style={{ marginBottom: '24px' }}>
              <div style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                color: 'white',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  👥 All Clients ({clients.length})
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  Clients sent from Production Incharge
                </p>
              </div>
              <div style={{ padding: '20px', background: 'white', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {clients.length === 0 ? (
                  <div className="strategy-empty-state">
                    <h3>No clients found</h3>
                    <p>No clients have been sent from Production Incharge yet</p>
                  </div>
                ) : (
                  <>
                    {selectedClients.size > 0 && (
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          padding: '8px 16px',
                          backgroundColor: '#e0e7ff',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#4B49AC'
                        }}>
                          {selectedClients.size} client(s) selected
                        </div>

                        {/* Employee Selection Dropdown */}
                        <select
                          value={selectedEmployee}
                          onChange={(e) => setSelectedEmployee(e.target.value)}
                          style={{
                            padding: '10px 16px',
                            border: '2px solid #37B46F',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            outline: 'none',
                            cursor: 'pointer',
                            minWidth: '250px',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">Select Strategy Employee</option>
                          <option value="head@gmail.com" style={{ fontWeight: '600', color: '#37B46F' }}>👤 Assign to Myself (Strategy Head)</option>
                          <option disabled>──────────</option>
                          {(() => {
                            console.log('All employees:', employees);
                            const strategyEmployees = employees.filter(emp => {
                              console.log('Checking employee:', emp.employeeName, 'Department:', emp.department);
                              return emp.department &&
                                (emp.department.toLowerCase().includes('strategy'));
                            });
                            console.log('Filtered Strategy employees:', strategyEmployees);

                            // If no strategy employees found, show all employees for debugging
                            const employeesToShow = strategyEmployees.length > 0 ? strategyEmployees : employees;

                            return employeesToShow.map(emp => (
                              <option key={emp.id} value={emp.email}>
                                {emp.employeeName} {strategyEmployees.length === 0 ? `(${emp.department || 'No Dept'})` : ''}
                              </option>
                            ));
                          })()}
                        </select>

                        <button
                          onClick={handleSendToStrategyDepartment}
                          disabled={!selectedEmployee}
                          style={{
                            background: selectedEmployee
                              ? 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)'
                              : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: selectedEmployee ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            boxShadow: selectedEmployee ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: selectedEmployee ? 1 : 0.6
                          }}
                          onMouseEnter={(e) => {
                            if (selectedEmployee) {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = selectedEmployee ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none';
                          }}
                        >
                          <Send size={16} />
                          Send to Employee
                        </button>
                      </div>
                    )}
                    <div className="strategy-table-container" style={{ overflowX: 'auto' }}>
                      <table className="strategy-clients-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '5%' }}>
                              <input
                                type="checkbox"
                                checked={selectedClients.size === clients.length && clients.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedClients(new Set(clients.map(c => c.id)));
                                  } else {
                                    setSelectedClients(new Set());
                                  }
                                }}
                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            </th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '10%' }}>Client ID</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151', width: '18%' }}>Client Name</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '12%' }}>Contact</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '15%' }}>Email</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '15%' }}>Assigned To</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '12%' }}>Allocation Status</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '13%' }}>Sent Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const paginatedClients = clients.slice(startIndex, endIndex);
                            return paginatedClients.map((client) => (
                              <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
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
                                <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                                  {client.contactNumber || 'N/A'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {client.email || 'N/A'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontWeight: '500' }}>
                                  {client.assignedToEmployeeName || client.assignedToEmployee || 'Not Assigned'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {client.assignedToEmployee ? (
                                    <span style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      background: '#dcfce7',
                                      color: '#16a34a',
                                      display: 'inline-block'
                                    }}>
                                      ✓ Allocated
                                    </span>
                                  ) : (
                                    <span style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      display: 'inline-block'
                                    }}>
                                      Not Allocated
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                                  {client.sentAt ? new Date(client.sentAt).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {clients.length > itemsPerPage && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '20px',
                        padding: '16px 20px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, clients.length)} of {clients.length} clients
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '8px 16px',
                              background: currentPage === 1 ? '#e5e7eb' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                              color: currentPage === 1 ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: currentPage === 1 ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.2)'
                            }}
                          >
                            ← Previous
                          </button>
                          <div style={{
                            padding: '8px 16px',
                            background: '#ffffff',
                            border: '2px solid #37B46F',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#37B46F',
                            minWidth: '80px',
                            textAlign: 'center'
                          }}>
                            Page {currentPage} of {Math.ceil(clients.length / itemsPerPage)}
                          </div>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(clients.length / itemsPerPage), prev + 1))}
                            disabled={currentPage >= Math.ceil(clients.length / itemsPerPage)}
                            style={{
                              padding: '8px 16px',
                              background: currentPage >= Math.ceil(clients.length / itemsPerPage) ? '#e5e7eb' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                              color: currentPage >= Math.ceil(clients.length / itemsPerPage) ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: currentPage >= Math.ceil(clients.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: currentPage >= Math.ceil(clients.length / itemsPerPage) ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.2)'
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : selectedView === 'clients' ? (
          <>
            <div className="strategy-header">
              <div className="strategy-header-content">
                <div className="strategy-header-left">
                  <div className="strategy-header-title">
                    <h1>Clients Management</h1>
                    <p>Manage and allocate clients to strategy employees</p>
                  </div>
                </div>
              </div>
            </div>

            {/* All Clients Section */}
            <div className="strategy-client-section" style={{ marginBottom: '24px' }}>
              <div style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                color: 'white',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  👥 All Clients ({clients.length})
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  Clients sent from Production Incharge
                </p>
              </div>
              <div style={{ padding: '20px', background: 'white', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {clients.length === 0 ? (
                  <div className="strategy-empty-state">
                    <h3>No clients found</h3>
                    <p>No clients have been sent from Production Incharge yet</p>
                  </div>
                ) : (
                  <>
                    {selectedClients.size > 0 && (
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          padding: '8px 16px',
                          backgroundColor: '#e0e7ff',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#4B49AC'
                        }}>
                          {selectedClients.size} client(s) selected
                        </div>

                        {/* Employee Selection Dropdown */}
                        <select
                          value={selectedEmployee}
                          onChange={(e) => setSelectedEmployee(e.target.value)}
                          style={{
                            padding: '10px 16px',
                            border: '2px solid #37B46F',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            outline: 'none',
                            cursor: 'pointer',
                            minWidth: '250px',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">Select Strategy Employee</option>
                          <option value="head@gmail.com" style={{ fontWeight: '600', color: '#37B46F' }}>👤 Assign to Myself (Strategy Head)</option>
                          <option disabled>──────────</option>
                          {employees.filter(emp => emp.department && emp.department.toLowerCase().includes('strategy')).map(emp => (
                            <option key={emp.id} value={emp.email}>
                              {emp.employeeName}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={handleSendToStrategyDepartment}
                          disabled={!selectedEmployee}
                          style={{
                            background: selectedEmployee
                              ? 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)'
                              : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: selectedEmployee ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            boxShadow: selectedEmployee ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: selectedEmployee ? 1 : 0.6
                          }}
                          onMouseEnter={(e) => {
                            if (selectedEmployee) {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = selectedEmployee ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none';
                          }}
                        >
                          <Send size={16} />
                          Send to Employee
                        </button>
                      </div>
                    )}
                    <div className="strategy-table-container">
                      <table className="strategy-clients-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '50px' }}>
                              <input
                                type="checkbox"
                                checked={selectedClients.size === clients.length && clients.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedClients(new Set(clients.map(c => c.id)));
                                  } else {
                                    setSelectedClients(new Set());
                                  }
                                }}
                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Client ID</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Client Name</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Contact</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Email</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Allocation Status</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Sent Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const paginatedClients = clients.slice(startIndex, endIndex);
                            return paginatedClients.map((client) => (
                              <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
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
                                <td style={{ padding: '12px', color: '#6366f1', fontWeight: '600' }}>
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
                                      fontSize: '16px'
                                    }}>
                                      {(client.clientName && typeof client.clientName === 'string')
                                        ? client.clientName.charAt(0).toUpperCase()
                                        : 'C'}
                                    </div>
                                    <span style={{ fontWeight: '500', color: '#374151' }}>
                                      {client.clientName || 'Unknown Client'}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px', color: '#6b7280' }}>
                                  {client.contactNumber || 'N/A'}
                                </td>
                                <td style={{ padding: '12px', color: '#6b7280' }}>
                                  {client.email || 'N/A'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {client.assignedToEmployee ? (
                                    <span style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      background: '#dcfce7',
                                      color: '#16a34a',
                                      display: 'inline-block'
                                    }}>
                                      ✓ Allocated
                                    </span>
                                  ) : (
                                    <span style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      display: 'inline-block'
                                    }}>
                                      Not Allocated
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                                  {client.sentAt ? new Date(client.sentAt).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {clients.length > itemsPerPage && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '20px',
                        padding: '16px 20px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, clients.length)} of {clients.length} clients
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '8px 16px',
                              background: currentPage === 1 ? '#e5e7eb' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                              color: currentPage === 1 ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: currentPage === 1 ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.2)'
                            }}
                          >
                            ← Previous
                          </button>
                          <div style={{
                            padding: '8px 16px',
                            background: '#ffffff',
                            border: '2px solid #37B46F',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#37B46F',
                            minWidth: '80px',
                            textAlign: 'center'
                          }}>
                            Page {currentPage} of {Math.ceil(clients.length / itemsPerPage)}
                          </div>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(clients.length / itemsPerPage), prev + 1))}
                            disabled={currentPage >= Math.ceil(clients.length / itemsPerPage)}
                            style={{
                              padding: '8px 16px',
                              background: currentPage >= Math.ceil(clients.length / itemsPerPage) ? '#e5e7eb' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                              color: currentPage >= Math.ceil(clients.length / itemsPerPage) ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: currentPage >= Math.ceil(clients.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: currentPage >= Math.ceil(clients.length / itemsPerPage) ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.2)'
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : selectedView === 'report' ? (
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
                  Strategy Department Reports
                </h2>
                <p style={{ margin: '6px 0 0 36px', color: '#6b7280', fontSize: '13px' }}>
                  Comprehensive analytics and performance metrics
                </p>
              </div>
              <button
                onClick={downloadAllStrategyReports}
                style={{
                  background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
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
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
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
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
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
                  {getReportsFilteredTasks().filter(t => t.status === 'completed' || t.status === 'approved').length}
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
                  {getReportsFilteredTasks().filter(t => t.status === 'in-progress' || t.status === 'pending').length}
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
                    const completed = reportsTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
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
                  value={reportsTimePeriod}
                  onChange={(e) => setReportsTimePeriod(e.target.value)}
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
              </div>

              {/* Second Row - Filter Dropdowns */}
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
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
                  <option value="pending">Pending</option>
                </select>

                {/* Clear Filters Button */}
                {(reportsSearchQuery || reportsEmployeeFilter !== 'all' || reportsClientFilter !== 'all' || reportsStatusFilter !== 'all' || reportsTimePeriod !== 'month') && (
                  <button
                    onClick={() => {
                      setReportsSearchQuery('');
                      setReportsEmployeeFilter('all');
                      setReportsClientFilter('all');
                      setReportsStatusFilter('all');
                      setReportsTimePeriod('month');
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
                    { label: 'In Progress', count: reportsTasks.filter(t => t.status === 'in-progress' || t.status === 'pending').length, color: '#3b82f6', gradient: 'url(#blueGradientStrategy)' },
                    { label: 'Completed', count: reportsTasks.filter(t => t.status === 'completed').length, color: '#10b981', gradient: 'url(#greenGradientStrategy)' },
                    { label: 'Approved', count: reportsTasks.filter(t => t.status === 'approved').length, color: '#8b5cf6', gradient: 'url(#purpleGradientStrategy)' }
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
                            <stop offset="0%" style={{ stopColor: '#37B46F', stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: '#37B46F', stopOpacity: 0.05 }} />
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
                        <path d={totalPath} stroke="#37B46F" strokeWidth="3" fill="none" filter="url(#lineShadowStrategy)" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={completedPath} stroke="#10b981" strokeWidth="3" fill="none" filter="url(#lineShadowStrategy)" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Points */}
                        {totalPoints.map((point, i) => (
                          <g key={`total-${i}`}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#37B46F" stroke="#ffffff" strokeWidth="2.5" filter="url(#lineShadowStrategy)" />
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
                          <div style={{ width: '12px', height: '3px', background: '#37B46F', borderRadius: '2px' }}></div>
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
                    // Get all strategy employees
                    const strategyEmployees = employees.filter(emp => emp.department === 'strategy');

                    // Calculate performance for each employee
                    const employeePerformance = strategyEmployees.map(employee => {
                      // Get clients assigned to this employee
                      const employeeClients = clients.filter(c => c.assignedToEmployee === employee.email);

                      // Get tasks for this employee's clients
                      const employeeTasks = tasks.filter(task =>
                        employeeClients.some(client =>
                          client.clientId === task.clientId || client.clientName === task.clientName
                        )
                      );

                      const totalTasks = employeeTasks.length;
                      const completedTasks = employeeTasks.filter(t =>
                        t.status === 'completed' ||
                        t.status === 'approved' ||
                        t.status === 'posted' ||
                        t.status === 'assigned-to-department'
                      ).length;

                      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                      return {
                        name: employee.name || employee.employeeName || employee.email,
                        email: employee.email,
                        totalTasks,
                        completedTasks,
                        completionRate
                      };
                    });

                    // Define colors for employee avatars
                    const colors = [
                      { bg: '#37B46F', light: '#818cf8', shadow: 'rgba(102,126,234,0.2)' },
                      { bg: '#10b981', light: '#34d399', shadow: 'rgba(16,185,129,0.2)' },
                      { bg: '#f59e0b', light: '#fbbf24', shadow: 'rgba(245,158,11,0.2)' },
                      { bg: '#8b5cf6', light: '#a78bfa', shadow: 'rgba(139,92,246,0.2)' },
                      { bg: '#3b82f6', light: '#60a5fa', shadow: 'rgba(59,130,246,0.2)' }
                    ];

                    return employeePerformance.length > 0 ? employeePerformance.map((emp, index) => {
                      const colorScheme = colors[index % colors.length];

                      return (
                        <div key={emp.email} style={{
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
                            {emp.name.charAt(0).toUpperCase()}
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
                                {emp.name}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                                <span style={{
                                  fontSize: '13px',
                                  color: colorScheme.bg,
                                  fontWeight: '700'
                                }}>
                                  {emp.completedTasks}
                                </span>
                                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
                                  /{emp.totalTasks}
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
                                width: `${emp.completionRate}%`,
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
                              {emp.completionRate.toFixed(0)}% Complete
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
                  color: '#1f2937'
                }}>
                  Client-wise Task Summary
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Select All Clients Button */}
                  <button
                    onClick={() => {
                      if (!showCheckboxes) {
                        // First click: show checkboxes and select all
                        setShowCheckboxes(true);
                        const reportsTasks = getReportsFilteredTasks();
                        const clientData = {};
                        reportsTasks.forEach(task => {
                          const clientName = task.clientName || 'Unknown';
                          if (!clientData[clientName]) {
                            clientData[clientName] = [];
                          }
                          clientData[clientName].push(task);
                        });
                        const allClients = Object.keys(clientData);
                        setSelectedClientsForDownload(allClients);
                        const allTasks = {};
                        allClients.forEach(clientName => {
                          allTasks[clientName] = clientData[clientName].map(t => t.id);
                        });
                        setSelectedReportTasks(allTasks);
                      } else {
                        // Subsequent clicks: toggle selection
                        const reportsTasks = getReportsFilteredTasks();
                        const clientData = {};
                        reportsTasks.forEach(task => {
                          const clientName = task.clientName || 'Unknown';
                          if (!clientData[clientName]) {
                            clientData[clientName] = [];
                          }
                          clientData[clientName].push(task);
                        });
                        const allClients = Object.keys(clientData);

                        if (selectedClientsForDownload.length === allClients.length) {
                          setSelectedClientsForDownload([]);
                          setSelectedReportTasks({});
                        } else {
                          setSelectedClientsForDownload(allClients);
                          const allTasks = {};
                          allClients.forEach(clientName => {
                            allTasks[clientName] = clientData[clientName].map(t => t.id);
                          });
                          setSelectedReportTasks(allTasks);
                        }
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(102,126,234,0.3)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(102,126,234,0.3)';
                    }}
                  >
                    Select All Clients
                  </button>
                  {showCheckboxes && (
                    <button
                      onClick={() => {
                        // Hide checkboxes and deselect all
                        setShowCheckboxes(false);
                        setSelectedClientsForDownload([]);
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(239,68,68,0.3)',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(239,68,68,0.3)';
                      }}
                    >
                      Deselect All
                    </button>
                  )}

                  {/* Download Buttons - Show when clients are selected */}
                  {selectedClientsForDownload.length > 0 && (
                    <>
                      <div style={{
                        padding: '6px 12px',
                        background: '#e0e7ff',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#4f46e5'
                      }}>
                        {selectedClientsForDownload.length} selected
                      </div>
                      <button
                        onClick={() => downloadMultipleClientsPDF()}
                        style={{
                          padding: '8px 16px',
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
                          boxShadow: '0 2px 6px rgba(239,68,68,0.3)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(239,68,68,0.3)';
                        }}
                      >
                        <FileText size={16} />
                        Download PDF
                      </button>
                      <button
                        onClick={() => downloadMultipleClientsExcel()}
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
                          boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(16,185,129,0.3)';
                        }}
                      >
                        <FileSpreadsheet size={16} />
                        Download Excel
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ overflowX: 'auto', padding: '0' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  tableLayout: 'fixed'
                }}>
                  <thead>
                    <tr style={{
                      background: '#ffffff',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '8%'
                      }}></th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '10%'
                      }}>Client ID</th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '20%'
                      }}>Client Name</th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '11%'
                      }}>Total Tasks</th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '11%'
                      }}>Completed</th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '11%'
                      }}>Pending</th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '13%'
                      }}>In Progress</th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#6b7280',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        width: '16%'
                      }}>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const reportsTasks = getReportsFilteredTasks();
                      const clientData = {};
                      reportsTasks.forEach(task => {
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
                        const clientTasks = reportsTasks.filter(task => task.clientName === client.clientName);

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
                              <td style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                                verticalAlign: 'middle'
                              }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                                  {showCheckboxes && (
                                    <input
                                      type="checkbox"
                                      checked={selectedClientsForDownload.includes(client.clientName)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          // Select client
                                          setSelectedClientsForDownload(prev => [...prev, client.clientName]);
                                          // Also select all tasks for this client
                                          const allTaskIds = clientTasks.map(t => t.id);
                                          setSelectedReportTasks(prev => ({
                                            ...prev,
                                            [client.clientName]: allTaskIds
                                          }));
                                        } else {
                                          // Deselect client
                                          setSelectedClientsForDownload(prev => prev.filter(c => c !== client.clientName));
                                          // Also deselect all tasks for this client
                                          setSelectedReportTasks(prev => ({
                                            ...prev,
                                            [client.clientName]: []
                                          }));
                                        }
                                      }}
                                      style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0 }}
                                    />
                                  )}
                                  <span
                                    style={{
                                      fontSize: '14px',
                                      fontWeight: 'bold',
                                      color: '#37B46F',
                                      transition: 'transform 0.2s',
                                      display: 'inline-block',
                                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                      cursor: 'pointer',
                                      lineHeight: '1'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleReportClientExpansion(client.clientName);
                                    }}
                                  >
                                    ▶
                                  </span>
                                </div>
                              </td>
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
                                      borderRadius: '4px',
                                      boxShadow: completionRate >= 75
                                        ? '0 0 8px rgba(16, 185, 129, 0.4)'
                                        : completionRate >= 50
                                          ? '0 0 8px rgba(245, 158, 11, 0.4)'
                                          : '0 0 8px rgba(239, 68, 68, 0.4)'
                                    }}></div>
                                  </div>
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    minWidth: '40px',
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
                                  background: '#f9fafb',
                                  borderBottom: '2px solid #e5e7eb'
                                }}>
                                  <div style={{
                                    padding: '20px',
                                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: '16px'
                                    }}>
                                      <h4 style={{
                                        margin: 0,
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#37B46F',
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

                                      {/* Selection and Download Controls - Hidden, using new approach */}
                                      {(() => {
                                        const clientTaskKeys = clientTasks.map(t => `${client.clientName}-${t.id}`);
                                        const selectedCount = (selectedReportTasks[client.clientName] || []).length;

                                        return false && selectedCount > 0 ? (
                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                          }}>
                                            <span style={{
                                              fontSize: '13px',
                                              fontWeight: '600',
                                              color: '#37B46F',
                                              padding: '6px 12px',
                                              background: 'rgba(102, 126, 234, 0.1)',
                                              borderRadius: '6px'
                                            }}>
                                              {selectedCount} selected
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                downloadSelectedTasksPDF(client.clientName);
                                              }}
                                              style={{
                                                padding: '8px 16px',
                                                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
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
                                              <FileText size={14} />
                                              PDF
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                downloadSelectedTasksExcel(client.clientName);
                                              }}
                                              style={{
                                                padding: '8px 16px',
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.target.style.transform = 'translateY(-2px)';
                                                e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.target.style.transform = 'translateY(0)';
                                                e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                                              }}
                                            >
                                              <FileSpreadsheet size={14} />
                                              Excel
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectAllClientTasks(client.clientName, clientTasks);
                                              }}
                                              style={{
                                                padding: '8px 16px',
                                                background: '#f3f4f6',
                                                color: '#374151',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                fontSize: '12px',
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
                                              {selectedCount === clientTasks.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSelectAllClientTasks(client.clientName, clientTasks);
                                            }}
                                            style={{
                                              padding: '8px 16px',
                                              background: '#f3f4f6',
                                              color: '#374151',
                                              border: '1px solid #e5e7eb',
                                              borderRadius: '8px',
                                              fontSize: '12px',
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
                                            Select All
                                          </button>
                                        );
                                      })()}
                                    </div>
                                    <table style={{
                                      width: '100%',
                                      borderCollapse: 'collapse',
                                      background: '#ffffff',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      tableLayout: 'fixed'
                                    }}>
                                      <thead>
                                        <tr style={{
                                          background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                                          color: 'white'
                                        }}>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            width: '5%'
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
                                            letterSpacing: '0.5px',
                                            width: '30%'
                                          }}>Task Name</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            width: '15%'
                                          }}>Department</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            width: '15%'
                                          }}>Post Date</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            width: '15%'
                                          }}>Deadline</th>
                                          <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontWeight: '600',
                                            fontSize: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            width: '20%'
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
                                              <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}>📋</div>
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
                          <td colSpan="8" style={{
                            padding: '60px 20px',
                            textAlign: 'center',
                            color: '#9ca3af',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>📊</div>
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
                          background: currentPage === 1 ? '#f3f4f6' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
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
                        ← Previous
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
                                ? 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)'
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
                          background: currentPage === totalPages ? '#f3f4f6' : 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
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
                        Next →
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        ) : null}



        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {/* Tasks Modal */}
        {showTasksModal && selectedClientForTasks && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
            onClick={() => setShowTasksModal(false)}
          >
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column'
            }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '24px 28px',
                borderBottom: '1px solid #e5e7eb',
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>

                    📋 Tasks for {selectedClientForTasks.clientName}
                  </h2>
                </div>
                <button
                  onClick={() => setShowTasksModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px 28px',
                overflowY: 'auto',
                flex: 1
              }}>
                <div style={{
                  background: '#f9fafb',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)' }}>
                        <th style={{
                          padding: '16px',
                          textAlign: 'left',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Task Name</th>
                        <th style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Department</th>
                        <th style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Post Date</th>
                        <th style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Deadline</th>
                        <th style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getClientTasks().map((task, index) => (
                        <tr key={task.id || index} style={{
                          background: index % 2 === 0 ? 'white' : '#f9fafb',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <td style={{
                            padding: '14px 16px',
                            color: '#111827',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            {task.taskName}
                          </td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'center',
                            color: '#6b7280',
                            fontSize: '13px'
                          }}>
                            {task.department}
                          </td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'center',
                            color: '#6b7280',
                            fontSize: '13px'
                          }}>
                            {formatDate(task.postDate)}
                          </td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'center',
                            color: '#6b7280',
                            fontSize: '13px'
                          }}>
                            {formatDate(task.deadline)}
                          </td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'center'
                          }}>
                            <span style={{
                              padding: '6px 12px',
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
                      ))}
                    </tbody>
                  </table>
                  {getClientTasks().length === 0 && (
                    <div style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      color: '#9ca3af'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>📋</div>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>No tasks found for this client</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Client Workflow Modal - Full Screen View (with sidebar visible) */}
        {showClientWorkflowModal && selectedClientForWorkflow && ReactDOM.createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: '280px', // Leave space for sidebar
            right: 0,
            bottom: 0,
            backgroundColor: '#f8f9fa',
            zIndex: 1000,
            overflow: 'auto'
          }}>
            <div style={{
              minHeight: '100vh',
              backgroundColor: '#f8f9fa'
            }}>
              {/* Modal Header - Full Width */}
              <div style={{
                padding: '20px 40px',
                background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                position: 'sticky',
                top: 0,
                zIndex: 100
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>
                    {selectedClientForWorkflow.clientName}
                  </h2>
                  <p style={{ margin: '8px 0 0 0', fontSize: '15px', opacity: 0.95 }}>
                    Client ID: {selectedClientForWorkflow.clientId} | Work through all 4 stages
                  </p>
                </div>
              </div>

              {/* Client Progress - 4 Stages - Full Width */}
              <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
                <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600', color: '#374151' }}>
                  Client Progress
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '24px',
                  marginBottom: '40px'
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
                    if (currentStageIndex === -1) currentStageIndex = 0;

                    return allStages.map((stage, index) => {
                      const isCompleted = index < currentStageIndex;
                      const isCurrent = index === currentStageIndex;
                      const isPending = index > currentStageIndex;

                      return (
                        <div key={stage.status} style={{
                          padding: '24px',
                          borderRadius: '16px',
                          border: `3px solid ${isCurrent ? stage.borderColor : isCompleted ? '#10b981' : '#e5e7eb'}`,
                          background: isCurrent ? stage.color : isCompleted ? '#d1fae5' : 'white',
                          position: 'relative',
                          boxShadow: isCurrent ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                          transition: 'all 0.3s'
                        }}>
                          <div style={{
                            fontSize: '32px',
                            marginBottom: '12px',
                            textAlign: 'center'
                          }}>
                            {isCompleted ? '✅' : isCurrent ? '🔄' : '⏳'}
                          </div>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: isCurrent ? stage.textColor : isCompleted ? '#059669' : '#6b7280',
                            textAlign: 'center',
                            marginBottom: '12px',
                            lineHeight: '1.4'
                          }}>
                            {stage.name}
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            textAlign: 'center',
                            fontWeight: '500'
                          }}>
                            {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Pending'}
                          </div>

                          {/* Complete Button for Current Stage */}
                          {isCurrent && index < 3 && (
                            <button
                              onClick={async () => {
                                const nextStage = allStages[index + 1];
                                if (window.confirm(`Mark ${stage.name} as complete and move to ${nextStage.name}?`)) {
                                  try {
                                    const clientRef = ref(database, `strategyHeadClients/${selectedClientForWorkflow.id}`);
                                    const updates = {
                                      stage: nextStage.status,
                                      [`${stage.status}CompletedAt`]: new Date().toISOString(),
                                      lastUpdated: new Date().toISOString()
                                    };
                                    await update(clientRef, updates);

                                    setSelectedClientForWorkflow({
                                      ...selectedClientForWorkflow,
                                      stage: nextStage.status
                                    });

                                    showToast(`✅ Moved to ${nextStage.name}!`, 'success', 3000);
                                  } catch (error) {
                                    console.error('Error updating stage:', error);
                                    showToast('❌ Error updating stage', 'error', 3000);
                                  }
                                }
                              }}
                              style={{
                                marginTop: '12px',
                                width: '100%',
                                padding: '8px',
                                background: stage.borderColor,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Complete
                            </button>
                          )}

                          {/* Complete Final Stage - Assign Tasks to Departments */}
                          {isCurrent && index === 3 && (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Mark ${stage.name} as complete and assign all tasks to departments?`)) {
                                  try {
                                    // Update client stage to completed
                                    const clientRef = ref(database, `strategyHeadClients/${selectedClientForWorkflow.id}`);
                                    const updates = {
                                      stage: 'completed',
                                      [`${stage.status}CompletedAt`]: new Date().toISOString(),
                                      completedAt: new Date().toISOString(),
                                      lastUpdated: new Date().toISOString()
                                    };
                                    await update(clientRef, updates);

                                    // Assign all tasks for this client to their departments
                                    const tasksRef = ref(database, 'tasks');
                                    const tasksSnapshot = await get(tasksRef);

                                    if (tasksSnapshot.exists()) {
                                      const allTasks = tasksSnapshot.val();
                                      const updatePromises = [];

                                      Object.entries(allTasks).forEach(([taskId, task]) => {
                                        // Find tasks for this client that are still in strategy workflow
                                        if (task.clientId === selectedClientForWorkflow.clientId &&
                                          (task.status === 'strategy-preparation' ||
                                            task.status === 'information-gathering' ||
                                            task.status === 'internal-approval' ||
                                            task.status === 'client-approval')) {
                                          const taskRef = ref(database, `tasks/${taskId}`);
                                          updatePromises.push(
                                            update(taskRef, {
                                              status: 'assigned-to-department',
                                              assignedToDepartmentAt: new Date().toISOString(),
                                              lastUpdated: new Date().toISOString()
                                            })
                                          );
                                        }
                                      });

                                      await Promise.all(updatePromises);
                                      showToast(`✅ All stages completed! ${updatePromises.length} tasks assigned to departments!`, 'success', 3000);
                                    } else {
                                      showToast('✅ All stages completed!', 'success', 3000);
                                    }

                                    setShowClientWorkflowModal(false);
                                    setSelectedClientForWorkflow(null);
                                  } catch (error) {
                                    console.error('Error completing final stage:', error);
                                    showToast('❌ Error completing final stage', 'error', 3000);
                                  }
                                }
                              }}
                              style={{
                                marginTop: '12px',
                                width: '100%',
                                padding: '8px',
                                background: stage.borderColor,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Complete & Assign Tasks
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Tasks Section */}
                <div style={{
                  marginTop: '32px',
                  padding: '20px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#374151', flex: 1 }}>
                      Tasks for {selectedClientForWorkflow.clientName}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="strategy-header-filters" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label htmlFor="client-modal-month-select" style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>Month:</label>
                        <input
                          id="client-modal-month-select"
                          type="month"
                          value={myTaskSelectedMonth}
                          onChange={(e) => setMyTaskSelectedMonth(e.target.value)}
                          className="strategy-filter-input"
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <button
                        onClick={() => setShowStrategyPrepForm(true)}
                        style={{
                          background: 'linear-gradient(135deg, #37B46F 0%, #2d9159 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 20px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Plus size={16} />
                        Add Task
                      </button>
                    </div>
                  </div>

                  {/* Tasks Table */}
                  {(() => {
                    const clientTasks = tasks.filter(t =>
                      (t.clientId === selectedClientForWorkflow.clientId || t.clientName === selectedClientForWorkflow.clientName) &&
                      !t.deleted &&
                      ((t.postDate && t.postDate.startsWith(myTaskSelectedMonth)) ||
                        (t.deadline && t.deadline.startsWith(myTaskSelectedMonth)))
                    );

                    if (clientTasks.length === 0) {
                      return (
                        <div style={{
                          padding: '40px',
                          textAlign: 'center',
                          color: '#9ca3af'
                        }}>
                          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>📋</div>
                          <p style={{ fontSize: '14px', fontWeight: '500' }}>No tasks found for this month. Click "Add Task" to create tasks.</p>
                        </div>
                      );
                    }

                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>IDEAS</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>CONTENT</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>DEPARTMENT</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>DATE</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>STAGE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientTasks.map((task) => (
                            <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '12px', fontSize: '13px', color: '#374151' }}>{task.ideas || task.taskName || 'N/A'}</td>
                              <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>{task.content || task.description || 'N/A'}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  background: task.department === 'video' ? '#dbeafe' : task.department === 'graphics' ? '#fce7f3' : '#fef3c7',
                                  color: task.department === 'video' ? '#1e40af' : task.department === 'graphics' ? '#ec4899' : '#f59e0b'
                                }}>
                                  {task.department?.toUpperCase() || 'N/A'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                                {task.postDate ? new Date(task.postDate).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  background: task.status === 'assigned-to-department' ? '#dcfce7' : '#e0e7ff',
                                  color: task.status === 'assigned-to-department' ? '#16a34a' : '#4338ca'
                                }}>
                                  {task.status === 'assigned-to-department' ? 'Assigned' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Add Task Form Modal - Matching Strategy Employee Form */}
        {showStrategyPrepForm && selectedClientForWorkflow && ReactDOM.createPortal(
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
            zIndex: 10000,
            padding: '20px'
          }}
            onClick={() => setShowStrategyPrepForm(false)}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
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

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = multipleTaskForms[0]; // Use first form for single task

                if (!form.taskName || !form.department || !form.taskType || !form.postDate) {
                  showToast('❌ Please fill in required fields (Ideas, Department, Task Type, Post Date)', 'error', 3000);
                  return;
                }

                try {
                  const tasksRef = ref(database, 'tasks');

                  await push(tasksRef, {
                    clientId: selectedClientForWorkflow.clientId,
                    clientName: selectedClientForWorkflow.clientName,
                    taskName: form.taskName,
                    ideas: form.taskName,
                    content: form.description,
                    description: form.description,
                    referenceLink: form.referenceLink || '',
                    specialNotes: form.specialNotes || '',
                    department: form.department,
                    taskType: form.taskType,
                    postDate: form.postDate,
                    deadline: form.postDate,
                    status: 'strategy-preparation', // Keep in strategy workflow until all stages complete
                    assignedToDept: form.department,
                    assignedBy: 'Strategy Head',
                    strategyHeadEmail: 'head@gmail.com',
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                  });

                  showToast('✅ Task created successfully!', 'success', 3000);
                  setShowStrategyPrepForm(false);
                  setMultipleTaskForms([{
                    id: 1,
                    taskName: '',
                    description: '',
                    referenceLink: '',
                    ideaPoint: '',
                    specialNotes: '',
                    department: '',
                    taskType: '',
                    postDate: ''
                  }]);
                } catch (error) {
                  console.error('Error creating task:', error);
                  showToast('❌ Error creating task', 'error', 3000);
                }
              }} style={{ padding: '24px' }}>

                {/* Client Info - Read Only */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Select Client *
                  </label>
                  <input
                    type="text"
                    value={`${selectedClientForWorkflow.clientName} (${selectedClientForWorkflow.clientId})`}
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
                    value={selectedClientForWorkflow.clientId}
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
                    value={multipleTaskForms[0].taskName}
                    onChange={(e) => {
                      const newForms = [...multipleTaskForms];
                      newForms[0].taskName = e.target.value;
                      setMultipleTaskForms(newForms);
                    }}
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
                    value={multipleTaskForms[0].description}
                    onChange={(e) => {
                      const newForms = [...multipleTaskForms];
                      newForms[0].description = e.target.value;
                      setMultipleTaskForms(newForms);
                    }}
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
                    value={multipleTaskForms[0].referenceLink}
                    onChange={(e) => {
                      const newForms = [...multipleTaskForms];
                      newForms[0].referenceLink = e.target.value;
                      setMultipleTaskForms(newForms);
                    }}
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
                    value={multipleTaskForms[0].specialNotes}
                    onChange={(e) => {
                      const newForms = [...multipleTaskForms];
                      newForms[0].specialNotes = e.target.value;
                      setMultipleTaskForms(newForms);
                    }}
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
                    value={multipleTaskForms[0].department}
                    onChange={(e) => {
                      const newForms = [...multipleTaskForms];
                      newForms[0].department = e.target.value;
                      newForms[0].taskType = ''; // Reset task type when department changes
                      setMultipleTaskForms(newForms);
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
                {multipleTaskForms[0].department && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Task Type *
                    </label>
                    <select
                      value={multipleTaskForms[0].taskType}
                      onChange={(e) => {
                        const newForms = [...multipleTaskForms];
                        newForms[0].taskType = e.target.value;
                        setMultipleTaskForms(newForms);
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
                      <option value="">-- Select task type --</option>
                      {multipleTaskForms[0].department === 'video' && (
                        <>
                          <option value="long-video">Long Video</option>
                          <option value="reel">Reel</option>
                        </>
                      )}
                      {multipleTaskForms[0].department === 'graphics' && (
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
                    value={multipleTaskForms[0].postDate}
                    onChange={(e) => {
                      const newForms = [...multipleTaskForms];
                      newForms[0].postDate = e.target.value;
                      setMultipleTaskForms(newForms);
                    }}
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
                      setShowStrategyPrepForm(false);
                      setMultipleTaskForms([{
                        id: 1,
                        taskName: '',
                        description: '',
                        referenceLink: '',
                        ideaPoint: '',
                        specialNotes: '',
                        department: '',
                        taskType: '',
                        postDate: ''
                      }]);
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
          </div>,
          document.body
        )}
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default StrategyHead;
