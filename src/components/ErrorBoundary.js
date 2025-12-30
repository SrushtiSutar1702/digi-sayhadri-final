import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error caught by ErrorBoundary:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Log specific error types
    if (error.message.includes('Firebase')) {
      console.error('🔥 This appears to be a Firebase-related error');
    }
    if (error.message.includes('database')) {
      console.error('💾 This appears to be a database-related error');
    }
    if (error.message.includes('auth')) {
      console.error('🔐 This appears to be an authentication-related error');
    }
    
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h1 style={{ color: '#e74c3c' }}>⚠️ Something went wrong</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Please check the following:
          </p>
          <div style={{
            background: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'left',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <h3>Common Issues:</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li>✓ Firebase Realtime Database is enabled</li>
              <li>✓ Firebase Authentication (Email/Password) is enabled</li>
              <li>✓ Database URL in src/firebase.js is correct</li>
              <li>✓ Database rules allow read/write access</li>
              <li>✓ Test users are created in Firebase Authentication</li>
            </ul>
          </div>
          <details style={{ marginTop: '20px', textAlign: 'left', maxWidth: '600px', margin: '20px auto' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Show Error Details
            </summary>
            <pre style={{
              background: '#fee',
              padding: '15px',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '12px',
              marginTop: '10px'
            }}>
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;


