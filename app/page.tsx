/**
 * Root Page - Redirects to Dashboard
 * Task 2.2: Implement authentication middleware and protected routes
 * 
 * This page redirects authenticated users to the conversations page
 * and unauthenticated users to the login page.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect authenticated users to conversations
        router.push('/conversations');
      } else {
        // Redirect unauthenticated users to login
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-4 text-sm text-gray-600">Memuat...</p>
      </div>
    </main>
  );
}

