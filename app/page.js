'use client';

import { useAuth } from './contexts/AuthContext';
import AuthForm from './components/auth/AuthForm';
import ChatWindow from './components/chat/ChatWindow';

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
          <AuthForm />
        </div>
      </div>
    );
  }

  return <ChatWindow />;
}
