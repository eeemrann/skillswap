import { SignIn } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';
import { authAppearance } from './authAppearance';

export default function Login() {
  return (
    <AuthLayout mode="login">
      <SignIn 
        fallbackRedirectUrl="/dashboard" 
        path="/login" 
        routing="path" 
        signUpUrl="/register" 
        appearance={authAppearance} 
      />
    </AuthLayout>
  );
}