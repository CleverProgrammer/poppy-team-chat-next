'use client';

import { useAuth } from '../../contexts/AuthContext';

export default function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <button
      onClick={signOut}
      className="sign-out-btn"
    >
      Sign out
    </button>
  );
}
