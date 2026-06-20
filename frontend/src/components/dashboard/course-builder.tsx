'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  DndContext as DndKitContext, 
  PointerSensor as DndPointerSensor, 
  KeyboardSensor as DndKeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  CheckCircle,
  GripVertical,
    Book as BookIcon,
  ClipboardList,
  PlusCircle,
  FileText,
  Video,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  BadgeCheck,
  Sparkles,
  Loader2,
  HelpCircle,
  ChevronLeft,
  XCircle,
  AlertCircle,
  CloudUpload,
  Plus,
  Target,
  ListChecks,
  Upload,
  X,
  Save,
  ImageIcon,
  SlidersHorizontal,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  BookMarked,
  Star,
  Search,
  BookOpen,
} from 'lucide-react';
import { type Course, type Section, type Lesson, type QuizQuestion, type CourseProgram, type ProgramCategory, type Book, type CourseBookRef, type User } from '@/lib/db';
import { getPrograms, addProgram as addProgramData, updateProgram as updateProgramData, deleteProgram as deleteProgramData, addCategoryToProgram, updateCategoryInProgram, deleteCategoryFromProgram } from '@/lib/programs-data';
import { QuizBuilder } from '@/components/dashboard/quiz-builder';
import { cn } from '@/lib/utils';
import { generateCourseDescription } from '@/ai/flows/course-description-generation';
import { generateSyllabus } from '@/ai/flows/syllabus-generation';
import { saveCourse } from '@/lib/course-data';
import {
  getCourseListingPrice,
  getCourseTotalListPrice,
  sumAttachedBookPrices,
} from '@/lib/course-pricing';
import { saveNewCourseWithLiveClass, ensureLiveClassForCourse } from '@/app/actions/live-class-admin';
import { createClassroom } from '@/app/actions/classroom';
import { getUserById } from '@/lib/user-data';
import { getGlobalSettings } from '@/lib/platform-settings-data';
import { isAdminRole } from '@/lib/course-access';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { logger } from '@/lib/logging';
import Link from 'next/link';
import { getPresignedUploadUrl, deleteStorageObject } from '@/app/actions/storage';
import { resolveMediaUrl } from '@/lib/media-url';
import { uploadToR2 } from '@/lib/upload-client';
import { Progress } from '@/components/ui/progress';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const ALL_STEPS = [
    { name: 'Basics', icon: BookIcon },
  { name: 'Curriculum', icon: ClipboardList },
  { name: 'Books', icon: BookMarked },
  { name: 'Pricing', icon: DollarSign },
  { name: 'Publish', icon: BadgeCheck },
];

const storageBadgeLabel = 'Cloud Storage (R2)';
const storageDescription = 'Uploaded files are stored in cloud object storage for reliable global delivery.';
const thumbnailSuccessToast = 'Thumbnail uploaded';
const resourceSuccessToast = 'Resource uploaded';
const savedIndicatorLabel = 'Save your draft before leaving';

const LESSON_TYPE_LABELS: Record<string, string> = {
    video: 'Video',
    document: 'Document',
    resource: 'Resource',
    text: 'Reading',
    quiz: 'Quiz',
    assignment: 'Assignment',
    pdf: 'PDF',
};

function migrateCoursePricingFromFirestore(course: Course): Course {
    const next: Course = { ...course };
    if (next.priceStatus === 'premium') next.priceStatus = 'paid';
    if (next.isFree === true || next.priceStatus === 'free') {
        return { ...next, priceStatus: 'free', isFree: true, price: 0, listingPrice: 0, basePrice: undefined };
    }
    const books = sumAttachedBookPrices(next);
    const listing = getCourseListingPrice(next);
    return {
        ...next,
        listingPrice: listing,
        price: listing + books,
        basePrice: undefined,
    };
}

const getLessonUploadAccept = (lessonType: Lesson['type']) => {
    switch (lessonType) {
        case 'document':
            return '.pdf,application/pdf';
        case 'video':
            return 'video/*';
        case 'resource':
            return '.xlsx,.xls,.csv,.txt,.md,.doc,.docx,.ppt,.pptx,.zip,.rar,.7z,.json,.xml,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,text/csv,application/pdf,application/zip,application/x-7z-compressed,application/x-rar-compressed';
        default:
            return '';
    }
};

const isAllowedLessonFile = (lessonType: Lesson['type'], file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mime = (file.type || '').toLowerCase();

    if (lessonType === 'document') {
        return ext === 'pdf' || mime === 'application/pdf';
    }

    if (lessonType === 'video') {
        return mime.startsWith('video/');
    }

    return true;
};

const getLessonUploadRuleText = (lessonType: Lesson['type']) => {
    if (lessonType === 'document') return 'PDF only. Students can view, but downloads are disabled.';
    if (lessonType === 'video') return 'Video files only. Students can stream, but downloads are disabled.';
    if (lessonType === 'resource') return 'Downloadable support files (Excel, TXT, MD, PDF, ZIP, DOCX, etc.).';
    return 'Attach lesson content.';
};

function resolveTrackFromProgram(programIdOrName: string): 'icag' | 'citg' | null {
    const normalized = (programIdOrName || '').toLowerCase().trim();
    if (normalized === 'icag' || normalized.includes('icag')) return 'icag';
    if (normalized === 'citg' || normalized.includes('citg')) return 'citg';
    return null;
}

function getLevelOptionsForTrack(track: 'icag' | 'citg' | null): string[] {
    if (track === 'icag') return ['Level 1', 'Level 2', 'Level 3'];
    if (track === 'citg') return ['Professional', 'Final 1', 'Final 2'];
    return [];
}

function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: value || '',
        editorProps: {
            attributes: {
                class: 'min-h-[160px] p-3 text-sm focus:outline-none',
                'data-rte': '',
                'data-placeholder': placeholder || 'Start typing...',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        if (editor.getHTML() !== (value || '')) {
            editor.commands.setContent(value || '', { emitUpdate: false });
        }
    }, [value]);

    return (
        <div className="border rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-ring">
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
                <button type="button" onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }} title="Bold" className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", editor?.isActive('bold') && "bg-muted text-foreground")}>
                    <Bold className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }} title="Italic" className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", editor?.isActive('italic') && "bg-muted text-foreground")}>
                    <Italic className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleStrike().run(); }} title="Strikethrough" className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", editor?.isActive('strike') && "bg-muted text-foreground")}>
                    <Strikethrough className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-border mx-0.5" />
                <button type="button" onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }} title="Bullet List" className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", editor?.isActive('bulletList') && "bg-muted text-foreground")}>
                    <List className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run(); }} title="Numbered List" className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", editor?.isActive('orderedList') && "bg-muted text-foreground")}>
                    <ListOrdered className="h-3.5 w-3.5" />
                </button>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}

function CourseBasicsStep({ 
    course, 
    setCourse, 
    onThumbnailUpload, 
    thumbnailRef,
    imagePreview,
    setImagePreview,
    isUploadingThumb,
    thumbUploadProgress,
}: { 
    course: Course, 
    setCourse: React.Dispatch<React.SetStateAction<Course>>,
    onThumbnailUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    thumbnailRef: React.RefObject<HTMLInputElement | null>,
    imagePreview: string | null,
    setImagePreview: (url: string | null) => void,
    isUploadingThumb: boolean,
    thumbUploadProgress: number,
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [newObjective, setNewObjective] = useState('');
    const [newPrereq, setNewPrereq] = useState('');
    const [imageLoadError, setImageLoadError] = useState(false);
    const { toast } = useToast();

    const [programs, setPrograms] = useState<CourseProgram[]>([]);
    const [isProgramsLoading, setIsProgramsLoading] = useState(true);

    const [programsDialogOpen, setProgramsDialogOpen] = useState(false);
    const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);

    const [newProgramName, setNewProgramName] = useState('');
    const [editingProgram, setEditingProgram] = useState<CourseProgram | null>(null);
    const [programToDelete, setProgramToDelete] = useState<CourseProgram | null>(null);

    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<ProgramCategory | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<ProgramCategory | null>(null);

    useEffect(() => {
        getPrograms().then(data => { setPrograms(data); setIsProgramsLoading(false); });
    }, []);

    const selectedProgram = programs.find(p => p.id === course.program) || null;
    const selectedTrack = resolveTrackFromProgram(selectedProgram?.id || selectedProgram?.name || course.program || course.category || '');
    const levelOptions = getLevelOptionsForTrack(selectedTrack);

    const handleImproveDescription = async () => {
        if (!course.title || course.title === 'Untitled Course') {
            toast({ title: 'Please provide a descriptive title first.', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        try {
            const result = await generateCourseDescription({
                courseTitle: course.title,
                courseSubtitle: course.subtitle,
                existingDescription: course.description,
            });
            if (result.description) {
                const normalized = result.description.trim().startsWith('<') ? result.description : `<p>${result.description}</p>`;
                setCourse(c => ({...c, description: normalized}));
                toast({ title: 'Description Optimized!' });
            }
        } catch (error) {
            toast({ title: 'AI Error', description: 'Could not refine description.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const addItem = (listKey: 'whatYoullLearn' | 'prerequisites', value: string, setter: (v: string) => void) => {
        if (!value.trim()) return;
        setCourse(prev => ({
            ...prev,
            [listKey]: [...(prev[listKey] || []), value.trim()]
        }));
        setter('');
    };

    const removeItem = (listKey: 'whatYoullLearn' | 'prerequisites', index: number) => {
        setCourse(prev => ({
            ...prev,
            [listKey]: (prev[listKey] || []).filter((_, i) => i !== index)
        }));
    };

    const handleSaveProgram = async () => {
        const name = newProgramName.trim();
        if (!name) return;
        if (editingProgram) {
            const updated = await updateProgramData(editingProgram, { name });
            setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p));
        } else {
            const fresh = await addProgramData(name);
            setPrograms(prev => [...prev, fresh]);
        }
        setNewProgramName(''); setEditingProgram(null);
        toast({ title: editingProgram ? 'Program updated' : 'Program added' });
    };

    const handleDeleteProgram = async () => {
        if (!programToDelete) return;
        await deleteProgramData(programToDelete.id);
        setPrograms(prev => prev.filter(p => p.id !== programToDelete.id));
        if (course.program === programToDelete.id) {
            setCourse(c => ({ ...c, program: undefined, cat_id: undefined, category: '' }));
        }
        setProgramToDelete(null);
        toast({ title: 'Program removed' });
    };

    const handleSaveCategory = async () => {
        if (!selectedProgram) return;
        const name = newCategoryName.trim();
        if (!name) return;
        let updated: CourseProgram;
        if (editingCategory) {
            updated = await updateCategoryInProgram(selectedProgram, { ...editingCategory, name });
        } else {
            const id = `cat-${Date.now()}`;
            updated = await addCategoryToProgram(selectedProgram, { id, name });
        }
        setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p));
        setNewCategoryName(''); setEditingCategory(null);
        toast({ title: editingCategory ? 'Category updated' : 'Category added' });
    };

    const handleDeleteCategory = async () => {
        if (!selectedProgram || !categoryToDelete) return;
        const updated = await deleteCategoryFromProgram(selectedProgram, categoryToDelete.id);
        setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p));
        if (course.cat_id === categoryToDelete.id) {
            setCourse(c => ({ ...c, cat_id: undefined, category: selectedProgram?.name || course.program || '' }));
        }
        setCategoryToDelete(null);
        toast({ title: 'Category removed' });
    };

    return (
        <>
        <Card className="border-none shadow-lg">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle>Course Basics</CardTitle>
                <CardDescription>Primary information for the marketplace landing page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Course Title</Label>
                        <Input id="title" value={course.title} onChange={(e) => setCourse(c => ({...c, title: e.target.value}))} placeholder="e.g., Financial Reporting (ICAG Level 2)" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="subtitle">One-line Subtitle</Label>
                        <Input id="subtitle" value={course.subtitle} onChange={(e) => setCourse(c => ({...c, subtitle: e.target.value}))} placeholder="Catchy hook for students" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Full Description</Label>
                            <Button variant="ghost" size="sm" className="text-accent hover:text-accent hover:bg-accent/10 h-7" onClick={handleImproveDescription} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                Optimize with AI
                            </Button>
                        </div>
                        <RichTextEditor
                            value={course.description}
                            onChange={html => setCourse(c => ({...c, description: html}))}
                            placeholder="What is this course about? Describe the value students will get."
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="text-base font-bold">Course Thumbnail</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div 
                            className="relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group overflow-hidden"
                            onClick={() => !isUploadingThumb && thumbnailRef.current?.click()}
                        >
                            {isUploadingThumb ? (
                                <div className="space-y-3 flex flex-col items-center w-full px-8">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <p className="text-xs font-bold text-muted-foreground">Uploading to Cloud...</p>
                                    <Progress value={thumbUploadProgress} className="h-1.5 w-full" />
                                    <p className="text-[10px] text-muted-foreground">{thumbUploadProgress}%</p>
                                </div>
                            ) : (imagePreview || course.imageUrl) ? (
                                <>
                                    {!imageLoadError ? (
                                        <img 
                                            src={imagePreview || resolveMediaUrl(course.imageUrl)} 
                                            alt="Thumbnail Preview" 
                                            className="w-full h-full object-cover" 
                                            data-ai-hint="course thumbnail"
                                            onError={() => setImageLoadError(true)}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full gap-2">
                                            <AlertCircle className="h-8 w-8 text-muted-foreground" />
                                            <p className="text-xs text-muted-foreground">Image failed to load</p>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                                        Change Image
                                    </div>
                                </>
                            ) : (
                                <div className="p-6 text-muted-foreground flex flex-col items-center">
                                    <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                                    <p className="text-sm font-semibold">Click to upload image</p>
                                    <p className="text-xs opacity-70">PNG, JPG or WEBP (Max 5MB)</p>
                                </div>
                            )}
                            <input type="file" ref={thumbnailRef} className="sr-only" accept="image/*" onChange={onThumbnailUpload} />
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 flex gap-3">
                                <CloudUpload className="h-5 w-5 text-primary shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-primary uppercase">{storageBadgeLabel}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {storageDescription}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="video-url" className="text-sm font-medium">Promo Video URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <div className="relative">
                            <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="video-url"
                                className="pl-9"
                                value={course.videoUrl || ''}
                                onChange={e => setCourse(c => ({ ...c, videoUrl: e.target.value || undefined }))}
                                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">A short promo video shown on the course landing page before students enroll.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 font-bold"><Target className="h-4 w-4 text-primary" /> Learning Objectives</Label>
                        <div className="flex gap-2">
                            <Input placeholder="What will students learn?" value={newObjective} onChange={e => setNewObjective(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('whatYoullLearn', newObjective, setNewObjective)} />
                            <Button size="icon" variant="outline" onClick={() => addItem('whatYoullLearn', newObjective, setNewObjective)}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="space-y-2">
                            {course.whatYoullLearn?.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border text-xs group">
                                    <span className="flex-1 truncate pr-2">{item}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem('whatYoullLearn', i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 font-bold"><ListChecks className="h-4 w-4 text-primary" /> Prerequisites</Label>
                        <div className="flex gap-2">
                            <Input placeholder="Any required skills or courses?" value={newPrereq} onChange={e => setNewPrereq(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('prerequisites', newPrereq, setNewPrereq)} />
                            <Button size="icon" variant="outline" onClick={() => addItem('prerequisites', newPrereq, setNewPrereq)}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="space-y-2">
                            {course.prerequisites?.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border text-xs group">
                                    <span className="flex-1 truncate pr-2">{item}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem('prerequisites', i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="program" className="font-bold">Program <span className="text-destructive">*</span></Label>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground gap-1" onClick={() => { setNewProgramName(''); setEditingProgram(null); setProgramsDialogOpen(true); }}>
                                    <SlidersHorizontal className="h-3 w-3" /> Manage
                                </Button>
                            </div>
                            <Select
                                value={course.program || ''}
                                onValueChange={v => {
                                    const prog = programs.find(p => p.id === v);
                                    setCourse(c => ({ ...c, program: v, cat_id: undefined, category: prog?.name || v, level: '' }));
                                }}
                                disabled={isProgramsLoading}
                            >
                                <SelectTrigger id="program">
                                    <SelectValue placeholder={isProgramsLoading ? 'Loading...' : 'Select program'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {programs.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="cat_id" className="font-bold">Category <span className="text-destructive">*</span></Label>
                                {selectedProgram && (
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground gap-1" onClick={() => { setNewCategoryName(''); setEditingCategory(null); setCategoriesDialogOpen(true); }}>
                                        <SlidersHorizontal className="h-3 w-3" /> Manage
                                    </Button>
                                )}
                            </div>
                            <Select
                                value={course.cat_id || ''}
                                onValueChange={v => {
                                    const cat = selectedProgram?.categories.find(c => c.id === v);
                                    setCourse(c => ({ ...c, cat_id: v, category: cat?.name || v, level: '' }));
                                }}
                                disabled={!selectedProgram}
                            >
                                <SelectTrigger id="cat_id">
                                    <SelectValue placeholder={selectedProgram ? 'Select category' : 'Select a program first'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {(selectedProgram?.categories || []).map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {levelOptions.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="level">Exam Level</Label>
                            <Select value={course.level || ''} onValueChange={(value) => setCourse(c => ({ ...c, level: value }))}>
                                <SelectTrigger id="level">
                                    <SelectValue placeholder="Select level" />
                                </SelectTrigger>
                                <SelectContent>
                                    {levelOptions.map((level) => (
                                        <SelectItem key={level} value={level}>{level}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>

        {/* Programs Manager Dialog */}
        <Dialog open={programsDialogOpen} onOpenChange={setProgramsDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Programs</DialogTitle>
                    <DialogDescription>Add, rename, or remove top-level academic programs.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 max-h-72 overflow-y-auto pr-1">
                    {programs.map(p => (
                        <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 group">
                            {editingProgram?.id === p.id ? (
                                <>
                                    <Input className="h-7 text-sm flex-1" value={newProgramName} onChange={e => setNewProgramName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveProgram(); if (e.key === 'Escape') { setEditingProgram(null); setNewProgramName(''); } }} />
                                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveProgram}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingProgram(null); setNewProgramName(''); }}>Cancel</Button>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{p.categories.length} categories</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => { setEditingProgram(p); setNewProgramName(p.name); }}><Edit className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => setProgramToDelete(p)}><Trash2 className="h-3 w-3" /></Button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                    <Input className="h-8 text-sm" placeholder="New program name..." value={editingProgram ? '' : newProgramName} onChange={e => { setEditingProgram(null); setNewProgramName(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') handleSaveProgram(); }} />
                    <Button size="sm" onClick={handleSaveProgram} disabled={!newProgramName.trim() || !!editingProgram}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* Categories Manager Dialog */}
        <Dialog open={categoriesDialogOpen} onOpenChange={setCategoriesDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Categories — {selectedProgram?.name}</DialogTitle>
                    <DialogDescription>Add, rename, or remove categories for this program.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2 max-h-72 overflow-y-auto pr-1">
                    {(selectedProgram?.categories || []).map(cat => (
                        <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 group">
                            {editingCategory?.id === cat.id ? (
                                <>
                                    <Input className="h-7 text-sm flex-1" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveCategory(); if (e.key === 'Escape') { setEditingCategory(null); setNewCategoryName(''); } }} />
                                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveCategory}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingCategory(null); setNewCategoryName(''); }}>Cancel</Button>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-sm">{cat.name}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }}><Edit className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => setCategoryToDelete(cat)}><Trash2 className="h-3 w-3" /></Button>
                                </>
                            )}
                        </div>
                    ))}
                    {(selectedProgram?.categories || []).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No categories yet. Add one below.</p>
                    )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                    <Input className="h-8 text-sm" placeholder="New category name..." value={editingCategory ? '' : newCategoryName} onChange={e => { setEditingCategory(null); setNewCategoryName(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') handleSaveCategory(); }} />
                    <Button size="sm" onClick={handleSaveCategory} disabled={!newCategoryName.trim() || !!editingCategory}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* Program Delete Confirm */}
        <AlertDialog open={!!programToDelete} onOpenChange={v => !v && setProgramToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Program</AlertDialogTitle>
                    <AlertDialogDescription>Remove "{programToDelete?.name}" and all its categories? This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive" onClick={handleDeleteProgram}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Category Delete Confirm */}
        <AlertDialog open={!!categoryToDelete} onOpenChange={v => !v && setCategoryToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                    <AlertDialogDescription>Remove "{categoryToDelete?.name}" from {selectedProgram?.name}?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive" onClick={handleDeleteCategory}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}

function SortableLessonItem({ lesson, onEdit, onDelete }: { lesson: Lesson; onEdit: () => void; onDelete: () => void; }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
  
    const Icon = lesson.type === 'video'
        ? Video
        : lesson.type === 'quiz'
            ? HelpCircle
            : lesson.type === 'resource'
                ? Upload
                : FileText;

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border bg-background p-3 shadow-sm group">
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab shrink-0" {...attributes} {...listeners}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className={cn("p-2 rounded-md shrink-0", lesson.type === 'video' ? 'bg-blue-100 text-blue-600' : lesson.type === 'resource' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-600')}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold truncate">{lesson.title}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{LESSON_TYPE_LABELS[lesson.type] || lesson.type} • {lesson.duration}m</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>
    );
}

function SortableSectionItem({ section, onEditSection, onDeleteSection, onAddLesson, onEditLesson, onDeleteLesson, lessons }: { section: Section; onEditSection: () => void; onDeleteSection: () => void; onAddLesson: (sectionId: string) => void; onEditLesson: (sectionId: string, lessonId: string) => void; onDeleteLesson: (sectionId: string, lessonId: string) => void; lessons: Lesson[] }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="space-y-2">
            <Card className="bg-muted/20 border-2 border-dashed border-muted-foreground/10 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                         <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" {...attributes} {...listeners}>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <h3 className="font-bold text-sm">{section.title}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditSection}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={onDeleteSection}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    <SortableContext items={lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {lessons.map(lesson => (
                                <SortableLessonItem 
                                    key={lesson.id} 
                                    lesson={lesson}
                                    onEdit={() => onEditLesson(section.id, lesson.id)}
                                    onDelete={() => onDeleteLesson(section.id, lesson.id)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                    <Button variant="outline" size="sm" className="w-full border-dashed gap-2" onClick={() => onAddLesson(section.id)}>
                        <PlusCircle size={14} /> Add Lesson to {section.title}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function CurriculumBuilderStep({ course, onEditSection, onDeleteSection, onEditLesson, onDeleteLesson, onAddLesson, onAddSection, onGenerateSyllabus, handleDragEnd }: { course: Course; onEditSection: (sectionId: string) => void; onDeleteSection: (sectionId: string) => void; onEditLesson: (sectionId: string, lessonId: string) => void; onDeleteLesson: (sectionId: string, lessonId: string) => void; onAddLesson: (sectionId: string) => void; onAddSection: () => void; onGenerateSyllabus: () => void; handleDragEnd: (event: DragEndEvent) => void; }) {
    const sensors = useSensors(useSensor(DndPointerSensor), useSensor(DndKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    return (
        <Card className="border-none shadow-lg">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle>Course Curriculum</CardTitle>
                <CardDescription>Structure your lessons. Drag and drop sections or lessons to reorder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <DndKitContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={course.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-6">
                            {course.sections.map(section => (
                                <SortableSectionItem
                                    key={section.id}
                                    section={section}
                                    lessons={section.lessons}
                                    onAddLesson={onAddLesson}
                                    onEditLesson={onEditLesson}
                                    onDeleteLesson={onDeleteLesson}
                                    onEditSection={() => onEditSection(section.id)}
                                    onDeleteSection={() => onDeleteSection(section.id)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndKitContext>
                
                {course.sections.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-xl opacity-50">
                        <ClipboardList size={48} className="text-muted-foreground" />
                        <div>
                            <p className="font-bold">Curriculum Empty</p>
                            <p className="text-xs">Add your first section or use AI to generate a starter syllabus.</p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="secondary" className="flex-1 gap-2 h-12" onClick={onAddSection}>
                        <PlusCircle size={18} /> New Section
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2 h-12 border-accent text-accent hover:bg-accent/5" onClick={onGenerateSyllabus}>
                        <Sparkles size={18} /> Generate Syllabus with AI
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function BooksStep({ course, setCourse }: { course: Course; setCourse: React.Dispatch<React.SetStateAction<Course>> }) {
    const { user } = useUser();
    const { toast } = useToast();
    const [allBooks, setAllBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        user.getIdToken(true).then(token => {
            return fetch('/api/books?includeDraft=false', { headers: { Authorization: `Bearer ${token}` } });
        }).then(r => r.json()).then(data => {
            setAllBooks(Array.isArray(data.books) ? data.books : []);
        }).catch(() => {
            toast({ variant: 'destructive', title: 'Could not load books' });
        }).finally(() => setIsLoading(false));
    }, [user?.uid]);

    const attachedIds = new Set((course.books || []).map(b => b.id));

    const filteredBooks = allBooks.filter(b => {
        if (attachedIds.has(b.id)) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q);
    });

    const attachBook = (book: Book) => {
        setCourse(c => {
            if ((c.books || []).some(b => b.id === book.id)) return c;
            const ref: CourseBookRef = { id: book.id, title: book.title, price: book.price || 0, isFree: book.isFree };
            return { ...c, books: [...(c.books || []), ref] };
        });
    };

    const removeBook = (bookId: string) => {
        setCourse(c => ({ ...c, books: (c.books || []).filter(b => b.id !== bookId) }));
    };

    const clearAllBooks = () => setCourse(c => ({ ...c, books: [] }));

    const attachedBooks = course.books || [];
    const totalValue = attachedBooks.reduce((sum, b) => sum + (b.price || 0), 0);
    const freeCount = attachedBooks.filter(b => b.isFree || b.price === 0).length;

    return (
        <Card className="border-none shadow-lg">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle>Book Bundle</CardTitle>
                <CardDescription>Attach books from the store catalog to include in this course package.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {attachedBooks.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold">Attached Books</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={clearAllBooks}>
                                <X className="h-3 w-3 mr-1" /> Clear All
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {attachedBooks.map(b => (
                                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 group">
                                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{b.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {b.isFree || b.price === 0 ? 'Free' : `GH₵ ${b.price.toFixed(2)}`}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => removeBook(b.id)}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                            <div>
                                <p className="text-lg font-black text-primary">{attachedBooks.length}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Books</p>
                            </div>
                            <div>
                                <p className="text-lg font-black text-primary">GH₵ {totalValue.toFixed(2)}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Value</p>
                            </div>
                            <div>
                                <p className="text-lg font-black text-primary">{freeCount}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Free Books</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3 pt-2 border-t">
                    <h3 className="text-sm font-bold">Available Books</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Search by title or author..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    {isLoading ? (
                        <div className="py-10 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredBooks.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            {search ? 'No books match your search.' : 'All published books are already attached.'}
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {filteredBooks.map(book => (
                                <div key={book.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/20 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{book.title}</p>
                                        <p className="text-xs text-muted-foreground">{book.author} · {book.isFree || book.price === 0 ? 'Free' : `GH₵ ${(book.price || 0).toFixed(2)}`}</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => attachBook(book)}>
                                        <Plus className="h-3 w-3 mr-1" /> Attach
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function PricingStep({ course, setCourse }: { course: Course; setCourse: React.Dispatch<React.SetStateAction<Course>> }) {
    const [platformCommissionPct, setPlatformCommissionPct] = useState('20');
    const bookTotal = sumAttachedBookPrices(course);
    const listingAmount = getCourseListingPrice(course);
    const totalAmount = getCourseTotalListPrice(course);

    useEffect(() => {
        const loadCommission = async () => {
            try {
                const settings = await getGlobalSettings();
                if (settings?.platformCommission) {
                    setPlatformCommissionPct(String(settings.platformCommission));
                }
            } catch {
                // Keep fallback value if settings are temporarily unavailable.
            }
        };

        void loadCommission();
    }, []);

    const showPaidFields =
        course.priceStatus === 'paid' || course.priceStatus === 'premium' || (!course.priceStatus && !course.isFree);

    return (
        <Card className="border-none shadow-lg">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle>Pricing & Commercials</CardTitle>
                <CardDescription>Determine how you want to monetize your content.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="price-status">Price Status</Label>
                        <Select
                            value={(course.priceStatus === 'premium' ? 'paid' : course.priceStatus) || (course.isFree ? 'free' : 'paid')}
                            onValueChange={v => {
                                const status = v as 'free' | 'paid';
                                if (status === 'free') {
                                    setCourse(c => ({
                                        ...c,
                                        priceStatus: 'free',
                                        isFree: true,
                                        price: 0,
                                        listingPrice: 0,
                                        basePrice: undefined,
                                    }));
                                    return;
                                }
                                setCourse(c => {
                                    const books = sumAttachedBookPrices(c);
                                    const list =
                                        typeof c.listingPrice === 'number' && !Number.isNaN(c.listingPrice)
                                            ? c.listingPrice
                                            : getCourseListingPrice(c);
                                    return {
                                        ...c,
                                        priceStatus: 'paid',
                                        isFree: false,
                                        listingPrice: list,
                                        price: list + books,
                                        basePrice: undefined,
                                    };
                                });
                            }}
                        >
                            <SelectTrigger id="price-status">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="free">Free — Open access for all students</SelectItem>
                                <SelectItem value="paid">Paid — Standard purchase required</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {showPaidFields && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                        <div className="space-y-2">
                            <Label htmlFor="listing-price">Listing price (GH₵)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">GH₵</span>
                                <Input
                                    id="listing-price"
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className="pl-12 h-11"
                                    value={course.listingPrice ?? ''}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        const list = raw === '' ? 0 : parseFloat(raw);
                                        const listing = Number.isFinite(list) ? Math.max(0, list) : 0;
                                        setCourse(c => {
                                            const books = sumAttachedBookPrices(c);
                                            return {
                                                ...c,
                                                listingPrice: listing,
                                                price: listing + books,
                                                basePrice: undefined,
                                            };
                                        });
                                    }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This is the course list price before attached books. Total updates automatically when you change this value or book prices.
                            </p>
                        </div>

                        <div className="rounded-xl border bg-muted/20 p-4 space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total list price</p>
                            <p className="text-2xl font-black text-primary font-headline">GH₵ {totalAmount.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                                GH₵ {listingAmount.toFixed(2)} (listing) + GH₵ {bookTotal.toFixed(2)} (books) = GH₵ {totalAmount.toFixed(2)}. The platform takes a {platformCommissionPct}% commission on paid sales.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PublishStep({ course, setCourse, onPublish, showPricing = true }: { course: Course, setCourse: React.Dispatch<React.SetStateAction<Course>>, onPublish: () => void, showPricing?: boolean }) {
    const [isPublishing, setIsPublishing] = useState(false);

    const checklist = [
        { label: 'Descriptive title provided', met: !!course.title && course.title !== 'Untitled Course' },
        { label: 'In-depth description (min 100 chars)', met: (course.description?.replace(/<[^>]*>/g, '').length || 0) > 100 },
        { label: 'Instructor name set', met: !!course.instructor?.name },
        { label: 'Program selected', met: !!course.program },
        { label: 'Category selected', met: !!course.cat_id },
        { label: 'Learning Objectives set (min 3)', met: (course.whatYoullLearn?.length || 0) >= 3 },
        { label: 'At least 3 lessons added', met: (course.sections?.flatMap(s => s.lessons).length || 0) >= 3 },
        ...(showPricing
            ? [
                  {
                      label: 'Price configured',
                      met:
                          course.priceStatus === 'free' ||
                          course.isFree === true ||
                          getCourseTotalListPrice(course) > 0,
                  },
              ]
            : []),
    ];

    const infoItems = [
        { label: course.featured ? 'Marked as Featured — will appear on homepage' : 'Not featured (optional)', active: !!course.featured },
    ];

    const canPublish = checklist.every(c => c.met);

    const handlePublishClick = () => {
        setIsPublishing(true);
        onPublish();
    };

    return (
        <Card className="border-none shadow-lg">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle>Launch Checklist</CardTitle>
                <CardDescription>Review these items before submitting your course for approval.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3">
                        <Star className="h-5 w-5 text-amber-500 shrink-0" />
                        <div>
                            <p className="text-sm font-bold">Mark as Featured</p>
                            <p className="text-xs text-muted-foreground">Featured courses appear at the top of the marketplace homepage.</p>
                        </div>
                    </div>
                    <Switch
                        checked={!!course.featured}
                        onCheckedChange={v => setCourse(c => ({ ...c, featured: v }))}
                    />
                </div>

                <div className="space-y-3">
                    {checklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                            {item.met ? (
                                <CheckCircle className="h-5 w-5 text-success" />
                            ) : (
                                <XCircle className="h-5 w-5 text-destructive" />
                            )}
                            <span className={cn("text-sm", item.met ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                        </div>
                    ))}
                    {infoItems.map((item, i) => (
                        <div key={`info-${i}`} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/10">
                            <Star className={cn("h-5 w-5 shrink-0", item.active ? "text-amber-500" : "text-muted-foreground/40")} />
                            <span className="text-sm text-muted-foreground">{item.label}</span>
                        </div>
                    ))}
                </div>

                {!canPublish && (
                    <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 shrink-0" />
                        <p className="text-xs text-orange-800 leading-relaxed">
                            Some required items are missing. Please go back to the <strong>Basics</strong> and <strong>Curriculum</strong> steps to finish your course design.
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
                <Button 
                    className="w-full h-14 text-lg font-black" 
                    disabled={!canPublish || isPublishing || course.status === 'Under Review'} 
                    onClick={handlePublishClick}
                >
                    {isPublishing ? <Loader2 className="animate-spin mr-2" /> : <BadgeCheck className="mr-2" />}
                    {course.status === 'Under Review' ? 'Awaiting Approval' : 'Submit for Final Review'}
                </Button>
            </CardFooter>
        </Card>
    )
}

export function CourseBuilder({ initialCourse, ownerTutorId, ownerTutorProfile, showPricing = true, preservePublishedStatusOnEdit = false }: { initialCourse?: Course; ownerTutorId?: string; ownerTutorProfile?: Pick<User, 'id' | 'name' | 'avatar' | 'bio'>; showPricing?: boolean; preservePublishedStatusOnEdit?: boolean }) {
    const router = useRouter();
    const { user, isLoading: isUserLoading } = useUser();
    const steps = showPricing ? ALL_STEPS : ALL_STEPS.filter(s => s.name !== 'Pricing' && s.name !== 'Books');
    const [activeStep, setActiveStep] = useState(0);
    const [mounted, setMounted] = useState(false);
    const { toast } = useToast();

    const wasInitiallyPublishedRef = useRef((initialCourse?.status || '') === 'Published');

    const [course, setCourse] = useState<Course>(() => {
        if (initialCourse) return migrateCoursePricingFromFirestore(initialCourse);
        return {
            id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            tutorId: '',
            createdByTutorId: user?.uid || '',
            assignedTutorIds: user?.uid ? [user.uid] : [],
            title: 'Untitled Course',
            subtitle: '',
            description: '',
            category: '',
            difficulty: 'Beginner',
            language: 'English',
            imageUrl: '',
            imageHint: 'accounting study',
            isFree: undefined,
            listingPrice: 0,
            price: 0,
            sections: [],
            status: 'Draft',
            whatYoullLearn: [],
            prerequisites: []
        };
    });

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingSection, setEditingSection] = useState<Section | null>(null);
    // pendingDeleteKeys: R2 keys staged for deletion after Firestore write succeeds.
    // Scoped inside editingLesson state so they are automatically cleared on modal close.
    const [editingLesson, setEditingLesson] = useState<{ sectionId: string; lesson: Lesson; pendingDeleteKeys: string[] } | null>(null);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'section' | 'lesson'; sectionId: string; lessonId?: string } | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailRef = useRef<HTMLInputElement>(null);
    const liveClassAutoCreated = useRef(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingThumb, setIsUploadingThumb] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [thumbUploadProgress, setThumbUploadProgress] = useState(0);

    const [isSyllabusGenOpen, setIsSyllabusGenOpen] = useState(false);
    const [syllabusTopic, setSyllabusTopic] = useState('');
    const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setCourse(prev => {
            if (prev.isFree === true || prev.priceStatus === 'free') return prev;
            const books = sumAttachedBookPrices(prev);
            const listing =
                typeof prev.listingPrice === 'number' && !Number.isNaN(prev.listingPrice)
                    ? prev.listingPrice
                    : getCourseListingPrice(prev);
            const nextTotal = listing + books;
            if (prev.price === nextTotal && prev.basePrice === undefined) return prev;
            return { ...prev, listingPrice: listing, price: nextTotal, basePrice: undefined };
        });
    }, [course.books, course.listingPrice, course.priceStatus, course.isFree]);

    useEffect(() => {
        if (!mounted) return;

        const preferredTutorId = ownerTutorProfile?.id || ownerTutorId || user?.uid;
        if (!preferredTutorId) return;

        setCourse(prev => {
            const nextInstructor = ownerTutorProfile ? {
                name: ownerTutorProfile.name || prev.instructor?.name || 'Academic Expert',
                title: prev.instructor?.title || 'Instructor',
                avatar: ownerTutorProfile.avatar || prev.instructor?.avatar || '',
                bio: ownerTutorProfile.bio || prev.instructor?.bio || '',
            } : prev.instructor;

            if (prev.tutorId === preferredTutorId && nextInstructor === prev.instructor) {
                return prev;
            }

            return {
                ...prev,
                tutorId: preferredTutorId,
                instructor: nextInstructor,
            };
        });
    }, [user, mounted, ownerTutorId, ownerTutorProfile]);

    const isNewCourseRef = useRef(!initialCourse?.updatedAt);

    const doUnifiedSave = useCallback(async (data: Course, tutorId: string): Promise<void> => {
        if (isNewCourseRef.current && !liveClassAutoCreated.current) {
            const idToken = await user!.getIdToken();
            const result = await saveNewCourseWithLiveClass(data, tutorId, idToken);
            if (result.error) throw new Error(result.error);
            isNewCourseRef.current = false;
            liveClassAutoCreated.current = result.liveClassCreated;
        } else {
            await saveCourse(data, tutorId);
            if (!liveClassAutoCreated.current) {
                try {
                    const idToken = await user!.getIdToken();
                    const liveResult = await ensureLiveClassForCourse(data.id, data.title, tutorId, idToken);
                    if (liveResult.error) {
                        logger.warn('[CourseBuilder] Live class ensure failed', { error: liveResult.error });
                    } else {
                        liveClassAutoCreated.current = true;
                    }
                } catch (err: any) {
                    logger.warn('[CourseBuilder] Live class ensure threw', { error: err?.message });
                }
            }
        }
    }, [user]);

    const getStatusSafePayload = useCallback((data: Course) => {
        const requiresReapproval = !preservePublishedStatusOnEdit && wasInitiallyPublishedRef.current && data.status === 'Published';
        return {
            requiresReapproval,
            payload: requiresReapproval ? { ...data, status: 'Under Review' as const } : data,
        };
    }, [preservePublishedStatusOnEdit]);

    const performSave = useCallback(async (data: Course) => {
        const effectiveTutorId = ownerTutorId || user?.uid;
        if (!isUserLoading && user && data.tutorId && effectiveTutorId) {
            setIsSaving(true);
            try {
                const { payload: statusSafePayload, requiresReapproval } = getStatusSafePayload(data);
                await doUnifiedSave(statusSafePayload, effectiveTutorId);
                if (requiresReapproval) {
                    setCourse(statusSafePayload);
                    toast({
                        title: 'Re-approval required',
                        description: 'Published course edits were saved and routed back to Under Review.',
                    });
                }
            } catch (error: any) {
                logger.error('[CourseBuilder] Save failed', { error: error.message });
                toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
            } finally {
                setIsSaving(false);
            }
        }
    }, [user, isUserLoading, ownerTutorId, doUnifiedSave, getStatusSafePayload, toast]);

    const handleManualSave = () => {
        if (user && course.tutorId) {
            performSave(course);
            toast({ title: 'Draft Synchronized' });
        } else {
            toast({ variant: 'destructive', title: 'Session initializing...' });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        
        const activeId = String(active.id);
        const overId = String(over.id);

        setCourse(prev => {
            const next = { ...prev };
            const isSectionDrag = next.sections.some(s => s.id === activeId);

            if (isSectionDrag) {
                const oldIdx = next.sections.findIndex(s => s.id === activeId);
                const newIdx = next.sections.findIndex(s => s.id === overId);
                next.sections = arrayMove(next.sections, oldIdx, newIdx);
            } else {
                const activeSecIdx = next.sections.findIndex(s => s.lessons.some(l => l.id === activeId));
                const overSecIdx = next.sections.findIndex(s => s.id === overId || s.lessons.some(l => l.id === overId));
                
                if (activeSecIdx === overSecIdx && activeSecIdx !== -1) {
                    const section = next.sections[activeSecIdx];
                    const oldIdx = section.lessons.findIndex(l => l.id === activeId);
                    const newIdx = section.lessons.findIndex(l => l.id === overId);
                    section.lessons = arrayMove(section.lessons, oldIdx, newIdx);
                } else if (activeSecIdx !== -1 && overSecIdx !== -1) {
                    const activeSec = { ...next.sections[activeSecIdx] };
                    const overSec = { ...next.sections[overSecIdx] };
                    const lessonIdx = activeSec.lessons.findIndex(l => l.id === activeId);
                    const [lesson] = activeSec.lessons.splice(lessonIdx, 1);
                    overSec.lessons.push(lesson);
                    
                    next.sections = [...next.sections];
                    next.sections[activeSecIdx] = activeSec;
                    next.sections[overSecIdx] = overSec;
                }
            }
            return next;
        });
    };

    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploadingThumb(true);
        setThumbUploadProgress(0);
        try {
            const { url, key, error, contentType } = await getPresignedUploadUrl(
                user.uid,
                'course_thumbnail',
                file.name,
                file.type,
                course.id
            );

            if (error || !key || !url) {
                throw new Error(error || 'Failed to sign upload');
            }

            const idToken = await user.getIdToken(true);
            await uploadToR2(url, file, contentType || file.type || 'application/octet-stream', {
                key,
                idToken,
                onProgress: setThumbUploadProgress,
            });

            setImagePreview(URL.createObjectURL(file));
            setCourse(prev => ({ ...prev, imageUrl: key }));
            toast({ title: thumbnailSuccessToast });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
        } finally {
            setIsUploadingThumb(false);
            setThumbUploadProgress(0);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        const files = 'target' in e ? (e.target as HTMLInputElement).files : (e as React.DragEvent).dataTransfer.files;
        if (!files || files.length === 0 || !editingLesson || !user) return;
        
        const file = files[0];
        if (!isAllowedLessonFile(editingLesson.lesson.type, file)) {
            toast({
                variant: 'destructive',
                title: 'Invalid file for lesson type',
                description: editingLesson.lesson.type === 'document'
                    ? 'Document lessons only accept PDF files.'
                    : 'Video lessons only accept video files.',
            });
            return;
        }

        const oldKey = editingLesson.lesson.contentUrl;
        setIsUploading(true);
        setUploadProgress(0);
        try {
            const idToken = await user.getIdToken(true);
            const { url, key, error, contentType } = await getPresignedUploadUrl(user.uid, 'lesson', file.name, file.type, course.id, idToken, editingLesson.lesson.type);
            
            if (error || !key || !url) throw new Error(error || 'Failed to sign upload');

            await uploadToR2(url, file, contentType || file.type || 'application/octet-stream', {
                key,
                idToken,
                onProgress: setUploadProgress,
            });

            setEditingLesson(prev => {
                if (!prev) return null;
                const newPending = oldKey && !oldKey.startsWith('http')
                    ? [...prev.pendingDeleteKeys, oldKey]
                    : prev.pendingDeleteKeys;
                return { ...prev, lesson: { ...prev.lesson, contentUrl: key }, pendingDeleteKeys: newPending };
            });
            toast({ title: resourceSuccessToast });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Secured Upload Failed', description: err.message });
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleRemoveLessonFile = () => {
        if (!editingLesson) return;
        const keyToDelete = editingLesson.lesson.contentUrl;
        if (!keyToDelete) return;

        // Stage the R2 key for deferred deletion — scoped to this editing session
        setEditingLesson(prev => {
            if (!prev) return null;
            const newPending = keyToDelete && !keyToDelete.startsWith('http')
                ? [...prev.pendingDeleteKeys, keyToDelete]
                : prev.pendingDeleteKeys;
            return { ...prev, lesson: { ...prev.lesson, contentUrl: '' }, pendingDeleteKeys: newPending };
        });
        toast({ title: 'File marked for removal', description: 'The file will be deleted when you save the lesson.' });
    };

    const handleSaveLesson = async (lesson: Lesson) => {
        if (!editingLesson || !user) return;

        // Capture pending deletes from this session before any state changes
        const keysToDelete = [...editingLesson.pendingDeleteKeys];

        const updatedCourse: Course = {
            ...course,
            sections: course.sections.map(s => {
                if (s.id === editingLesson.sectionId) {
                    const lessons = lesson.id.startsWith('new-')
                        ? [...s.lessons, { ...lesson, id: `lesson-${Date.now()}` }]
                        : s.lessons.map(l => l.id === lesson.id ? lesson : l);
                    return { ...s, lessons };
                }
                return s;
            }),
        };

        // Persist to Firestore first
        try {
            const effectiveTutorId = ownerTutorId || user.uid;
            const { payload: statusSafePayload, requiresReapproval } = getStatusSafePayload(updatedCourse);
            await doUnifiedSave(statusSafePayload, effectiveTutorId);
            if (requiresReapproval) {
                toast({
                    title: 'Re-approval required',
                    description: 'Published course edits were saved and routed back to Under Review.',
                });
            }
            setCourse(statusSafePayload);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save failed', description: err?.message || 'Could not save lesson.' });
            return;
        }

        // After successful Firestore write, execute all staged R2 deletions for this session
        if (keysToDelete.length > 0) {
            try {
                const idToken = await user.getIdToken(true);
                await Promise.all(keysToDelete.map(async (keyToDelete) => {
                    const result = await deleteStorageObject(keyToDelete, idToken);
                    if (result.error) {
                        logger.warn('[CourseBuilder] Deferred lesson asset delete failed', { key: keyToDelete, error: result.error });
                    }
                }));
            } catch (e: any) {
                logger.warn('[CourseBuilder] Deferred lesson asset deletions threw', { error: e?.message });
            }
        }

        setEditingLesson(null);
        toast({ title: 'Lesson saved' });
    };

    const handleGenerateSyllabus = async () => {
        if (!syllabusTopic.trim()) return;
        setIsGeneratingSyllabus(true);
        try {
            const result = await generateSyllabus({ courseTopic: syllabusTopic, numberOfSections: 5 });
            const sections: Section[] = result.sections.map((s, si) => ({
                id: `sec-${Date.now()}-${si}`,
                title: s.title,
                lessons: s.lessons.map((l, li) => ({
                    id: `les-${Date.now()}-${si}-${li}`,
                    title: l.title,
                    type: l.type === 'pdf' ? 'document' : l.type === 'text' ? 'resource' : l.type,
                    duration: 15
                }))
            }));
            setCourse(prev => ({ ...prev, sections }));
            setIsSyllabusGenOpen(false);
            toast({ title: 'Curriculum Drafted' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'AI Assistant Busy' });
        } finally {
            setIsGeneratingSyllabus(false);
        }
    };

    const handlePublish = async () => {
        if (!user) return;
        try {
            const [profile, globalSettings] = await Promise.all([
                getUserById(user.uid),
                getGlobalSettings(),
            ]);

            const shouldAutoPublish = isAdminRole(profile?.role) || globalSettings.allowReviewAutoApproval;
            const effectiveTutorId = ownerTutorId || course.tutorId || user.uid;

            const updatedCourse: Course = {
                ...course,
                status: shouldAutoPublish ? 'Published' : 'Under Review',
                tutorId: effectiveTutorId,
                createdByTutorId: course.createdByTutorId || effectiveTutorId,
                assignedTutorIds: Array.from(new Set([...(course.assignedTutorIds || []), effectiveTutorId])),
            };

            await doUnifiedSave(updatedCourse, effectiveTutorId);
            if (shouldAutoPublish && isAdminRole(profile?.role)) {
                const idToken = await user.getIdToken();
                const classroomResult = await createClassroom(idToken, updatedCourse.id).catch((error) => ({
                    error: error instanceof Error ? error.message : String(error),
                }));
                if (classroomResult?.error) {
                    logger.warn('[CourseBuilder] Classroom setup failed after publish', {
                        courseId: updatedCourse.id,
                        error: classroomResult.error,
                    });
                    toast({
                        variant: 'destructive',
                        title: 'Classroom setup failed',
                        description: 'Classroom setup failed but course was published.',
                    });
                }
            }
            setCourse(updatedCourse);
            if (shouldAutoPublish) {
                toast({ title: 'Course Published', description: 'This course is now live in the marketplace.' });
                router.push('/tutor-dashboard/courses?status=published');
            } else {
                toast({ title: 'Course Submitted for Review', description: 'Our team will review your course within 3-5 business days.' });
                router.push('/tutor-dashboard/courses?status=pending');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
            logger.error('[CourseBuilder] Publish failed', { error: error.message });
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8 pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <Link href="/tutor-dashboard/courses">
                        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 sm:h-10 sm:w-10">
                            <ChevronLeft />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black font-headline tracking-tighter">Course Lab</h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3 text-success" />}
                            {isSaving ? 'Saving draft...' : savedIndicatorLabel}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={handleManualSave}><Save size={14} className="mr-2" /> Save Draft</Button>
                    <Button size="sm" variant="secondary" onClick={() => router.push('/tutor-dashboard/courses')}>Close Lab</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
                <aside className="lg:sticky lg:top-24 h-fit z-20">
                    <nav className="flex lg:flex-col gap-2 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-3 lg:mx-0 lg:px-0 overflow-x-auto scrollbar-hide">
                        {steps.map((step, idx) => (
                            <button key={step.name} onClick={() => setActiveStep(idx)} className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border-2 shrink-0",
                                activeStep === idx 
                                    ? 'bg-primary border-primary text-primary-foreground shadow-lg' 
                                    : 'bg-background border-transparent text-muted-foreground hover:bg-muted'
                            )}>
                                <step.icon size={16} />
                                <span>{step.name}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                <main className="min-h-[500px]">
                    {steps[activeStep]?.name === 'Basics' && (
                        <CourseBasicsStep 
                            course={course} 
                            setCourse={setCourse} 
                            thumbnailRef={thumbnailRef} 
                            onThumbnailUpload={handleThumbnailUpload} 
                            imagePreview={imagePreview} 
                            setImagePreview={setImagePreview}
                            isUploadingThumb={isUploadingThumb}
                            thumbUploadProgress={thumbUploadProgress}
                        />
                    )}
                    {steps[activeStep]?.name === 'Curriculum' && (
                        <CurriculumBuilderStep 
                            course={course}
                            onEditSection={(id) => { const s = course.sections.find(x => x.id === id); if(s) setEditingSection(s); }}
                            onDeleteSection={(id) => setItemToDelete({ type: 'section', sectionId: id })}
                            onAddLesson={(id) => setEditingLesson({ sectionId: id, lesson: { id: `new-${Date.now()}`, title: 'New Lesson', type: 'video', duration: 10 }, pendingDeleteKeys: [] })}
                            onEditLesson={(sid, lid) => { const l = course.sections.find(x => x.id === sid)?.lessons.find(y => y.id === lid); if(l) setEditingLesson({ sectionId: sid, lesson: l, pendingDeleteKeys: [] }); }}
                            onDeleteLesson={(sid, lid) => setItemToDelete({ type: 'lesson', sectionId: sid, lessonId: lid })}
                            onAddSection={() => { const id = `sec-${Date.now()}`; setCourse(c => ({...c, sections: [...c.sections, { id, title: 'New Section', lessons: [] }] })); setEditingSection({ id, title: 'New Section', lessons: [] }); }}
                            onGenerateSyllabus={() => setIsSyllabusGenOpen(true)}
                            handleDragEnd={handleDragEnd}
                        />
                    )}
                    {steps[activeStep]?.name === 'Books' && <BooksStep course={course} setCourse={setCourse} />}
                    {steps[activeStep]?.name === 'Pricing' && <PricingStep course={course} setCourse={setCourse} />}
                    {steps[activeStep]?.name === 'Publish' && <PublishStep course={course} setCourse={setCourse} onPublish={handlePublish} showPricing={showPricing} />}
                </main>
            </div>

            <Dialog open={!!editingSection} onOpenChange={(v) => !v && setEditingSection(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Section</DialogTitle>
                        <DialogDescription>Update the title of your course section.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Title</Label>
                        <Input value={editingSection?.title || ''} onChange={e => setEditingSection(prev => prev ? {...prev, title: e.target.value} : null)} />
                    </div>
                    <DialogFooter>
                        <Button onClick={() => { if(editingSection) { setCourse(c => ({...c, sections: c.sections.map(s => s.id === editingSection.id ? editingSection : s)})); setEditingSection(null); } }}>Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingLesson} onOpenChange={(v) => !v && setEditingLesson(null)}>
                <DialogContent className={editingLesson?.lesson.type === 'quiz' ? 'max-w-3xl' : 'max-w-2xl'}>
                    <DialogHeader>
                        <DialogTitle>Lesson Setup</DialogTitle>
                        <DialogDescription>Configure the title, type, and source content for this lesson.</DialogDescription>
                    </DialogHeader>
                    {editingLesson && (
                        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Title</Label><Input value={editingLesson.lesson.title} onChange={e => setEditingLesson({...editingLesson, lesson: {...editingLesson.lesson, title: e.target.value}})} /></div>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={editingLesson.lesson.type} onValueChange={(v: any) => setEditingLesson({...editingLesson, lesson: {...editingLesson.lesson, type: v}})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="video">Video</SelectItem>
                                            <SelectItem value="document">Document</SelectItem>
                                            <SelectItem value="resource">Resource</SelectItem>
                                            <SelectItem value="quiz">Quiz</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {editingLesson.lesson.type === 'quiz' ? (
                                <QuizBuilder
                                    key={editingLesson.lesson.id}
                                    initialQuestions={editingLesson.lesson.quiz || []}
                                    lessonTitle={editingLesson.lesson.title}
                                    onSave={(questions: QuizQuestion[]) => {
                                        const updated = { ...editingLesson.lesson, quiz: questions };
                                        handleSaveLesson(updated);
                                    }}
                                />
                            ) : (
                                <div className="space-y-4">
                                    <Label>Source</Label>
                                    <p className="text-xs text-muted-foreground">{getLessonUploadRuleText(editingLesson.lesson.type)}</p>
                                    <Tabs defaultValue={editingLesson.lesson.contentUrl?.startsWith('http') ? 'link' : 'upload'}>
                                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upload">Upload to Vault</TabsTrigger><TabsTrigger value="link">External Link</TabsTrigger></TabsList>
                                        <TabsContent value="upload" className="pt-4 space-y-3">
                                            {editingLesson.lesson.contentUrl && !editingLesson.lesson.contentUrl.startsWith('http') && (
                                                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <p className="text-xs text-muted-foreground truncate flex-1" title={editingLesson.lesson.contentUrl}>
                                                        {editingLesson.lesson.contentUrl.split('/').pop()}
                                                    </p>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs shrink-0"
                                                        disabled={isUploading}
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <Upload className="h-3 w-3 mr-1" />
                                                        Replace
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs text-destructive hover:text-destructive shrink-0"
                                                        disabled={isUploading}
                                                        onClick={handleRemoveLessonFile}
                                                    >
                                                        <X className="h-3 w-3 mr-1" />
                                                        Remove
                                                    </Button>
                                                </div>
                                            )}
                                            <div 
                                                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50 transition-all" 
                                                onClick={() => !isUploading && fileInputRef.current?.click()}
                                            >
                                                {isUploading ? (
                                                    <div className="space-y-3 px-4">
                                                        <Loader2 className="animate-spin mx-auto text-primary" />
                                                        <p className="text-xs font-bold text-muted-foreground">Securing asset...</p>
                                                        <Progress value={uploadProgress} className="h-1.5" />
                                                        <p className="text-[10px] text-muted-foreground">{uploadProgress}%</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <Upload className="mx-auto opacity-50" />
                                                        <p className="text-xs">{editingLesson.lesson.contentUrl ? 'Replace file' : 'Attach secure file'}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <input type="file" ref={fileInputRef} className="sr-only" accept={getLessonUploadAccept(editingLesson.lesson.type)} onChange={handleFileUpload} />
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Reuse from Media Library</p>
                                                <Input
                                                    placeholder="private/tutors/…  or  private/courses/…"
                                                    className="text-xs h-8 font-mono"
                                                    value={(editingLesson.lesson.contentUrl && !editingLesson.lesson.contentUrl.startsWith('http')) ? editingLesson.lesson.contentUrl : ''}
                                                    onChange={(e) => {
                                                        const text = e.target.value;
                                                        setEditingLesson(prev => prev ? { ...prev, lesson: { ...prev.lesson, contentUrl: text } } : null);
                                                    }}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Paste or type an R2 key from <strong>My Media Library</strong> to reuse an existing upload without re-uploading.</p>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="link" className="pt-4">
                                            <Input value={editingLesson.lesson.contentUrl?.startsWith('http') ? editingLesson.lesson.contentUrl : ''} onChange={e => setEditingLesson({...editingLesson, lesson: {...editingLesson.lesson, contentUrl: e.target.value}})} placeholder="https://..." />
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            )}
                        </div>
                    )}
                    {editingLesson?.lesson.type !== 'quiz' && (
                        <DialogFooter><Button onClick={() => editingLesson && handleSaveLesson(editingLesson.lesson)}>Save Lesson</Button></DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isSyllabusGenOpen} onOpenChange={setIsSyllabusGenOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>AI Curriculum Design</DialogTitle>
                        <DialogDescription>Provide a topic to generate a comprehensive 5-section syllabus draft.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4"><Label>Exam or Topic</Label><Input value={syllabusTopic} onChange={e => setSyllabusTopic(e.target.value)} /></div>
                    <DialogFooter><Button disabled={isGeneratingSyllabus || !syllabusTopic} onClick={handleGenerateSyllabus}>{isGeneratingSyllabus ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2"/>}Design Now</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!itemToDelete} onOpenChange={(v) => !v && setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
                        <AlertDialogDescription>This action will permanently delete this item from your curriculum. Enrolled students will no longer see this content.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive" onClick={() => {
                            if(!itemToDelete) return;
                            setCourse(prev => {
                                const next = { ...prev };
                                if (itemToDelete.type === 'section') {
                                    next.sections = next.sections.filter(s => s.id !== itemToDelete.sectionId);
                                } else {
                                    const secIdx = next.sections.findIndex(s => s.id === itemToDelete.sectionId);
                                    if (secIdx !== -1) {
                                        const section = { ...next.sections[secIdx] };
                                        section.lessons = section.lessons.filter(l => l.id !== itemToDelete.lessonId);
                                        next.sections = [...next.sections];
                                        next.sections[secIdx] = section;
                                    }
                                }
                                return next;
                            });
                            setItemToDelete(null);
                        }}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
