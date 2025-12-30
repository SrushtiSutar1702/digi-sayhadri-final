import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Image, LogOut, CheckCircle, XCircle, Clock, Calendar, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import './Dashboard.css';

const GraphicsTeam = () => {
  const [tasks, setTasks] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false);
  const [selectedTaskForAssignment, setSelectedTaskForAssignment] = useState(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState('');
  const [employees, setEmployees] = useState([]);
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    const tasksRef = ref(database, 'tasks');
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tasksList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(task => 
          task.department === 'graphics' && 
          task.assignedBy === 'Project Team Leader'
        );
        setTasks(tasksList);
      } else {
        setTasks([]);
      }
    });

    // Fetch employees
    const employeesRef = ref(database, 'employees');
    onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const employeesList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(emp => emp.department === 'graphics' && emp.status === 'active');
        setEmployees(employeesList);
      } else {
        setEmployees([]);
      }
    });
  }, []);

  const handleAssignToTeamMember = () => {
    if (!selectedTaskForAssignment || !selectedTeamMember) {
      showToast('Please select a team member', 'warning');
      return;
    }

    const taskRef = ref(database, `tasks/${selectedTaskForAssignment.id}`);
    update(taskRef, {
      assignedTo: selectedTeamMember,
      status: 'assigned',
      assignedToMemberAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    showToast(`Task "${selectedTaskForAssignment.taskName}" assigned to ${selectedTeamMember}!`, 'success');
    setShowAssignMemberModal(false);
    setSelectedTaskForAssignment(null);
    setSelectedTeamMember('');
  };

  const getStatusIcon = (status) => {
    if (status === 'posted' || status === 'approved') return <CheckCircle size={18} color="green" />;
    if (status === 'revision-required') return <XCircle size={18} color="red" />;
    if (status === 'in-progress') return <Clock size={18} color="orange" />;
    return <Clock size={18} color="gray" />;
  };

  const getStatusColor = (status) => {
    switch(status) {
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
      case 'assigned':
        return '#6c757d';
      default:
        return '#95a5a6';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const taskDate = task.deadline;
    return taskDate && taskDate.startsWith(selectedMonth);
  });

  const stats = {
    total: tasks.length,
    unassigned: tasks.filter(t => !t.assignedTo || t.status === 'assigned-to-department').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pendingApproval: tasks.filter(t => t.status === 'pending-client-approval').length
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
  };

  return (
    <div className="dashboard">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="dashboard-header">
        <div className="header-left">
          <Image size={32} />
          <div>
            <h1>🎨 Graphics Team Dashboard</h1>
            <p>Manage graphics team tasks and assign to team members</p>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={20} /> Logout
        </button>
      </div>

      {/* Month Filter */}
      <div className="filters-bar">
        <div className="filter-group">
          <Calendar size={18} />
          <label>Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
        <div className="filter-info">
          <span>{new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-row" style={{marginBottom: '25px'}}>
        <div className="stat-card stat-total">
          <h3>{stats.total}</h3>
          <p>Total Tasks</p>
        </div>
        <div className="stat-card" style={{backgroundColor: '#6c757d', color: 'white'}}>
          <h3>{stats.unassigned}</h3>
          <p>Unassigned</p>
        </div>
        <div className="stat-card" style={{backgroundColor: '#ffc107', color: 'white'}}>
          <h3>{stats.inProgress}</h3>
          <p>In Progress</p>
        </div>
        <div className="stat-card stat-progress">
          <h3>{stats.completed}</h3>
          <p>Completed</p>
        </div>
        <div className="stat-card stat-pending">
          <h3>{stats.pendingApproval}</h3>
          <p>Pending Approval</p>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="card full-width">
        <div className="card-header">
          <h2>Graphics Team Tasks ({filteredTasks.length})</h2>
        </div>
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks assigned to Graphics team for this month.</p>
          </div>
        ) : (
          <div style={{overflowX: 'auto', padding: '20px'}}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              borderRadius: '8px'
            }}>
              <thead>
                <tr style={{backgroundColor: '#3498db', color: 'white'}}>
                  <th style={{padding: '16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase'}}>Task Name</th>
                  <th style={{padding: '16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase'}}>Client</th>
                  <th style={{padding: '16px', textAlign: 'center', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase'}}>Assigned To</th>
                  <th style={{padding: '16px', textAlign: 'center', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase'}}>Deadline</th>
                  <th style={{padding: '16px', textAlign: 'center', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase'}}>Status</th>
                  <th style={{padding: '16px', textAlign: 'center', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, index) => (
                  <tr key={task.id} style={{
                    borderBottom: index < filteredTasks.length - 1 ? '1px solid #e9ecef' : 'none',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                  >
                    <td style={{padding: '14px 16px', textAlign: 'left', color: '#212529', fontSize: '14px', fontWeight: '500'}}>
                      {task.taskName}
                      {task.description && (
                        <p style={{fontSize: '12px', color: '#6c757d', margin: '4px 0 0 0'}}>{task.description}</p>
                      )}
                    </td>
                    <td style={{padding: '14px 16px', textAlign: 'left', color: '#495057', fontSize: '14px'}}>
                      {task.clientName || task.projectName || '-'}
                    </td>
                    <td style={{padding: '14px 16px', textAlign: 'center', fontSize: '13px'}}>
                      {task.assignedTo ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          backgroundColor: '#e3f2fd',
                          borderRadius: '6px',
                          color: '#1976d2',
                          fontWeight: '500'
                        }}>
                          <User size={14} />
                          {task.assignedTo}
                        </span>
                      ) : (
                        <span style={{color: '#999', fontStyle: 'italic'}}>Unassigned</span>
                      )}
                    </td>
                    <td style={{padding: '14px 16px', textAlign: 'center', color: '#495057', fontSize: '13px'}}>
                      {task.deadline ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Calendar size={14} />
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{padding: '14px 16px', textAlign: 'center'}}>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: getStatusColor(task.status),
                        color: 'white'
                      }}>
                        {task.status.replace(/-/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{padding: '14px 16px', textAlign: 'center'}}>
                      {(!task.assignedTo || task.status === 'assigned-to-department' || task.status === 'assigned') && (
                        <button
                          onClick={() => {
                            setSelectedTaskForAssignment(task);
                            setShowAssignMemberModal(true);
                          }}
                          style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <User size={14} /> Assign Member
                        </button>
                      )}
                      {task.assignedTo && task.status !== 'assigned' && task.status !== 'assigned-to-department' && (
                        <span style={{
                          padding: '8px 16px',
                          backgroundColor: '#e7f3ff',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#0066cc',
                          fontWeight: '500'
                        }}>
                          In Progress
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team Member Assignment Modal */}
      {showAssignMemberModal && selectedTaskForAssignment && (
        <div className="day-plan-modal">
          <div className="day-plan-content" style={{maxWidth: '500px'}}>
            <div className="day-plan-header">
              <h2>👤 Assign Task to Graphics Team Member</h2>
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
            <div style={{padding: '20px'}}>
              <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px'}}>
                <h3 style={{margin: '0 0 10px 0', fontSize: '16px'}}>{selectedTaskForAssignment.taskName}</h3>
                <p style={{margin: '5px 0', fontSize: '14px', color: '#666'}}>
                  <strong>Client:</strong> {selectedTaskForAssignment.clientName}
                </p>
                <p style={{margin: '5px 0', fontSize: '14px', color: '#666'}}>
                  <strong>Deadline:</strong> {new Date(selectedTaskForAssignment.deadline).toLocaleDateString()}
                </p>
              </div>

              <div className="form-group">
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                  Select Graphics Team Member *
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
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.employeeName}>
                      {emp.employeeName}
                    </option>
                  ))}
                  {employees.length === 0 && (
                    <option disabled>No graphics employees available</option>
                  )}
                </select>
                {employees.length === 0 && (
                  <p style={{fontSize: '12px', color: '#dc3545', marginTop: '8px', fontWeight: '500'}}>
                    ⚠️ No graphics employees found. Please add employees first.
                  </p>
                )}
              </div>

              <div style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
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
    </div>
  );
};

export default GraphicsTeam;
