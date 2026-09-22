import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { bindClerkTokenGetter } from './api/axios';
import api from './api/axios';
import { updateUser, logout } from './redux/authSlice';
import { fetchUnreadCounts } from './redux/notificationSlice';
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

export function ClerkRouterProvider({ children }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? children : <Navigate replace to="/login" />;
}

function PublicAuthRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  // Keep the Clerk flow mounted while auth state is loading so transient
  // state updates do not cancel an in-progress verification step.
  if (!isLoaded) return children;
  return isSignedIn ? <Navigate replace to="/dashboard" /> : children;
}

function AppRoutes() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  useEffect(() => { bindClerkTokenGetter(getToken); return () => bindClerkTokenGetter(null); }, [getToken]);
  useEffect(() => {
    if (!isLoaded) return undefined;
    if (!isSignedIn) {
      dispatch(logout());
      return undefined;
    }
    let active = true;
    api.get('/users/me').then((res) => {
      if (!active) return;
      dispatch(updateUser(res.data));
      dispatch(fetchUnreadCounts());
    }).catch((error) => {
      if (active) console.error('Failed to sync MongoDB user record:', error);
    });
    return () => { active = false; };
  }, [dispatch, isLoaded, isSignedIn]);

  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login/*" element={<PublicAuthRoute><Login /></PublicAuthRoute>} />
    <Route path="/register/*" element={<PublicAuthRoute><Register /></PublicAuthRoute>} />
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
  return <><AppRoutes /><OnboardingModal /></>;
}

export default App;
