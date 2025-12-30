import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../firebase';
import { AlertCircle, X, CheckCircle, Bell } from 'lucide-react';

const RevisionNotificationPopup = ({ employeeName, department }) => {
  const [revisionTasks, setRevisionTasks] = useState([]);
  const [acknowledgedTasks, setAcknowledgedTasks] = useState(new Set());

  useEffect(() => {
    if (!employeeName || !department) return;

    const tasksRef = ref(database, 'tasks');
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tasksList = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(task => {
            // Show tasks that:
            // 1. Are in revision-required status
            // 2. Were submitted by this employee
            // 3. Have a revision message
            // 4. Haven't been acknowledged yet
            const isMyTask = task.submittedBy === employeeName || task.assignedTo === employeeName;
            const isRevisionRequired = task.status === 'revision-required';
            const hasRevisionMessage = task.revisionMessage && task.revisionMessage.trim() !== '';
            const notAcknowledged = !task.revisionAcknowledged || task.revisionAcknowledged === false;
            const isCorrectDepartment = task.originalDepartment === department || task.department === department;
            
            return isMyTask && isRevisionRequired && hasRevisionMessage && notAcknowledged && isCorrectDepartment;
          });
        
        setRevisionTasks(tasksList);
      } else {
        setRevisionTasks([]);
      }
    });

    return () => unsubscribe();
  }, [employeeName, department]);

  const handleAcknowledge = async (taskId) => {
    try {
      const taskRef = ref(database, `tasks/${taskId}`);
      await update(taskRef, {
        revisionAcknowledged: true,
        revisionAcknowledgedAt: new Date().toISOString(),
        revisionAcknowledgedBy: employeeName,
        lastUpdated: new Date().toISOString()
      });
      
      // Add to acknowledged set for immediate UI update
      setAcknowledgedTasks(prev => new Set([...prev, taskId]));
    } catch (error) {
      console.error('Error acknowledging revision:', error);
    }
  };

  // Filter out acknowledged tasks
  const visibleTasks = revisionTasks.filter(task => !acknowledgedTasks.has(task.id));

  if (visibleTasks.length === 0) return null;

  return (
    <>
      {visibleTasks.map((task, index) => (
        <div
          key={task.id}
          style={{
            position: 'fixed',
            top: `${80 + (index * 10)}px`,
            right: '24px',
            width: '420px',
            maxWidth: '90vw',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(239, 68, 68, 0.4), 0 0 0 3px rgba(239, 68, 68, 0.2)',
            zIndex: 10000 + index,
            animation: 'slideInRight 0.5s ease-out, pulse 2s ease-in-out infinite',
            overflow: 'hidden'
          }}
        >
          {/* Animated Border */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #ef4444, #dc2626, #ef4444)',
            backgroundSize: '200% 100%',
            animation: 'gradientMove 2s linear infinite'
          }} />

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'bellRing 1s ease-in-out infinite'
            }}>
              <Bell size={20} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '700',
                color: 'white'
              }}>
                🔔 Revision Required!
              </h3>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.9)',
                fontWeight: '500'
              }}>
                Task needs your attention
              </p>
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '700',
              color: 'white'
            }}>
              {task.revisionCount || 1}
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '20px' }}>
            {/* Task Info */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: '600',
                textTransform: 'uppercase',
                marginBottom: '6px',
                letterSpacing: '0.5px'
              }}>
                Task Name
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                {task.taskName}
              </div>
              <div style={{
                display: 'flex',
                gap: '12px',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                <span>
                  <strong>Client:</strong> {task.clientName}
                </span>
                <span>•</span>
                <span>
                  <strong>Project:</strong> {task.projectName}
                </span>
              </div>
            </div>

            {/* Revision Message */}
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #fbbf24',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#92400e',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Revision Feedback
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#78350f',
                    lineHeight: '1.6',
                    fontWeight: '500'
                  }}>
                    {task.revisionMessage}
                  </div>
                </div>
              </div>
            </div>

            {/* Requested By */}
            {task.revisionRequestedBy && (
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '16px',
                fontStyle: 'italic'
              }}>
                Requested by: <strong>{task.revisionRequestedBy}</strong>
                {task.lastRevisionAt && (
                  <span> • {new Date(task.lastRevisionAt).toLocaleString()}</span>
                )}
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={() => handleAcknowledge(task.id)}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
              }}
            >
              <CheckCircle size={18} />
              I Understand - Start Working
            </button>
          </div>
        </div>
      ))}

      {/* Animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(500px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 20px 60px rgba(239, 68, 68, 0.4), 0 0 0 3px rgba(239, 68, 68, 0.2);
          }
          50% {
            box-shadow: 0 20px 60px rgba(239, 68, 68, 0.6), 0 0 0 6px rgba(239, 68, 68, 0.3);
          }
        }

        @keyframes gradientMove {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }

        @keyframes bellRing {
          0%, 100% {
            transform: rotate(0deg);
          }
          10%, 30% {
            transform: rotate(-10deg);
          }
          20%, 40% {
            transform: rotate(10deg);
          }
          50% {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </>
  );
};

export default RevisionNotificationPopup;
