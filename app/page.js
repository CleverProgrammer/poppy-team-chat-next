'use client';

import { useAuth } from './contexts/AuthContext';
import SignInButton from './components/auth/SignInButton';
import SignOutButton from './components/auth/SignOutButton';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-section">
          <h2>Welcome to Poppy Chat</h2>
          <p>Sign in to start chatting with your team</p>
          <SignInButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4">
        <img
          src={user.photoURL || ''}
          alt="Profile"
          className="rounded-full w-20 h-20"
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold">{user.displayName}</h1>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </div>
      <SignOutButton />
    </div>
  );
}
