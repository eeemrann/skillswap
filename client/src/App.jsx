import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ClerkProvider, useAuth, useClerk } from '@clerk/clerk-react';
import api, { setClerkTokenGetter } from './api/axios';
import { connectSocket, disconnectSocket } from './api/socket';
import { logout, updateUser } from './redux/authSlice';
import { clearNotifications, fetchUnreadCounts } from './redux/notificationSlice';
import { errorMessage } from './lib/format';
import { useToast } from './lib/toast';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingModal from './components/OnboardingModal';
import PaywallHost from './components/PaywallHost';
import ToastProvider from './components/ToastProvider';

const Landing = lazy(() => import('./pages/Landing'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Legal = lazy(() => import('./pages/Legal'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Browse = lazy(() => import('./pages/Browse'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Session = lazy(() => import('./pages/Session'));
const Messages = lazy(() => import('./pages/Messages'));
const Settings = lazy(() => import('./pages/Settings'));
const Billing = lazy(() => import('./pages/Billing'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function LoadingScreen({ label = 'Loading…' }) {
  return <div className="loading-screen" role="status"><span className="spinner" /><span>{label}</span></div>;
}

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

function SyncFailed({ message, onRetry }) {
  const { signOut } = useClerk();
  return (
    <div className="loading-screen" role="alert">
      <h1 style={{ fontSize: 24 }}>We could not load your account</h1>
      <p className="muted" style={{ maxWidth: 420, textAlign: 'center' }}>{message}</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>
        <button type="button" className="btn btn-secondary" onClick={() => signOut({ redirectUrl: '/' })}>Sign out</button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, session }) {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();
  if (!isLoaded) return <LoadingScreen label="Loading your workspace…" />;
  if (!isSignedIn) return <Navigate replace to={`/login?redirect_url=${encodeURIComponent(location.pathname + location.search)}`} />;
  if (session.status === 'failed') return <SyncFailed message={session.error} onRetry={session.retry} />;
  if (session.status === 'syncing' || !user) return <LoadingScreen label="Loading your workspace…" />;
  return children;
}

function PublicAuthRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  // Keep the Clerk flow mounted while auth is loading so an in-progress verification step is not cancelled.
  if (!isLoaded) return children;
  return isSignedIn ? <Navigate replace to="/dashboard" /> : children;
}

/** Loads the member's application profile once signed in, and exposes retry on failure. */
function useSession() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const dispatch = useDispatch();
  const [state, setState] = useState({ status: 'syncing', error: '', attempt: 0 });

  // Keep the API client pointed at the current token getter without re-running the profile load when it changes identity.
  useEffect(() => { setClerkTokenGetter(getToken); }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return undefined;
    if (!isSignedIn) {
      dispatch(logout());
      dispatch(clearNotifications());
      disconnectSocket();
      return undefined;
    }
    let active = true;
    api.get('/users/me').then(
      (response) => {
        if (!active) return;
        dispatch(updateUser(response.data));
        dispatch(fetchUnreadCounts());
        setState((current) => ({ ...current, status: 'ready', error: '' }));
      },
      (error) => {
        if (active) setState((current) => ({ ...current, status: 'failed', error: errorMessage(error, 'The server could not be reached. Check your connection and try again.') }));
      }
    );
    return () => { active = false; };
  }, [dispatch, isLoaded, isSignedIn, state.attempt]);

  const retry = () => setState((current) => ({ status: 'syncing', error: '', attempt: current.attempt + 1 }));
  return { status: isLoaded && !isSignedIn ? 'ready' : state.status, error: state.error, retry };
}

/** Keeps counts, credits and the live socket current while signed in. */
function RealtimeBridge() {
  const { getToken, isSignedIn } = useAuth();
  const dispatch = useDispatch();
  const toast = useToast();
  const latest = useRef({ getToken, toast });
  useEffect(() => { latest.current = { getToken, toast }; });

  useEffect(() => {
    if (!isSignedIn) return undefined;
    const socket = connectSocket(() => latest.current.getToken());
    const refreshProfile = () => api.get('/users/me').then((response) => dispatch(updateUser(response.data))).catch(() => {});
    const onNotification = ({ message }) => {
      dispatch(fetchUnreadCounts());
      refreshProfile();
      window.dispatchEvent(new CustomEvent('skillswap:refresh'));
      if (message) latest.current.toast.info(message);
    };
    const onMessage = () => {
      dispatch(fetchUnreadCounts());
      window.dispatchEvent(new CustomEvent('skillswap:message'));
    };
    socket.on('notification:new', onNotification);
    socket.on('message:new', onMessage);
    // Sockets are an optimisation; this slow poll keeps badges right if one is blocked.
    const timer = window.setInterval(() => { if (!document.hidden) { dispatch(fetchUnreadCounts()); refreshProfile(); } }, 60000);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('message:new', onMessage);
      window.clearInterval(timer);
    };
  }, [dispatch, isSignedIn]);

  return null;
}

function AppRoutes() {
  const user = useSelector((state) => state.auth.user);
  const session = useSession();
  const guard = (element) => <ProtectedRoute session={session}>{element}</ProtectedRoute>;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/terms" element={<Legal doc="terms" />} />
        <Route path="/privacy" element={<Legal doc="privacy" />} />
        <Route path="/login/*" element={<PublicAuthRoute><Login /></PublicAuthRoute>} />
        <Route path="/register/*" element={<PublicAuthRoute><Register /></PublicAuthRoute>} />
        <Route path="/dashboard" element={guard(<Dashboard />)} />
        <Route path="/browse" element={guard(<Browse />)} />
        <Route path="/profile/:id" element={guard(<UserProfile />)} />
        <Route path="/bookings" element={guard(<Bookings />)} />
        <Route path="/session/:bookingId" element={guard(<Session />)} />
        <Route path="/messages" element={guard(<Messages />)} />
        <Route path="/settings" element={guard(<Settings />)} />
        <Route path="/billing" element={guard(<Billing />)} />
        <Route path="/admin" element={guard(user?.role === 'admin' ? <AdminDashboard /> : <Navigate replace to="/dashboard" />)} />
        <Route path="/edit-skills" element={<Navigate replace to="/settings" />} />
        <Route path="/credits" element={<Navigate replace to="/billing" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppRoutes />
        <OnboardingModal />
        <PaywallHost />
        <RealtimeBridge />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
