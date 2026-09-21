import { SignUp } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';
import { authAppearance } from './authAppearance';

export default function Register() {
  return <AuthLayout mode="register"><SignUp routing="path" path="/register" signInUrl="/login" afterSignUpUrl="/dashboard" appearance={authAppearance} /></AuthLayout>;
}
