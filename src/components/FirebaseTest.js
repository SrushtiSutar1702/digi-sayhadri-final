import React, { useEffect, useState } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';

const FirebaseTest = () => {
  const [status, setStatus] = useState('Testing...');
  const [details, setDetails] = useState([]);

  useEffect(() => {
    const testFirebase = async () => {
      const results = [];

      // Test 1: Check if database exists
      results.push({
        test: 'Database Object',
        status: database ? '✅ Pass' : '❌ Fail',
        details: database ? 'Database object exists' : 'Database object is undefined'
      });

      if (!database) {
        setStatus('❌ Firebase Not Initialized');
        setDetails(results);
        return;
      }

      // Test 2: Try to read from database
      try {
        const tasksRef = ref(database, 'tasks');
        const snapshot = await get(tasksRef);
        results.push({
          test: 'Read Tasks',
          status: '✅ Pass',
          details: `Found ${snapshot.exists() ? Object.keys(snapshot.val()).length : 0} tasks`
        });
      } catch (error) {
        results.push({
          test: 'Read Tasks',
          status: '❌ Fail',
          details: error.message
        });
      }

      // Test 3: Try to read clients
      try {
        const clientsRef = ref(database, 'clients');
        const snapshot = await get(clientsRef);
        results.push({
          test: 'Read Clients',
          status: '✅ Pass',
          details: `Found ${snapshot.exists() ? Object.keys(snapshot.val()).length : 0} clients`
        });
      } catch (error) {
        results.push({
          test: 'Read Clients',
          status: '❌ Fail',
          details: error.message
        });
      }

      setStatus('✅ Tests Complete');
      setDetails(results);
    };

    testFirebase();
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔥 Firebase Connection Test</h1>
      <h2>{status}</h2>

      <div style={{ marginTop: '20px' }}>
        {details.map((result, index) => (
          <div key={index} style={{
            padding: '15px',
            margin: '10px 0',
            background: '#f8f9fa',
            borderRadius: '8px',
            borderLeft: `4px solid ${result.status.includes('✅') ? '#10b981' : '#ef4444'}`
          }}>
            <h3>{result.test}: {result.status}</h3>
            <p style={{ color: '#666', margin: '5px 0 0 0' }}>{result.details}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => window.location.href = '/production-incharge'}
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Go to Production Incharge
      </button>
    </div>
  );
};

export default FirebaseTest;
