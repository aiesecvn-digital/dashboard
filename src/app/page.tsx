'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page
    router.push('/auth/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
      <div className="text-center">
        <div className="mx-auto">
          <img src="/giphy.gif" alt="Loading..." className="h-16 w-16 object-contain mx-auto" />
        </div>
        <p className="mt-4 text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}
