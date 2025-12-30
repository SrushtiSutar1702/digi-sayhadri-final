import React, { useState } from 'react';
import { ref, push, get } from 'firebase/database';
import { database, secondaryAuth } from '../firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import { ArrowLeft, Calendar, UserPlus, Plus, Upload, LogOut, LayoutDashboard } from 'lucide-react';
import './ProductionIncharge.css';

const AddEmployeeForm = () => {
    const navigate = useNavigate();
    const { toasts, showToast, removeToast } = useToast();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [newEmployee, setNewEmployee] = useState({
        employeeName: '',
        department: '',
        role: 'employee',
        email: '',
        password: '',
        status: 'active'
    });

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        if (!database) {
            showToast('❌ Database not available', 'error', 3000);
            return;
        }

        try {
            // Check if email already exists in database
            const employeesRef = ref(database, 'employees');
            const snapshot = await get(employeesRef);
            if (snapshot.exists()) {
                const employeesData = snapshot.val();
                const emailExists = Object.values(employeesData).some(emp =>
                    emp.email && emp.email.toLowerCase() === newEmployee.email.toLowerCase()
                );

                if (emailExists) {
                    showToast('⚠️ An employee with this email already exists!', 'error', 4000);
                    return;
                }
            }

            // Validate password length
            if (newEmployee.password.length < 6) {
                showToast('❌ Password must be at least 6 characters long', 'error', 3000);
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
            await push(employeesRef, {
                ...newEmployee,
                firebaseUid: userCredential.user.uid, // Store Firebase Auth UID
                createdAt: new Date().toISOString(),
                createdBy: 'Production Incharge'
            });

            showToast(`✅ Employee ${newEmployee.employeeName} added successfully with Firebase Auth account!`, 'success', 3000);

            // Navigate back after short delay to show toast
            setTimeout(() => {
                navigate('/production-incharge');
            }, 1500);

        } catch (error) {
            console.error('Error adding employee:', error);

            // Provide specific error messages
            if (error.code === 'auth/email-already-in-use') {
                showToast('❌ This email is already registered in Firebase Authentication', 'error', 4000);
            } else if (error.code === 'auth/invalid-email') {
                showToast('❌ Invalid email address', 'error', 3000);
            } else if (error.code === 'auth/weak-password') {
                showToast('❌ Password is too weak. Use at least 6 characters', 'error', 3000);
            } else {
                showToast(`❌ Error adding employee: ${error.message}`, 'error', 3000);
            }
        }
    };

    return (
        <div className="production-dashboard">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Mobile Menu Button - Reuse logic if needed, simplifed for now */}
            <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="mobile-menu-button"
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
                    display: 'none', // Hidden by default, CSS handles media query
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: '#4B49AC',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
            >
                {mobileMenuOpen ? '✕' : '☰'}
            </button>

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
                                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                                    onClick={() => navigate('/production-incharge')}
                                >
                                    <div className="production-sidebar-menu-icon"><LayoutDashboard size={20} /></div>
                                    Dashboard
                                </button>
                            </li>
                            <li className="production-sidebar-menu-item">
                                <button
                                    className="production-sidebar-menu-link"
                                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                                    onClick={() => navigate('/production-incharge', { state: { openCalendar: true } })}
                                >
                                    <div className="production-sidebar-menu-icon"><Calendar size={20} /></div>
                                    Calendar
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div className="production-sidebar-section">
                        <div className="production-sidebar-section-title">Actions</div>
                        <ul className="production-sidebar-menu">
                            {/* Add Employee - ACTIVE */}
                            <li className="production-sidebar-menu-item">
                                <button
                                    className="production-sidebar-menu-link active"
                                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                                >
                                    <div className="production-sidebar-menu-icon"><UserPlus size={20} /></div>
                                    Add Employee
                                </button>
                            </li>

                            {/* Other links navigate back to dashboard for simplicity */}

                            <li className="production-sidebar-menu-item">
                                <button
                                    className="production-sidebar-menu-link"
                                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                                    onClick={() => navigate('/production-incharge/view-clients')}
                                >
                                    <div className="production-sidebar-menu-icon"><UserPlus size={20} /></div>
                                    View Clients
                                </button>
                            </li>
                            <li className="production-sidebar-menu-item">
                                <button
                                    className="production-sidebar-menu-link"
                                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                                    onClick={() => navigate('/production-incharge/view-employees')}
                                >
                                    <div className="production-sidebar-menu-icon"><UserPlus size={20} /></div>
                                    All Employees
                                </button>
                            </li>
                            <li className="production-sidebar-menu-item">
                                <button
                                    className="production-sidebar-menu-link"
                                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                                    onClick={() => navigate('/production-incharge')}
                                >
                                    <div className="production-sidebar-menu-icon"><Upload size={20} /></div>
                                    Upload Excel
                                </button>
                            </li>
                        </ul>
                    </div>
                </nav>

                {/* User Profile */}
                <div className="production-sidebar-user">
                    <div className="production-sidebar-user-info">
                        <div className="production-sidebar-user-avatar">P</div>
                        <div className="production-sidebar-user-details">
                            <h4>Production Manager</h4>
                            <p>Admin</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')} // Logout to home
                        className="production-btn production-btn-logout"
                        style={{ marginTop: '12px', width: '100%' }}
                    >
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </div>

            {/* Main Content Area - Form */}
            <div className="production-main-content">
                <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>


                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '40px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                    }}>
                        <h2 style={{
                            margin: '0 0 32px 0',
                            fontSize: '28px',
                            fontWeight: '700',
                            color: '#1f2937',
                            textAlign: 'center'
                        }}>👥 Add New Employee</h2>

                        <form onSubmit={handleAddEmployee}>
                            <div style={{ marginBottom: '24px' }}>
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
                                    value={newEmployee.employeeName}
                                    onChange={(e) => setNewEmployee({ ...newEmployee, employeeName: e.target.value })}
                                    placeholder="e.g., harshada patil, janavi patil, sagar"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                                <div>
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
                                            padding: '14px 16px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '10px',
                                            fontSize: '15px',
                                            outline: 'none',
                                            backgroundColor: 'white',
                                            cursor: 'pointer'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                    >
                                        <option value="">-- Select Department --</option>
                                        <option value="production">🏭 Production Department</option>
                                        <option value="video">📹 Video Department</option>
                                        <option value="graphics">🎨 Graphics Department</option>
                                        <option value="social-media">📱 Social Media Department</option>
                                        <option value="strategy">📊 Strategy Department</option>
                                    </select>
                                </div>

                                <div>
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
                                            padding: '14px 16px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '10px',
                                            fontSize: '15px',
                                            outline: 'none',
                                            backgroundColor: 'white',
                                            cursor: 'pointer'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                    >
                                        <option value="employee">👤 Employee</option>
                                        <option value="head">👑 Department Head</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
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
                                    value={newEmployee.email}
                                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                    placeholder="employee@company.com"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            <div style={{ marginBottom: '32px' }}>
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
                                    type="password"
                                    value={newEmployee.password}
                                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                                    placeholder="Enter password for employee login"
                                    required
                                    minLength="6"
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                                <small style={{
                                    display: 'block',
                                    marginTop: '8px',
                                    fontSize: '13px',
                                    color: '#6b7280'
                                }}>
                                    Minimum 6 characters. Employee will use this to login.
                                </small>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '16px',
                                marginTop: '40px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/production-incharge')}
                                    style={{
                                        flex: '1',
                                        padding: '14px 24px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        backgroundColor: 'white',
                                        color: '#6b7280',
                                        fontSize: '15px',
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
                                        flex: '1',
                                        padding: '14px 24px',
                                        border: 'none',
                                        borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #4B49AC 0%, #7DA0FA 100%)',
                                        color: 'white',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(75, 73, 172, 0.2)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 6px 16px rgba(75, 73, 172, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(75, 73, 172, 0.2)';
                                    }}
                                >
                                    Create Employee
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddEmployeeForm;
