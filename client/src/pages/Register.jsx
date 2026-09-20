import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';

function Register(){
  const [form,setForm]=useState({name:'',email:'',password:''}); const [error,setError]=useState(''); const [isSubmitting,setIsSubmitting]=useState(false); const navigate=useNavigate();
  const handleSubmit=async(event)=>{event.preventDefault();setError('');setIsSubmitting(true);try{await api.post('/auth/register',form);navigate('/login');}catch(err){setError(err.response?.data?.message||'Registration failed');}finally{setIsSubmitting(false);}};
  return <AuthLayout mode="register">{error&&<p className="auth-error" role="alert">{error}</p>}<form className="auth-form" onSubmit={handleSubmit}><div className="form-field"><label htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" placeholder="How should people call you?" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></div><div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required/></div><div className="form-field"><label htmlFor="password">Create a password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength="8" placeholder="At least 8 characters" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required/><span className="form-hint">Use at least 8 characters.</span></div><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting?'Creating your account...':'Create my account'}</button></form></AuthLayout>;
}
export default Register;
