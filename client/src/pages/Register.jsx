import { SignUp } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';
import { authAppearance } from './authAppearance';

export default function Register() {
  return <AuthLayout mode="register"><SignUp fallbackRedirectUrl="/dashboard" path="/register" routing="path" signInUrl="/login" appearance={authAppearance} /></AuthLayout>;
}
