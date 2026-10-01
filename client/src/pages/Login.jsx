import { SignIn } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';
import { useDocumentTitle } from '../lib/hooks';
import { authAppearance } from './authAppearance';

export default function Login() {
  useDocumentTitle('Sign in');
  return <AuthLayout mode="login"><SignIn fallbackRedirectUrl="/dashboard" path="/login" routing="path" signUpUrl="/register" appearance={authAppearance} /></AuthLayout>;
}
