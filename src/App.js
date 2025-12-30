import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import SuperAdmin from './components/SuperAdmin';
import ProductionIncharge from './components/ProductionIncharge';
import AddEmployeeForm from './components/AddEmployeeForm';
import ViewClients from './components/ViewClients';
import ViewEmployees from './components/ViewEmployees';
import StrategyDashboard from './components/StrategyDashboard';
import StrategyHead from './components/StrategyHead';
import StrategyEmployeeLogin from './components/StrategyEmployeeLogin';
import SocialMediaEmployeeLogin from './components/SocialMediaEmployeeLogin';
import GraphicsEmployeeLogin from './components/GraphicsEmployeeLogin';
import VideoEmployeeLogin from './components/VideoEmployeeLogin';
import VideoDashboard from './components/VideoDashboard';
import GraphicsDashboard from './components/GraphicsDashboard';
import SocialMediaDashboard from './components/SocialMediaDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import SocialMediaEmpDashboard from './components/SocialMediaEmpDashboard';
import FirebaseTest from './components/FirebaseTest';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/superadmin" element={<SuperAdmin />} />
            <Route path="/superadmin/production-incharge" element={<ProductionIncharge />} />
            <Route path="/production-incharge" element={<ProductionIncharge />} />
            <Route path="/production-incharge/add-employee" element={<AddEmployeeForm />} />
            <Route path="/production-incharge/view-clients" element={<ViewClients />} />
            <Route path="/production-incharge/view-employees" element={<ViewEmployees />} />
            <Route path="/strategy-login" element={<StrategyEmployeeLogin />} />
            <Route path="/social-media-login" element={<SocialMediaEmployeeLogin />} />
            <Route path="/graphics-login" element={<GraphicsEmployeeLogin />} />
            <Route path="/video-login" element={<VideoEmployeeLogin />} />
            <Route path="/strategy" element={<StrategyDashboard />} />
            <Route path="/strategy-head" element={<StrategyHead />} />
            <Route path="/video" element={<VideoDashboard />} />
            <Route path="/graphics" element={<GraphicsDashboard />} />
            <Route path="/social-media" element={<SocialMediaDashboard />} />
            <Route path="/employee" element={<EmployeeDashboard />} />
            <Route path="/social-media-employee" element={<SocialMediaEmpDashboard />} />
            <Route path="/firebase-test" element={<FirebaseTest />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
