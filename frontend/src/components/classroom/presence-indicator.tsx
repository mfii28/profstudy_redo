'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { motion } from 'framer-motion';

interface PresenceUser {
  userId: string;
  userName?: string;
  userAvatar?: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  lastSeen: string;
}

interface PresenceIndicatorProps {
  classroomId: string;
  members?: Array<{ userId: string; name: string; avatar?: string }>;
}

export function PresenceIndicator({ classroomId, members = [] }: PresenceIndicatorProps) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!classroomId) return;

    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const res = await apiFetch(`/classroom-presence/${classroomId}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setOnlineUsers(data.users || []);
        }
      } catch {
        // ignore
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [classroomId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'dnd':
        return 'bg-red-500';
      case 'offline':
      default:
        return 'bg-slate-300';
    }
  };

  const getMemberInfo = (userId: string) => {
    return members.find((m) => m.userId === userId);
  };

  const onlineCount = onlineUsers.filter((u) => u.status === 'online').length;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
        Online ({onlineCount})
      </div>
      <div className="space-y-1">
        {onlineUsers.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No one online</p>
        ) : (
          onlineUsers.map((user) => {
            const member = getMemberInfo(user.userId);
            return (
              <motion.div
                key={user.userId}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="relative h-6 w-6 flex-shrink-0">
                  {member?.avatar && (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  )}
                  <div
                    className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white dark:border-slate-900 ${getStatusColor(
                      user.status
                    )}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {member?.name || user.userId}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {user.status}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
