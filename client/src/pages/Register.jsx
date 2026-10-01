import { SignUp } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';
import { useDocumentTitle } from '../lib/hooks';
import { authAppearance } from './authAppearance';

export default function Register() {
  useDocumentTitle('Create account');
  return <AuthLayout mode="register"><SignUp fallbackRedirectUrl="/dashboard" path="/register" routing="path" signInUrl="/login" appearance={authAppearance} /></AuthLayout>;
}
