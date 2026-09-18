import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';

function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <AuthLayout mode="register">
      {error && <p className="auth-error">{error}</p>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field"><label htmlFor="name">Your name</label><input id="name" name="name" placeholder="How should people call you?" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
        <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
        <div className="form-field"><label htmlFor="password">Create a password</label><input id="password" name="password" type="password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></div>
        <button className="primary-button" type="submit">Create my account <span>→</span></button>
      </form>
    </AuthLayout>
  );
}

export default Register;
