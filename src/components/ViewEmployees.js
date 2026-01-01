import React, { useState, useEffect } from 'react';
import { ref, onValue, update, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Calendar, LogOut, Plus, UserPlus, Upload, Search, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import './ProductionIncharge.css';

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

const ViewEmployees = () => {
    const navigate = useNavigate();
    const { toasts, showToast, removeToast } = useToast();
    const [employees, setEmployees] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [clients, setClients] = useState([]);
    const [employeeListSearch, setEmployeeListSearch] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [editEmployeeName, setEditEmployeeName] = useState('');
    const [editEmployeePassword, setEditEmployeePassword] = useState('');
    const [editEmployeeRole, setEditEmployeeRole] = useState('employee');

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

    // Firebase data loading - Load employees
    useEffect(() => {
        console.log('ViewEmployees: Setting up Firebase listeners');
        console.log('ViewEmployees: Database object:', database);
        console.log('ViewEmployees: Auth state:', auth.currentUser ? `Authenticated as ${auth.currentUser.email}` : 'Not authenticated');

        if (!database) {
            console.error('ViewEmployees: Database is not initialized!');
            showToast('❌ Database connection error. Please refresh the page.', 'error', 5000);
            return;
        }

        const employeesRef = ref(database, 'employees');
        const unsubscribeEmployees = onValue(employeesRef, (snapshot) => {
            console.log('ViewEmployees: Loading employees from Firebase...');
            const data = snapshot.val();
            console.log('ViewEmployees: Raw employees data:', data);

            if (data) {
                const dbEmployees = Object.keys(data)
                    .map(key => ({
                        id: key,
                        ...data[key]
                    }))
                    .filter(employee => !employee.deleted); // Filter out deleted employees

                // Merge system employees with database employees (avoiding duplicates if they were added to DB)
                const dbEmails = new Set(dbEmployees.map(e => e.email?.toLowerCase()));
                const uniqueSystemEmployees = SYSTEM_EMPLOYEES.filter(se => !dbEmails.has(se.email?.toLowerCase()));

                const combinedEmployees = [...uniqueSystemEmployees, ...dbEmployees];
                console.log('ViewEmployees: Employees loaded (System + DB):', combinedEmployees.length);
                setEmployees(combinedEmployees);
            } else {
                setEmployees(SYSTEM_EMPLOYEES);
            }
        });

        const tasksRef = ref(database, 'tasks');
        const unsubscribeTasks = onValue(tasksRef, (snapshot) => {
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

        const clientsRef = ref(database, 'clients');
        const unsubscribeClients = onValue(clientsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const clientsArray = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setClients(prevClients => {
                    const merged = [...prevClients];
                    clientsArray.forEach(nc => {
                        const existingIndex = merged.findIndex(c => c.id === nc.id);
                        if (existingIndex === -1) {
                            merged.push(nc);
                        } else {
                            merged[existingIndex] = { ...merged[existingIndex], ...nc };
                        }
                    });
                    return merged;
                });
            }
        });

        // Also listen to strategyClients
        const strategyClientsRef = ref(database, 'strategyClients');
        const unsubscribeStrategyClients = onValue(strategyClientsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const strategyClientsArray = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    source: 'strategy'
                }));

                setClients(prevClients => {
                    const merged = [...prevClients];
                    strategyClientsArray.forEach(sc => {
                        const existingIndex = merged.findIndex(c => c.id === sc.id);
                        if (existingIndex === -1) {
                            merged.push(sc);
                        } else {
                            merged[existingIndex] = { ...merged[existingIndex], ...sc };
                        }
                    });
                    return merged;
                });
            }
        });

        return () => {
            unsubscribeEmployees();
            unsubscribeTasks();
            unsubscribeClients();
            unsubscribeStrategyClients();
        };
    }, []);

    // Handle logout
    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Get filtered employees for display
    const getFilteredEmployees = () => {
        return employees.filter(employee => {
            // Filter out deleted employees
            if (employee.deleted) return false;

            // Filter out system employees (they should not be shown in the list)
            if (employee.isSystem) return false;

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

    // Handle employee status toggle
    const handleEmployeeStatusToggle = async (employeeId, currentStatus) => {
        if (!database) {
            showToast('❌ Database not available', 'error', 3000);
            return;
        }

        try {
            if (SYSTEM_EMPLOYEES.some(se => se.id === employeeId)) {
                showToast('System accounts cannot be disabled via this panel.', 'warning', 3000);
                return;
            }
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

    // Handle edit employee
    const handleEditEmployee = (employee) => {
        setEditingEmployee(employee);
        setEditEmployeeName(employee.employeeName || '');
        setEditEmployeePassword(employee.password || '');
        setEditEmployeeRole(employee.role || 'employee');
        setShowEditEmployeeModal(true);
    };

    // Handle save employee edits
    const handleSaveEmployeeEdits = async () => {
        if (!editingEmployee || !editingEmployee.id) {
            showToast('❌ No employee selected for editing', 'error', 3000);
            return;
        }

        if (editingEmployee.email === 'superadmin@gmail.com') {
            showToast('❌ The primary Super Admin account cannot be edited here for safety.', 'error', 3000);
            return;
        }

        if (!editEmployeeName.trim()) {
            showToast('❌ Employee name is required', 'error', 3000);
            return;
        }

        if (!editEmployeePassword.trim()) {
            showToast('❌ Password is required', 'error', 3000);
            return;
        }

        try {
            const employeeRef = ref(database, `employees/${editingEmployee.id}`);
            await update(employeeRef, {
                employeeName: editEmployeeName.trim(),
                password: editEmployeePassword.trim(),
                role: editEmployeeRole,
                lastUpdated: new Date().toISOString(),
                updatedBy: 'Production Incharge'
            });

            showToast('✅ Employee updated successfully!', 'success', 3000);
            setShowEditEmployeeModal(false);
            setEditingEmployee(null);
            setEditEmployeeName('');
            setEditEmployeePassword('');
            setEditEmployeeRole('employee');
        } catch (error) {
            console.error('Error updating employee:', error);
            showToast('❌ Error updating employee', 'error', 3000);
        }
    };

    // Handle delete employee
    const handleDeleteEmployee = async (employee) => {
        if (!employee || (!employee.id && !employee.email)) {
            showToast('❌ Invalid employee data', 'error');
            return;
        }

        if (employee.email === 'superadmin@gmail.com') {
            showToast('❌ The primary Super Admin account cannot be deleted.', 'error');
            return;
        }

        if (!window.confirm(`Are you sure you want to PERMANENTLY delete ${employee.employeeName || employee.email}? This action will unassign all their tasks and clients.`)) {
            return;
        }

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

            // 3. Mark as deleted in database (soft delete)
            if (employee.id) {
                updates[`employees/${employee.id}/deleted`] = true;
                updates[`employees/${employee.id}/deletedAt`] = new Date().toISOString();
                updates[`employees/${employee.id}/status`] = 'inactive';
            } else if (employee.email) {
                const foundEmp = employees.find(e => e.email === employee.email);
                if (foundEmp && foundEmp.id) {
                    updates[`employees/${foundEmp.id}/deleted`] = true;
                    updates[`employees/${foundEmp.id}/deletedAt`] = new Date().toISOString();
                    updates[`employees/${foundEmp.id}/status`] = 'inactive';
                }
            }

            console.log('Sending updates to Firebase:', updates);
            await update(ref(database), updates);

            showToast(`✅ Employee ${employee.employeeName || employee.email} deleted successfully!`, 'success', 3000);
        } catch (error) {
            console.error('Error deleting employee:', error);
            showToast('❌ Failed to delete employee: ' + error.message, 'error', 5000);
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
                                    onClick={() => navigate('/production-incharge')}
                                >
                                    <div className="production-sidebar-menu-icon">
                                        <LayoutDashboard size={20} />
                                    </div>
                                    Dashboard
                                </button>
                            </li>
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
                                    onClick={() => navigate('/production-incharge', { state: { openCalendar: true } })}
                                >
                                    <div className="production-sidebar-menu-icon">
                                        <Calendar size={20} />
                                    </div>
                                    Calendar
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div className="production-sidebar-section">
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
                                    onClick={() => navigate('/production-incharge/view-clients')}
                                >
                                    <div className="production-sidebar-menu-icon">
                                        <UserPlus size={20} />
                                    </div>
                                    View Clients
                                </button>
                            </li>
                            <li className="production-sidebar-menu-item">
                                <button
                                    className="production-sidebar-menu-link active"
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
                                >
                                    <div className="production-sidebar-menu-icon">
                                        <UserPlus size={20} />
                                    </div>
                                    <span style={{ flex: 1 }}>
                                        All Employees
                                    </span>
                                    {employees.filter(e => !e.deleted && !e.isSystem).length > 0 && (
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
                                            {employees.filter(e => !e.deleted && !e.isSystem).length}
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
                                    onClick={() => navigate('/production-incharge')}
                                >
                                    <div className="production-sidebar-menu-icon">
                                        <Upload size={20} />
                                    </div>
                                    Upload Excel
                                </label>
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
            </div>

            {/* Main Content */}
            <div className="production-main-content">
                {/* Page Header */}
                <div className="production-header">
                    <div className="production-header-content">
                        <div className="production-header-left">
                            <div className="production-header-title">
                                <h1>All Employees</h1>
                                <p>Manage all employees and their access</p>
                            </div>
                        </div>
                        <div className="production-header-right">
                            <div className="production-breadcrumb">
                                <span>Dashboard</span>
                                <span className="production-breadcrumb-separator">/</span>
                                <span>All Employees</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Employees List */}
                <div style={{ padding: '0 0 32px 0' }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
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
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <UserPlus size={24} />
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>👥 All Employees ({getFilteredEmployees().length})</h2>
                            </div>
                        </div>
                        <div style={{ padding: '24px' }}>
                            {/* Search Bar */}
                            <div style={{
                                marginBottom: '20px'
                            }}>
                                <div style={{ position: 'relative', maxWidth: '400px' }}>
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
                                        placeholder="Search employees by name, email, or department..."
                                        value={employeeListSearch}
                                        onChange={(e) => setEmployeeListSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 40px 12px 40px',
                                            border: '2px solid #e5e7eb',
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
                                    {employeeListSearch && (
                                        <button
                                            onClick={() => setEmployeeListSearch('')}
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
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            {getFilteredEmployees().length > 0 ? (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        backgroundColor: 'white',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        minWidth: '900px',
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#667eea', color: 'white' }}>
                                                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Name
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Email
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Password
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Department
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Role
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Status
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Created At
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', width: '100px' }}>
                                                    Enable/Disable
                                                </th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', width: '150px' }}>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getFilteredEmployees().map((emp, index) => (
                                                <tr key={emp.id || index} style={{
                                                    borderBottom: '1px solid #f3f4f6',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    <td style={{ padding: '10px 8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '28px',
                                                                height: '28px',
                                                                borderRadius: '50%',
                                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white',
                                                                fontWeight: '600',
                                                                fontSize: '12px'
                                                            }}>
                                                                {emp.employeeName?.charAt(0).toUpperCase() || 'E'}
                                                            </div>
                                                            <span style={{ fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                                                                {emp.employeeName || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', fontSize: '12px', color: '#6b7280' }}>
                                                        {emp.email || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                        <span style={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '11px',
                                                            padding: '2px 4px',
                                                            backgroundColor: '#f3f4f6',
                                                            borderRadius: '4px',
                                                            color: '#374151'
                                                        }}>
                                                            {emp.password || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '10px',
                                                            fontWeight: '600',
                                                            backgroundColor: emp.department === 'video' ? '#dbeafe' :
                                                                emp.department === 'graphics' ? '#fce7f3' :
                                                                    emp.department === 'social-media' ? '#d1fae5' :
                                                                        emp.department === 'strategy' ? '#fef3c7' :
                                                                            emp.department === 'production' ? '#e0e7ff' : '#f3f4f6',
                                                            color: emp.department === 'video' ? '#1e40af' :
                                                                emp.department === 'graphics' ? '#831843' :
                                                                    emp.department === 'social-media' ? '#065f46' :
                                                                        emp.department === 'strategy' ? '#92400e' :
                                                                            emp.department === 'production' ? '#3730a3' : '#374151'
                                                        }}>
                                                            {emp.department === 'video' ? '📹 Video' :
                                                                emp.department === 'graphics' ? '🎨 Graphics' :
                                                                    emp.department === 'social-media' ? '📱 Social' :
                                                                        emp.department === 'strategy' ? '📊 Strategy' :
                                                                            emp.department === 'production' ? '🏭 Production' :
                                                                                emp.department || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                        <span style={{
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
                                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            backgroundColor: emp.status === 'active' ? '#d1fae5' : '#fee2e2',
                                                            color: emp.status === 'active' ? '#065f46' : '#dc2626'
                                                        }}>
                                                            {emp.status === 'active' ? '✅ Active' : '❌ Inactive'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px' }}>{emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : 'N/A'}</td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                        <button
                                                            onClick={async () => {
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
                                                                width: '40px',
                                                                height: '22px',
                                                                backgroundColor: emp.status === 'active' ? '#10b981' : '#e5e7eb',
                                                                borderRadius: '11px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                transition: 'background-color 0.3s',
                                                                padding: 0
                                                            }}
                                                        >
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '2px',
                                                                left: emp.status === 'active' ? '20px' : '2px',
                                                                width: '18px',
                                                                height: '18px',
                                                                backgroundColor: 'white',
                                                                borderRadius: '50%',
                                                                transition: 'left 0.3s',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                            }} />
                                                        </button>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
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
                                                                onClick={() => handleDeleteEmployee(emp)}
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
                                                                onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
                                                                title="Delete Employee"
                                                            >
                                                                🗑️ Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '60px 20px',
                                    color: '#6b7280'
                                }}>
                                    {employeeListSearch ? (
                                        <>
                                            <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                            <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                                                No employees found matching "{employeeListSearch}"
                                            </p>
                                            <p style={{ fontSize: '13px' }}>
                                                Try a different search term
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                            <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                                                No employees found
                                            </p>
                                            <p style={{ fontSize: '13px' }}>
                                                Add employees using the "Add Employee" button
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Employee Modal */}
            {showEditEmployeeModal && (
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
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                                onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '16px' }}>
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
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151'
                                }}>
                                    Password *
                                </label>
                                <input
                                    type="text"
                                    value={editEmployeePassword}
                                    onChange={(e) => setEditEmployeePassword(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
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
                                }}>
                                    Role *
                                </label>
                                <select
                                    value={editEmployeeRole}
                                    onChange={(e) => setEditEmployeeRole(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                >
                                    <option value="employee">Employee</option>
                                    <option value="head">Head</option>
                                </select>
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
                                    onClick={handleSaveEmployeeEdits}
                                    style={{
                                        padding: '10px 20px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ViewEmployees;
