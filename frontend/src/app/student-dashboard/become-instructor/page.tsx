'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { GraduationCap, Loader2, CheckCircle } from 'lucide-react';
import { submitInstructorApplication } from '@/lib/application-service';

export default function BecomeInstructorDashboardPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form State
  const [professionalId, setProfessionalId] = useState('');
  const [expertise, setExpertise] = useState('');
  const [bio, setBio] = useState('');
  const [motivation, setMotivation] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast({ variant: 'destructive', title: "Not Authenticated", description: "Please log in to apply." });
        return;
    }

    setIsSubmitting(true);
    
    try {
        await submitInstructorApplication({
          applicantId: user.uid,
          fullName: user.displayName || user.email || 'Unknown',
          email: user.email || '',
          teachingExperienceDescription: `Professional ID: ${professionalId}\n\n${bio}`,
          proposedCourseTopics: expertise.split(',').map(s => s.trim()).filter(Boolean),
          motivationStatement: motivation || bio,
        });
        
        setIsSubmitted(true);
        toast({
            title: "Application Received",
            description: "Your instructor application has been submitted. Our team will review it within 3-5 business days.",
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: "Submission Error",
            description: "Could not submit your application. Please check your connection.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center shadow-2xl border-none animate-in zoom-in-95 duration-300">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-headline text-green-700">Application Submitted!</CardTitle>
            <CardDescription>
              Thank you for applying to become an instructor on Profs Training Solutions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              We\'ve received your request to teach. Our curriculum team reviews all applications within 3-5 business days. You\'ll receive a notification in your dashboard once your status has been updated.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsSubmitted(false)}>
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl">
          < GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-1 font-headline">Become an Instructor</h1>
          <p className="text-muted-foreground">
            Share your professional expertise with thousands of Ghanaian students.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <Card className="shadow-lg border-none overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Instructor Application</CardTitle>
            <CardDescription>Tell us about your background and what you\'d like to teach.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={user?.displayName || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" type="email" value={user?.email || ''} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="professionalId">Professional ID (ICAG/CITG Number)</Label>
                <Input 
                    id="professionalId" 
                    placeholder="e.g., Reg No. 12345" 
                    required 
                    value={professionalId}
                    onChange={e => setProfessionalId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expertise">Primary Field of Expertise</Label>
                <Input 
                    id="expertise" 
                    placeholder="e.g., Financial Reporting, Corporate Law" 
                    required 
                    value={expertise}
                    onChange={e => setExpertise(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Teaching Experience & Background</Label>
                <Textarea 
                  id="bio" 
                  placeholder="Briefly describe your professional background and teaching experience." 
                  rows={4} 
                  required
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivation">Why do you want to teach on Profs Training Solutions?</Label>
                <Textarea 
                  id="motivation" 
                  placeholder="Tell us your motivation and what value you will bring to students." 
                  rows={3} 
                  required
                  value={motivation}
                  onChange={e => setMotivation(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  'Submit Application'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Why teach here?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm opacity-90">
              <div className="space-y-1">
                <p className="font-bold">Scale Your Impact</p>
                <p className="text-[11px]">Reach students across the entire country instantly.</p>
              </div>
              <div className="space-y-1">
                <p className="font-bold">Earn Revenue</p>
                <p className="text-[11px]">Get paid GH₵ for every enrollment in your courses.</p>
              </div>
              <div className="space-y-1">
                <p className="font-bold">AI Support</p>
                <p className="text-[11px]">Use PTS AI to build curriculum and quizzes 10x faster.</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/50 border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="text-[10px] text-muted-foreground space-y-2 leading-relaxed">
              <p>• Courses must align with the current official ICAG/CITG syllabus.</p>
              <p>• High-quality audio and HD video (1080p) are mandatory.</p>
              <p>• Instructors must maintain active certification status.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
