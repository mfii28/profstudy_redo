'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeServiceError } from '@/lib/service-errors';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
} from '@/components/ui/sheet';
import {
  getClassroomById,
  sendClassroomMessage,
  getClassroomMembers,
  deleteClassroomMessage,
  editClassroomMessage,
  reactToClassroomMessage,
  getOlderClassroomMessages,
  updateUserPresence,
  createThreadReply,
  pinClassroomMessage,
  unpinClassroomMessage,
  getClassroomUserProfile,
  repairMyClassroomAccess,
} from '@/app/actions/classroom';
import { getPresignedDownloadUrl, getPresignedUploadUrl } from '@/app/actions/storage';
import { createLiveSession, getZoomJoinUrl } from '@/app/actions/zoom';
import { aiTutorChat } from '@/ai/flows/ai-tutor-chat';
import type { Classroom, ClassroomMessage, ClassroomChannel, LiveClass, PinnedMessage } from '@/lib/db';
import { resolveLiveSessionUiStatus, isLiveSessionJoinable } from '@/lib/live-session-status';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Hash,
  Send,
  Users,
  MessageSquare,
  BookOpen,
  HelpCircle,
  Sparkles,
  Crown,
  ChevronLeft,
  Circle,
  Maximize2,
  Minimize2,
  Paperclip,
  FileIcon,
  X,
  DownloadCloud,
  ImageIcon,
  Loader2,
  Video,
  PlusCircle,
  CalendarClock,
  Bot,
  Settings2,
  RotateCcw,
  User,
  Search,
  Pencil,
  Trash2,
  SmilePlus,
  ChevronUp,
  Pin,
  PinOff,
  Bell,
  BellOff,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sora, Manrope } from 'next/font/google';
import { RichTextEditor } from './rich-text-editor';
import { ThreadView } from './thread-view';
import { PresenceIndicator } from './presence-indicator';
import DOMPurify from 'dompurify';

const displayFont = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const CHANNELS: { key: ClassroomChannel; label: string; icon: typeof Hash; description: string }[] = [
  { key: 'general', label: 'Discussion', icon: MessageSquare, description: 'General discussion for all members' },
  { key: 'lectures', label: 'Lectures', icon: BookOpen, description: 'Lecture notes and study materials' },
  { key: 'qa', label: 'Q&A', icon: HelpCircle, description: 'Questions and answers' },
];

function normalizeChannel(channel?: string | string[]): ClassroomChannel {
  const value = Array.isArray(channel) ? channel[0] : channel;
  if (value === 'lectures' || value === 'qa' || value === 'general') {
    return value;
  }
  return 'general';
}

function normalizeClassroomError(errorMessage?: string): string {
  if (!errorMessage) return 'Unable to load classroom right now. Please try again.';

  const mapped = normalizeServiceError(new Error(errorMessage), { feature: 'Classroom' });

  if (mapped.kind === 'quota') {
    return 'Live classroom is temporarily busy. Please wait a minute and try again.';
  }

  if (mapped.kind === 'permission') {
    return 'Your classroom access is not yet active. Try refreshing the page or signing out and back in. If this continues, contact support — your enrollment may need to be synced.';
  }

  return mapped.description;
}

function isTransientClassroomAccessError(errorMessage?: string): boolean {
  const normalized = (errorMessage || '').toLowerCase();
  return (
    normalized.includes('permission-denied') ||
    normalized.includes('insufficient permissions') ||
    normalized.includes('missing or insufficient') ||
    normalized.includes('access denied')
  );
}

function getRoleColor(role: string) {
  if (role === 'tutor') return 'text-amber-700 dark:text-amber-300';
  if (['admin', 'superadmin', 'subadmin'].includes(role)) return 'text-rose-700 dark:text-rose-300';
  return 'text-sky-700 dark:text-sky-300';
}

function getRoleBadge(role: string) {
  if (role === 'tutor') return 'Tutor';
  if (['admin', 'superadmin'].includes(role)) return 'Admin';
  if (role === 'subadmin') return 'Moderator';
  return null;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '👏', '🤔'];

const EMOJI_CATEGORIES = [
  {
    key: 'smileys', label: '😊', title: 'Smileys',
    emoji: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','🤩','🥹','😏','😒','🙄','😬','😔','😪','😴','🤔','😐','😑','😶','😷','🤒'],
  },
  {
    key: 'gestures', label: '👋', title: 'Gestures',
    emoji: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👏','🙌','🤝','🫶','🙏','💪','🦾','🫂'],
  },
  {
    key: 'hearts', label: '❤️', title: 'Hearts',
    emoji: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🔴','🟠','🟡','🟢','🔵'],
  },
  {
    key: 'nature', label: '🌿', title: 'Nature',
    emoji: ['🌸','🌹','🌺','🌻','🌼','🌷','🌱','🌲','🌳','🌴','🍀','🍁','🍂','🍃','☀️','🌈','⭐','🌟','💫','✨','🌊','🔥','❄️','⛄','🌙','🌏','🌍','🌎','🌑','🌕'],
  },
  {
    key: 'food', label: '🍕', title: 'Food',
    emoji: ['🍎','🍊','🍋','🍇','🍓','🍒','🍑','🥭','🍍','🥥','🍕','🍔','🍟','🌮','🌯','🍣','🍱','🍜','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','☕','🍵','🍺','🥂'],
  },
  {
    key: 'fun', label: '🎮', title: 'Fun',
    emoji: ['🎉','🎊','🎁','🎈','🎯','🎮','🎲','🎨','🎭','🎬','🎤','🎵','🎶','🏆','🥇','🥈','🥉','🎖','🏅','💯','✅','❌','❓','❗','💡','🔥','💥','👑','💎','🚀'],
  },
] as const;

// ─── UserProfileCard ────────────────────────────────────────────────────────
interface UserProfileCardProps {
  userId: string;
  userName: string;
  userRole: string;
  classroomId?: string;
  avatarSrc?: string;
  status?: 'online' | 'away' | 'dnd' | 'offline';
  messageCount?: number;
  children: React.ReactNode; // the trigger element
}

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-slate-400',
};
const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  away: 'Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

function UserProfileCard({ userId, userName, userRole, classroomId, avatarSrc, status = 'offline', messageCount = 0, children }: UserProfileCardProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    avatar?: string;
    status: 'online' | 'away' | 'dnd' | 'offline';
    lastSeen?: string;
    messageCount: number;
  } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!open || profile || !user || !classroomId) return;
      setIsLoadingProfile(true);
      try {
        const idToken = await user.getIdToken();
        const { profile: fetchedProfile } = await getClassroomUserProfile(idToken, classroomId, userId);
        if (fetchedProfile) {
          setProfile({
            name: fetchedProfile.name,
            role: fetchedProfile.role,
            avatar: fetchedProfile.avatar,
            status: fetchedProfile.status,
            lastSeen: fetchedProfile.lastSeen,
            messageCount: fetchedProfile.messageCount,
          });
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [open, profile, user, classroomId, userId]);

  const displayName = profile?.name || userName;
  const displayRole = profile?.role || userRole;
  const displayAvatar = profile?.avatar || avatarSrc;
  const displayStatus = profile?.status || status;
  const displayMessageCount = profile?.messageCount ?? messageCount;

  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const badge = getRoleBadge(displayRole);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 rounded-2xl border border-slate-200 bg-white p-0 shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        {/* Banner */}
        <div className={`h-14 rounded-t-2xl ${getRoleColor(displayRole).replace('text-', 'bg-').replace('dark:text-', 'dark:bg-') || 'bg-primary/20'} opacity-60`} />
        {/* Avatar row */}
        <div className="-mt-7 flex items-end gap-3 px-4">
          <div className="relative">
            <Avatar className="h-14 w-14 border-4 border-white dark:border-slate-900 shadow-md">
              <AvatarImage src={displayAvatar} />
              <AvatarFallback className="bg-primary/15 text-primary text-sm font-extrabold">{initials}</AvatarFallback>
            </Avatar>
            <span className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${STATUS_COLORS[displayStatus]}`} />
          </div>
          <div className="mb-1 flex flex-col">
            {badge && (
              <Badge className="mb-0.5 h-4 w-fit px-1.5 text-[9px] font-extrabold uppercase bg-primary/15 text-primary border-primary/20">
                {badge}
              </Badge>
            )}
          </div>
        </div>
        {/* Info */}
        <div className="px-4 pb-4 pt-2 space-y-3">
          <div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">{displayName}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[displayStatus]}`} />
              {STATUS_LABELS[displayStatus]}
            </p>
            {profile?.lastSeen && displayStatus !== 'online' && (
              <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                Last seen {format(new Date(profile.lastSeen), 'MMM d, h:mm a')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/5">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{displayMessageCount}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Messages</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/5">
              <p className="text-[10px] font-extrabold capitalize text-slate-900 dark:text-white">{displayRole}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Role</p>
            </div>
          </div>
          {isLoadingProfile && (
            <p className="text-[10px] font-medium text-slate-400">Loading profile...</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
// ────────────────────────────────────────────────────────────────────────────

interface MessageItemProps {
  msg: ClassroomMessage;
  resolvedAvatars: Map<string, string>;
  currentUserId?: string;
  currentUserRole?: string;
  classroomId?: string;
  isPinned?: boolean;
  members?: { id: string; name: string; role: string; avatar?: string }[];
  presenceStatus?: 'online' | 'away' | 'dnd' | 'offline';
  messageCount?: number;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onPin?: (id: string) => void;
  onProfileClick?: (userId: string) => void;
}

function MessageItem({ msg, resolvedAvatars, currentUserId, currentUserRole, classroomId, isPinned, onDelete, onEdit, onReact, onReply, onPin, members, presenceStatus = 'offline', messageCount = 0, onProfileClick }: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [showReactions, setShowReactions] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [emojiSearch, setEmojiSearch] = useState('');

  const isOwner = msg.userId === currentUserId;
  const isAdminUser = ['admin', 'superadmin', 'subadmin'].includes(currentUserRole || '');
  const isTutorUser = currentUserRole === 'tutor';
  const canDelete = isOwner || isAdminUser;
  const canEdit = isOwner && !msg.deleted;
  const canPin = isAdminUser || isTutorUser;

  const initials = msg.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const roleBadge = getRoleBadge(msg.userRole);
  const avatarSrc = resolvedAvatars.get(msg.userId);

  const handleEditSave = () => {
    if (editText.trim() && editText.trim() !== msg.text) {
      onEdit?.(msg.id, editText.trim());
    }
    setIsEditing(false);
  };

  if (msg.deleted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-4 py-2 text-xs italic text-slate-500 dark:bg-slate-900/60 dark:text-slate-400"
      >
        <Trash2 className="h-3 w-3 shrink-0" />
        <span>This message was deleted.</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex items-start gap-3 rounded-2xl border border-transparent px-4 py-3 transition-all duration-200 hover:border-slate-200 hover:bg-slate-100/80 dark:hover:border-white/10 dark:hover:bg-white/5"
    >
      {isPinned && (
        <div className="absolute -top-1.5 right-4 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-300">
          <Pin className="h-2.5 w-2.5" />
          Pinned
        </div>
      )}
      <div className="relative">
        <UserProfileCard
          userId={msg.userId}
          userName={msg.userName}
          userRole={msg.userRole}
          classroomId={classroomId}
          avatarSrc={avatarSrc}
          status={presenceStatus}
          messageCount={messageCount}
        >
          <button className="cursor-pointer" type="button" onClick={() => onProfileClick?.(msg.userId)}>
            <Avatar className="mt-0.5 h-10 w-10 shrink-0 border-2 border-transparent transition-all group-hover:border-primary/40">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback className="bg-primary/10 text-primary ring-1 ring-primary/20 text-xs font-extrabold">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </UserProfileCard>
        {msg.userRole === 'tutor' && (
          <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 shadow-lg border border-slate-900">
            <Crown className="h-2 w-2 text-white" />
          </div>
        )}
        {/* Presence dot */}
        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${STATUS_COLORS[presenceStatus]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <UserProfileCard
            userId={msg.userId}
            userName={msg.userName}
            userRole={msg.userRole}
            classroomId={classroomId}
            avatarSrc={avatarSrc}
            status={presenceStatus}
            messageCount={messageCount}
          >
            <button type="button" className={`font-bold text-sm tracking-tight ${getRoleColor(msg.userRole)} hover:underline`}>
              {msg.userName}
            </button>
          </UserProfileCard>
          {roleBadge && (
            <Badge className="h-4 text-[9px] px-1.5 uppercase font-black bg-primary/20 text-primary border-primary/30">
              {roleBadge}
            </Badge>
          )}
          <span className="ml-auto whitespace-nowrap text-[10px] font-bold uppercase text-slate-500 opacity-80 transition-opacity group-hover:opacity-100 dark:text-slate-400">
            {msg.timestamp ? format(new Date(msg.timestamp), 'h:mm a') : ''}
          </span>
          {/* Hover action buttons */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-6 w-6 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              title="Reply"
              onClick={() => onReply?.(msg.id)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
                className="relative h-6 w-6 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              title="React"
              onClick={() => setShowReactions((v) => !v)}
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-slate-500 hover:bg-slate-200 hover:text-sky-700 dark:hover:bg-white/10 dark:hover:text-sky-300"
                title="Edit message"
                onClick={() => { setIsEditing(true); setEditText(msg.text); setShowReactions(false); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-slate-500 hover:bg-slate-200 hover:text-rose-700 dark:hover:bg-white/10 dark:hover:text-rose-400"
                title="Delete message"
                onClick={() => onDelete?.(msg.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {canPin && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 ${isPinned ? 'text-amber-600 dark:text-amber-400' : 'hover:text-amber-600 dark:hover:text-amber-400'}`}
                title={isPinned ? 'Unpin message' : 'Pin message'}
                onClick={() => onPin?.(msg.id)}
              >
                {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Emoji picker */}
        {showReactions && (
          <div className="mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-800">
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Search emoji…"
                className="h-7 w-full rounded-lg bg-slate-100 pl-7 pr-3 text-xs text-slate-700 placeholder:text-slate-400 outline-none dark:bg-white/10 dark:text-white"
                autoFocus
              />
            </div>
            {/* Quick reactions row */}
            {!emojiSearch && (
              <div className="mb-2 flex items-center gap-1 border-b border-slate-100 pb-2 dark:border-white/10">
                {QUICK_REACTIONS.map((e) => (
                  <button key={e} className="rounded-lg p-1 text-base hover:bg-slate-100 dark:hover:bg-white/10"
                    onClick={() => { onReact?.(msg.id, e); setShowReactions(false); setEmojiSearch(''); }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {/* Category tabs */}
            {!emojiSearch && (
              <div className="mb-1.5 flex gap-0.5">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button key={cat.key} onClick={() => setEmojiCategory(i)}
                    className={`flex-1 rounded-lg p-1 text-sm transition-all ${emojiCategory === i ? 'bg-primary/15 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                    title={cat.title}>
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
            {/* Emoji grid */}
            <div className="grid grid-cols-8 gap-0.5 max-h-36 overflow-y-auto">
              {(emojiSearch
                ? EMOJI_CATEGORIES.flatMap((c) => c.emoji).filter((e) => e.includes(emojiSearch))
                : EMOJI_CATEGORIES[emojiCategory].emoji
              ).map((e) => (
                <button key={e} className="rounded-lg p-1 text-base hover:bg-slate-100 dark:hover:bg-white/10"
                  onClick={() => { onReact?.(msg.id, e); setShowReactions(false); setEmojiSearch(''); }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message body or edit mode */}
        {isEditing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                if (e.key === 'Escape') { setIsEditing(false); setEditText(msg.text); }
              }}
              className="min-h-[2.5rem] max-h-32 w-full resize-none border-slate-300 bg-white text-sm font-medium text-slate-900 focus-visible:ring-primary/50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
              rows={2}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs font-bold" onClick={handleEditSave}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 dark:text-slate-400" onClick={() => { setIsEditing(false); setEditText(msg.text); }}>Cancel</Button>
              <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">Esc to cancel · Enter to save</span>
            </div>
          </div>
        ) : (
          <>
            {msg.richContent ? (
              <div
                className="prose dark:prose-invert prose-sm max-w-none mt-1.5 text-slate-800 dark:text-slate-100"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(msg.richContent),
                }}
              />
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100">
                {msg.text}
              </p>
            )}
            {msg.editedAt && (
              <span className="text-[9px] italic text-slate-500 dark:text-slate-500">(edited)</span>
            )}
          </>
        )}

        {/* Reactions display */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            <TooltipProvider delayDuration={300}>
              <AnimatePresence>
                {Object.entries(msg.reactions).map(([emoji, users]) => {
                  const reacterNames = users
                    .map((uid) => members?.find((m) => m.id === uid)?.name ?? (uid === currentUserId ? 'You' : 'Someone'))
                    .join(', ');
                  const iMine = users.includes(currentUserId || '');
                  return (
                    <motion.div
                      key={emoji}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onReact?.(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold transition-all hover:scale-110 active:scale-95 ${
                              iMine
                                ? 'bg-primary/20 border-primary/40 text-primary'
                                : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px]">
                          {reacterNames}
                        </TooltipContent>
                      </Tooltip>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </TooltipProvider>
          </div>
        )}

        {/* Attachments */}
        {msg.attachmentUrl && (
          <div className="mt-3">
            {msg.attachmentType?.startsWith('image/') ? (
              <div className="group/img relative max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
                <img
                  src={msg.attachmentUrl}
                  alt={msg.attachmentName || 'Image'}
                  className="w-full h-auto object-cover transition-transform group-hover/img:scale-[1.02]"
                />
                <a
                  href={msg.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover/img:opacity-100"
                >
                  <Button size="sm" variant="secondary" className="gap-2 font-bold">
                    <Maximize2 className="h-4 w-4" />
                    View Larger
                  </Button>
                </a>
              </div>
            ) : (
              <div className="group/file flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 transition-colors hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                <div className="rounded-lg bg-primary/15 p-2">
                  <FileIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{msg.attachmentName || 'Attached File'}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">
                    {msg.attachmentType?.split('/')[1] || 'FILE'}
                  </p>
                </div>
                <a
                  href={msg.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    <DownloadCloud className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Thread replies */}
        {classroomId && <ThreadView messageId={msg.id} classroomId={classroomId} threadCount={msg.threadCount} />}
      </div>
    </motion.div>
  );
}

interface ClassroomRoomProps {
  courseId: string;
  backHref: string;
  roomHref?: string;
  initialChannel?: string | string[];
}

export function ClassroomRoom({ courseId, backHref, roomHref, initialChannel }: ClassroomRoomProps) {
  const { user, isLoading: isAuthLoading } = useUser();
  const { toast } = useToast();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [isLoadingClassroom, setIsLoadingClassroom] = useState(true);
  const [isActivatingClassroom, setIsActivatingClassroom] = useState(false);
  const [isClassroomAccessActive, setIsClassroomAccessActive] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ClassroomChannel>(() => normalizeChannel(initialChannel));
  const [messages, setMessages] = useState<ClassroomMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [members, setMembers] = useState<{ id: string; name: string; role: string; avatar?: string }[]>([]);
  const [resolvedAvatars, setResolvedAvatars] = useState<Map<string, string>>(new Map());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [activeLiveClasses, setActiveLiveClasses] = useState<LiveClass[]>([]);
  /** Bumps on an interval so scheduled → live transitions without waiting on Firestore. */
  const [sessionClock, setSessionClock] = useState(0);
  const [liveSessionDialogOpen, setLiveSessionDialogOpen] = useState(false);
  const [newLiveSession, setNewLiveSession] = useState({ title: '', zoomUrl: '', startTime: new Date().toISOString(), durationMinutes: 60 });
  const [isCreatingLiveSession, setIsCreatingLiveSession] = useState(false);

  // New: Smart Assistant State
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [assistantPersona, setAssistantPersona] = useState<'Friendly' | 'Expert' | 'Exam Coach' | 'Strict' | 'Beginner'>('Friendly');
  const [assistantInput, setAssistantInput] = useState('');
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Pagination for older messages
  const [historicMessages, setHistoricMessages] = useState<ClassroomMessage[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  
  // New: Rich text and threading
  const [messageRichContent, setMessageRichContent] = useState('');
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);

  // Phase 2: Search + status
  const [messageSearch, setMessageSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userStatus, setUserStatus] = useState<'online' | 'away' | 'dnd'>('online');
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);

  // Phase 3: Presence map for profile cards
  const [presenceMap, setPresenceMap] = useState<Map<string, 'online' | 'away' | 'dnd' | 'offline'>>(new Map());

  const assistantScrollRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const roomRefElement = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    setActiveChannel(normalizeChannel(initialChannel));
  }, [initialChannel]);

  useEffect(() => {
    const id = window.setInterval(() => setSessionClock((c) => c + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void roomRefElement.current?.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  useEffect(() => {
    const load = async () => {
      if (isAuthLoading || !user) return;
      setIsLoadingClassroom(true);
      setIsClassroomAccessActive(false);
      try {
        const idToken = await user.getIdToken();
        const { classroom: room, error } = await getClassroomById(idToken, courseId);
        if (error || !room) {
          toast({
            variant: 'destructive',
            title: 'Unable to open classroom',
            description: normalizeClassroomError(error || 'Classroom not found.'),
          });
          return;
        }

        setIsActivatingClassroom(true);
        const activation = await repairMyClassroomAccess(idToken, room.courseId || courseId);
        if (!activation.ok) {
          toast({
            variant: 'destructive',
            title: 'Classroom activation pending',
            description: normalizeClassroomError(activation.error),
          });
          return;
        }

        setIsClassroomAccessActive(true);
        setClassroom(room);

        const { members: memberList, error: membersError } = await getClassroomMembers(idToken, room.id);
        if (membersError) {
          toast({
            variant: 'destructive',
            title: 'Members unavailable',
            description: normalizeClassroomError(membersError),
          });
        }
        setMembers(memberList);

        // Map current user to their role in this room or global role
        const me = memberList.find(m => m.id === user.uid);
        setUserRole(me?.role || 'student');

        const avatarMap = new Map<string, string>();
        await Promise.all(
          memberList.map(async (m) => {
            if (m.avatar) {
              if (m.avatar.startsWith('http')) {
                avatarMap.set(m.id, m.avatar);
              } else {
                try {
                  const idToken = await user.getIdToken();
                  const { url } = await getPresignedDownloadUrl(m.avatar, m.id, undefined, idToken);
                  if (url) avatarMap.set(m.id, url);
                } catch { }
              }
            }
          })
        );
        setResolvedAvatars(avatarMap);
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Unable to open classroom',
          description: normalizeClassroomError(err?.message),
        });
      } finally {
        setIsActivatingClassroom(false);
        setIsLoadingClassroom(false);
      }
    };
    void load();
  }, [user, isAuthLoading, courseId, toast]);

  useEffect(() => {
    if (!user || !classroom?.id || !isClassroomAccessActive) return;

    console.info('[ClassroomMessageStream] Initializing polling', {
      classroomId: classroom.id,
      courseId,
      channel: activeChannel,
      uid: user.uid,
    });

    setIsLoadingMessages(true);
    setHistoricMessages([]);
    setHasOlderMessages(true);
    let cancelled = false;

    const pollMessages = async () => {
      if (!user || cancelled) return;
      try {
        const idToken = await user.getIdToken();
        const classroomMessageKeys = Array.from(
          new Set(
            [classroom.id, classroom.courseId]
              .filter((value): value is string => typeof value === 'string' && value.length > 0)
          )
        );

        const merged = new Map<string, ClassroomMessage>();
        for (const messageKey of classroomMessageKeys) {
          const result = await getOlderClassroomMessages(idToken, messageKey, activeChannel, new Date().toISOString(), 200);
          if (cancelled) return;
          const entries: ClassroomMessage[] = (result.messages || []).map((m: any) => ({
            ...m,
            id: m.id,
            timestamp: m.timestamp || new Date().toISOString(),
          }));
          entries.forEach((entry) => merged.set(entry.id, entry));
        }

        const msgs = Array.from(merged.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        setMessages(msgs);
        setMessageCount(msgs.length);
        setIsLoadingMessages(false);
        if (msgs.length < 200) setHasOlderMessages(false);
      } catch {
        if (!cancelled) setIsLoadingMessages(false);
      }
    };

    pollMessages();

    // Poll every 10 seconds for new messages
    const interval = setInterval(pollMessages, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [classroom?.id, classroom?.courseId, activeChannel, user, courseId, isClassroomAccessActive]);

  // Presence heartbeat: update user status every 30 seconds
  useEffect(() => {
    if (!user || !classroom?.id || !isClassroomAccessActive) return;

    const updatePresence = async () => {
      const idToken = await user.getIdToken();
      await updateUserPresence(idToken, classroom.id, 'online').catch(() => undefined);
    };

    // Update immediately
    void updatePresence();

    // Then update every 30 seconds
    const interval = setInterval(() => {
      void updatePresence();
    }, 30000);

    return () => {
      clearInterval(interval);
      void (async () => {
        try {
          const idToken = await user.getIdToken();
          await updateUserPresence(idToken, classroom.id, 'offline').catch(() => undefined);
        } catch {
          // best effort cleanup
        }
      })();
    };
  }, [user, classroom?.id, isClassroomAccessActive]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const fetchLiveClasses = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/v1/live-classes/${courseId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const rows: LiveClass[] = Array.isArray(data) ? data : (data.classes || []);
          const now = Date.now();
          setActiveLiveClasses(rows.filter((c) => resolveLiveSessionUiStatus(c, now) !== 'ended'));
        }
      } catch (error: any) {
        console.warn('[ClassroomRoom] Live classes fetch error:', error?.message);
      }
    };

    fetchLiveClasses();
    const interval = setInterval(fetchLiveClasses, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [courseId, user]);

  // Phase 3: Presence polling for profile cards
  useEffect(() => {
    if (!classroom?.id || !isClassroomAccessActive || !user) return;

    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const idToken = await user.getIdToken();
        const members = await getClassroomMembers(idToken, classroom.id);
        if (cancelled || !members.members) return;
        const map = new Map<string, 'online' | 'away' | 'dnd' | 'offline'>();
        members.members.forEach((m: any) => {
          if (m.id) map.set(m.id, m.status ?? 'offline');
        });
        setPresenceMap(map);
      } catch {
        // non-critical
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [classroom?.id, isClassroomAccessActive, user]);

  const handleCreateLiveSession = async () => {
    if (!user || !newLiveSession.title) return;
    setIsCreatingLiveSession(true);
    try {
      const idToken = await user.getIdToken();
      const result = await createLiveSession(idToken, {
        ...newLiveSession,
        courseId,
      });
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Failed to create live session', description: result.error });
      } else {
        toast({ title: 'Live session scheduled', description: 'Students can now see and join the session.' });
        setLiveSessionDialogOpen(false);
        setNewLiveSession({ title: '', zoomUrl: '', startTime: new Date().toISOString(), durationMinutes: 60 });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsCreatingLiveSession(false);
    }
  };

  const handleJoinLiveSession = async (sessionId: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const result = await getZoomJoinUrl(idToken, sessionId);
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Failed to join', description: result.error });
      } else {
        window.open(result.url, '_blank');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  // New: Smart Assistant Logic
  const handleAskAssistant = async () => {
    if (!assistantInput.trim() || isAssistantThinking || !user || !classroom) return;
    
    const question = assistantInput.trim();
    setAssistantInput('');
    setIsAssistantThinking(true);
    
    // Add user message
    setAssistantMessages(prev => [...prev, { role: 'user', content: question }]);
    
    try {
      const subject = classroom.subject || classroom.category || 'General';
      const description = classroom.description || 'No classroom description available.';
      const courseMaterial = `
        Course Title: ${classroom.courseTitle}
        Subject: ${subject}
        Description: ${description}
      `.trim();

      const result = await aiTutorChat({
        question,
        courseMaterial,
        persona: assistantPersona,
      });

      if (result.answer) {
        setAssistantMessages(prev => [...prev, { role: 'assistant', content: result.answer }]);
      } else {
        throw new Error('AI failed to respond.');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Assistant Error', description: err.message });
      setAssistantMessages(prev => [...prev, { role: 'assistant', content: 'I encountered an error. Please try again soon!' }]);
    } finally {
      setIsAssistantThinking(false);
      // Scroll to bottom
      setTimeout(() => {
        assistantScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !messageRichContent.trim() && !pendingFile) || !user || isSending || isUploading) return;
    
    const text = messageText.trim();
    const richContent = messageRichContent || '';
    const file = pendingFile;
    
    setMessageText('');
    setMessageRichContent('');
    setPendingFile(null);
    setIsSending(true);
    
    try {
      const idToken = await user.getIdToken();
      let attachmentUrl: string | undefined = undefined;
      let attachmentName: string | undefined = undefined;
      let attachmentType: string | undefined = undefined;

      if (file) {
        setIsUploading(true);
        setUploadProgress(10);
        
        const { url: presignedUrl, key, error: presignedError } = await getPresignedUploadUrl(
          user.uid,
          'classroom',
          file.name,
          file.type,
          courseId,
          idToken
        );

        if (presignedError || !presignedUrl) {
          throw new Error(presignedError || 'Failed to get upload authorization.');
        }

        setUploadProgress(30);

        // Upload through proxy
        const uploadResponse = await fetch('/api/media/upload', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'x-upload-key': key,
            'content-type': file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          const errData = await uploadResponse.json();
          throw new Error(errData.error || 'Upload failed.');
        }

        setUploadProgress(70);

        // Get download URL
        const { url: downloadUrl, error: downloadError } = await getPresignedDownloadUrl(key, user.uid, undefined, idToken);
        if (downloadError || !downloadUrl) {
          throw new Error(downloadError || 'Failed to resolve attachment URL.');
        }

        attachmentUrl = downloadUrl;
        attachmentName = file.name;
        attachmentType = file.type;
        
        setUploadProgress(90);
      }

      if (replyingToMessageId) {
        // Send as thread reply
        const result = await createThreadReply(
          idToken,
          classroom!.id,
          replyingToMessageId,
          text,
          richContent,
          attachmentUrl,
          attachmentName,
          attachmentType
        );
        
        if (result.error) {
          toast({ variant: 'destructive', title: 'Send failed', description: result.error });
          setMessageText(text);
          if (file) setPendingFile(file);
        } else {
          setReplyingToMessageId(null);
          toast({ title: 'Reply sent' });
        }
      } else {
        // Send as main message
        const sendMainMessage = async (token: string) => sendClassroomMessage(
          token,
          classroom!.id,
          activeChannel,
          text,
          richContent,
          attachmentUrl,
          attachmentName,
          attachmentType,
          replyingToMessageId || undefined
        );

        let result = await sendMainMessage(idToken);

        if (result.error && isTransientClassroomAccessError(result.error)) {
          const refreshedToken = await user.getIdToken(true);
          const repaired = await repairMyClassroomAccess(refreshedToken, courseId);
          if (repaired.ok) {
            result = await sendMainMessage(refreshedToken);
          }
        }

        if (result.error) {
          toast({ variant: 'destructive', title: 'Send failed', description: normalizeClassroomError(result.error) });
          setMessageText(text);
          if (file) setPendingFile(file);
        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Send failed', description: err.message });
      setMessageText(text);
      if (file) setPendingFile(file);
    } finally {
      setIsSending(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit for classroom
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Maximum file size is 50MB.',
        });
        return;
      }
      setPendingFile(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isComposing = (e.nativeEvent as KeyboardEvent).isComposing;
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      void handleSendMessage();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const { error } = await deleteClassroomMessage(idToken, messageId);
      if (error) toast({ variant: 'destructive', title: 'Delete failed', description: error });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err.message });
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const { error } = await editClassroomMessage(idToken, messageId, newText);
      if (error) toast({ variant: 'destructive', title: 'Edit failed', description: error });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Edit failed', description: err.message });
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!user || !classroom) return;
    try {
      const idToken = await user.getIdToken();
      const { error } = await reactToClassroomMessage(idToken, messageId, classroom.id, emoji);
      if (error) toast({ variant: 'destructive', title: 'Reaction failed', description: error });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Reaction failed', description: err.message });
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!user || !classroom) return;
    const isAlreadyPinned = classroom.pinnedMessages?.some((p) => p.messageId === messageId);
    try {
      const idToken = await user.getIdToken();
      if (isAlreadyPinned) {
        const { error } = await unpinClassroomMessage(idToken, classroom.id, messageId);
        if (error) {
          toast({ variant: 'destructive', title: 'Unpin failed', description: error });
        } else {
          setClassroom((prev) => prev ? {
            ...prev,
            pinnedMessages: (prev.pinnedMessages || []).filter((p) => p.messageId !== messageId),
          } : prev);
          toast({ title: 'Message unpinned' });
        }
      } else {
        const { error } = await pinClassroomMessage(idToken, messageId);
        if (error) {
          toast({ variant: 'destructive', title: 'Pin failed', description: error });
        } else {
          // Optimistically add to local state
          const msg = displayMessages.find((m) => m.id === messageId);
          if (msg) {
            const newPin: PinnedMessage = {
              messageId,
              text: msg.text,
              userName: msg.userName,
              pinnedAt: new Date().toISOString(),
              pinnedBy: user.uid,
              channel: activeChannel,
            };
            setClassroom((prev) => prev ? {
              ...prev,
              pinnedMessages: [newPin, ...(prev.pinnedMessages || [])].slice(0, 10),
            } : prev);
          }
          toast({ title: 'Message pinned' });
        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Pin failed', description: err.message });
    }
  };

  const handleStatusChange = async (status: 'online' | 'away' | 'dnd') => {
    if (!user || !classroom) return;
    setUserStatus(status);
    try {
      const idToken = await user.getIdToken();
      await updateUserPresence(idToken, classroom.id, status).catch(() => undefined);
    } catch {
      // non-critical
    }
  };

  const handleLoadOlderMessages = async () => {
    if (!user || !classroom || isLoadingOlder || !hasOlderMessages) return;
    const oldestTimestamp = historicMessages[0]?.timestamp || messages[0]?.timestamp;
    if (!oldestTimestamp) return;
    setIsLoadingOlder(true);
    try {
      const idToken = await user.getIdToken();
      const { messages: older, error } = await getOlderClassroomMessages(
        idToken, classroom.id, activeChannel, oldestTimestamp, 50
      );
      if (error) {
        toast({ variant: 'destructive', title: 'Could not load older messages', description: error });
      } else {
        setHistoricMessages((prev) => [...older, ...prev]);
        if (older.length < 50) setHasOlderMessages(false);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not load older messages', description: err.message });
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Combined deduplicated message list: historic (older) first, then real-time window.
  const displayMessages = useMemo(() => {
    if (historicMessages.length === 0) return messages;
    const seen = new Set(messages.map((m) => m.id));
    const unique = historicMessages.filter((m) => !seen.has(m.id));
    return [...unique, ...messages];
  }, [historicMessages, messages]);

  // Phase 2: filtered messages for search
  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return displayMessages;
    const q = messageSearch.toLowerCase();
    return displayMessages.filter(
      (m) => m.text.toLowerCase().includes(q) || m.userName.toLowerCase().includes(q)
    );
  }, [displayMessages, messageSearch]);

  const activeChannelInfo = CHANNELS.find(c => c.key === activeChannel)!;
  const joinableLiveSessions = useMemo(() => {
    const now = Date.now();
    return activeLiveClasses.filter((c) => isLiveSessionJoinable(c, now));
  }, [activeLiveClasses, sessionClock]);
  const scheduledLiveSessions = useMemo(() => {
    const now = Date.now();
    return activeLiveClasses.filter((c) => resolveLiveSessionUiStatus(c, now) === 'scheduled');
  }, [activeLiveClasses, sessionClock]);
  const firstJoinableSessionId = joinableLiveSessions[0]?.id;
  const lastMessage = messages[messages.length - 1];
  const resolvedRoomHref = roomHref || `${backHref}/${courseId}`;
  const dashboardHref = userRole
    ? ['admin', 'superadmin', 'subadmin'].includes(userRole)
      ? '/admin'
      : userRole === 'tutor'
      ? '/tutor-dashboard'
      : '/student-dashboard'
    : '/room';

  const getChannelHref = (channel: ClassroomChannel) => {
    if (channel === 'general') return `${resolvedRoomHref}/messages`;
    if (channel === 'lectures') return `${resolvedRoomHref}/lectures`;
    if (channel === 'qa') return `${resolvedRoomHref}/qa`;
    return resolvedRoomHref;
  };

  if (isAuthLoading || isLoadingClassroom) {
    return (
      <div className={`${bodyFont.className} flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,oklch(0.985_0.008_247),oklch(0.958_0.014_247))] text-slate-900 dark:bg-[linear-gradient(180deg,oklch(0.22_0.02_260),oklch(0.18_0.02_260))] dark:text-slate-100`}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15">
            <Sparkles className="h-8 w-8 text-primary animate-spin-slow" />
          </div>
          <p className={`${displayFont.className} text-sm font-extrabold uppercase tracking-[0.22em] text-primary/70`}>
            {isActivatingClassroom ? 'Activating Classroom...' : 'Launching Classroom...'}
          </p>
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className={`${bodyFont.className} flex h-full items-center justify-center bg-[linear-gradient(180deg,oklch(0.985_0.008_247),oklch(0.958_0.014_247))] text-slate-700 dark:bg-[linear-gradient(180deg,oklch(0.22_0.02_260),oklch(0.18_0.02_260))] dark:text-slate-300`}>
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900/90">
          <HelpCircle className="mx-auto mb-4 h-12 w-12 text-slate-500 dark:text-slate-600" />
          <p className={`${displayFont.className} mb-2 text-xl font-extrabold text-slate-900 dark:text-white`}>Classroom Unreachable</p>
          <p className="mx-auto mb-6 max-w-xs text-sm text-slate-600 dark:text-slate-300">Either this classroom doesn't exist or you don't have the necessary permits.</p>
          <Button asChild variant="default" className="rounded-xl px-8 font-bold">
            <Link href={dashboardHref}>Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalMembers = Math.max(
    members.length,
    Number(classroom.memberCount || 0),
    Array.isArray(classroom.enrolledStudentIds) ? classroom.enrolledStudentIds.length : 0,
  );
  const liveSessionCount = joinableLiveSessions.length;
  const visibleMembers = members.filter((member) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return member.name.toLowerCase().includes(q) || member.role.toLowerCase().includes(q);
  });

  return (
    <div 
      ref={roomRefElement}
      className={`${bodyFont.className} relative flex h-full w-full overflow-hidden bg-[linear-gradient(180deg,oklch(0.985_0.008_247),oklch(0.958_0.014_247))] text-slate-900 selection:bg-primary/20 selection:text-slate-900 dark:bg-[linear-gradient(180deg,oklch(0.22_0.02_260),oklch(0.18_0.02_260))] dark:text-slate-100 dark:selection:text-white ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}
    >
      {/* Background Decorative Glows */}
      <div className="pointer-events-none absolute -right-[8%] -top-[12%] h-[42%] w-[42%] rounded-full bg-[oklch(0.75_0.09_235_/_0.14)] blur-[120px] dark:bg-[oklch(0.46_0.08_235_/_0.2)]" />
      <div className="pointer-events-none absolute -left-[6%] bottom-6 h-[34%] w-[32%] rounded-full bg-[oklch(0.86_0.07_130_/_0.18)] blur-[110px] dark:bg-[oklch(0.42_0.06_130_/_0.18)]" />

      {/* Left Sidebar — hidden on mobile, visible md+ */}
      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
        className="relative z-10 hidden flex-col overflow-y-auto border-r border-slate-200/90 bg-white/85 backdrop-blur-xl transition-all md:flex md:w-72 md:shrink-0 dark:border-white/10 dark:bg-slate-900/75"
      >
        {/* Header */}
        <div className="space-y-4 border-b border-slate-200/80 p-6 dark:border-white/10">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 h-8 gap-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 group dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Link href={dashboardHref}>
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="font-bold text-[11px] uppercase tracking-wider">Leave Room</span>
            </Link>
          </Button>
          <div className="space-y-1">
            <h2 className={`${displayFont.className} text-lg font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white`}>{classroom.courseTitle}</h2>
            <p className="line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400">{classroom.description || 'No description available.'}</p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-1 dark:bg-emerald-500/15">
                <Circle className="h-1.5 w-1.5 fill-green-400 text-green-400 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {liveSessionCount} live · {scheduledLiveSessions.length} scheduled
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Users className="h-3 w-3" />
                {totalMembers} Members
              </div>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex w-full max-w-[220px]">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!firstJoinableSessionId}
                      onClick={() => firstJoinableSessionId && void handleJoinLiveSession(firstJoinableSessionId)}
                      className="h-9 w-full gap-2 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                    >
                      <Video className="h-4 w-4" />
                      Join Room
                    </Button>
                  </span>
                </TooltipTrigger>
                {!firstJoinableSessionId ? (
                  <TooltipContent side="bottom" className="max-w-xs text-xs font-semibold">
                    No active session. Join is available only during the scheduled time window when the class is live.
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-2 pt-6">
          <p className="mb-3 px-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Assistant</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAssistantOpen(true)}
            className="group h-10 w-full justify-start gap-3 rounded-xl border border-transparent px-3 text-slate-700 transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-primary/20 dark:hover:text-white"
          >
            <div className="p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-bold">Smart Assistant</span>
          </Button>

          {/* Assistant Slide-over */}
          <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
            <SheetContent side="right" className="flex w-full flex-col border-slate-200 bg-white p-0 text-slate-900 shadow-2xl sm:max-w-md dark:border-white/10 dark:bg-slate-900 dark:text-white">
              <div className="border-b border-slate-200/80 bg-slate-50/80 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50">
                <SheetHeader className="flex-row items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-left">
                    <SheetTitle className={`${displayFont.className} text-lg font-extrabold text-slate-900 dark:text-white`}>Smart Assistant</SheetTitle>
                    <SheetDescription className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      AI Powered Tutoring Support
                    </SheetDescription>
                  </div>
                </SheetHeader>
                
                {/* Persona Switcher */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {(['Friendly', 'Expert', 'Exam Coach'] as const).map(p => (
                    <Badge 
                      key={p}
                      variant="outline"
                      className={`cursor-pointer h-7 rounded-lg px-3 transition-all ${assistantPersona === p ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-600 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-slate-200'}`}
                      onClick={() => setAssistantPersona(p)}
                    >
                      {p}
                    </Badge>
                  ))}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="ml-auto h-7 w-7 rounded-lg text-slate-500 hover:text-rose-700 dark:hover:text-rose-400"
                    onClick={() => setAssistantMessages([])}
                    title="Clear Chat"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Chat Canvas */}
              <div className="scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10 flex-1 space-y-6 overflow-y-auto p-6">
                {assistantMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-20 opacity-50">
                    <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-200 dark:bg-slate-800">
                       <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h4 className={`${displayFont.className} font-extrabold text-slate-900 dark:text-white`}>Hello {user?.displayName?.split(' ')[0]}!</h4>
                      <p className="max-w-[200px] text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                        I'm your AI tutor. Ask me anything about <b>{classroom.courseTitle}</b>.
                      </p>
                    </div>
                  </div>
                ) : (
                  assistantMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex gap-3 ${msg.role === 'assistant' ? 'items-start' : 'items-start flex-row-reverse'}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${msg.role === 'assistant' ? 'bg-primary/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                        {msg.role === 'assistant' ? <Bot className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
                      </div>
                      <div className={`max-w-[85%] rounded-2xl border p-3.5 text-[13px] font-medium leading-relaxed shadow-sm ${msg.role === 'assistant' ? 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200' : 'border-primary/20 bg-primary text-white'}`}>
                        {msg.content}
                      </div>
                    </motion.div>
                  ))
                )}
                {isAssistantThinking && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                       <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3.5 dark:border-white/10 dark:bg-white/5">
                      <div className="flex gap-1">
                         <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                         <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                         <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={assistantScrollRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t border-slate-200 bg-slate-50 p-6 dark:border-white/10 dark:bg-slate-900">
                <div className="relative group">
                  <Textarea 
                    value={assistantInput}
                    onChange={e => setAssistantInput(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={isAssistantThinking}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAskAssistant();
                      }
                    }}
                    className="scrollbar-none min-h-[50px] max-h-[150px] w-full resize-none rounded-2xl border-slate-300 bg-white pr-12 text-slate-900 transition-all focus:border-primary/50 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-100"
                    rows={1}
                  />
                  <Button 
                    size="icon" 
                    className="absolute right-2 bottom-2 h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                    onClick={handleAskAssistant}
                    disabled={!assistantInput.trim() || isAssistantThinking}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">
                  AI responses can be inaccurate. verify with your mentor.
                </p>
              </div>
            </SheetContent>
          </Sheet>

          {/* New: Create Live Class */}
          {(['tutor', 'admin', 'superadmin', 'subadmin'].includes(userRole || '') || classroom.tutorId === user?.uid) && (
            <Dialog open={liveSessionDialogOpen} onOpenChange={setLiveSessionDialogOpen}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLiveSessionDialogOpen(true);
                  setNewLiveSession({
                    title: `Live Class: ${classroom.courseTitle}`,
                    zoomUrl: '',
                    startTime: new Date().toISOString(),
                    durationMinutes: 60,
                  });
                }}
                className="group mt-1 h-10 w-full justify-start gap-3 rounded-xl border border-transparent px-3 text-slate-700 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-emerald-500/20 dark:hover:text-white"
              >
                <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <Video className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <span className="text-xs font-bold">Start Live Class</span>
              </Button>
              <DialogContent className="rounded-2xl border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <DialogHeader>
                  <DialogTitle className={`${displayFont.className} flex items-center gap-2 text-xl font-extrabold`}>
                    <Video className="h-5 w-5 text-emerald-500" />
                    Host Live Session
                  </DialogTitle>
                  <DialogDescription className="font-medium text-slate-500 dark:text-slate-400">
                    Schedule a live Zoom meeting for your students in this classroom.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Session Title</Label>
                    <Input 
                      value={newLiveSession.title}
                      onChange={e => setNewLiveSession(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Advanced Calculus Q&A"
                      className="h-11 rounded-xl border-slate-300 bg-slate-50 font-bold transition-all focus:border-emerald-500/50 dark:border-white/10 dark:bg-slate-950"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Manual Zoom URL</Label>
                    <Input 
                      value={newLiveSession.zoomUrl}
                      onChange={e => setNewLiveSession(p => ({ ...p, zoomUrl: e.target.value }))}
                      placeholder="https://your-domain.zoom.us/j/meeting-id"
                      className="h-11 rounded-xl border-slate-300 bg-slate-50 font-medium transition-all focus:border-emerald-500/50 dark:border-white/10 dark:bg-slate-950"
                    />
                    <p className="text-[9px] font-bold italic text-slate-500 dark:text-slate-400">Provide an existing Zoom meeting link. Automatic meeting creation is disabled.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Start Time</Label>
                    <Input 
                      type="datetime-local"
                      value={newLiveSession.startTime.split('.')[0]}
                      onChange={e => setNewLiveSession(p => ({ ...p, startTime: new Date(e.target.value).toISOString() }))}
                      className="h-11 rounded-xl border-slate-300 bg-slate-50 font-bold transition-all focus:border-emerald-500/50 dark:border-white/10 dark:bg-slate-950"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Duration (minutes)</Label>
                    <Input
                      type="number"
                      min={15}
                      max={300}
                      value={newLiveSession.durationMinutes}
                      onChange={e => setNewLiveSession(p => ({ ...p, durationMinutes: Number(e.target.value || 60) }))}
                      className="h-11 rounded-xl border-slate-300 bg-slate-50 font-bold transition-all focus:border-emerald-500/50 dark:border-white/10 dark:bg-slate-950"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setLiveSessionDialogOpen(false)}>Cancel</Button>
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black px-6 shadow-lg shadow-emerald-500/20 transition-all"
                    onClick={handleCreateLiveSession}
                    disabled={isCreatingLiveSession || !newLiveSession.title || !newLiveSession.zoomUrl.trim()}
                  >
                    {isCreatingLiveSession ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Launch Session'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Navigation / Channels */}
        <div className="px-4 pt-4 pb-2 flex-1">
          <p className="mb-3 px-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Channels</p>
          <div className="space-y-1">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              const isActive = activeChannel === channel.key;
              return (
                <Link
                  key={channel.key}
                  href={getChannelHref(channel.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? 'scale-[1.02] bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  {channel.label}
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-white" />}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Classroom Info */}
        <div className="border-t border-slate-200/80 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-slate-900/35">
          <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Classroom Info</p>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
              <span className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">Category</span>
              <span className="text-[10px] font-extrabold text-slate-900 dark:text-white">{classroom.category || 'General'}</span>
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="font-bold text-slate-500 dark:text-slate-400">Launched</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {classroom.createdAt ? format(new Date(classroom.createdAt), 'MMM d, yyyy') : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-w-0 flex-1 flex-col"
      >
        {/* Mobile-only top bar (course title + back + assistant) */}
        <div className="z-10 flex shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/85 px-3 py-2 md:hidden dark:border-white/10 dark:bg-slate-900/80">
          <Link href={dashboardHref}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className={`${displayFont.className} flex-1 truncate text-sm font-extrabold text-slate-900 dark:text-white`}>{classroom.courseTitle}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white" onClick={() => setAssistantOpen(true)}>
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
        {/* Mobile-only channel tab bar */}
        <div className="flex shrink-0 border-b border-slate-200/80 bg-white/70 md:hidden dark:border-white/10 dark:bg-slate-900/60">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            const isActive = activeChannel === channel.key;
            return (
              <Link
                key={channel.key}
                href={getChannelHref(channel.key)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                  isActive ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {channel.label}
              </Link>
            );
          })}
        </div>
        {/* Channel Header */}
        <div className="z-10 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/70 px-6 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/40">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/70 dark:bg-white/10">
            <Hash className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex flex-col">
            <span className={`${displayFont.className} leading-none text-sm font-extrabold text-slate-900 dark:text-white`}>{activeChannelInfo.label}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">— {activeChannelInfo.description}</span>
          </div>
          
          <div className="ml-auto flex items-center gap-3">
            {!isLoadingMessages && (
              <Badge variant="secondary" className="rounded-md border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                {displayMessages.length} MSG
              </Badge>
            )}
            {/* Search toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setMessageSearch(''); }}
              className={`h-8 w-8 rounded-lg ${searchOpen ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white'}`}
              title="Search messages"
            >
              <Search className="h-4 w-4" />
            </Button>
            {/* Pinned messages toggle */}
            {(classroom?.pinnedMessages?.filter((p) => p.channel === activeChannel).length ?? 0) > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPinnedPanel((v) => !v)}
                className={`h-8 w-8 rounded-lg ${showPinnedPanel ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white'}`}
                title="View pinned messages"
              >
                <Pin className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMembersOpen(true)}
              className="h-8 gap-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Users className="h-4 w-4" />
              <span className="text-[10px] font-black">{totalMembers}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="shrink-0 overflow-hidden border-b border-slate-200/80 bg-white/60 px-6 dark:border-white/10 dark:bg-slate-900/30"
            >
              <div className="flex items-center gap-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Search messages…"
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-white"
                />
                {messageSearch && (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
                  </span>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded text-slate-400" onClick={() => { setMessageSearch(''); setSearchOpen(false); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pinned messages panel */}
        <AnimatePresence>
          {showPinnedPanel && (classroom?.pinnedMessages?.filter((p) => p.channel === activeChannel).length ?? 0) > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="shrink-0 overflow-hidden border-b border-amber-200/60 bg-amber-50/80 dark:border-amber-800/30 dark:bg-amber-900/10"
            >
              <div className="px-6 py-3 space-y-1.5 max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                    <Pin className="h-3 w-3" /> Pinned Messages
                  </span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400" onClick={() => setShowPinnedPanel(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {(classroom?.pinnedMessages ?? [])
                  .filter((p) => p.channel === activeChannel)
                  .map((pin) => (
                    <div key={pin.messageId} className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 dark:bg-white/5">
                      <Pin className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-xs text-slate-700 dark:text-slate-300">{pin.text}</span>
                        <span className="ml-2 text-[10px] text-slate-400">— {pin.userName}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 scroll-smooth scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10 sm:px-6 sm:py-6">
          {/* Active Live Sessions Banners */}
          <AnimatePresence>
            {joinableLiveSessions.map((cls) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, height: 0, y: -20 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -20 }}
                className="mb-6 flex items-center justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-lg shadow-emerald-500/10"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center animate-pulse">
                    <Video className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="bg-emerald-500 rounded-full h-2 w-2 animate-ping" />
                       <h4 className={`${displayFont.className} text-sm font-extrabold text-slate-900 dark:text-white`}>{cls.title}</h4>
                    </div>
                    <p className="text-[10px] text-emerald-500/80 font-black uppercase tracking-widest flex items-center gap-2">
                      <PlusCircle className="h-3 w-3" /> Live now with {cls.instructor}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="hidden sm:block text-right mr-2">
                     <p className="text-[9px] text-white/40 font-black uppercase tracking-tight">Started at</p>
                     <p className="text-xs font-bold text-slate-800 dark:text-white/80">{format(new Date(cls.startTime), 'h:mm a')}</p>
                   </div>
                   <Button 
                    onClick={() => void handleJoinLiveSession(cls.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black px-6 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                   >
                     Join Room
                   </Button>
                </div>
              </motion.div>
            ))}
            {scheduledLiveSessions.map((cls) => (
              <motion.div
                key={`sched-${cls.id}`}
                initial={{ opacity: 0, height: 0, y: -20 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -20 }}
                className="mb-6 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-slate-300/60 bg-slate-100/80 p-4 dark:border-white/10 dark:bg-slate-900/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 dark:bg-white/10">
                    <CalendarClock className="h-6 w-6 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <h4 className={`${displayFont.className} text-sm font-extrabold text-slate-800 dark:text-white`}>{cls.title}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Scheduled · starts {format(new Date(cls.startTime), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                <Button type="button" disabled variant="secondary" className="cursor-not-allowed rounded-xl font-black px-6">
                  No active session
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {isLoadingMessages ? (
              <div className="space-y-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-white/5" />
                    <div className="space-y-3 flex-1 mt-1">
                      <div className="h-3 w-28 rounded bg-slate-300 dark:bg-white/10" />
                      <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-5">
                <div className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-inner dark:border-white/10 dark:bg-slate-900">
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <MessageSquare className="relative z-10 h-9 w-9 text-slate-500 dark:text-slate-700" />
                </div>
                <div className="space-y-1">
                  <p className={`${displayFont.className} text-lg font-extrabold uppercase tracking-tight text-slate-900 dark:text-white`}>The silence is loud</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Be the first to speak in #{activeChannelInfo.label}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Load older messages button */}
                {hasOlderMessages && (
                  <div className="flex justify-center pb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadOlderMessages}
                      disabled={isLoadingOlder}
                      className="h-8 gap-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-slate-200"
                    >
                      {isLoadingOlder ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5" />
                      )}
                      {isLoadingOlder ? 'Loading...' : 'Load older messages'}
                    </Button>
                  </div>
                )}
                {filteredMessages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    msg={msg}
                    resolvedAvatars={resolvedAvatars}
                    currentUserId={user?.uid}
                    currentUserRole={userRole || undefined}
                    classroomId={classroom?.id}
                    isPinned={classroom?.pinnedMessages?.some((p) => p.messageId === msg.id)}
                    members={members}
                    presenceStatus={presenceMap.get(msg.userId) ?? 'offline'}
                    messageCount={displayMessages.filter((m) => m.userId === msg.userId).length}
                    onDelete={handleDeleteMessage}
                    onEdit={handleEditMessage}
                    onReact={handleReactToMessage}
                    onReply={(id) => setReplyingToMessageId(id)}
                    onPin={handlePinMessage}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="shrink-0 p-6 pt-2">
          {/* Pending reply context */}
          {replyingToMessageId && displayMessages && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 flex items-center gap-2 rounded-lg border-l-4 border-primary bg-primary/5 p-3 dark:bg-primary/10"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Replying to</p>
                <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                  {displayMessages.find(m => m.id === replyingToMessageId)?.userName || 'User'}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                onClick={() => setReplyingToMessageId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}
          <AnimatePresence>
            {pendingFile && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative mb-3 flex items-center gap-3 overflow-hidden rounded-xl border border-primary/30 bg-white p-3 shadow-sm dark:bg-slate-900"
              >
                {isUploading && (
                  <motion.div 
                    className="absolute bottom-0 left-0 h-1 bg-primary/40"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                )}
                <div className="p-2 bg-primary/10 rounded-lg">
                  {pendingFile.type.startsWith('image/') ? (
                    <ImageIcon className="h-4 w-4 text-primary" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{pendingFile.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {(pendingFile.size / 1024 / 1024).toFixed(2)} MB · Ready to send
                  </p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7 text-slate-500 hover:text-rose-700 dark:hover:text-rose-400"
                  onClick={() => setPendingFile(null)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="group flex items-end gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm transition-all backdrop-blur-xl focus-within:border-primary/50 dark:border-white/10 dark:bg-slate-900/75"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              disabled={isSending || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 shrink-0 rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <div className="flex-1">
              <Textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isUploading ? "Uploading file..." : `Message #${activeChannelInfo.label}...`}
                disabled={isUploading}
                className="scrollbar-none min-h-[2.5rem] max-h-32 w-full resize-none border-0 bg-transparent p-2 text-sm font-medium text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                rows={1}
              />
            </div>
            <Button
              type="submit"
              disabled={(!messageText.trim() && !messageRichContent.trim() && !pendingFile) || isSending || isUploading}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <div className="mt-2.5 flex items-center gap-4 px-2">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-500">
              Return to Send · <span className="font-bold italic text-slate-600 dark:text-slate-400">Shift + Return for new line</span>
            </p>
          </div>
        </div>
      </motion.main>

      {/* Right Sidebar — Members */}
      <motion.aside
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1], delay: 0.04 }}
        className="relative z-10 hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200/90 bg-white/85 backdrop-blur-xl lg:flex dark:border-white/10 dark:bg-slate-900/75"
      >
        {/* Members Header */}
        <div className="border-b border-slate-200/80 p-6 dark:border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Live Members ({totalMembers})
            </p>
            <div className="px-2 py-0.5 bg-green-500/10 rounded-full">
              <span className="text-[9px] font-extrabold uppercase tracking-tighter text-emerald-700 dark:text-emerald-300">{liveSessionCount} sessions live</span>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="p-6 space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members"
              className="h-9 border-slate-300 bg-slate-100 pl-8 text-xs dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div className="space-y-1">
            {visibleMembers.slice(0, 50).map((member) => {
              const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
              const isCreator = member.role === 'tutor';
              const isAdmin = ['admin', 'superadmin'].includes(member.role);
              const avatarSrc = resolvedAvatars.get(member.id);
              const memberStatus = presenceMap.get(member.id) ?? 'offline';
              const memberMessageCount = displayMessages.filter((m) => m.userId === member.id).length;
              
              return (
                <UserProfileCard
                  key={member.id}
                  userId={member.id}
                  userName={member.name}
                  userRole={member.role}
                  classroomId={classroom?.id}
                  avatarSrc={avatarSrc}
                  status={memberStatus}
                  messageCount={memberMessageCount}
                >
                  <button type="button" className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all hover:bg-slate-100 dark:hover:bg-white/5">
                    <div className="relative shrink-0">
                      <Avatar className="h-9 w-9 border-2 border-transparent group-hover:border-white/10 transition-all">
                        <AvatarImage src={avatarSrc} />
                        <AvatarFallback className="bg-slate-200 text-[10px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${STATUS_COLORS[memberStatus]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <p className={`text-xs font-bold truncate ${getRoleColor(member.role)}`}>{member.name}</p>
                        {isCreator && <Crown className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                      </div>
                      {isCreator && (
                        <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-tighter">Class Creator</p>
                      )}
                      {isAdmin && !isCreator && (
                        <p className="text-[9px] font-black text-rose-500/60 uppercase tracking-tighter">Moderator</p>
                      )}
                    </div>
                  </button>
                </UserProfileCard>
              );
            })}
            {visibleMembers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-6 text-center dark:border-white/10 dark:bg-slate-900/50">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-500">Ghost Town</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-auto bg-slate-100/70 p-6 dark:bg-slate-950/40">
          {/* Status Picker */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800/40">
            <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">My Status</p>
            <div className="flex gap-1.5">
              {(['online', 'away', 'dnd'] as const).map((s) => {
                const labels: Record<string, string> = { online: 'Online', away: 'Away', dnd: 'DND' };
                const colors: Record<string, string> = {
                  online: 'bg-emerald-500',
                  away: 'bg-amber-400',
                  dnd: 'bg-rose-500',
                };
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-wider transition-all ${
                      userStatus === s
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${colors[s]}`} />
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-800/40">
               <div className="absolute top-0 right-0 p-2 opacity-20 dark:opacity-10">
                 <MessageSquare className="h-8 w-8 text-slate-600 dark:text-white" />
               </div>
               <p className={`${displayFont.className} text-xl font-extrabold text-slate-900 dark:text-white`}>{messageCount}</p>
               <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">Messages</p>
             </div>
             <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-800/40">
               <div className="absolute top-0 right-0 p-2 opacity-20 dark:opacity-10">
                 <Users className="h-8 w-8 text-slate-600 dark:text-white" />
               </div>
               <p className={`${displayFont.className} text-xl font-extrabold text-slate-900 dark:text-white`}>{totalMembers}</p>
               <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">Students</p>
             </div>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Members Drawer */}
      <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm border-slate-200 bg-white p-0 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
          <div className="border-b border-slate-200/80 p-5 dark:border-white/10">
            <h3 className={`${displayFont.className} text-lg font-extrabold`}>Members ({totalMembers})</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Live classroom participants</p>
          </div>
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members"
                className="h-9 border-slate-300 bg-slate-100 pl-8 text-xs dark:border-white/10 dark:bg-white/5"
              />
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {visibleMembers.map((member) => (
                <div key={member.id} className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm dark:border-white/10 dark:bg-white/5">
                  <p className="font-semibold text-slate-900 dark:text-white">{member.name}</p>
                  <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">{member.role}</p>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
