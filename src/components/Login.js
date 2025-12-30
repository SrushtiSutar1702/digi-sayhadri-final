import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Trigger entrance animation
    setIsMounted(true);
  }, []);

  // Function to determine dashboard based on email
  const getDashboardRoute = (userEmail) => {
    const emailLower = userEmail.toLowerCase();
    
    if (emailLower === 'superadmin@gmail.com') {
      return '/superadmin';
    } else if (emailLower === 'proin@gmail.com' || emailLower === 'productionincharge@gmail.com') {
      return '/production-incharge';
    } else if (emailLower === 'projectincharge@gmail.com') {
      return '/project-incharge';
    } else if (emailLower === 'teamleader@gmail.com') {
      return '/team-leader';
    } else if (emailLower === 'projectteamleader@gmail.com') {
      return '/project-team-leader';
    } else if (emailLower === 'social@gmail.com') {
      return '/social-media';
    } else if (emailLower === 'graphics@gmail.com') {
      return '/graphics';
    } else if (emailLower === 'videoteam@gmail.com' || emailLower === 'projectvideo@gmail.com') {
      return '/video-team';
    } else if (emailLower === 'graphicsteam@gmail.com' || emailLower === 'projectgraphics@gmail.com') {
      return '/graphics-team';
    } else if (emailLower === 'projectsocial@gmail.com') {
      return '/social-media-team';
    } else if (emailLower === 'employee@gmail.com') {
      return '/employee';
    } else if (emailLower === 'strategy@gmail.com') {
      return '/strategy';
    } else if (emailLower === 'head@gmail.com') {
      return '/strategy-head';
    } else if (emailLower === 'video@gmail.com') {
      return '/video';
    } else if (emailLower === 'admin@gmail.com') {
      return '/production-incharge';
    } else if (emailLower.includes('videoemp') || emailLower.includes('graphicemp')) {
      return '/employee';
    } else if (emailLower === 'socialemp@gmail.com' || emailLower.includes('socialemp')) {
      return '/social-media-employee';
    } else {
      return '/employee';
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // First, check if this is an employee login (from employees database)
      const { ref: dbRef, get: dbGet } = await import('firebase/database');
      const { database } = await import('../firebase');
      
      if (database) {
        const employeesRef = dbRef(database, 'employees');
        const snapshot = await dbGet(employeesRef);
        
        if (snapshot.exists()) {
          const employees = snapshot.val();
          const employee = Object.values(employees).find(emp => emp.email === email);
          
          // If employee found in database
          if (employee) {
            // Check if employee account is disabled
            if (employee.status === 'inactive') {
              setError('Your account has been disabled. Please contact the administrator.');
              setLoading(false);
              return;
            }
            
            // Verify password
            if (employee.password === password) {
              // Store employee info in sessionStorage
              sessionStorage.setItem('employeeData', JSON.stringify(employee));
              sessionStorage.setItem('employeeName', employee.employeeName);
              
              console.log('Main Login - Employee data:', employee);
              console.log('Main Login - Role:', employee.role);
              console.log('Main Login - Department:', employee.department);
              
              // Route based on department and role
              const dept = employee.department ? employee.department.toLowerCase() : '';
              const role = employee.role || 'employee';
              
              if (dept.includes('strategy')) {
                // Store strategy-specific employee data
                sessionStorage.setItem('strategyEmployee', JSON.stringify(employee));
                
                if (role === 'head') {
                  console.log('✅ Routing to Strategy Head Dashboard');
                  navigate('/strategy-head');
                } else {
                  console.log('➡️ Routing to Strategy Dashboard');
                  navigate('/strategy');
                }
                return;
              } else if (dept.includes('social') || dept.includes('media')) {
                // Store for social media dashboard
                localStorage.setItem('socialMediaEmployeeName', employee.employeeName || employee.name);
                localStorage.setItem('socialMediaEmployeeEmail', employee.email);
                
                if (role === 'head') {
                  console.log('✅ Routing to Social Media Dashboard (Head)');
                  navigate('/social-media');
                } else {
                  console.log('➡️ Routing to Social Media Employee Dashboard');
                  navigate('/social-media-employee');
                }
                return;
              } else if (dept.includes('graphics')) {
                sessionStorage.setItem('employeeDepartment', 'graphics');
                sessionStorage.setItem('employeeName', employee.employeeName || employee.name);
                sessionStorage.setItem('employeeData', JSON.stringify(employee));
                
                if (role === 'head') {
                  console.log('✅ Routing to Graphics Dashboard (Head)');
                  navigate('/graphics');
                } else {
                  console.log('➡️ Routing to Employee Dashboard (Graphics)');
                  navigate('/employee');
                }
                return;
              } else if (dept.includes('video')) {
                sessionStorage.setItem('employeeDepartment', 'video');
                sessionStorage.setItem('employeeName', employee.employeeName || employee.name);
                sessionStorage.setItem('employeeData', JSON.stringify(employee));
                
                if (role === 'head') {
                  console.log('✅ Routing to Video Dashboard (Head)');
                  navigate('/video');
                } else {
                  console.log('➡️ Routing to Employee Dashboard (Video)');
                  navigate('/employee');
                }
                return;
              } else if (dept.includes('production')) {
                // Production Incharge employees (all roles go to Production Incharge dashboard)
                sessionStorage.setItem('productionEmail', employee.email);
                sessionStorage.setItem('productionName', employee.employeeName || employee.name);
                console.log('✅ Routing to Production Incharge Dashboard');
                navigate('/production-incharge');
                return;
              } else {
                console.log('➡️ Routing to Default Employee Dashboard');
                navigate('/employee'); // Default employee dashboard
                return;
              }
            } else {
              setError('Invalid password. Please check your password.');
              setLoading(false);
              return;
            }
          }
        }
      }
      
      // If not an employee, try Firebase Auth for dashboard users
      try {
        await signInWithEmailAndPassword(auth, email, password);
        
        // Store email and name for dashboard users
        const emailLower = email.toLowerCase();
        sessionStorage.setItem('employeeEmail', email);
        
        // Set appropriate name based on email
        if (emailLower === 'video@gmail.com') {
          sessionStorage.setItem('employeeName', 'Video Head');
        } else if (emailLower === 'graphics@gmail.com') {
          sessionStorage.setItem('employeeName', 'Graphics Head');
        } else if (emailLower === 'social@gmail.com') {
          sessionStorage.setItem('employeeName', 'Social Media Head');
        } else if (emailLower === 'strategy@gmail.com') {
          sessionStorage.setItem('employeeName', 'Strategy Head');
        } else if (emailLower === 'proin@gmail.com' || emailLower === 'productionincharge@gmail.com') {
          sessionStorage.setItem('employeeName', 'Production Incharge');
          sessionStorage.setItem('productionEmail', email);
        } else if (emailLower === 'superadmin@gmail.com') {
          sessionStorage.setItem('employeeName', 'Super Admin');
        } else {
          // Extract name from email (before @)
          const name = email.split('@')[0];
          sessionStorage.setItem('employeeName', name.charAt(0).toUpperCase() + name.slice(1));
        }
        
        const route = getDashboardRoute(email);
        navigate(route);
      } catch (authError) {
        setError('Invalid credentials. Please check your email and password.');
        console.error('Login error:', authError);
      }
    } catch (error) {
      setError('Login error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Animated background elements */}
      <div className="floating-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>
      
      <div className={`login-card ${isMounted ? 'card-visible' : ''}`}>
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-pulse"></div>
            <h1>Welcome Back!</h1>
          </div>
          <p>Sign in to your account</p>
        </div>
        
        <form onSubmit={handleLogin} autoComplete="off" className="login-form">
          <div className="form-group">
            <label className="label-animate">Username or Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              autoComplete="off"
              name="email-login"
              className="input-animate"
            />
          </div>
          
          <div className="form-group">
            <label className="label-animate">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                autoComplete="new-password"
                name="password-login"
                className="input-animate"
                style={{ paddingRight: '45px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  // Eye slash icon (hide password)
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  // Eye icon (show password)
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
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
      </div>
    </div>
  );
};

export default Login;