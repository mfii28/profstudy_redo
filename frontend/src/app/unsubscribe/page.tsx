'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { updateUserEmailPreferences } from '@/app/actions/user';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your unsubscribe request...');

  useEffect(() => {
    const handleUnsubscribe = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid unsubscribe link. No token provided.');
        return;
      }

      try {
        const result = await updateUserEmailPreferences(token, { subscribedToMarketing: false, subscribedToTransactional: false });
        if (result.success) {
          setStatus('success');
          setMessage('You have been successfully unsubscribed from all emails.');
        } else {
          setStatus('error');
          setMessage(result.error || 'An unexpected error occurred.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('An unexpected error occurred while processing your request.');
        console.error(err);
      }
    };

    handleUnsubscribe();
  }, [searchParams]);

  const StatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader className="h-12 w-12 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <StatusIcon />
          </div>
          <CardTitle className="text-2xl font-bold">Unsubscribe</CardTitle>
          <CardDescription>Email Subscription Management</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-600">
            {message}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnsubscribePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <UnsubscribeContent />
        </Suspense>
    )
}
