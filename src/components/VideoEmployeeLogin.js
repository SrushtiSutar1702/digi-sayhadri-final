import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '../firebase';
import { ref, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const VideoEmployeeLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check employee in database first
      if (database) {
        const employeesRef = ref(database, 'employees');
        const snapshot = await get(employeesRef);

        if (snapshot.exists()) {
          const employees = snapshot.val();
          const employee = Object.values(employees).find(emp => emp.email === email);

          if (employee) {
            // Check if employee is inactive
            if (employee.status === 'inactive') {
              setError('Your account has been disabled. Please contact the administrator.');
              return;
            }

            // Check if password matches
            if (employee.password === password) {
              // Check if Video Department employee
              const dept = employee.department ? employee.department.toLowerCase() : '';
              if (dept.includes('video')) {
                // Valid Video employee
                // Try Firebase Auth, if fails, still allow login
                try {
                  await signInWithEmailAndPassword(auth, email, password);
                } catch (authError) {
                  console.log('Firebase Auth not set up for this employee, using database auth');
                }
                
                // Store employee info in sessionStorage for the dashboard to use
                sessionStorage.setItem('employeeData', JSON.stringify({
                  ...employee,
                  department: 'video'
                }));
                sessionStorage.setItem('employeeName', employee.employeeName);
                sessionStorage.setItem('employeeDepartment', 'video');
                
                // Check role and route accordingly
                console.log('Video Employee Login - Employee data:', employee);
                console.log('Video Employee Login - Role:', employee.role);
                
                if (employee.role === 'head') {
                  console.log('Routing to Video Dashboard (Head)');
                  // Route to Video Dashboard (Head Dashboard)
                  navigate('/video');
                } else {
                  console.log('Routing to Employee Dashboard');
                  // Route to Employee Dashboard
                  navigate('/employee');
                }
                return;
              } else {
                setError('You are not authorized to access Video Employee Dashboard');
                return;
              }
            } else {
              setError('Invalid password. Please check your password.');
              return;
            }
          } else {
            setError('Employee not found. Please check your email.');
            return;
          }
        }
      }

      setError('Unable to connect to database');
    } catch (error) {
      setError('Login error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="floating-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>

      <div className="login-card card-visible">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-pulse"></div>
            <h1>Video Department</h1>
          </div>
          <p>Employee Login</p>
        </div>

        <form onSubmit={handleLogin} autoComplete="off" className="login-form">
          <div className="form-group">
            <label className="label-animate">Employee Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your employee email"
              required
              disabled={loading}
              autoComplete="off"
              className="input-animate"
            />
          </div>

          <div className="form-group">
            <label className="label-animate">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              autoComplete="new-password"
              className="input-animate"
            />
          </div>

          {error && (
            <div className="error-message shake-animation">
              {error}
            </div>
          )}

          <button
            type="submit"
            className={`login-btn ${loading ? 'btn-loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span className="btn-text">Logging in...</span>
              </>
            ) : (
              <span className="btn-text">LOGIN</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline'
            }}
          >
            ← Back to Main Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoEmployeeLogin;
