'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CustomerSupportChat } from './customer-support-chat';

export function CustomerSupportButton() {
  const pathname = usePathname();

  const isHidden =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/student-dashboard');

  if (isHidden) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            className="h-16 w-16 rounded-full shadow-lg"
            size="icon"
          >
            <MessageSquare className="h-8 w-8" />
            <span className="sr-only">Customer Support</span>
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-headline text-2xl">
            PTS AI Support
          </DialogTitle>
          <DialogDescription>
            Ask me anything about our courses, study materials, or platform
            features.
          </DialogDescription>
        </DialogHeader>
        <CustomerSupportChat />
      </DialogContent>
    </Dialog>
  );
}
