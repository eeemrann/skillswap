import { useEffect, useState } from 'react';
import { AuthenticateWithRedirectCallback, ClerkProvider, useAuth } from '@clerk/clerk-react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setClerkTokenGetter } from './api/axios';
import api from './api/axios';
import { logout, updateUser } from './redux/authSlice';
import { fetchUnreadCounts } from './redux/notificationSlice';
import OnboardingModal from './components/OnboardingModal';
import AdminDashboard from './pages/AdminDashboard';
import Bookings from './pages/Bookings';
import Browse from './pages/Browse';
import CreditHistory from './pages/CreditHistory';
import Dashboard from './pages/Dashboard';
import EditSkills from './pages/EditSkills';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Messages from './pages/Messages';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';

function LoadingScreen() {
  return <div className="loading-screen" role="status"><span className="loading-spinner" aria-hidden="true" />Loading workspace…</div>;
}

function SyncError({ message, onRetry }) {
  return <main className="workspace-error"><div><span>Connection interrupted</span><h1>We couldn’t open your workspace.</h1><p>{message}</p><button className="primary-button" type="button" onClick={onRetry}>Try again</button></div></main>;
}

export function ClerkRouterProvider({ children }) {
  const navigate = useNavigate();
  return <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} routerPush={(to) => navigate(to)} routerReplace={(to) => navigate(to, { replace: true })}>{children}</ClerkProvider>;
}

function ProtectedRoute({ children, isReady }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded || !isReady) return <LoadingScreen />;
  return isSignedIn ? children : <Navigate replace to="/login" />;
}

function PublicAuthRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return children;
  return isSignedIn ? <Navigate replace to="/dashboard" /> : children;
}

function AppRoutes() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncAttempt, setSyncAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded) return undefined;
    setClerkTokenGetter(getToken);
    if (!isSignedIn) {
      dispatch(logout());
      queueMicrotask(() => { setSyncError(''); setIsSynced(true); });
      return undefined;
    }

    let active = true;
    queueMicrotask(() => { setSyncError(''); setIsSynced(false); });
    const initializeSession = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk session token was unavailable');
        const response = await api.get('/users/me');
        if (!active) return;
        dispatch(updateUser(response.data));
        dispatch(fetchUnreadCounts());
        setIsSynced(true);
      } catch (error) {
        if (active) setSyncError(error.response?.data?.message || 'The server could not synchronize your account. Check your connection and try again.');
      }
    };
    initializeSession();
    return () => { active = false; };
  }, [dispatch, getToken, isLoaded, isSignedIn, syncAttempt]);

  if (isLoaded && isSignedIn && syncError) return <SyncError message={syncError} onRetry={() => setSyncAttempt((attempt) => attempt + 1)} />;

  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login/*" element={<PublicAuthRoute><Login /></PublicAuthRoute>} />
    <Route path="/register/*" element={<PublicAuthRoute><Register /></PublicAuthRoute>} />
    <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" />} />
    <Route path="/dashboard" element={<ProtectedRoute isReady={isSynced}><Dashboard /></ProtectedRoute>} />
    <Route path="/browse" element={<ProtectedRoute isReady={isSynced}><Browse /></ProtectedRoute>} />
    <Route path="/profile/:id" element={<ProtectedRoute isReady={isSynced}><UserProfile /></ProtectedRoute>} />
    <Route path="/bookings" element={<ProtectedRoute isReady={isSynced}><Bookings /></ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute isReady={isSynced}><Messages /></ProtectedRoute>} />
    <Route path="/edit-skills" element={<ProtectedRoute isReady={isSynced}><EditSkills /></ProtectedRoute>} />
    <Route path="/credits" element={<ProtectedRoute isReady={isSynced}><CreditHistory /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute isReady={isSynced}>{user?.role === 'admin' ? <AdminDashboard /> : <Navigate replace to="/dashboard" />}</ProtectedRoute>} />
    <Route path="*" element={<Navigate replace to="/dashboard" />} />
  </Routes>;
}

function App() {
  return <><AppRoutes /><OnboardingModal /></>;
}

export default App;
