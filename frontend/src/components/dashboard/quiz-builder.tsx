'use client';

import { useState, useRef } from 'react';
import type { QuizQuestion } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
    PlusCircle,
    Trash2,
    Edit2,
    Check,
    X,
    Sparkles,
    Loader2,
    FileText,
    ClipboardList,
    HelpCircle,
    ChevronUp,
    ChevronDown,
    CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateQuizFromText, generateQuizFromFile } from '@/app/actions/quiz-generation';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

type GeneratedQuestion = QuizQuestion & { _gid: string };

function emptyQuestion(): QuizQuestion {
    return {
        questionText: '',
        options: ['', ''],
        correctAnswerIndex: 0,
        explanation: '',
    };
}

function QuestionForm({
    question,
    onSave,
    onCancel,
}: {
    question: QuizQuestion;
    onSave: (q: QuizQuestion) => void;
    onCancel: () => void;
}) {
    const [q, setQ] = useState<QuizQuestion>({ ...question, options: [...question.options] });

    const updateOption = (i: number, val: string) => {
        const opts = [...q.options];
        opts[i] = val;
        setQ(prev => ({ ...prev, options: opts }));
    };

    const addOption = () => {
        if (q.options.length < 5) setQ(prev => ({ ...prev, options: [...prev.options, ''] }));
    };

    const removeOption = (i: number) => {
        if (q.options.length <= 2) return;
        const opts = q.options.filter((_, idx) => idx !== i);
        const correctIdx = q.correctAnswerIndex >= opts.length ? opts.length - 1 : q.correctAnswerIndex === i ? 0 : q.correctAnswerIndex > i ? q.correctAnswerIndex - 1 : q.correctAnswerIndex;
        setQ(prev => ({ ...prev, options: opts, correctAnswerIndex: correctIdx }));
    };

    const isValid = q.questionText.trim() && q.options.every(o => o.trim()) && q.correctAnswerIndex < q.options.length;

    return (
        <div className="space-y-4 border rounded-xl p-4 bg-muted/10">
            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase">Question</Label>
                <Textarea
                    value={q.questionText}
                    onChange={e => setQ(prev => ({ ...prev, questionText: e.target.value }))}
                    placeholder="Enter your question..."
                    rows={2}
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase">Answer Options</Label>
                    {q.options.length < 5 && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addOption}>
                            <PlusCircle className="h-3 w-3" /> Add Option
                        </Button>
                    )}
                </div>
                <div className="space-y-2">
                    {q.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <button
                                type="button"
                                className={cn(
                                    'h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                                    q.correctAnswerIndex === i
                                        ? 'border-green-500 bg-green-500 text-white'
                                        : 'border-muted-foreground/30 text-muted-foreground hover:border-green-400'
                                )}
                                onClick={() => setQ(prev => ({ ...prev, correctAnswerIndex: i }))}
                                title="Mark as correct"
                            >
                                {q.correctAnswerIndex === i ? <Check className="h-3.5 w-3.5" /> : OPTION_LETTERS[i]}
                            </button>
                            <Input
                                value={opt}
                                onChange={e => updateOption(i, e.target.value)}
                                placeholder={`Option ${OPTION_LETTERS[i]}`}
                                className="h-9 text-sm"
                            />
                            {q.options.length > 2 && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeOption(i)}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Click the circle next to an option to mark it as the correct answer.</p>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase">Explanation <span className="font-normal normal-case text-muted-foreground">(optional)</span></Label>
                <Textarea
                    value={q.explanation || ''}
                    onChange={e => setQ(prev => ({ ...prev, explanation: e.target.value }))}
                    placeholder="Explain why this answer is correct..."
                    rows={2}
                />
            </div>

            <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
                    <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={() => isValid && onSave(q)} disabled={!isValid} className="gap-1">
                    <Check className="h-3.5 w-3.5" /> Save Question
                </Button>
            </div>
        </div>
    );
}

function QuestionCard({
    question,
    index,
    total,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
}: {
    question: QuizQuestion;
    index: number;
    total: number;
    onEdit: () => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    return (
        <div className="border rounded-lg p-3 space-y-2 bg-background hover:bg-muted/10 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground mb-1">Q{index + 1}</p>
                    <p className="text-sm font-medium leading-snug">{question.questionText}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={index === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={index === total - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
            </div>
            <div className="flex flex-wrap gap-1">
                {question.options.map((opt, i) => (
                    <span
                        key={i}
                        className={cn(
                            'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border',
                            i === question.correctAnswerIndex
                                ? 'border-green-300 bg-green-50 text-green-700 font-bold'
                                : 'border-border bg-muted/30 text-muted-foreground'
                        )}
                    >
                        {i === question.correctAnswerIndex && <CheckCircle2 className="h-2.5 w-2.5" />}
                        {OPTION_LETTERS[i]}. {opt.length > 30 ? opt.slice(0, 30) + '…' : opt}
                    </span>
                ))}
            </div>
        </div>
    );
}

export function QuizBuilder({
    initialQuestions,
    onSave,
    lessonTitle,
}: {
    initialQuestions: QuizQuestion[];
    onSave: (questions: QuizQuestion[]) => void;
    lessonTitle?: string;
}) {
    const { toast } = useToast();
    const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);

    const [aiText, setAiText] = useState('');
    const [aiTopic, setAiTopic] = useState(lessonTitle || '');
    const [aiCount, setAiCount] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[] | null>(null);
    const [editingGeneratedId, setEditingGeneratedId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleSaveQuestion = (q: QuizQuestion, index: number | null) => {
        if (index === null) {
            setQuestions(prev => [...prev, q]);
            setIsAddingNew(false);
        } else {
            setQuestions(prev => prev.map((item, i) => (i === index ? q : item)));
            setEditingIndex(null);
        }
    };

    const handleDelete = (index: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
    };

    const handleMove = (index: number, dir: 'up' | 'down') => {
        setQuestions(prev => {
            const next = [...prev];
            const target = dir === 'up' ? index - 1 : index + 1;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const toGeneratedQuestions = (qs: QuizQuestion[]): GeneratedQuestion[] =>
        qs.map(q => ({ ...q, _gid: `gq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }));

    const generateFromText = async () => {
        if (!aiText.trim()) { toast({ variant: 'destructive', title: 'Paste some content first' }); return; }
        setIsGenerating(true);
        setGeneratedQuestions(null);
        setEditingGeneratedId(null);
        try {
            const result = await generateQuizFromText(aiText, aiTopic, aiCount);
            if (result.error) throw new Error(result.error);
            setGeneratedQuestions(toGeneratedQuestions(result.questions || []));
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Generation failed', description: err.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const generateFromFile = async () => {
        if (!selectedFile) { toast({ variant: 'destructive', title: 'Select a file first' }); return; }
        setIsGenerating(true);
        setGeneratedQuestions(null);
        setEditingGeneratedId(null);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            reader.onload = async () => {
                const dataUrl = reader.result as string;
                const base64 = dataUrl.split(',')[1];
                const mimeType = selectedFile.type === 'application/pdf' ? 'application/pdf' : 'text/plain';
                const result = await generateQuizFromFile(base64, mimeType, aiTopic, aiCount);
                if (result.error) throw new Error(result.error);
                setGeneratedQuestions(toGeneratedQuestions(result.questions || []));
                setIsGenerating(false);
            };
            reader.onerror = () => {
                toast({ variant: 'destructive', title: 'File read failed' });
                setIsGenerating(false);
            };
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Generation failed', description: err.message });
            setIsGenerating(false);
        }
    };

    const acceptGenerated = () => {
        if (!generatedQuestions) return;
        const { length } = generatedQuestions;
        setQuestions(prev => [...prev, ...generatedQuestions.map(({ _gid, ...q }) => q)]);
        setGeneratedQuestions(null);
        setEditingGeneratedId(null);
        toast({ title: `${length} questions added` });
    };

    const dismissGenerated = () => { setGeneratedQuestions(null); setEditingGeneratedId(null); };

    const AiControls = (
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <Label className="text-xs">Topic / Context</Label>
                <Input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder={lessonTitle || 'e.g. Financial Accounting'} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">Number of Questions</Label>
                <Input type="number" min={1} max={20} value={aiCount} onChange={e => setAiCount(parseInt(e.target.value) || 5)} className="h-9" />
            </div>
        </div>
    );

    const GeneratedReview = generatedQuestions && (
        <div className="space-y-3 mt-4 p-4 border rounded-xl bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-green-800">{generatedQuestions.length} questions generated — review &amp; edit before adding</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={dismissGenerated}>Discard</Button>
                    <Button size="sm" className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700" onClick={acceptGenerated} disabled={editingGeneratedId !== null}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Add All to Quiz
                    </Button>
                </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {generatedQuestions.map((gq, i) => (
                    editingGeneratedId === gq._gid ? (
                        <QuestionForm
                            key={gq._gid}
                            question={gq}
                            onSave={(updated) => {
                                setGeneratedQuestions(prev => prev!.map(item => item._gid === gq._gid ? { ...updated, _gid: gq._gid } : item));
                                setEditingGeneratedId(null);
                            }}
                            onCancel={() => setEditingGeneratedId(null)}
                        />
                    ) : (
                        <div key={gq._gid} className="border rounded-lg p-3 bg-white space-y-1.5 text-sm">
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-medium">{i + 1}. {gq.questionText}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditingGeneratedId(gq._gid)}>
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setGeneratedQuestions(prev => prev!.filter(item => item._gid !== gq._gid))}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                {gq.options.map((opt, oi) => (
                                    <div key={oi} className={cn('text-xs px-2 py-1 rounded', oi === gq.correctAnswerIndex ? 'bg-green-100 text-green-800 font-semibold' : 'text-muted-foreground')}>
                                        {OPTION_LETTERS[oi]}. {opt}
                                        {oi === gq.correctAnswerIndex && <span className="ml-1 text-green-600">(Correct)</span>}
                                    </div>
                                ))}
                            </div>
                            {gq.explanation && <p className="text-xs text-muted-foreground italic">Explanation: {gq.explanation}</p>}
                        </div>
                    )
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">Quiz Questions</span>
                    {questions.length > 0 && <Badge variant="secondary">{questions.length}</Badge>}
                </div>
                <Button size="sm" onClick={() => onSave(questions)} className="h-8 gap-1">
                    <Check className="h-3.5 w-3.5" /> Save Quiz ({questions.length} Q)
                </Button>
            </div>

            <Tabs defaultValue="manual">
                <TabsList className="grid w-full grid-cols-3 h-9">
                    <TabsTrigger value="manual" className="text-xs gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Manual</TabsTrigger>
                    <TabsTrigger value="ai-text" className="text-xs gap-1.5"><Sparkles className="h-3.5 w-3.5" /> AI from Text</TabsTrigger>
                    <TabsTrigger value="ai-file" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" /> AI from File</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-3 pt-3">
                    {questions.length === 0 && !isAddingNew && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                            <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No questions yet. Add your first question.</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        {questions.map((q, i) =>
                            editingIndex === i ? (
                                <QuestionForm
                                    key={i}
                                    question={q}
                                    onSave={(updated) => handleSaveQuestion(updated, i)}
                                    onCancel={() => setEditingIndex(null)}
                                />
                            ) : (
                                <QuestionCard
                                    key={i}
                                    question={q}
                                    index={i}
                                    total={questions.length}
                                    onEdit={() => { setIsAddingNew(false); setEditingIndex(i); }}
                                    onDelete={() => handleDelete(i)}
                                    onMoveUp={() => handleMove(i, 'up')}
                                    onMoveDown={() => handleMove(i, 'down')}
                                />
                            )
                        )}
                    </div>

                    {isAddingNew ? (
                        <QuestionForm
                            question={emptyQuestion()}
                            onSave={(q) => handleSaveQuestion(q, null)}
                            onCancel={() => setIsAddingNew(false)}
                        />
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-dashed h-10"
                            onClick={() => { setEditingIndex(null); setIsAddingNew(true); }}
                        >
                            <PlusCircle className="h-4 w-4" /> Add Question
                        </Button>
                    )}
                </TabsContent>

                <TabsContent value="ai-text" className="space-y-3 pt-3">
                    {AiControls}
                    <div className="space-y-1.5">
                        <Label className="text-xs">Paste content to generate questions from</Label>
                        <Textarea
                            value={aiText}
                            onChange={e => setAiText(e.target.value)}
                            placeholder="Paste lesson text, notes, or study material here..."
                            rows={6}
                            className="text-sm"
                        />
                    </div>
                    <Button onClick={generateFromText} disabled={isGenerating || !aiText.trim()} className="w-full gap-2">
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isGenerating ? 'Generating...' : 'Generate Quiz Questions'}
                    </Button>
                    {GeneratedReview}

                    {questions.length > 0 && (
                        <div className="border-t pt-3">
                            <p className="text-xs text-muted-foreground mb-2">{questions.length} question(s) currently in this quiz</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="ai-file" className="space-y-3 pt-3">
                    {AiControls}
                    <div className="space-y-1.5">
                        <Label className="text-xs">Upload a PDF or text file</Label>
                        <div
                            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {selectedFile ? (
                                <div className="space-y-1">
                                    <FileText className="h-6 w-6 mx-auto text-primary" />
                                    <p className="text-sm font-medium">{selectedFile.name}</p>
                                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB — Click to change</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <FileText className="h-6 w-6 mx-auto opacity-40" />
                                    <p className="text-sm text-muted-foreground">Click to select a .pdf or .txt file</p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="sr-only"
                            accept=".pdf,.txt,text/plain,application/pdf"
                            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    <Button onClick={generateFromFile} disabled={isGenerating || !selectedFile} className="w-full gap-2">
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isGenerating ? 'Processing file...' : 'Generate from File'}
                    </Button>
                    {GeneratedReview}

                    {questions.length > 0 && (
                        <div className="border-t pt-3">
                            <p className="text-xs text-muted-foreground mb-2">{questions.length} question(s) currently in this quiz</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
