import React, { useState, useEffect } from 'react';
import { ref, onValue, update, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Calendar, LogOut, Plus, UserPlus, Upload, Search, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import './ProductionIncharge.css';

const ViewEmployees = () => {
    const navigate = useNavigate();
    const { toasts, showToast, removeToast } = useToast();
    const [employees, setEmployees] = useState([]);
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
                const employeesArray = Object.keys(data)
                    .map(key => ({
                        id: key,
                        ...data[key]
                    }))
                    .filter(employee => !employee.deleted); // Filter out deleted employees

                console.log('ViewEmployees: Employees loaded:', employeesArray.length, employeesArray);
                setEmployees(employeesArray);
            } else {
                console.log('ViewEmployees: No employees found in database');
                setEmployees([]);
            }
        });

        return () => {
            unsubscribeEmployees();
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
        if (!window.confirm(`Are you sure you want to delete ${employee.employeeName}? This action cannot be undone.`)) {
            return;
        }

        try {
            const employeeRef = ref(database, `employees/${employee.id}`);
            await update(employeeRef, {
                deleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: 'Production Incharge'
            });

            showToast(`✅ Employee ${employee.employeeName} deleted successfully!`, 'success', 3000);
        } catch (error) {
            console.error('Error deleting employee:', error);
            showToast('❌ Error deleting employee', 'error', 3000);
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
                                    {employees.filter(e => !e.deleted).length > 0 && (
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
                                            {employees.filter(e => !e.deleted).length}
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
                <div style={{ padding: '24px' }}>
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
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#667eea', color: 'white' }}>
                                                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Name
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Email
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Password
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Department
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Role
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Status
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Created At
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    Enable/Disable
                                                </th>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
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
                                                                {emp.employeeName?.charAt(0).toUpperCase() || 'E'}
                                                            </div>
                                                            <span style={{ fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                                                                {emp.employeeName || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                                                        {emp.email || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <span style={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '12px',
                                                            padding: '4px 6px',
                                                            backgroundColor: '#f3f4f6',
                                                            borderRadius: '4px',
                                                            color: '#374151'
                                                        }}>
                                                            {emp.password || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '12px',
                                                            fontSize: '11px',
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
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            backgroundColor: emp.role === 'head' ? '#fef3c7' : '#dbeafe',
                                                            color: emp.role === 'head' ? '#92400e' : '#1e40af'
                                                        }}>
                                                            {emp.role === 'head' ? '👑 Head' : '👤 Employee'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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
                                                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                                                        {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => handleEmployeeStatusToggle(emp.id, emp.status)}
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
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => handleEditEmployee(emp)}
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
                                                                onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
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
