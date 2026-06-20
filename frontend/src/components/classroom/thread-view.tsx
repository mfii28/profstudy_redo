'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getThreadMessages } from '@/app/actions/classroom';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

interface ThreadViewProps {
  messageId: string;
  classroomId: string;
  threadCount?: number;
}

export function ThreadView({ messageId, classroomId, threadCount = 0 }: ThreadViewProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadThread = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const { messages: threadMessages, error } = await getThreadMessages(
        idToken,
        classroomId,
        messageId
      );
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error });
      } else {
        setMessages(threadMessages);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!isOpen) {
      await loadThread();
    }
    setIsOpen(!isOpen);
  };

  if (threadCount === 0) return null;

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      >
        <MessageSquare className="h-3 w-3 mr-1" />
        {threadCount} {threadCount === 1 ? 'reply' : 'replies'}
        <ChevronDown
          className={`h-3 w-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 ml-6 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-3"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">No replies yet.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    {msg.userAvatar && (
                      <img
                        src={msg.userAvatar}
                        alt={msg.userName}
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {msg.userName}
                        </span>
                        {msg.userRole && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                            {msg.userRole}
                          </span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {msg.richContent ? (
                        <div
                          className="prose dark:prose-invert prose-sm max-w-none mt-1 text-slate-700 dark:text-slate-300"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(msg.richContent),
                          }}
                        />
                      ) : (
                        <p className="text-slate-700 dark:text-slate-300 mt-1 break-words">
                          {msg.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
