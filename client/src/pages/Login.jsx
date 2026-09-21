import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { GoogleLogin } from '@react-oauth/google';
import api from '../api/axios';
import { setCredentials } from '../redux/authSlice';
import AuthLayout from '../components/AuthLayout';
import.meta.env.VITE_GOOGLE_CLIENT_ID

function Login(){
  const [form,setForm]=useState({email:'',password:''}); const [error,setError]=useState(''); const [isSubmitting,setIsSubmitting]=useState(false); const [showPassword,setShowPassword]=useState(false); const navigate=useNavigate(); const dispatch=useDispatch();
  const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const finishAuthentication=async(token)=>{sessionStorage.setItem('token',token);const userRes=await api.get('/users/me');dispatch(setCredentials({user:userRes.data,token}));navigate('/dashboard');};
  const handleSubmit=async(event)=>{event.preventDefault();setError('');setIsSubmitting(true);try{const res=await api.post('/auth/login',form);const token=res.data.token;sessionStorage.setItem('token',token);const userRes=await api.get('/users/me');dispatch(setCredentials({user:userRes.data,token}));navigate('/dashboard');}catch(err){sessionStorage.removeItem('token');setError(err.response?.data?.message||'Login failed');}finally{setIsSubmitting(false);}};
  const handleGoogleSuccess=async(response)=>{if(!response.credential){setError('Google did not return a valid credential.');return;}setError('');setIsSubmitting(true);try{const result=await api.post('/auth/google',{credential:response.credential});await finishAuthentication(result.data.token);}catch(err){setError(err.response?.data?.message||'Google sign-in failed. Please try again.');}finally{setIsSubmitting(false);}};
  return <AuthLayout mode="login"><>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="google-auth-wrap">{googleEnabled?<GoogleLogin onSuccess={handleGoogleSuccess} onError={()=>setError('Google sign-in was cancelled or could not start.')} theme="outline" shape="pill" size="large" text="continue_with" width="360"/>:<button className="google-disabled" type="button" disabled>Google sign-in is not configured</button>}</div><div className="auth-divider"><span>or continue with email</span></div><form className="auth-form" onSubmit={handleSubmit}><div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required/></div><div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required/><label className="password-visibility"><input type="checkbox" checked={showPassword} onChange={(event)=>setShowPassword(event.target.checked)}/> Show password</label></div><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting?'Signing you in...':'Continue to your workspace'}</button></form></></AuthLayout>;
}
export default Login;
