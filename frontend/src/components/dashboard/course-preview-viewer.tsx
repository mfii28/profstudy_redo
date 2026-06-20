'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCourseById } from '@/lib/course-data';
import type { Course, Lesson, Section, QuizQuestion } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, PlayCircle, FileText, HelpCircle, BookOpen, ChevronLeft, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentViewer } from '@/components/document-viewer';
import { resolveMediaUrl } from '@/lib/media-url';
import { generateSignedUrl } from '@/app/actions/documents';
import { useUser } from '@/firebase';

const getYouTubeEmbedUrl = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') {
            const id = parsed.pathname.split('/').filter(Boolean)[0];
            return id ? `https://www.youtube.com/embed/${id}` : null;
        }
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            if (parsed.pathname === '/watch') return parsed.searchParams.get('v') ? `https://www.youtube.com/embed/${parsed.searchParams.get('v')}` : null;
            const pathId = parsed.pathname.split('/').pop();
            return pathId ? `https://www.youtube.com/embed/${pathId}` : null;
        }
    } catch { /* not a URL */ }
    return null;
};

function LessonIcon({ type }: { type: Lesson['type'] }) {
    if (type === 'video') return <PlayCircle className="h-4 w-4 shrink-0 text-primary" />;
    if (type === 'document' || type === 'pdf') return <FileText className="h-4 w-4 shrink-0 text-blue-500" />;
    if (type === 'quiz') return <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />;
    return <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function QuizReadOnly({ questions }: { questions: QuizQuestion[] }) {
    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="h-5 w-5 text-amber-500" />
                <span className="font-bold text-sm uppercase tracking-wide text-muted-foreground">Quiz Preview — Read Only</span>
            </div>
            {questions.map((q, qi) => (
                <Card key={qi} className="border">
                    <CardContent className="pt-4 space-y-3">
                        <p className="font-semibold text-sm">{qi + 1}. {q.questionText}</p>
                        <div className="space-y-2">
                            {q.options.map((opt, oi) => (
                                <div
                                    key={oi}
                                    className={cn(
                                        'rounded-lg border px-4 py-2.5 text-sm',
                                        oi === q.correctAnswerIndex
                                            ? 'border-green-300 bg-green-50 text-green-800 font-semibold'
                                            : 'border-border bg-background text-muted-foreground'
                                    )}
                                >
                                    <span className="font-mono mr-2 text-xs opacity-60">{String.fromCharCode(65 + oi)}.</span>
                                    {opt}
                                    {oi === q.correctAnswerIndex && <span className="ml-2 text-xs text-green-600">(Correct Answer)</span>}
                                </div>
                            ))}
                        </div>
                        {q.explanation && (
                            <p className="text-xs text-muted-foreground italic border-t pt-2">
                                <span className="font-semibold not-italic">Explanation: </span>{q.explanation}
                            </p>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function VideoContent({ contentUrl }: { contentUrl: string }) {
    const { user } = useUser();
    const [src, setSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const youtubeUrl = getYouTubeEmbedUrl(contentUrl);
                if (youtubeUrl) {
                    setSrc(youtubeUrl);
                    setIsLoading(false);
                    return;
                }
                if (contentUrl.startsWith('http')) {
                    setSrc(contentUrl);
                    setIsLoading(false);
                    return;
                }
                if (user) {
                    const idToken = await user.getIdToken();
                    const result = await generateSignedUrl(idToken, contentUrl);
                    if (typeof result === 'string') setSrc(result);
                    else if (typeof result === 'object' && 'url' in result) setSrc((result as { url: string }).url);
                } else {
                    setSrc(resolveMediaUrl(contentUrl));
                }
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [contentUrl, user]);

    const isYouTube = src && src.includes('youtube.com/embed');

    if (isLoading) {
        return (
            <div className="aspect-video bg-black flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
        );
    }

    if (!src) {
        return (
            <div className="aspect-video bg-black flex items-center justify-center text-white/50 text-sm">
                Video content not available
            </div>
        );
    }

    return (
        <div className="aspect-video bg-black">
            {isYouTube ? (
                <iframe
                    src={src}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            ) : (
                <video
                    key={src}
                    controls
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    className="h-full w-full"
                >
                    <source src={src} />
                </video>
            )}
        </div>
    );
}

function LessonContent({ lesson }: { lesson: Lesson }) {
    if (lesson.type === 'video') {
        if (!lesson.contentUrl) {
            return (
                <div className="aspect-video bg-black flex items-center justify-center text-white/50 text-sm">
                    No video content uploaded yet
                </div>
            );
        }
        return <VideoContent contentUrl={lesson.contentUrl} />;
    }

    if (lesson.type === 'quiz') {
        const questions = lesson.quiz || [];
        if (questions.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                    <HelpCircle className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No quiz questions added yet</p>
                </div>
            );
        }
        return <QuizReadOnly questions={questions} />;
    }

    if ((lesson.type === 'document' || lesson.type === 'pdf') && lesson.contentUrl) {
        return (
            <div className="h-[60vh] min-h-[400px]">
                <DocumentViewer path={lesson.contentUrl} allowDownload={false} />
            </div>
        );
    }

    if (lesson.type === 'resource' || lesson.type === 'text') {
        return (
            <div className="p-6 prose prose-sm max-w-none">
                {lesson.description ? (
                    <p>{lesson.description}</p>
                ) : lesson.contentUrl ? (
                    <p className="text-muted-foreground">Resource: <a href={lesson.contentUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{lesson.contentUrl}</a></p>
                ) : (
                    <p className="text-muted-foreground italic">No content uploaded for this lesson yet.</p>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <AlertCircle className="h-10 w-10 opacity-30" />
            <p className="text-sm">No content available for this lesson</p>
        </div>
    );
}

export function CoursePreviewViewer({ courseId }: { courseId: string }) {
    const router = useRouter();
    const [course, setCourse] = useState<Course | null | undefined>(undefined);
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    useEffect(() => {
        getCourseById(courseId).then(data => {
            setCourse(data || null);
            if (data?.sections?.[0]?.lessons?.[0]) {
                setActiveLesson(data.sections[0].lessons[0]);
                setActiveSectionId(data.sections[0].id);
            }
        });
    }, [courseId]);

    if (course === undefined) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (course === null) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>Course not found</p>
            </div>
        );
    }

    const allLessons = course.sections?.flatMap(s => s.lessons) || [];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-amber-50 border-amber-200 shrink-0">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 shrink-0" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] uppercase tracking-wider shrink-0">Preview Mode</Badge>
                        <p className="text-xs text-amber-800 font-medium truncate">Viewing as a student would see the course. No progress is tracked.</p>
                    </div>
                    <p className="font-bold text-sm truncate text-foreground">{course.title}</p>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-72 border-r shrink-0 flex flex-col">
                    <div className="p-3 border-b bg-muted/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {allLessons.length} lesson{allLessons.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <ScrollArea className="flex-1">
                        <Accordion
                            type="multiple"
                            defaultValue={course.sections?.map(s => s.id) || []}
                            className="p-2"
                        >
                            {course.sections?.map(section => (
                                <AccordionItem key={section.id} value={section.id} className="border-none">
                                    <AccordionTrigger className="text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-lg hover:no-underline hover:bg-muted/50">
                                        {section.title}
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-1">
                                        <div className="space-y-0.5 pl-2">
                                            {section.lessons.map(lesson => (
                                                <button
                                                    key={lesson.id}
                                                    onClick={() => { setActiveLesson(lesson); setActiveSectionId(section.id); }}
                                                    className={cn(
                                                        'w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors',
                                                        activeLesson?.id === lesson.id
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                                    )}
                                                >
                                                    <LessonIcon type={lesson.type} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium leading-tight truncate">{lesson.title}</p>
                                                        <p className="text-[10px] opacity-70 mt-0.5 capitalize">{lesson.type} · {lesson.duration}min</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </ScrollArea>
                </aside>

                <main className="flex-1 overflow-y-auto">
                    {activeLesson ? (
                        <div>
                            <div className="px-6 py-4 border-b bg-muted/10">
                                <p className="text-xs text-muted-foreground uppercase font-mono tracking-wide">{activeLesson.type}</p>
                                <h2 className="text-lg font-bold">{activeLesson.title}</h2>
                                {activeLesson.description && <p className="text-sm text-muted-foreground mt-1">{activeLesson.description}</p>}
                            </div>
                            <LessonContent lesson={activeLesson} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                            <BookOpen className="h-16 w-16 opacity-20" />
                            <p className="text-sm">Select a lesson from the left panel to preview its content</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
