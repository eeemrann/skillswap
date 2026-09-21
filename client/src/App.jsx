import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { setClerkTokenGetter } from './api/axios';
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

function App() {
  const { isSignedIn, getToken } = useAuth();
  useEffect(() => { setClerkTokenGetter(getToken); return () => setClerkTokenGetter(null); }, [getToken]);
  const token = isSignedIn;
  const user = useSelector((state) => state.auth.user);
  const isAdmin = user?.role === 'admin';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={token ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/edit-skills"
          element={token ? <EditSkills /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/bookings"
          element={token ? <Bookings /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/browse"
          element={token ? <Browse /> : <Navigate to="/login" replace />}
        />
        <Route path="/credits" element={token ? <CreditHistory /> : <Navigate to="/login" replace />} />
        <Route path="/messages" element={token ? <Messages /> : <Navigate to="/login" replace />} />
        <Route path="/admin" element={token && isAdmin ? <AdminDashboard /> : <Navigate to={token ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
      <OnboardingModal />
    </BrowserRouter>
  );
}

export default App;
