'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { getPresignedUploadUrl } from '@/app/actions/storage';
import {
  ingestCourseRagFromText,
  ingestCourseRagFile,
  getCourseRagStatsForStaff,
  type CourseRagStats,
} from '@/app/actions/rag';

interface CourseRagIngestPanelProps {
  courseId: string;
  courseTitle?: string;
}

export function CourseRagIngestPanel({ courseId, courseTitle }: CourseRagIngestPanelProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [stats, setStats] = useState<CourseRagStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sourceLabel, setSourceLabel] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const refreshStats = useCallback(async () => {
    if (!user || !courseId) {
      setStats(null);
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await getCourseRagStatsForStaff(courseId, token);
      if (res.ok) setStats(res.stats);
      else setStats(null);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const runIngest = async (label: string, text: string) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in required' });
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'No text', description: 'Paste transcript text or choose a file first.' });
      return;
    }
    const src = label.trim().slice(0, 200) || 'Course material';
    setIngesting(true);
    try {
      const token = await user.getIdToken();
      const result = await ingestCourseRagFromText(courseId, token, src, trimmed);
      if (!result.ok) {
        toast({ variant: 'destructive', title: 'Indexing failed', description: result.error || 'Unknown error' });
        return;
      }
      toast({
        title: result.skipped ? 'Already up to date' : 'Materials indexed',
        description:
          result.chunkCount === 0
            ? 'No chunks were created (text may be too short).'
            : result.skipped
              ? 'Same content hash as the last index for this source — skipped re-embedding.'
              : `${result.chunkCount} chunks saved for AI tutor, flashcards, and exams.`,
      });
      setPasteText('');
      await refreshStats();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Indexing failed', description: 'Try again in a moment.' });
    } finally {
      setIngesting(false);
    }
  };

  const onSubmitPaste = () => void runIngest(sourceLabel || 'Pasted notes / transcript', pasteText);

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in required' });
      return;
    }

    setIngesting(true);
    try {
      const label = sourceLabel.trim() || file.name.replace(/\.[^.]+$/, '') || file.name;
      const token = await user.getIdToken();

      // Request presigned URL from Cloudflare R2
      const presigned = await getPresignedUploadUrl(
        user.uid,
        'course_rag',
        file.name,
        file.type || 'application/octet-stream',
        courseId,
        token
      );

      if (presigned.error || !presigned.url || !presigned.key) {
        toast({
          variant: 'destructive',
          title: 'Could not prepare upload',
          description: presigned.error || 'Unknown storage authorization error',
        });
        return;
      }

      // Upload directly to Cloudflare R2
      const uploadRes = await fetch(presigned.url, {
        method: 'PUT',
        headers: {
          'Content-Type': presigned.contentType || file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: 'Failed to write file to storage. Try again.',
        });
        return;
      }

      // Trigger RAG conversion on server
      const result = await ingestCourseRagFile(courseId, token, label, presigned.key);
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Indexing failed',
          description: result.error || 'Failed to process RAG file on server.',
        });
        return;
      }

      toast({
        title: result.skipped ? 'Already up to date' : 'Materials indexed',
        description: result.skipped
          ? 'Same content hash as the last index for this source — skipped processing.'
          : `${label} has been processed and indexed for the AI tutor.`,
      });

      setSourceLabel('');
      await refreshStats();
    } catch (err) {
      console.error('[course-rag-ingest] file ingestion failed:', err);
      toast({
        variant: 'destructive',
        title: 'Could not read file',
        description: err instanceof Error ? err.message : 'Try a different PDF or export to TXT.',
      });
    } finally {
      setIngesting(false);
    }
  };

  return (
    <Card className="rounded-2xl border-dashed border-primary/25 bg-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-black">
          <Sparkles className="h-5 w-5 text-primary" />
          AI course materials (RAG)
        </CardTitle>
        <CardDescription>
          Upload PDF, DOCX, or TXT — or paste a transcript — so enrolled students get answers, flashcards, and exams
          grounded in <strong>{courseTitle || 'this course'}</strong>. Re-indexing the same source name replaces old
          chunks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {statsLoading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking index…
            </span>
          ) : stats ? (
            <span>
              <strong className="text-foreground">{stats.chunkCount}</strong> indexed chunks ·{' '}
              <strong className="text-foreground">{stats.sources.length}</strong> source label
              {stats.sources.length === 1 ? '' : 's'}
              {stats.sources.length > 0 ? `: ${stats.sources.slice(0, 5).join(', ')}${stats.sources.length > 5 ? '…' : ''}` : ''}
            </span>
          ) : (
            <span>No index stats (save permissions or try refresh).</span>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void refreshStats()}>
            Refresh
          </Button>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="rag-source-label">Source name (for student citations)</Label>
          <Input
            id="rag-source-label"
            placeholder="e.g. Module 2 slides, Week 4 transcript"
            value={sourceLabel}
            onChange={ev => setSourceLabel(ev.target.value)}
            maxLength={200}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="rag-paste">Paste transcript or notes</Label>
          <Textarea
            id="rag-paste"
            placeholder="Paste plain text from a lecture transcript, study guide, or exported PDF text…"
            value={pasteText}
            onChange={ev => setPasteText(ev.target.value)}
            rows={6}
            className="min-h-[120px] font-mono text-xs"
          />
          <Button type="button" onClick={onSubmitPaste} disabled={ingesting || !pasteText.trim()} className="w-fit gap-2 font-bold">
            {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Index pasted text
          </Button>
        </div>

        <div className="relative border-t pt-4">
          <Label className="mb-2 block">Or upload a file</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="file" accept=".pdf,.docx,.txt" className="max-w-sm cursor-pointer text-xs" onChange={onFileSelected} disabled={ingesting} />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">PDF · DOCX · TXT</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            <Upload className="mr-1 inline h-3 w-3" />
            Extraction runs in your browser; only plain text is sent to the server for chunking and embeddings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
