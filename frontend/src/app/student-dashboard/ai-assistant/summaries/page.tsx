'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { summarizeLessonContent } from "@/ai/flows/lesson-content-summarization";
import { useToast } from "@/hooks/use-toast";
import { useStudentProfile } from "@/hooks/use-student-profile";
import { Skeleton } from "@/components/ui/skeleton";

function AiSummariesPage() {
    const { user, profile, isLoading: isUserLoading } = useStudentProfile();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const { toast } = useToast();

  const handleGenerateSummary = async () => {
    if (!content.trim()) {
        toast({
            variant: "destructive",
            title: "Content is empty",
            description: "Please paste some content to summarize."
        });
        return;
    }
    if (!user || !profile) return;

    setIsLoading(true);
    setSummary('');

    try {
        const result = await summarizeLessonContent(
            {
                type: "document",
                documentText: content,
            },
            {
                requesterUid: user.uid,
            }
        );
        setSummary(result.summary);
    } catch (error) {
        console.error("Failed to generate summary", error);
         toast({
            variant: "destructive",
            title: "AI Error",
            description: "Failed to generate the summary. Please try again."
        });
    } finally {
        setIsLoading(false);
    }
  }
  
  if (isUserLoading || !user || !profile) {
      return (
          <div className="space-y-8">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-96 w-full" />
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
            <h1 className="text-3xl font-bold mb-2 font-headline">AI Summaries</h1>
            <p className="text-muted-foreground">
            Turns 20-page PDFs or hour-long videos into quick, readable bullet points.
            </p>
        </div>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Instant Lesson Breakdowns</CardTitle>
            <CardDescription>Paste your lesson content below to generate a summary.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-2">
                <Label htmlFor="content">Content to Summarize</Label>
                <Textarea 
                    id="content" 
                    placeholder="Paste a video transcript, article text, or study notes here..." 
                    rows={15} 
                    value={content}
                    onChange={e => setContent(e.target.value)}
                />
            </div>
        </CardContent>
        <CardFooter>
            <Button size="lg" onClick={handleGenerateSummary} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Generate Summary
            </Button>
        </CardFooter>
      </Card>
      
      {summary && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent"/> AI-Generated Summary</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{summary}</p>
            </CardContent>
        </Card>
      )}

    </div>
  );
}

export default AiSummariesPage;
