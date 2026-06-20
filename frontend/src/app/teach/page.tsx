'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitInstructorApplication } from '@/lib/application-service';
import { Loader2, CheckCircle } from 'lucide-react';

export default function TeachPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [experience, setExperience] = useState('');
  const [topics, setTopics] = useState('');
  const [motivation, setMotivation] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
        await submitInstructorApplication({
            fullName: `${firstName} ${lastName}`,
            email,
            phoneNumber,
            linkedinProfileUrl: linkedin,
            portfolioUrl: portfolio,
            teachingExperienceDescription: experience,
            proposedCourseTopics: topics.split(',').map(t => t.trim()),
            motivationStatement: motivation
        });

        setIsSubmitted(true);
        toast({
            title: "Application Received",
            description: "Your application has been logged. We'll contact you after reviewing your profile.",
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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground section-pad">
          <div className="page-container text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="font-headline text-3xl xs:text-4xl font-bold md:text-5xl">Become an Instructor</h1>
              <p className="mx-auto mt-4 max-w-3xl text-lg text-primary-foreground/80">
                Share your expertise, build your brand, and make a global impact. Join our community of professional instructors today.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="section-pad">
          <div className="page-container-md">
            {isSubmitted ? (
                <Card className="flex flex-col items-center justify-center text-center p-12 border-success/20 bg-success/5 animate-in zoom-in-95">
                    <div className="p-4 bg-success/10 rounded-full mb-6">
                        <CheckCircle className="h-12 w-12 text-success" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-success mb-2">Application Received!</CardTitle>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                        Thank you for applying to teach on Profs Training Solutions. Our team will review your professional profile and reach out via email within 3-5 business days.
                    </p>
                    <Button variant="outline" className="mt-8 h-12 px-8" onClick={() => setIsSubmitted(false)}>Submit Another Application</Button>
                </Card>
            ) : (
                <Card className="shadow-xl border-none">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="font-headline text-2xl">Instructor Application</CardTitle>
                        <CardDescription>Tell us about your professional background and academic expertise.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="first-name">First Name</Label>
                                    <Input 
                                        id="first-name" 
                                        placeholder="John" 
                                        required 
                                        value={firstName} 
                                        onChange={e => setFirstName(e.target.value)} 
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="last-name">Last Name</Label>
                                    <Input 
                                        id="last-name" 
                                        placeholder="Doe" 
                                        required 
                                        value={lastName} 
                                        onChange={e => setLastName(e.target.value)} 
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input 
                                        id="email" 
                                        type="email" 
                                        placeholder="john.doe@example.com" 
                                        required 
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)} 
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input 
                                        id="phone" 
                                        type="tel" 
                                        placeholder="+233 24 000 0000" 
                                        value={phoneNumber} 
                                        onChange={e => setPhoneNumber(e.target.value)} 
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
                                <Input 
                                    id="linkedin" 
                                    placeholder="https://linkedin.com/in/johndoe" 
                                    value={linkedin} 
                                    onChange={e => setLinkedin(e.target.value)} 
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="portfolio">Teaching Portfolio / CV URL</Label>
                                <Input 
                                    id="portfolio" 
                                    placeholder="https://johndoe.com/cv" 
                                    value={portfolio} 
                                    onChange={e => setPortfolio(e.target.value)} 
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="experience">Teaching Experience</Label>
                                <Textarea 
                                    id="experience" 
                                    placeholder="Describe your teaching background..." 
                                    required 
                                    rows={3}
                                    value={experience} 
                                    onChange={e => setExperience(e.target.value)} 
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="topics">Proposed Course Topics</Label>
                                <Input 
                                    id="topics" 
                                    placeholder="e.g., Financial Accounting, Corporate Law (comma separated)" 
                                    required 
                                    value={topics} 
                                    onChange={e => setTopics(e.target.value)} 
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="motivation">Why do you want to teach on Profs Training Solutions?</Label>
                                <Textarea 
                                    id="motivation" 
                                    placeholder="Your motivation statement..." 
                                    required 
                                    rows={3}
                                    value={motivation} 
                                    onChange={e => setMotivation(e.target.value)} 
                                    disabled={isSubmitting}
                                />
                            </div>
                            <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                Submit Application
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
