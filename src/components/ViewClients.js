import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, get } from 'firebase/database';
import { database, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Calendar, LogOut, Plus, UserPlus, Upload, Search, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './Toast';
import './ProductionIncharge.css';

const ViewClients = () => {
    const navigate = useNavigate();
    const { toasts, showToast, removeToast } = useToast();
    const [clients, setClients] = useState([]);
    const [clientListSearch, setClientListSearch] = useState('');
    const [selectedClients, setSelectedClients] = useState(new Set());
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showAddClientForm, setShowAddClientForm] = useState(false);
    const [newClient, setNewClient] = useState({
        clientId: '',
        clientName: '',
        contactNumber: '',
        email: '',
        videoInstructions: '',
        graphicsInstructions: ''
    });

    // Helper function to get only active clients
    const getActiveClients = () => {
        return clients.filter(client => {
            if (!client || !client.clientName) {
                console.warn('Invalid client data found:', client);
                return false;
            }
            return (client.status || 'active') === 'active';
        });
    };

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

    // Firebase data loading - Load clients
    useEffect(() => {
        console.log('ViewClients: Setting up Firebase listeners');
        console.log('ViewClients: Database object:', database);
        console.log('ViewClients: Auth state:', auth.currentUser ? `Authenticated as ${auth.currentUser.email}` : 'Not authenticated');

        if (!database) {
            console.error('ViewClients: Database is not initialized!');
            showToast('❌ Database connection error. Please refresh the page.', 'error', 5000);
            return;
        }

        const clientsRef = ref(database, 'clients');
        const unsubscribeClients = onValue(clientsRef, (snapshot) => {
            console.log('ViewClients: Loading clients from Firebase...');
            const data = snapshot.val();
            console.log('ViewClients: Raw clients data:', data);

            if (data) {
                const clientsArray = Object.keys(data)
                    .map(key => ({
                        id: key,
                        ...data[key]
                    }))
                    .filter(client => !client.deleted); // Filter out deleted clients

                console.log('ViewClients: Clients loaded:', clientsArray.length, clientsArray);
                setClients(clientsArray);
            } else {
                console.log('ViewClients: No clients found in database');
                setClients([]);
            }
        });

        return () => {
            unsubscribeClients();
        };
    }, []);

    // Auto-generate Client ID when Add Client form opens
    useEffect(() => {
        if (showAddClientForm) {
            console.log('Auto-generating client ID, current clients:', clients.length);

            if (clients.length === 0) {
                // First client
                setNewClient(prev => ({
                    ...prev,
                    clientId: '1'
                }));
                console.log('First client, setting ID to 1');
            } else {
                // Find the highest numeric client ID
                const numericIds = clients
                    .map(client => {
                        const id = client.clientId;
                        // Extract number from clientId (e.g., "1", "2", "CLI001" -> 1)
                        const match = id?.match(/\d+/);
                        return match ? parseInt(match[0]) : 0;
                    })
                    .filter(num => !isNaN(num));

                console.log('Numeric IDs found:', numericIds);

                const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
                const nextId = maxId + 1;

                console.log('Next client ID will be:', nextId);

                setNewClient(prev => ({
                    ...prev,
                    clientId: String(nextId)
                }));
            }
        }
    }, [showAddClientForm, clients]);

    // Handle adding new client
    const handleAddClient = async (e) => {
        e.preventDefault();

        console.log('handleAddClient called with data:', newClient);

        if (!database) {
            console.error('Database not available');
            showToast('❌ Database not available', 'error', 3000);
            return;
        }

        // Validate required fields
        if (!newClient.clientName || !newClient.clientName.trim()) {
            showToast('❌ Client name is required', 'error', 3000);
            return;
        }

        if (!newClient.contactNumber || newClient.contactNumber.length !== 10) {
            showToast('❌ Contact number must be exactly 10 digits', 'error', 3000);
            return;
        }

        if (!newClient.email || !newClient.email.trim()) {
            showToast('❌ Email is required', 'error', 3000);
            return;
        }

        try {
            console.log('Attempting to add client to Firebase...');
            const clientsRef = ref(database, 'clients');

            const clientData = {
                clientId: newClient.clientId,
                clientName: newClient.clientName.trim(),
                contactNumber: newClient.contactNumber,
                email: newClient.email.trim(),
                videoInstructions: newClient.videoInstructions || '',
                graphicsInstructions: newClient.graphicsInstructions || '',
                createdAt: new Date().toISOString(),
                createdBy: 'Production Incharge',
                status: 'active'
            };

            console.log('Client data to be saved:', clientData);

            const newClientRef = await push(clientsRef, clientData);
            console.log('Client added successfully with ID:', newClientRef.key);

            showToast(`✅ Client ${newClient.clientName} added successfully!`, 'success', 3000);

            // Reset form
            setNewClient({
                clientId: '',
                clientName: '',
                contactNumber: '',
                email: '',
                videoInstructions: '',
                graphicsInstructions: ''
            });
            setShowAddClientForm(false);
        } catch (error) {
            console.error('Error adding client:', error);
            console.error('Error details:', error.message, error.code);

            // Check if it's a permission error
            if (error.code === 'PERMISSION_DENIED' || error.message.includes('Permission denied')) {
                showToast('🚨 PERMISSION DENIED: Please update Firebase Database Rules. Check console for instructions.', 'error', 8000);
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('🚨 FIREBASE PERMISSION ERROR');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('');
                console.error('SOLUTION:');
                console.error('1. Go to: https://console.firebase.google.com/');
                console.error('2. Select project: dsayhadri');
                console.error('3. Click: Realtime Database → Rules tab');
                console.error('4. Replace rules with:');
                console.error('');
                console.error(JSON.stringify({
                    "rules": {
                        ".read": "auth != null",
                        ".write": "auth != null"
                    }
                }, null, 2));
                console.error('');
                console.error('5. Click PUBLISH button');
                console.error('6. Try adding client again');
                console.error('');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            } else {
                showToast(`❌ Error adding client: ${error.message}`, 'error', 4000);
            }
        }
    };

    // Handle logout
    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Handle client status toggle
    const handleClientStatusToggle = async (clientId, currentStatus) => {
        if (!database) {
            showToast('❌ Database not available', 'error', 3000);
            return;
        }

        try {
            // Find the client in the database
            const clientRef = ref(database, 'clients');
            const snapshot = await get(clientRef);
            if (snapshot.exists()) {
                const clientsData = snapshot.val();
                let clientKey = null;
                // Find the client key by clientId
                for (const [key, client] of Object.entries(clientsData)) {
                    if (client.clientId === clientId) {
                        clientKey = key;
                        break;
                    }
                }
                if (clientKey) {
                    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
                    const specificClientRef = ref(database, `clients/${clientKey}`);
                    await update(specificClientRef, {
                        status: newStatus,
                        lastStatusUpdate: new Date().toISOString(),
                        statusUpdatedBy: 'Production Incharge'
                    });
                    const statusText = newStatus === 'active' ? 'activated' : 'deactivated';
                    showToast(`✅ Client ${statusText} successfully!`, 'success', 3000);
                } else {
                    showToast('❌ Client not found', 'error', 3000);
                }
            }
        } catch (error) {
            console.error('Error updating client status:', error);
            showToast('❌ Error updating client status', 'error', 3000);
        }
    };

    // Handle sending specific client to Strategy Head
    const handleSendClientToStrategyHead = async (clientId, clientName) => {
        if (!database) {
            showToast('❌ Database not available', 'error', 3000);
            return;
        }

        try {
            // Find the client in the database
            const clientRef = ref(database, 'clients');
            const snapshot = await get(clientRef);

            if (!snapshot.exists()) {
                showToast('❌ No clients found in database', 'error', 3000);
                return;
            }

            const clientsData = snapshot.val();
            let clientKey = null;
            let clientData = null;

            // Find the client by clientId or clientName
            for (const [key, client] of Object.entries(clientsData)) {
                if (client.clientId === clientId || client.clientName === clientName) {
                    clientKey = key;
                    clientData = client;
                    break;
                }
            }

            if (!clientKey || !clientData) {
                showToast('❌ Client not found in database', 'error', 3000);
                return;
            }

            // Check if already sent
            if (clientData.sentToStrategyHead === true) {
                showToast(`⚠️ ${clientName} has already been sent to Strategy Head`, 'warning', 3000);
                return;
            }

            // Get all tasks for this client
            const tasksRef = ref(database, 'tasks');
            const tasksSnapshot = await get(tasksRef);
            let clientTasks = [];

            if (tasksSnapshot.exists()) {
                const tasksData = tasksSnapshot.val();
                clientTasks = Object.entries(tasksData)
                    .filter(([_, task]) =>
                        (task.clientId === clientId || task.clientName === clientName) &&
                        !task.deleted
                    )
                    .map(([key, task]) => ({ id: key, ...task }));
            }

            // Update client to mark as sent to Strategy Head
            const specificClientRef = ref(database, `clients/${clientKey}`);
            await update(specificClientRef, {
                sentToStrategyHead: true,
                sentToStrategyHeadDate: new Date().toISOString(),
                sentToStrategyHeadBy: 'Production Incharge'
            });

            // Add client to strategyHeadClients with all the new fields
            const strategyHeadClientsRef = ref(database, 'strategyHeadClients');
            await push(strategyHeadClientsRef, {
                clientId: clientData.clientId,
                clientName: clientData.clientName,
                contactNumber: clientData.contactNumber || '',
                email: clientData.email || '',
                ideas: clientData.ideas || '',
                content: clientData.content || '',
                reference: clientData.reference || '',
                specialNotes: clientData.specialNotes || '',
                department: clientData.department || '',
                type: clientData.type || '',
                postDate: clientData.postDate || '',
                videoInstructions: clientData.videoInstructions || '',
                graphicsInstructions: clientData.graphicsInstructions || '',
                sentAt: new Date().toISOString(),
                sentBy: 'Production Incharge',
                status: 'active',
                stage: 'information-gathering',
                taskCount: clientTasks.length
            });

            const taskMessage = clientTasks.length > 0 ? ` and ${clientTasks.length} task(s)` : '';
            showToast(`✅ ${clientName}${taskMessage} sent to Strategy Head successfully!`, 'success', 4000);
        } catch (error) {
            console.error('Error sending client to Strategy Head:', error);
            showToast('❌ Error sending client to Strategy Head', 'error', 3000);
        }
    };

    // Handle sending multiple selected clients to Strategy Head
    const handleSendSelectedClientsToStrategyHead = async () => {
        if (selectedClients.size === 0) {
            showToast('⚠️ Please select at least one client to send', 'warning', 3000);
            return;
        }

        if (!database) {
            showToast('❌ Database not available', 'error', 3000);
            return;
        }

        try {
            const clientRef = ref(database, 'clients');
            const snapshot = await get(clientRef);

            if (!snapshot.exists()) {
                showToast('❌ No clients found in database', 'error', 3000);
                return;
            }

            const clientsData = snapshot.val();
            const tasksRef = ref(database, 'tasks');
            const tasksSnapshot = await get(tasksRef);

            let successCount = 0;
            let alreadySentCount = 0;
            let totalTasks = 0;
            const sentClientNames = [];

            for (const clientId of selectedClients) {
                // Find client in database by ID
                let clientKey = clientId;
                let clientData = clientsData[clientId];

                if (!clientData) {
                    console.warn(`Client with ID ${clientId} not found in database`);
                    continue;
                }

                // Check if already sent
                if (clientData.sentToStrategyHead === true) {
                    alreadySentCount++;
                    continue;
                }

                // Get tasks for this client
                let clientTasks = [];
                if (tasksSnapshot.exists()) {
                    const tasksData = tasksSnapshot.val();
                    clientTasks = Object.entries(tasksData)
                        .filter(([_, task]) =>
                            (task.clientId === clientData.clientId || task.clientName === clientData.clientName) &&
                            !task.deleted
                        )
                        .map(([key, task]) => ({ id: key, ...task }));
                }

                // Update client
                const specificClientRef = ref(database, `clients/${clientKey}`);
                await update(specificClientRef, {
                    sentToStrategyHead: true,
                    sentToStrategyHeadDate: new Date().toISOString(),
                    sentToStrategyHeadBy: 'Production Incharge'
                });

                // Add to strategyHeadClients with all the new fields
                const strategyHeadClientsRef = ref(database, 'strategyHeadClients');
                await push(strategyHeadClientsRef, {
                    clientId: clientData.clientId,
                    clientName: clientData.clientName,
                    contactNumber: clientData.contactNumber || '',
                    email: clientData.email || '',
                    ideas: clientData.ideas || '',
                    content: clientData.content || '',
                    reference: clientData.reference || '',
                    specialNotes: clientData.specialNotes || '',
                    department: clientData.department || '',
                    type: clientData.type || '',
                    postDate: clientData.postDate || '',
                    videoInstructions: clientData.videoInstructions || '',
                    graphicsInstructions: clientData.graphicsInstructions || '',
                    sentAt: new Date().toISOString(),
                    sentBy: 'Production Incharge',
                    status: 'active',
                    stage: 'information-gathering',
                    taskCount: clientTasks.length
                });

                successCount++;
                totalTasks += clientTasks.length;
                sentClientNames.push(clientData.clientName);
            }

            // Clear selection
            setSelectedClients(new Set());

            // Show result message
            if (successCount > 0) {
                const message = `✅ Sent ${successCount} client(s) with ${totalTasks} task(s) to Strategy Head!`;
                showToast(message, 'success', 5000);
            }

            if (alreadySentCount > 0) {
                showToast(`ℹ️ ${alreadySentCount} client(s) were already sent`, 'info', 3000);
            }

            if (successCount === 0 && alreadySentCount === 0) {
                showToast('❌ No clients could be sent', 'error', 3000);
            }
        } catch (error) {
            console.error('Error sending selected clients:', error);
            showToast('❌ Error sending clients to Strategy Head', 'error', 3000);
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
                                    className="production-sidebar-menu-link active"
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
                                >
                                    <div className="production-sidebar-menu-icon">
                                        <UserPlus size={20} />
                                    </div>
                                    <span style={{ flex: 1 }}>
                                        View Clients
                                    </span>
                                    {getActiveClients().length > 0 && (
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
                                            {getActiveClients().length}
                                        </span>
                                    )}
                                </button>
                            </li>
                            <li className="production-sidebar-menu-item">
                                <button
                                    className="production-sidebar-menu-link"
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
                                    onClick={() => navigate('/production-incharge/view-employees')}
                                >
                                    <div className="production-sidebar-menu-icon">
                                        <UserPlus size={20} />
                                    </div>
                                    All Employees
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
                                <h1>View Clients</h1>
                                <p>Manage all clients and send them to Strategy Head</p>
                            </div>
                        </div>
                        <div className="production-header-right">
                            <div className="production-breadcrumb">
                                <span>Dashboard</span>
                                <span className="production-breadcrumb-separator">/</span>
                                <span>View Clients</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Clients List */}
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
                            alignItems: 'center',
                            borderTopLeftRadius: '16px',
                            borderTopRightRadius: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <UserPlus size={24} />
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>👥 Clients List</h2>
                            </div>
                            <button
                                onClick={() => setShowAddClientForm(true)}
                                style={{
                                    padding: '10px 20px',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                    border: '2px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                                    e.target.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                                    e.target.style.transform = 'translateY(0)';
                                }}
                            >
                                <Plus size={16} />
                                Add New Client
                            </button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            {/* Search and Stats Bar */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '20px',
                                gap: '16px',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    flex: 1,
                                    minWidth: '250px'
                                }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
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
                                            placeholder="Search clients by name, ID, email..."
                                            value={clientListSearch}
                                            onChange={(e) => setClientListSearch(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 16px 10px 40px',
                                                border: '2px solid #e5e7eb',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#4B49AC';
                                                e.target.style.boxShadow = '0 0 0 3px rgba(75, 73, 172, 0.1)';
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 16px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}>
                                    <UserPlus size={18} />
                                    <span>Total: {clients.length} {clients.length === 1 ? 'Client' : 'Clients'}</span>
                                </div>
                            </div>

                            {clients.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                                    <UserPlus size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                    <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No clients found</p>
                                    <p style={{ fontSize: '14px' }}>Add a client to get started.</p>
                                </div>
                            ) : (
                                <>
                                    {selectedClients.size > 0 && (
                                        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                            <button
                                                onClick={handleSendSelectedClientsToStrategyHead}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.target.style.transform = 'translateY(-2px)';
                                                    e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.target.style.transform = 'translateY(0)';
                                                    e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                                }}
                                            >
                                                <UserPlus size={16} />
                                                Send Selected to Strategy ({selectedClients.size})
                                            </button>
                                        </div>
                                    )}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '50px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedClients.size === getActiveClients().filter(c => c.sentToStrategyHead !== true).length && getActiveClients().filter(c => c.sentToStrategyHead !== true).length > 0}
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
                                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Contact Number</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Email</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Video Instructions</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Graphics Instructions</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Status</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {clients
                                                    .filter(client => {
                                                        if (!clientListSearch.trim()) return true;
                                                        const search = clientListSearch.toLowerCase();
                                                        return (
                                                            client.clientId?.toLowerCase().includes(search) ||
                                                            client.clientName?.toLowerCase().includes(search) ||
                                                            client.email?.toLowerCase().includes(search) ||
                                                            client.contactNumber?.includes(search)
                                                        );
                                                    })
                                                    .map((client, index) => (
                                                        <tr key={client.id} style={{
                                                            borderBottom: '1px solid #f3f4f6',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        >
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
                                                            <td style={{ padding: '12px', color: '#6366f1', fontWeight: '600' }}>{client.clientId}</td>
                                                            <td style={{ padding: '12px', color: '#374151', fontWeight: '500' }}>{client.clientName}</td>
                                                            <td style={{ padding: '12px', color: '#6b7280' }}>{client.contactNumber || 'N/A'}</td>
                                                            <td style={{ padding: '12px', color: '#6b7280' }}>{client.email || 'N/A'}</td>
                                                            <td style={{ padding: '12px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {client.videoInstructions || 'No instructions'}
                                                            </td>
                                                            <td style={{ padding: '12px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {client.graphicsInstructions || 'No instructions'}
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleClientStatusToggle(client.clientId, client.status || 'active');
                                                                    }}
                                                                    style={{
                                                                        position: 'relative',
                                                                        width: '50px',
                                                                        height: '24px',
                                                                        borderRadius: '12px',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.3s ease',
                                                                        backgroundColor: (client.status || 'active') === 'active' ? '#10b981' : '#ef4444',
                                                                        outline: 'none'
                                                                    }}
                                                                    title={`Click to ${(client.status || 'active') === 'active' ? 'deactivate' : 'activate'} client`}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '2px',
                                                                            left: (client.status || 'active') === 'active' ? '26px' : '2px',
                                                                            width: '20px',
                                                                            height: '20px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: 'white',
                                                                            transition: 'all 0.3s ease',
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                                        }}
                                                                    />
                                                                    <span
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '50%',
                                                                            left: (client.status || 'active') === 'active' ? '6px' : '30px',
                                                                            transform: 'translateY(-50%)',
                                                                            fontSize: '10px',
                                                                            fontWeight: '600',
                                                                            color: 'white',
                                                                            transition: 'all 0.3s ease'
                                                                        }}
                                                                    >
                                                                        {(client.status || 'active') === 'active' ? 'ON' : 'OFF'}
                                                                    </span>
                                                                </button>
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                {client.sentToStrategyHead === true ? (
                                                                    <span style={{
                                                                        padding: '6px 12px',
                                                                        backgroundColor: '#d1fae5',
                                                                        color: '#065f46',
                                                                        borderRadius: '6px',
                                                                        fontSize: '12px',
                                                                        fontWeight: '600'
                                                                    }}>
                                                                        ✓ Sent
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSendClientToStrategyHead(client.clientId, client.clientName);
                                                                        }}
                                                                        style={{
                                                                            padding: '6px 12px',
                                                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            borderRadius: '6px',
                                                                            fontSize: '12px',
                                                                            fontWeight: '600',
                                                                            cursor: 'pointer',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            transition: 'all 0.2s',
                                                                            boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            e.target.style.transform = 'translateY(-1px)';
                                                                            e.target.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            e.target.style.transform = 'translateY(0)';
                                                                            e.target.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                                                                        }}
                                                                    >
                                                                        <UserPlus size={14} />
                                                                        Send to Strategy
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {clients.filter(client => {
                                                    if (!clientListSearch.trim()) return true;
                                                    const search = clientListSearch.toLowerCase();
                                                    return (
                                                        client.clientId?.toLowerCase().includes(search) ||
                                                        client.clientName?.toLowerCase().includes(search) ||
                                                        client.email?.toLowerCase().includes(search) ||
                                                        client.contactNumber?.includes(search)
                                                    );
                                                }).length === 0 && clientListSearch.trim() && (
                                                        <tr>
                                                            <td colSpan="9" style={{
                                                                padding: '40px',
                                                                textAlign: 'center',
                                                                color: '#6b7280'
                                                            }}>
                                                                <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                                                <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                                                                    No clients found matching "{clientListSearch}"
                                                                </p>
                                                                <p style={{ fontSize: '13px' }}>
                                                                    Try a different search term
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Client Form Modal */}
            {showAddClientForm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '40px',
                        maxWidth: '650px',
                        width: '90%',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '24px'
                        }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: '24px',
                                fontWeight: '700',
                                color: '#1f2937'
                            }}>👤 Add New Client</h2>
                            <button
                                onClick={() => setShowAddClientForm(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '4px'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleAddClient}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151'
                                }}>
                                    Client ID *
                                </label>
                                <input
                                    type="text"
                                    value={newClient.clientId}
                                    readOnly
                                    placeholder="Auto-generated"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        backgroundColor: '#f9fafb',
                                        color: '#6b7280',
                                        cursor: 'not-allowed'
                                    }}
                                />
                                <small style={{
                                    display: 'block',
                                    marginTop: '6px',
                                    fontSize: '12px',
                                    color: '#6b7280'
                                }}>
                                    Auto-generated sequentially (1, 2, 3...)
                                </small>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151'
                                }}>
                                    Client Name *
                                </label>
                                <input
                                    type="text"
                                    value={newClient.clientName}
                                    onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
                                    placeholder="Enter client name"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151'
                                }}>
                                    Contact Number *
                                </label>
                                <input
                                    type="tel"
                                    value={newClient.contactNumber}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        if (value.length <= 10) {
                                            setNewClient({ ...newClient, contactNumber: value });
                                        }
                                    }}
                                    placeholder="Enter 10-digit mobile number"
                                    required
                                    pattern="[0-9]{10}"
                                    maxLength="10"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                                <small style={{
                                    display: 'block',
                                    marginTop: '6px',
                                    fontSize: '12px',
                                    color: '#6b7280'
                                }}>
                                    Must be exactly 10 digits
                                </small>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151'
                                }}>
                                    Email ID *
                                </label>
                                <input
                                    type="email"
                                    value={newClient.email}
                                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                                    placeholder="client@example.com"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151'
                                }}>
                                    Video Instructions (Optional)
                                </label>
                                <textarea
                                    value={newClient.videoInstructions}
                                    onChange={(e) => setNewClient({ ...newClient, videoInstructions: e.target.value })}
                                    placeholder="Special instructions for video content..."
                                    rows="3"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        resize: 'vertical'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
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
                                    Graphics Instructions (Optional)
                                </label>
                                <textarea
                                    value={newClient.graphicsInstructions}
                                    onChange={(e) => setNewClient({ ...newClient, graphicsInstructions: e.target.value })}
                                    placeholder="Special instructions for graphics content..."
                                    rows="3"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        resize: 'vertical'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4B49AC'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '12px',
                                justifyContent: 'flex-end'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddClientForm(false)}
                                    style={{
                                        padding: '12px 24px',
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
                                    type="submit"
                                    style={{
                                        padding: '12px 24px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, #4B49AC 0%, #7DA0FA 100%)',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 8px 20px rgba(75,73,172,0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                >
                                    <Plus size={16} />
                                    Add Client
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewClients;
