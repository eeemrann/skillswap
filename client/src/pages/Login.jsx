import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import api from '../api/axios';
import { setCredentials } from '../redux/authSlice';
import AuthLayout from '../components/AuthLayout';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      const token = res.data.token;
      localStorage.setItem('token', token);
      const userRes = await api.get('/users/me');
      dispatch(setCredentials({ user: userRes.data, token }));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <AuthLayout mode="login">
      {error && <p className="auth-error">{error}</p>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
        <div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" placeholder="Enter your password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></div>
        <button className="primary-button" type="submit">Continue to your workspace <span>→</span></button>
      </form>
    </AuthLayout>
  );
}

export default Login;
