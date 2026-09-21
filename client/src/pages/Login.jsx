import { SignIn } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';
import { authAppearance } from './authAppearance';

export default function Login() {
  return <AuthLayout mode="login"><SignIn routing="path" path="/login" signUpUrl="/register" fallbackRedirectUrl="/dashboard" appearance={authAppearance} /></AuthLayout>;
}
