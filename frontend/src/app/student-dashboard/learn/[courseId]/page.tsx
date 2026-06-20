'use client';

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { getCourseById } from '@/lib/course-data';
import { isAdminRole } from '@/lib/course-access';
import Link from 'next/link';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import * as userData from '@/lib/user-data';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  BookText,
  Bot,
  BrainCircuit,
  CheckCircle,
  ChevronLeft,
  ClipboardList,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HelpCircle,
  PlayCircle,
  Video,
  Loader2,
  Layout,
  List,
  Check,
  Trophy,
  PartyPopper,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lesson, Section, Course, User as AppUser, QuizQuestion } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { recordStudySession } from '@/lib/analytics-data';
import { getCourseLessonCount } from '@/lib/learning-progress';
import { DocumentViewer } from '@/components/document-viewer';
import { generateSignedDownloadUrl } from '@/app/actions/documents';
import { resolveMediaUrl } from '@/lib/media-url';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ProtectedMediaShell } from '@/components/protected-media-shell';

interface LearnPageProps {
  params: Promise<{ courseId: string }>;
}

const getYouTubeEmbedUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/embed/')[1]?.split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/shorts/')[1]?.split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }

  return null;
};

type LessonPosition = {
  lesson: Lesson;
  section: Section;
  index: number;
  sectionIndex: number;
};

type LessonSectionPair = {
  lesson: Lesson;
  section: Section;
};

type CurriculumResult = {
  totalLessons: number;
  lessonMap: Map<string, LessonPosition>;
  firstLesson: LessonSectionPair | null;
  getLessonByIndex: (index: number) => LessonSectionPair | null;
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function QuizPlayer({ questions, onComplete }: { questions: QuizQuestion[]; onComplete: () => void }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<(number | null)[]>(new Array(questions.length).fill(null));
  const [showResult, setShowResult] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-white/50 gap-4">
        <HelpCircle className="h-12 w-12 opacity-20" />
        <p className="text-xs font-black uppercase">No quiz questions found</p>
      </div>
    );
  }

  const score = answered.filter((a, i) => a === questions[i]?.correctAnswerIndex).length;
  const q = questions[current];
  const isAnswered = answered[current] !== null;
  const isCorrect = answered[current] === q?.correctAnswerIndex;

  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= 60;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8 bg-slate-950 text-white">
        <div className={cn('p-4 rounded-full', passed ? 'bg-green-500/20' : 'bg-orange-500/20')}>
          {passed ? <Trophy className="h-12 w-12 text-green-400" /> : <HelpCircle className="h-12 w-12 text-orange-400" />}
        </div>
        <div className="text-center space-y-2">
          <p className="text-4xl font-black">{pct}%</p>
          <p className="text-sm text-white/60">{score} / {questions.length} correct</p>
          <p className={cn('text-sm font-bold', passed ? 'text-green-400' : 'text-orange-400')}>
            {passed ? 'Great job! Quiz passed.' : 'Keep studying and try again.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10"
            onClick={() => { setAnswered(new Array(questions.length).fill(null)); setCurrent(0); setSelected(null); setShowResult(false); }}>
            Retry Quiz
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-2" onClick={onComplete}>
            <Check className="h-4 w-4" /> Mark Complete
          </Button>
        </div>
      </div>
    );
  }

  const handleAnswer = (idx: number) => {
    if (isAnswered) return;
    setSelected(idx);
    setAnswered(prev => { const next = [...prev]; next[current] = idx; return next; });
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(answered[current + 1] ?? null);
    } else {
      setShowResult(true);
    }
  };

  return (
    <ScrollArea className="h-full bg-slate-950 text-white">
      <div className="p-6 space-y-5 min-h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => { setCurrent(i); setSelected(answered[i] ?? null); }}
                className={cn('h-1.5 rounded-full transition-all', i === current ? 'w-6 bg-white' : answered[i] !== null ? (answered[i] === questions[i].correctAnswerIndex ? 'w-2 bg-green-400' : 'w-2 bg-red-400') : 'w-2 bg-white/20')} />
            ))}
          </div>
          <span className="text-[10px] font-bold text-white/40 uppercase">{current + 1} / {questions.length}</span>
        </div>

        <div className="flex-1 space-y-4">
          <p className="text-sm font-semibold leading-relaxed text-white">{q.questionText}</p>

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isThisCorrect = i === q.correctAnswerIndex;
              const isThisSelected = (answered[current] ?? selected) === i;
              const revealed = isAnswered;
              return (
                <button key={i} onClick={() => handleAnswer(i)} disabled={isAnswered}
                  className={cn(
                    'w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-colors',
                    revealed && isThisCorrect ? 'border-green-500 bg-green-500/20 text-green-300 font-bold' :
                    revealed && isThisSelected && !isThisCorrect ? 'border-red-400 bg-red-500/20 text-red-300' :
                    isThisSelected && !revealed ? 'border-primary bg-primary/20 text-white' :
                    'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  )}>
                  <span className={cn('h-5 w-5 rounded-full border text-[10px] font-bold flex items-center justify-center shrink-0',
                    revealed && isThisCorrect ? 'border-green-400 text-green-400' :
                    revealed && isThisSelected && !isThisCorrect ? 'border-red-400 text-red-400' :
                    isThisSelected && !revealed ? 'border-primary text-primary' :
                    'border-white/20 text-white/40')}>
                    {OPTION_LETTERS[i]}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {isAnswered && q.explanation && (
            <div className={cn('p-3 rounded-xl text-xs', isCorrect ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-orange-500/10 text-orange-300 border border-orange-500/20')}>
              <span className="font-bold uppercase text-[10px] block mb-1">Explanation</span>
              {q.explanation}
            </div>
          )}
        </div>

        {isAnswered && (
          <Button className="w-full gap-2" onClick={handleNext}>
            {current < questions.length - 1 ? 'Next Question' : 'See Results'} <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}

export default function LearnPage({ params }: LearnPageProps) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';
  const { toast } = useToast();
  const { user: currentUser, profile: studentProfile, isLoading: isUserLoading } = useStudentProfile();
  
  const [course, setCourse] = useState<Course | undefined | null>(undefined);
  const [activeLesson, setActiveLesson] = useState<Lesson | undefined>();
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);

  const [signedLessonMediaUrl, setSignedLessonMediaUrl] = useState<string | null>(null);
  const [isResolvingLessonMedia, setIsResolvingLessonMedia] = useState(false);
  const [lessonPlaybackToken, setLessonPlaybackToken] = useState<string | null>(null);
  const [signedResourceUrl, setSignedResourceUrl] = useState<string | null>(null);
  const [isResolvingResourceUrl, setIsResolvingResourceUrl] = useState(false);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isSyncingAccess, setIsSyncingAccess] = useState(false);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) return;

      // Wait for auth to resolve before making any access decisions
      if (isUserLoading) return;

      if (!currentUser) {
        router.replace(`/login?redirect=/student-dashboard/learn/${courseId}`);
        setIsDataLoading(false);
        return;
      }

      // Don't evaluate enrollment until the profile has fully loaded from Firestore.
      // Without this guard the check runs with a null profile and incorrectly denies access.
      if (!studentProfile) {
        // Still loading profile — keep spinner, do NOT redirect
        setIsDataLoading(true);
        return;
      }

      setIsDataLoading(true);
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData || null);

        setUserProfile(studentProfile);
        const enrollment = studentProfile.enrollments?.find(e => e.courseId === courseId);
        const hasAdminBypass = isAdminRole(studentProfile.role);
        const hasTutorPreviewBypass = isPreviewMode && studentProfile.role === 'tutor' && courseData?.tutorId === currentUser.uid;

        if (!enrollment && !hasAdminBypass && !hasTutorPreviewBypass) {
          // Enrollment not in profile — check Firestore orders to see if a recent
          // SUCCESSFUL (Delivered) purchase exists for this course (webhook may still
          // be processing). Limiting to 'Delivered' avoids spurious retries for
          // old/cancelled orders that happen to list the same courseId.
          const { getOrders } = await import('@/lib/finance-data');
          const userOrders = await getOrders(currentUser.uid);
          const hasSuccessfulPurchase = userOrders.some(
            o =>
              o.status === 'Delivered' &&
              Array.isArray(o.courseIds) &&
              o.courseIds.includes(courseId)
          );

          if (hasSuccessfulPurchase) {
            // Order exists but enrollment not yet written — webhook latency.
            // Show syncing UI and retry profile load up to 3 times.
            setIsSyncingAccess(true);
            let enrollmentSynced = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 1500));
              const { getUserById } = await import('@/lib/user-data');
              const freshProfile = await getUserById(currentUser.uid);
              if (freshProfile?.enrollments?.some(e => e.courseId === courseId)) {
                setUserProfile(freshProfile);
                const freshEnrollment = freshProfile.enrollments.find(e => e.courseId === courseId);
                setCompletedLessons(new Set(freshEnrollment?.completedLessons ?? []));
                enrollmentSynced = true;
                break;
              }
            }
            setIsSyncingAccess(false);

            if (!enrollmentSynced) {
              setIsAccessDenied(true);
              toast({
                variant: 'destructive',
                title: 'Access sync failed',
                description: 'Your enrollment is still processing. Please try again in a moment.',
              });
              router.replace(`/course/${courseId}`);
              return;
            }
          } else {
            // No order found — could be a free enrollment whose profile update is
            // momentarily stale. Do one quick retry before denying access.
            setIsSyncingAccess(true);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const { getUserById } = await import('@/lib/user-data');
            const freshProfile = await getUserById(currentUser.uid);
            setIsSyncingAccess(false);

            if (freshProfile?.enrollments?.some(e => e.courseId === courseId)) {
              setUserProfile(freshProfile);
              const freshEnrollment = freshProfile.enrollments.find(e => e.courseId === courseId);
              setCompletedLessons(new Set(freshEnrollment?.completedLessons ?? []));
            } else {
              // Genuine access denial
              setIsAccessDenied(true);
              toast({
                variant: 'destructive',
                title: 'Access denied',
                description: 'You must be enrolled in this course to access lessons.',
              });
              router.replace(`/course/${courseId}`);
              return;
            }
          }
        } else {
          if (enrollment) {
            setCompletedLessons(new Set(enrollment.completedLessons));
          } else {
            setCompletedLessons(new Set());
          }
        }
      } catch (error) {
        console.error('Failed to fetch course data:', error);
        setCourse(null);
      } finally {
        setIsDataLoading(false);
      }
    };

    void fetchCourseData();
  }, [courseId, currentUser, isPreviewMode, isUserLoading, router, studentProfile, toast]);

  useEffect(() => {
    let cancelled = false;

    const resolveVideoUrl = async () => {
      const contentPath = activeLesson?.contentUrl;
      if (!contentPath || activeLesson?.type !== 'video') {
        setSignedLessonMediaUrl(null);
        setLessonPlaybackToken(null);
        setIsResolvingLessonMedia(false);
        return;
      }

      if (getYouTubeEmbedUrl(contentPath)) {
        setSignedLessonMediaUrl(null);
        setLessonPlaybackToken(null);
        setIsResolvingLessonMedia(false);
        return;
      }

      if (contentPath.startsWith('http')) {
        setSignedLessonMediaUrl(contentPath);
        setLessonPlaybackToken(null);
        setIsResolvingLessonMedia(false);
        return;
      }

      if (contentPath.startsWith('public/')) {
        setSignedLessonMediaUrl(resolveMediaUrl(contentPath));
        setLessonPlaybackToken(null);
        setIsResolvingLessonMedia(false);
        return;
      }

      try {
        setIsResolvingLessonMedia(true);
        const idToken = currentUser ? await currentUser.getIdToken(true) : '';
        const playbackResult = await fetch('/api/media/playback-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ key: contentPath }),
        }).then((response) => response.json());
        if (cancelled) return;

        if (playbackResult?.token) {
          setLessonPlaybackToken(playbackResult.token);
          setSignedLessonMediaUrl(`/api/media/stream?key=${encodeURIComponent(contentPath)}&pt=${encodeURIComponent(playbackResult.token)}`);
        } else {
          setSignedLessonMediaUrl(null);
          setLessonPlaybackToken(null);
        }
      } catch {
        if (!cancelled) {
          setSignedLessonMediaUrl(null);
          setLessonPlaybackToken(null);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingLessonMedia(false);
        }
      }
    };

    void resolveVideoUrl();
    return () => {
      cancelled = true;
    };
  }, [activeLesson?.contentUrl, activeLesson?.type, currentUser, currentUser?.uid]);

  useEffect(() => {
    let cancelled = false;

    const resolveResourceUrl = async () => {
      const contentPath = activeLesson?.contentUrl;
      if (!contentPath || activeLesson?.type !== 'resource') {
        setSignedResourceUrl(null);
        setIsResolvingResourceUrl(false);
        return;
      }

      if (contentPath.startsWith('http')) {
        setSignedResourceUrl(contentPath);
        setIsResolvingResourceUrl(false);
        return;
      }

      if (contentPath.startsWith('public/')) {
        setSignedResourceUrl(resolveMediaUrl(contentPath));
        setIsResolvingResourceUrl(false);
        return;
      }

      try {
        setIsResolvingResourceUrl(true);
        const idToken = currentUser ? await currentUser.getIdToken() : '';
        const fileName = contentPath.split('/').pop();
        const result = await generateSignedDownloadUrl(idToken, contentPath, fileName);
        if (cancelled) return;

        if (typeof result === 'string') {
          setSignedResourceUrl(result);
        } else {
          setSignedResourceUrl(null);
        }
      } catch {
        if (!cancelled) {
          setSignedResourceUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingResourceUrl(false);
        }
      }
    };

    void resolveResourceUrl();
    return () => {
      cancelled = true;
    };
  }, [activeLesson?.contentUrl, activeLesson?.type, currentUser, currentUser?.uid]);

  const curriculumData = useMemo<CurriculumResult>(() => {
    const emptyResult: CurriculumResult = {
      totalLessons: 0,
      lessonMap: new Map<string, LessonPosition>(),
      firstLesson: null,
      getLessonByIndex: () => null
    };

    if (!course?.sections) return emptyResult;

    let count = 0;
    const map = new Map<string, LessonPosition>();
    const flatLessonsArray: LessonSectionPair[] = [];
    let first: LessonSectionPair | null = null;

    course.sections.forEach((section, sectionIndex) => {
      if (section.lessons) {
        section.lessons.forEach((lesson, lessonIndex) => {
          const position: LessonPosition = { lesson, section, index: lessonIndex, sectionIndex };
          const pair: LessonSectionPair = { lesson, section };
          if (!first) first = pair;
          map.set(lesson.id, position);
          flatLessonsArray.push(pair);
          count++;
        });
      }
    });
    
    const getLessonByIndex = (index: number): LessonSectionPair | null => {
        if (index >= 0 && index < flatLessonsArray.length) {
            return flatLessonsArray[index];
        }
        return null;
    }

    return { totalLessons: count, lessonMap: map, firstLesson: first, getLessonByIndex };
  }, [course]);

  const { firstLesson, lessonMap, getLessonByIndex } = curriculumData;
  const totalLessons = getCourseLessonCount(course || undefined);
  
  useEffect(() => {
    if (firstLesson && !activeLesson) {
      setActiveLesson(firstLesson.lesson);
    }
  }, [firstLesson, activeLesson]);

  const handleLessonSelect = useCallback((lesson: Lesson, _section: Section) => {
    setActiveLesson(lesson);
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const progress = totalLessons > 0 ? (completedLessons.size / totalLessons) * 100 : 0;

  const getNextPrevLesson = useCallback((direction: 'next' | 'prev'): LessonSectionPair | null => {
    if (!activeLesson || !course?.sections) return null;

    const currentPos = lessonMap.get(activeLesson.id);
    if (!currentPos) return null;

    let globalIndex = 0;
    for (let i = 0; i < currentPos.sectionIndex; i++) {
        globalIndex += course.sections[i].lessons?.length || 0;
    }
    globalIndex += currentPos.index;

    const targetIndex = direction === 'next' ? globalIndex + 1 : globalIndex - 1;
    return getLessonByIndex(targetIndex);
  }, [activeLesson, course, lessonMap, getLessonByIndex]);

  const handleNavigation = (direction: 'next' | 'prev') => {
    const next = getNextPrevLesson(direction);
    if (next) {
        handleLessonSelect(next.lesson, next.section);
    }
  }

  const handleToggleComplete = async () => {
    if (isPreviewMode) {
      toast({ title: 'Preview mode', description: 'Progress tracking is disabled in preview mode.' });
      return;
    }
    if (!activeLesson || !currentUser || !userProfile) return;
    
    const newCompleted = new Set(completedLessons);
    if (newCompleted.has(activeLesson.id)) {
      newCompleted.delete(activeLesson.id);
    } else {
      newCompleted.add(activeLesson.id);
      // Record study analytics — non-blocking, does not affect UI flow
      void recordStudySession(currentUser.uid, course?.title ?? '', activeLesson.duration ?? 10);
      
      // Check if course is now 100% complete
      if (totalLessons > 0 && newCompleted.size === totalLessons) {
        setShowCompletionCelebration(true);
      } else {
        const next = getNextPrevLesson('next');
        if (next) handleLessonSelect(next.lesson, next.section);
      }
    }
    setCompletedLessons(newCompleted);

    try {
      await userData.updateEnrollmentCompletedLessons(currentUser.uid, courseId, Array.from(newCompleted));
      const updatedProfile: AppUser = {
        ...userProfile,
        enrollments: userProfile.enrollments.map(e =>
          e.courseId === courseId ? { ...e, completedLessons: Array.from(newCompleted) } : e
        ),
      };
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error("Progress save failed:", error);
    }
  };

  const getIconForType = (type: Lesson['type']) => {
    switch (type) {
      case 'video': return <PlayCircle className="h-5 w-5 shrink-0" />;
      case 'quiz': return <HelpCircle className="h-5 w-5 shrink-0" />;
      case 'assignment': return <ClipboardCheck className="h-5 w-5 shrink-0" />;
      case 'document': return <FileText className="h-5 w-5 shrink-0" />;
      case 'resource': return <Download className="h-5 w-5 shrink-0" />;
      case 'text': return <BookText className="h-5 w-5 shrink-0" />;
      default: return <BookText className="h-5 w-5 shrink-0" />;
    }
  };

  const SyllabusList = () => {
    if (!course?.sections) return null;
    return (
      <Accordion type="single" collapsible defaultValue="item-0" className="space-y-2">
        {course.sections.map((section, index) => (
          <AccordionItem value={`item-${index}`} key={section.id || index} className="border-none">
            <AccordionTrigger className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card hover:no-underline shadow-sm border">
              <div className="flex items-center gap-3 text-left w-full">
                <div className="h-7 w-7 rounded-full flex items-center justify-center bg-primary/5 text-primary border border-primary/10">
                  <span className="text-[10px] font-black">{index + 1}</span>
                </div>
                <p className="font-bold text-xs truncate uppercase tracking-tight">{section.title}</p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 px-1 pb-4">
              <ul className="space-y-1">
                {section.lessons?.map((lesson) => (
                  <li key={lesson.id}>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "w-full justify-start h-auto p-3 text-left rounded-lg transition-all",
                        activeLesson?.id === lesson.id ? "bg-primary/5 border-primary/10 shadow-sm" : "text-muted-foreground" 
                      )}
                      onClick={() => handleLessonSelect(lesson, section)}
                    >
                      {completedLessons.has(lesson.id) ? <CheckCircle className="mr-3 h-4 w-4 text-success shrink-0" /> : <div className="mr-3 shrink-0">{getIconForType(lesson.type)}</div>}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold truncate", activeLesson?.id === lesson.id ? "text-foreground" : "")}>{lesson.title}</p>
                        <p className="text-[9px] font-black uppercase opacity-60 mt-0.5">{lesson.duration || 0}m • {lesson.type}</p>
                      </div>
                    </Button>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  if (isUserLoading || isDataLoading) {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            {isSyncingAccess && (
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">Syncing access…</p>
                <p className="text-xs text-muted-foreground">We are confirming your enrollment. This takes just a moment.</p>
              </div>
            )}
        </div>
    );
  }

  if (course === null) {
    notFound();
  }

  if (!course) return null;

  if (isAccessDenied) return null;

  const activeContentPath = activeLesson?.contentUrl || '';
  const youtubeEmbedUrl = activeLesson?.type === 'video' && activeContentPath ? getYouTubeEmbedUrl(activeContentPath) : null;
  const videoSource = signedLessonMediaUrl || (activeContentPath.startsWith('http') ? activeContentPath : '');

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-5rem)] lg:overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-h-0 bg-background lg:border-r overflow-y-auto">
        <div className="p-4 lg:p-8 xl:p-10 space-y-8">
          {isPreviewMode && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Preview mode is active. You are viewing this course as a student; progress and interactions are read-only.
            </div>
          )}
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/student-dashboard' },
              { label: 'My Courses', href: '/student-dashboard' },
              { label: course.title },
            ]}
            className="mb-0"
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-primary/60 mb-1">Now Learning</p>
              <h1 className="text-2xl lg:text-3xl font-black font-headline text-foreground leading-tight">{course.title}</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/student-dashboard')} className="text-xs font-bold gap-2 rounded-full px-4 h-9">
              <ChevronLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>

          {!isPreviewMode && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/25 p-3 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground sm:mr-1">AI study</span>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm" className="h-8 rounded-full text-xs font-bold gap-1.5 px-3">
                  <Link href={`/student-dashboard/ai-assistant?course=${encodeURIComponent(courseId)}&tab=chat`}>
                    <Bot className="h-3.5 w-3.5" />
                    Tutor chat
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm" className="h-8 rounded-full text-xs font-bold gap-1.5 px-3">
                  <Link href={`/student-dashboard/ai-assistant?course=${encodeURIComponent(courseId)}&tab=flashcards`}>
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Flashcards
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm" className="h-8 rounded-full text-xs font-bold gap-1.5 px-3">
                  <Link href={`/student-dashboard/ai-assistant?course=${encodeURIComponent(courseId)}&tab=exam`}>
                    <ClipboardList className="h-3.5 w-3.5" />
                    Exam practice
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs font-bold gap-1.5 px-3">
                  <Link href={`/student-dashboard/ai-assistant?course=${encodeURIComponent(courseId)}&tab=materials`}>
                    <FileText className="h-3.5 w-3.5" />
                    Materials
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <Card className="overflow-hidden rounded-2xl shadow-xl border-none bg-slate-950">
            {activeLesson?.type === 'video' && activeLesson.contentUrl ? (
              <AspectRatio ratio={16 / 9}>
                {youtubeEmbedUrl ? (
                  <iframe
                    title={activeLesson.title}
                    src={youtubeEmbedUrl}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  isResolvingLessonMedia ? (
                    <div className="flex h-full w-full flex-col items-center justify-center text-white/60 gap-3">
                      <Loader2 className="h-10 w-10 animate-spin opacity-70" />
                      <p className="text-xs font-bold uppercase">Loading video...</p>
                    </div>
                  ) : videoSource ? (
                    <ProtectedMediaShell watermarkText={`PROTECTED • ${currentUser?.uid || 'STUDENT'}`}>
                      <video controls controlsList="nodownload noplaybackrate" disablePictureInPicture onContextMenu={(event) => event.preventDefault()} className="h-full w-full bg-black" key={`${videoSource}-${lessonPlaybackToken || ''}`}>
                        <source src={videoSource} />
                      </video>
                    </ProtectedMediaShell>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-white/60 gap-3">
                      <Video className="h-12 w-12 opacity-30" />
                      <p className="text-xs font-bold uppercase">Video source unavailable</p>
                    </div>
                  )
                )
              }
              </AspectRatio>
            ) : (activeLesson?.type === 'document' || activeLesson?.type === 'pdf' || activeLesson?.type === 'assignment') && activeLesson.contentUrl ? (
              <div className="h-[650px] w-full bg-background relative">
                <DocumentViewer path={activeLesson.contentUrl} allowDownload={!activeLesson.contentUrl.toLowerCase().endsWith('.pdf')} />
              </div>
            ) : activeLesson?.type === 'resource' && activeLesson.contentUrl ? (
              <AspectRatio ratio={16 / 9}>
                <div className="h-full w-full bg-background p-6 flex items-center justify-center">
                  <Card className="w-full max-w-xl border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-black flex items-center gap-2"><Download className="h-5 w-5 text-primary" /> Resource File</CardTitle>
                      <CardDescription>This lesson provides a downloadable material file.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground break-all">{activeLesson.contentUrl}</p>
                      {isResolvingResourceUrl ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing secure download...</div>
                      ) : signedResourceUrl ? (
                        <Button asChild className="font-bold gap-2">
                          <a href={signedResourceUrl} target="_blank" rel="noopener noreferrer" download>
                            <Download className="h-4 w-4" /> Download Resource
                          </a>
                        </Button>
                      ) : (
                        <p className="text-sm text-destructive">Unable to resolve this resource file.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </AspectRatio>
            ) : activeLesson?.type === 'text' ? (
              <div className="h-[550px] w-full bg-background">
                <ScrollArea className="h-full p-6"><div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">{activeLesson.description}</div></ScrollArea>
              </div>
            ) : activeLesson?.type === 'quiz' ? (
              <div className="h-[550px] w-full">
                <QuizPlayer
                  key={activeLesson.id}
                  questions={activeLesson.quiz || []}
                  onComplete={handleToggleComplete}
                />
              </div>
            ) : (
              <AspectRatio ratio={16 / 9}>
                <div className="flex h-full w-full flex-col items-center justify-center text-white/50 gap-4"><Video className="h-16 w-16 opacity-20" /><p className="text-xs font-black uppercase">No Content Selected</p></div>
              </AspectRatio>
            )}
          </Card>

          {activeLesson && activeLesson.type !== 'text' && activeLesson.description?.trim() && (
            <div className="rounded-2xl border border-border/50 bg-card/50 p-5 lg:p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">About this lesson</p>
              <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground leading-relaxed">
                <p className="whitespace-pre-wrap m-0">{activeLesson.description}</p>
              </div>
            </div>
          )}

          <div className="lg:hidden space-y-4 pb-12">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                <List className="h-4 w-4 text-primary" />
                Course schedule
              </h3>
              <span className="text-[10px] font-bold text-muted-foreground">{Math.round(progress)}% done</span>
            </div>
            <SyllabusList />
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-[360px] xl:w-[400px] flex-col bg-muted/10 shrink-0 border-l h-full">
        <div className="p-6 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-black font-headline uppercase tracking-widest flex items-center gap-2"><Layout className="h-4 w-4 text-primary" />Course Content</h3><Badge variant="outline" className="text-[10px] font-black">{Math.round(progress)}%</Badge></div>
          <Progress value={progress} className="h-1.5" />
        </div>
        <ScrollArea className="flex-1"><div className="p-4"><SyllabusList /></div></ScrollArea>
        <div className="p-4 border-t bg-muted/30 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="sm" onClick={() => handleNavigation('prev')} disabled={!getNextPrevLesson('prev')} className="font-bold h-10 uppercase text-[10px]"><ChevronLeft className="h-3 w-3 mr-1" /> Prev</Button>
            <Button size="sm" onClick={() => handleNavigation('next')} disabled={!getNextPrevLesson('next')} className="font-bold h-10 uppercase text-[10px]">Next <ChevronRight className="h-3 w-3 ml-1" /></Button>
          </div>
          <Button onClick={handleToggleComplete} className={cn("w-full mt-3 h-10 font-black text-[10px] uppercase gap-2 rounded-full shadow-md", completedLessons.has(activeLesson?.id || '') ? "bg-success hover:bg-success/90" : "bg-primary")}>{completedLessons.has(activeLesson?.id || '') ? <><CheckCircle size={14} /> Completed</> : "Mark as Complete"}</Button>
        </div>
      </div>

      <div className="lg:hidden sticky bottom-0 z-50 bg-background border-t p-4 flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <Button variant="outline" className="flex-1 h-12 font-bold text-xs rounded-xl" onClick={() => handleNavigation('prev')} disabled={!getNextPrevLesson('prev')}><ChevronLeft size={16} /></Button>
        <Button onClick={handleToggleComplete} className={cn("flex-[2] h-12 font-black text-xs uppercase gap-2 rounded-xl shadow-lg", (activeLesson && completedLessons.has(activeLesson.id)) ? "bg-success hover:bg-success/90" : "bg-primary")}>{(activeLesson && completedLessons.has(activeLesson.id)) ? "Done" : "Mark Done"}</Button>
        <Button variant="outline" className="flex-1 h-12 font-bold text-xs rounded-xl" onClick={() => handleNavigation('next')} disabled={!getNextPrevLesson('next')}><ChevronRight size={16} /></Button>
      </div>

      {/* Course Completion Celebration Modal */}
      {showCompletionCelebration && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="mx-auto w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-headline text-foreground">Course Completed!</h2>
              <p className="text-muted-foreground mt-2">
                Congratulations! You&apos;ve completed all {totalLessons} lessons in <strong>{course.title}</strong>.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full h-12 font-black gap-2 rounded-full shadow-lg"
                onClick={() => {
                  setShowCompletionCelebration(false);
                  router.push('/student-dashboard/certificates');
                }}
              >
                <PartyPopper className="h-4 w-4" /> View Certificates
              </Button>
              <Button
                variant="outline"
                className="w-full h-10 font-bold rounded-full"
                onClick={() => setShowCompletionCelebration(false)}
              >
                Continue Reviewing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
