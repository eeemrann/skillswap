import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';
import { setCredentials } from '../redux/authSlice';
import.meta.env.VITE_GOOGLE_CLIENT_ID

function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = async (event) => {
    event.preventDefault(); setError(''); setIsSubmitting(true);
    try {
      const response = await api.post('/auth/register', form);
      sessionStorage.setItem('token', response.data.token);
      dispatch(setCredentials({ user: response.data.user, token: response.data.token }));
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'Registration failed'); }
    finally { setIsSubmitting(false); }
  };

  return <AuthLayout mode="register">
    <>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field"><label htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" placeholder="How should people call you?" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
          <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
          <div className="form-field"><label htmlFor="password">Create a password</label><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><label className="password-visibility"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} /> Show password</label></div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating your account...' : 'Create my account'}</button>
        </form>
      </>
  </AuthLayout>;
}

export default Register;
