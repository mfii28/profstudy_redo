'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bot,
  Loader2,
  Send,
  User,
  Sparkles,
  Settings2,
  BookOpen,
  BrainCircuit,
  RefreshCcw,
  Zap,
  History,
  FileText,
  CheckCircle2,
  ClipboardList,
  Trash2,
  ArrowRight,
  GraduationCap,
  CircleDot,
  XCircle,
} from 'lucide-react';
import { generateFlashcards } from '@/ai/flows/flashcard-generation';
import { generateExamPractice, gradeShortAnswer } from '@/ai/flows/exam-practice';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveAvatarUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { getCoursesByIds } from '@/lib/course-data';
import { saveAiInteraction, getAiHistory, deleteAiInteraction } from '@/lib/ai-history-data';
import { type Course, type AiInteraction } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import {
  retrieveCourseChunksForStudent,
  getCourseRagStatsForStudent,
  type CourseRagStats,
  type RetrievedChunk,
} from '@/app/actions/rag';
import type { ExamPracticeOutput } from '@/ai/schemas/exam-practice';

type ExamItem = ExamPracticeOutput['items'][number];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sourceDocs?: string[];
}

type Persona = 'Friendly' | 'Strict' | 'Beginner' | 'Expert' | 'Exam Coach';

const PERSONAS: { id: Persona; label: string; description: string }[] = [
  { id: 'Friendly', label: 'Friendly Tutor', description: 'Warm, supportive, and uses simple language.' },
  { id: 'Strict', label: 'Strict Tutor', description: 'Formal, rigorous, and demands precision.' },
  { id: 'Beginner', label: 'Beginner Mode', description: 'Patient, uses analogies, explains all jargon.' },
  { id: 'Expert', label: 'Expert Mode', description: 'Technical, deep-dives into professional standards.' },
  { id: 'Exam Coach', label: 'Exam Coach', description: 'Focused on exam strategy and marking schemes.' },
];

const TAB_IDS = ['chat', 'materials', 'flashcards', 'exam', 'history'] as const;
type TabId = (typeof TAB_IDS)[number];

function buildLessonOutline(course: Course | undefined): string {
  if (!course?.sections?.length) return 'No structured outline available.';
  return course.sections
    .flatMap(s => (s.lessons || []).map(l => `${s.title}: ${l.title} — ${l.description || ''}`))
    .join('\n');
}

export default function AiStudyTutorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser, profile } = useStudentProfile();
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<Persona>('Friendly');
  const [tab, setTab] = useState<TabId>('chat');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [courseRagStats, setCourseRagStats] = useState<CourseRagStats | null>(null);
  const [courseRagLoading, setCourseRagLoading] = useState(false);

  const [flashcards, setFlashcards] = useState<{ front: string; back: string }[]>([]);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [flashcardTopic, setFlashcardTopic] = useState('');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardRatings, setCardRatings] = useState<Record<number, 'easy' | 'hard'>>({});

  const [examTopic, setExamTopic] = useState('');
  const [examCount, setExamCount] = useState(6);
  const [examItems, setExamItems] = useState<ExamItem[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examLoading, setExamLoading] = useState(false);
  const [examMcqPick, setExamMcqPick] = useState<number | null>(null);
  const [examShortDraft, setExamShortDraft] = useState('');
  const [examShortResult, setExamShortResult] = useState<{ feedback: string; score: number; isCorrect: boolean } | null>(null);
  const [examShortSubmitting, setExamShortSubmitting] = useState(false);

  const [aiHistory, setAiHistory] = useState<AiInteraction[]>([]);

  const { toast } = useToast();

  const selectedCourse = useMemo(
    () => enrolledCourses.find(c => c.id === selectedCourseId),
    [enrolledCourses, selectedCourseId],
  );

  const refreshHistory = useCallback(async () => {
    if (!currentUser) return;
    const history = await getAiHistory(currentUser.uid);
    setAiHistory(history || []);
  }, [currentUser]);

  const loadCourseRag = useCallback(async () => {
    if (!currentUser || !selectedCourseId) {
      setCourseRagStats(null);
      return;
    }
    setCourseRagLoading(true);
    try {
      const stats = await getCourseRagStatsForStudent(currentUser.uid, selectedCourseId);
      setCourseRagStats(stats);
    } catch {
      setCourseRagStats(null);
    } finally {
      setCourseRagLoading(false);
    }
  }, [currentUser, selectedCourseId]);

  useEffect(() => {
    if (!currentUser || !profile) return;
    const init = async () => {
      try {
        const enrolledIds = (profile.enrollments || []).map(e => e.courseId);
        const courseData = await getCoursesByIds(enrolledIds);
        const courseMap = new Map(courseData.map(c => [c.id, c]));
        const courses = (profile.enrollments || [])
          .map(e => courseMap.get(e.courseId))
          .filter(Boolean) as Course[];
        setEnrolledCourses(courses);
        const qpCourse = searchParams.get('course');
        const qpTab = searchParams.get('tab');
        if (qpCourse && courses.some(c => c.id === qpCourse)) {
          setSelectedCourseId(qpCourse);
        } else if (courses.length > 0) {
          setSelectedCourseId(courses[0].id);
        }
        if (qpTab && TAB_IDS.includes(qpTab as TabId)) {
          setTab(qpTab as TabId);
        }
        await refreshHistory();
      } catch (e) {
        console.error('AI assistant init error:', e);
      }
    };
    void init();
  }, [currentUser, profile, searchParams, refreshHistory]);

  useEffect(() => {
    void loadCourseRag();
  }, [loadCourseRag]);

  const scrollToBottom = useCallback(() => {
    const el = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (el) (el as HTMLDivElement).scrollTop = (el as HTMLDivElement).scrollHeight;
  }, []);
  useEffect(() => {
    scrollToBottom();
  }, [messages, isChatLoading, scrollToBottom]);

  const persistTabInUrl = useCallback(
    (next: TabId, courseId: string) => {
      const params = new URLSearchParams();
      if (courseId) params.set('course', courseId);
      if (next !== 'chat') params.set('tab', next);
      const q = params.toString();
      router.replace(q ? `/student-dashboard/ai-assistant?${q}` : '/student-dashboard/ai-assistant', { scroll: false });
    },
    [router],
  );

  const handleTabChange = (v: string) => {
    const next = v as TabId;
    setTab(next);
    persistTabInUrl(next, selectedCourseId);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading || !currentUser || !selectedCourseId) return;

    const question = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setInput('');
    setIsChatLoading(true);

    try {
      const idToken = await currentUser.getIdToken(true);
      const outline = buildLessonOutline(selectedCourse);

      const res = await fetch('/api/student/ai-tutor-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          courseId: selectedCourseId,
          question,
          persona: selectedPersona,
          lessonOutline: outline,
        }),
      });

      let sourceDocs: string[] | undefined;
      const meta = res.headers.get('X-Tutor-Source-Docs');
      if (meta) {
        try {
          const parsed = JSON.parse(decodeURIComponent(meta)) as unknown;
          if (Array.isArray(parsed) && parsed.length && parsed.every(x => typeof x === 'string')) {
            sourceDocs = parsed as string[];
          }
        } catch {
          /* ignore */
        }
      }

      if (!res.ok || !res.body) {
        setMessages(prev => prev.slice(0, -2));
        let msg = 'Failed to get a response from the AI tutor.';
        const ct = res.headers.get('content-type') || '';
        try {
          if (ct.includes('application/json')) {
            const errBody = await res.json();
            if (errBody && typeof errBody.error === 'string') msg = errBody.error;
            if (errBody && typeof errBody.hint === 'string' && errBody.hint.trim()) {
              msg = `${msg}\n\n${errBody.hint.trim()}`;
            }
          } else {
            const text = await res.text();
            if (text.trim()) msg = text.trim().slice(0, 400);
          }
        } catch {
          /* ignore */
        }
        console.error('[ai-assistant] tutor stream HTTP', res.status, msg);
        toast({ variant: 'destructive', title: 'Error', description: msg });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const next = [...prev];
          const last = next.length - 1;
          if (last >= 0 && next[last].role === 'assistant') {
            next[last] = { role: 'assistant', content: full };
          }
          return next;
        });
      }
      full += decoder.decode();

      setMessages(prev => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === 'assistant') {
          next[last] = { role: 'assistant', content: full, sourceDocs };
        }
        return next;
      });

      await saveAiInteraction({
        userId: currentUser.uid,
        type: 'TutoringChat',
        prompt: question,
        response: full,
        tokensUsed: 1,
        courseId: selectedCourseId,
      });
      await refreshHistory();
    } catch (err) {
      console.error('[ai-assistant] tutor stream', err);
      setMessages(prev => (prev.length >= 2 && prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -2) : prev));
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to get a response from the AI tutor.',
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateCards = async () => {
    if (!currentUser || !selectedCourseId) return;
    const topic =
      flashcardTopic.trim() || selectedCourse?.title || 'General review';

    setIsGeneratingCards(true);
    try {
      let retrievedContext: RetrievedChunk[] | undefined;
      const chunks = await retrieveCourseChunksForStudent(currentUser.uid, selectedCourseId, topic, 10);
      if (chunks.length > 0) retrievedContext = chunks;

      const contentFallback =
        retrievedContext && retrievedContext.length > 0 ? undefined : buildLessonOutline(selectedCourse);

      const result = await generateFlashcards({
        topic,
        retrievedContext,
        content: contentFallback,
        count: 8,
      });

      setFlashcards(result.flashcards);
      setCurrentCardIndex(0);
      setIsCardFlipped(false);
      setCardRatings({});

      await saveAiInteraction({
        userId: currentUser.uid,
        type: 'FlashcardGeneration',
        prompt: `Flashcards: ${topic}`,
        response: result.flashcards,
        tokensUsed: 2,
        courseId: selectedCourseId,
      });
      await refreshHistory();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate flashcards.' });
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleGenerateExam = async () => {
    if (!currentUser || !selectedCourseId) return;
    const topic = examTopic.trim() || selectedCourse?.title || 'Exam practice';
    setExamLoading(true);
    setExamMcqPick(null);
    setExamShortDraft('');
    setExamShortResult(null);
    try {
      const retrieved = await retrieveCourseChunksForStudent(currentUser.uid, selectedCourseId, topic, 12);
      const syllabus = buildLessonOutline(selectedCourse);
      const out = await generateExamPractice({
        topic,
        retrievedContext: retrieved.length ? retrieved : undefined,
        syllabus: retrieved.length ? undefined : syllabus,
        count: Math.min(12, Math.max(3, examCount)),
        mcqShare: 0.55,
      });
      setExamItems(out.items);
      setExamIndex(0);
      await saveAiInteraction({
        userId: currentUser.uid,
        type: 'ExamPractice',
        prompt: `Exam generated: ${topic}`,
        response: out.items,
        tokensUsed: 3,
        courseId: selectedCourseId,
      });
      await refreshHistory();
      toast({ title: 'Practice exam ready', description: `${out.items.length} questions — work through them at your pace.` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not generate exam', description: 'Try again in a moment.' });
      setExamItems([]);
    } finally {
      setExamLoading(false);
    }
  };

  const handleGradeShort = async () => {
    const item = examItems[examIndex];
    if (!item || item.type !== 'short' || !examShortDraft.trim()) return;
    setExamShortSubmitting(true);
    setExamShortResult(null);
    try {
      const res = await gradeShortAnswer({
        question: item.question,
        modelAnswer: item.modelAnswer,
        studentAnswer: examShortDraft.trim(),
      });
      setExamShortResult({
        feedback: res.feedback,
        score: res.score,
        isCorrect: res.isCorrect,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Grading failed', description: 'Try a shorter answer or retry.' });
    } finally {
      setExamShortSubmitting(false);
    }
  };

  const resumeCourseChat = useCallback(async () => {
    if (!currentUser || !selectedCourseId) return;
    const rows = (await getAiHistory(currentUser.uid))
      .filter(h => h.type === 'TutoringChat' && h.courseId === selectedCourseId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const rebuilt: Message[] = [];
    for (const h of rows) {
      rebuilt.push({ role: 'user', content: h.prompt });
      if (typeof h.response === 'string') {
        rebuilt.push({ role: 'assistant', content: h.response });
      }
    }
    setMessages(rebuilt);
    setTab('chat');
    persistTabInUrl('chat', selectedCourseId);
    toast({ title: 'Chat restored', description: `${rebuilt.length / 2} turns loaded from history.` });
  }, [currentUser, selectedCourseId, persistTabInUrl, toast]);

  const clearChat = () => {
    setMessages([]);
    toast({ title: 'Chat cleared', description: 'Start a fresh thread. History is still saved.' });
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteAiInteraction(id);
      setAiHistory(prev => prev.filter(h => h.id !== id));
      toast({ title: 'Removed', description: 'That interaction was deleted.' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    }
  };

  if (!currentUser) return null;

  const hasIndexedMaterials = (courseRagStats?.chunkCount ?? 0) > 0;
  const currentExam = examItems[examIndex];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="mb-1 flex items-center gap-2 font-headline text-3xl font-bold">
            <BrainCircuit className="h-8 w-8 text-accent" />
            AI Study Tutor
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Ask questions, drill flashcards, and run practice exams grounded in{' '}
            <strong>your enrolled course</strong> and any materials your instructor has indexed for that course.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
            <GraduationCap className="h-3.5 w-3.5" />
            {selectedCourse?.title || 'Pick a course'}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            Course RAG · Gemini
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Select
          value={selectedCourseId}
          onValueChange={id => {
            setSelectedCourseId(id);
            persistTabInUrl(tab, id);
            setExamItems([]);
            setExamIndex(0);
            setFlashcards([]);
          }}
        >
          <SelectTrigger className="h-11 w-full md:w-[320px]">
            <BookOpen className="mr-2 h-4 w-4 text-primary" />
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {enrolledCourses.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedPersona} onValueChange={v => setSelectedPersona(v as Persona)}>
          <SelectTrigger className="h-11 w-full md:w-[280px]">
            <Settings2 className="mr-2 h-4 w-4 text-primary" />
            <SelectValue placeholder="Persona" />
          </SelectTrigger>
          <SelectContent>
            {PERSONAS.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex flex-col text-left">
                  <span className="font-bold">{p.label}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{p.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="scrollbar-hide flex h-auto flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
          <TabsTrigger value="chat" className="gap-2 rounded-lg px-4">
            <Send size={16} /> Chat
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-2 rounded-lg px-4">
            <FileText size={16} /> Materials
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="gap-2 rounded-lg px-4">
            <Zap size={16} /> Flashcards
          </TabsTrigger>
          <TabsTrigger value="exam" className="gap-2 rounded-lg px-4">
            <ClipboardList size={16} /> Exam
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-lg px-4">
            <History size={16} /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="m-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={resumeCourseChat}>
              <History className="mr-1 h-3.5 w-3.5" />
              Load chat from history
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearChat}>
              Clear thread
            </Button>
          </div>
          <Card className="flex h-[min(68vh,720px)] flex-col overflow-hidden border-none shadow-lg">
            <ScrollArea className="flex-1 bg-muted/20" ref={scrollAreaRef}>
              <div className="space-y-6 p-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center pt-12 text-center text-muted-foreground">
                    <div className="mb-4 rounded-full bg-accent/10 p-4">
                      <Sparkles className="h-12 w-12 text-accent" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-foreground">Ask your tutor</h3>
                    <p className="max-w-md text-sm leading-relaxed">
                      Answers prioritize <strong>indexed course materials</strong> when your instructor has uploaded
                      them. Otherwise the tutor uses your visible lesson outline.
                    </p>
                    {!selectedCourseId && (
                      <p className="mt-4 text-xs font-semibold text-amber-700">Select a course above to begin.</p>
                    )}
                    {selectedCourseId && !hasIndexedMaterials && (
                      <p className="mt-4 rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        No indexed materials yet for this course — answers use the lesson outline until your instructor
                        adds PDFs or transcripts.
                      </p>
                    )}
                    {hasIndexedMaterials && (
                      <p className="mt-4 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                        {courseRagStats?.chunkCount} indexed passages from {courseRagStats?.sources.length || 0} source
                        {(courseRagStats?.sources.length || 0) !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn('flex max-w-[90%] gap-3', m.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
                  >
                    <Avatar className={cn('h-9 w-9 shrink-0 border-2', m.role === 'assistant' ? 'border-accent/30' : 'border-primary/30')}>
                      <AvatarFallback>{m.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}</AvatarFallback>
                      {m.role === 'user' && <AvatarImage src={resolveAvatarUrl(currentUser.photoURL || '')} />}
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div
                        className={cn(
                          'rounded-2xl p-4 text-sm leading-relaxed shadow-sm whitespace-pre-wrap',
                          m.role === 'user'
                            ? 'rounded-tr-sm bg-primary text-primary-foreground'
                            : 'rounded-tl-sm bg-card text-foreground',
                        )}
                      >
                        {m.content}
                      </div>
                      {m.role === 'assistant' && m.sourceDocs && m.sourceDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-1">
                          {m.sourceDocs.map(d => (
                            <span
                              key={d}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
                            >
                              <FileText className="h-2.5 w-2.5" /> {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex gap-3">
                    <Avatar className="h-9 w-9 animate-pulse border-2 border-accent/30">
                      <AvatarFallback>
                        <Bot size={18} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-card p-4 text-sm text-muted-foreground shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Searching course materials…
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="border-t bg-card p-4">
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  className="h-12 flex-1 rounded-xl border border-border bg-muted/30 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={
                    selectedCourseId
                      ? `Ask about ${selectedCourse?.title ?? 'this course'}…`
                      : 'Select a course to start…'
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={isChatLoading || !selectedCourseId}
                />
                <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-xl" disabled={isChatLoading || !input.trim() || !selectedCourseId}>
                  <Send size={18} />
                </Button>
              </form>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="m-0">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Course materials (RAG)</CardTitle>
              <CardDescription>
                Instructors index PDFs, transcripts, and notes for each course. You do not upload files here — content
                is tied to the course you selected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courseRagLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedCourseId ? (
                <p className="text-sm text-muted-foreground">Select a course to see indexing status.</p>
              ) : !hasIndexedMaterials ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="font-semibold text-foreground">No indexed passages yet</p>
                  <p className="mt-2 max-w-md mx-auto">
                    When your instructor publishes indexed materials for this course, they will appear here and power
                    chat, flashcards, and exams.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      <strong>{courseRagStats?.chunkCount}</strong> passages indexed
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {(courseRagStats?.sources || []).map(src => (
                      <li
                        key={src}
                        className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium"
                      >
                        <FileText className="h-4 w-4 text-primary" />
                        {src}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flashcards" className="m-0">
          <Card className="flex min-h-[56vh] flex-col items-center justify-center border-none bg-muted/20 p-6 shadow-inner">
            {flashcards.length === 0 ? (
              <div className="w-full max-w-md space-y-6 text-center">
                <div className="mx-auto flex h-36 max-w-xs items-center justify-center rounded-3xl border-2 border-dashed border-muted-foreground/25 bg-card shadow-sm">
                  <Zap className="h-12 w-12 text-accent/30" />
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold">Flashcards from your course</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    We pull the most relevant indexed passages (or your lesson outline) and generate active-recall
                    cards. Optional topic narrows the focus.
                  </p>
                </div>
                <div className="space-y-3">
                  <input
                    className="h-11 w-full rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Topic focus (optional)…"
                    value={flashcardTopic}
                    onChange={e => setFlashcardTopic(e.target.value)}
                  />
                  <Button
                    onClick={handleGenerateCards}
                    disabled={isGeneratingCards || !selectedCourseId}
                    size="lg"
                    className="w-full rounded-full font-bold"
                  >
                    {isGeneratingCards ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" /> Generate deck
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-lg space-y-8">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span>
                    Card {Math.min(currentCardIndex + 1, flashcards.length)} / {flashcards.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setFlashcards([]);
                      setCurrentCardIndex(0);
                      setCardRatings({});
                    }}
                  >
                    <RefreshCcw className="mr-1 h-3 w-3" /> New deck
                  </Button>
                </div>

                {currentCardIndex < flashcards.length ? (
                  <>
                    <button
                      type="button"
                      className="perspective-1000 h-64 w-full cursor-pointer text-left"
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                    >
                      <div
                        className={cn(
                          'relative h-full w-full transition-transform duration-500 preserve-3d',
                          isCardFlipped && 'rotate-y-180',
                        )}
                      >
                        <Card className="absolute inset-0 flex items-center justify-center backface-hidden rounded-3xl border-none p-8 shadow-xl">
                          <p className="text-center font-headline text-lg font-bold text-primary md:text-xl">
                            {flashcards[currentCardIndex].front}
                          </p>
                          <span className="absolute bottom-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                            Tap to flip
                          </span>
                        </Card>
                        <Card className="absolute inset-0 flex rotate-y-180 items-center justify-center backface-hidden rounded-3xl border-none bg-accent p-8 text-accent-foreground shadow-xl">
                          <p className="text-center text-base leading-relaxed">{flashcards[currentCardIndex].back}</p>
                        </Card>
                      </div>
                    </button>

                    <div className="flex gap-3">
                      {!isCardFlipped ? (
                        <Button className="h-12 flex-1 rounded-xl font-bold" onClick={() => setIsCardFlipped(true)}>
                          Reveal
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            className="h-12 flex-1 rounded-xl border-red-200 font-bold text-red-600"
                            onClick={() => {
                              setCardRatings(p => ({ ...p, [currentCardIndex]: 'hard' }));
                              setCurrentCardIndex(i => i + 1);
                              setIsCardFlipped(false);
                            }}
                          >
                            Hard
                          </Button>
                          <Button
                            className="h-12 flex-1 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700"
                            onClick={() => {
                              setCardRatings(p => ({ ...p, [currentCardIndex]: 'easy' }));
                              setCurrentCardIndex(i => i + 1);
                              setIsCardFlipped(false);
                            }}
                          >
                            Easy
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 text-center">
                    <p className="text-lg font-bold">Deck complete</p>
                    <p className="text-sm text-muted-foreground">
                      Easy {Object.values(cardRatings).filter(r => r === 'easy').length} · Hard{' '}
                      {Object.values(cardRatings).filter(r => r === 'hard').length}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const hardIdx = Object.entries(cardRatings)
                          .filter(([, r]) => r === 'hard')
                          .map(([i]) => parseInt(i, 10));
                        if (hardIdx.length) {
                          setFlashcards(hardIdx.map(i => flashcards[i]));
                          setCurrentCardIndex(0);
                          setCardRatings({});
                          setIsCardFlipped(false);
                        } else {
                          setFlashcards([]);
                        }
                      }}
                    >
                      Review hard cards or start over
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="exam" className="m-0 space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5 text-primary" />
                AI practice exam
              </CardTitle>
              <CardDescription>
                Mixed MCQ and short answers from your course materials. MCQs give instant feedback; short answers are
                graded by the model against a rubric.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Focus / topic</label>
                  <input
                    className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
                    value={examTopic}
                    onChange={e => setExamTopic(e.target.value)}
                    placeholder={selectedCourse?.title || 'Topic'}
                  />
                </div>
                <div className="w-full space-y-1 sm:w-36">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Questions</label>
                  <input
                    type="number"
                    min={3}
                    max={12}
                    className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
                    value={examCount}
                    onChange={e => setExamCount(Math.min(12, Math.max(3, parseInt(e.target.value || '6', 10))))}
                  />
                </div>
                <Button onClick={handleGenerateExam} disabled={examLoading || !selectedCourseId} className="h-11 font-bold">
                  {examLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                </Button>
              </div>

              {examItems.length > 0 && currentExam && (
                <div className="space-y-4 rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Question {examIndex + 1} of {examItems.length}
                    </span>
                    <Badge variant="outline">{currentExam.type === 'mcq' ? 'Multiple choice' : 'Short answer'}</Badge>
                  </div>
                  <p className="font-semibold leading-relaxed">{currentExam.question}</p>

                  {currentExam.type === 'mcq' && currentExam.options && (
                    <div className="grid gap-2">
                      {currentExam.options.map((opt, i) => {
                        const picked = examMcqPick === i;
                        const show = examMcqPick !== null;
                        const correct = currentExam.correctIndex === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={examMcqPick !== null}
                            onClick={() => setExamMcqPick(i)}
                            className={cn(
                              'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                              !show && 'hover:border-primary/50 hover:bg-muted/50',
                              show && correct && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
                              show && picked && !correct && 'border-red-400 bg-red-50 dark:bg-red-950/30',
                            )}
                          >
                            <span className="font-bold text-primary">{String.fromCharCode(65 + i)}.</span> {opt}
                          </button>
                        );
                      })}
                      {examMcqPick !== null && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Explanation:</strong> {currentExam.modelAnswer}
                        </p>
                      )}
                    </div>
                  )}

                  {currentExam.type === 'short' && (
                    <div className="space-y-2">
                      <textarea
                        className="min-h-[120px] w-full rounded-lg border bg-background p-3 text-sm"
                        placeholder="Type your answer…"
                        value={examShortDraft}
                        onChange={e => {
                          setExamShortDraft(e.target.value);
                          setExamShortResult(null);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGradeShort}
                        disabled={examShortSubmitting || !examShortDraft.trim()}
                      >
                        {examShortSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit for grading'}
                      </Button>
                      {examShortResult && (
                        <div
                          className={cn(
                            'rounded-lg border p-3 text-sm',
                            examShortResult.isCorrect
                              ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20'
                              : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20',
                          )}
                        >
                          <p className="font-bold">
                            {examShortResult.isCorrect ? (
                              <span className="flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" /> Substantially correct
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-800">
                                <XCircle className="h-4 w-4" /> Needs improvement
                              </span>
                            )}{' '}
                            · Score {examShortResult.score}/100
                          </p>
                          <p className="mt-2 text-muted-foreground">{examShortResult.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={examIndex === 0}
                      onClick={() => {
                        setExamIndex(i => i - 1);
                        setExamMcqPick(null);
                        setExamShortDraft('');
                        setExamShortResult(null);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      disabled={examIndex >= examItems.length - 1}
                      onClick={() => {
                        setExamIndex(i => i + 1);
                        setExamMcqPick(null);
                        setExamShortDraft('');
                        setExamShortResult(null);
                      }}
                    >
                      Next
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="m-0">
          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-lg">History</CardTitle>
              <CardDescription>Delete entries you no longer need, or load tutoring turns back into chat.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {aiHistory.length > 0 ? (
                <div className="divide-y">
                  {aiHistory.map(item => (
                    <div key={item.id} className="flex gap-3 p-4 hover:bg-muted/40">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {item.type === 'TutoringChat' ? <Bot size={18} /> : <CircleDot size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold">{item.prompt}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <Badge variant="secondary" className="mb-2 mt-1 text-[9px] uppercase">
                          {item.type.replace(/([A-Z])/g, ' $1').trim()}
                          {item.courseId ? ` · ${enrolledCourses.find(c => c.id === item.courseId)?.title || item.courseId}` : ''}
                        </Badge>
                        <p className="line-clamp-3 text-xs text-muted-foreground">
                          {typeof item.response === 'string' ? item.response : JSON.stringify(item.response).slice(0, 160)}…
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => void handleDeleteHistory(item.id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-muted-foreground">
                  <History className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  <p className="text-sm font-semibold">No interactions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
