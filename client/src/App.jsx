import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { bindClerkTokenGetter } from './api/axios';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Browse from './pages/Browse';
import EditSkills from './pages/EditSkills';
import Bookings from './pages/Bookings';
import Landing from './pages/Landing';
import CreditHistory from './pages/CreditHistory';
import Messages from './pages/Messages';
import AdminDashboard from './pages/AdminDashboard';
import OnboardingModal from './components/OnboardingModal';

function LoadingScreen() { return <div className="loading-screen">Loading workspace...</div>; }

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? children : <Navigate replace to="/login" />;
}

function PublicAuthRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Navigate replace to="/dashboard" /> : children;
}

function AppRoutes() {
  const { getToken } = useAuth();
  const user = useSelector((state) => state.auth.user);
  useEffect(() => { bindClerkTokenGetter(getToken); return () => bindClerkTokenGetter(null); }, [getToken]);

  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<PublicAuthRoute><Login /></PublicAuthRoute>} />
    <Route path="/register" element={<PublicAuthRoute><Register /></PublicAuthRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
    <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="/edit-skills" element={<ProtectedRoute><EditSkills /></ProtectedRoute>} />
    <Route path="/credits" element={<ProtectedRoute><CreditHistory /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute>{user?.role === 'admin' ? <AdminDashboard /> : <Navigate replace to="/dashboard" />}</ProtectedRoute>} />
    <Route path="*" element={<Navigate replace to="/dashboard" />} />
  </Routes>;
}

function App() {
  return <BrowserRouter><AppRoutes /><OnboardingModal /></BrowserRouter>;
}

export default App;
