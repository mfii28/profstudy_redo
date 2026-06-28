'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Quote, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTestimonials, TESTIMONIAL_GROUPS, type TestimonialDocument } from '@/lib/testimonial-data';
import type { TestimonialGroup } from '@/lib/db';
import { resolveAvatarUrl } from '@/lib/media-url';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { submitUserTestimonial } from '@/app/actions/testimonials';
import { apiFetch } from '@/lib/api-client';

function groupLabel(group?: TestimonialGroup): string {
  return TESTIMONIAL_GROUPS.find((g) => g.value === (group ?? 'general'))?.label ?? 'General';
}

export default function TestimonialsPage() {
  const [stories, setStories] = useState<TestimonialDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState<TestimonialGroup | 'all'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [text, setText] = useState('');
  const [group, setGroup] = useState<TestimonialGroup>('general');
  const { user } = useUser();
  const { toast } = useToast();

  const loadStories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTestimonials(48, filterGroup === 'all' ? undefined : filterGroup);
      setStories(data);
    } finally {
      setIsLoading(false);
    }
  }, [filterGroup]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  useEffect(() => {
    if (!user) return;
    apiFetch('/users/profile').then(res => {
      if (res.ok) return res.json();
    }).then(data => {
      if (data?.user?.name && !name) setName(String(data.user.name));
    }).catch(() => {});
  }, [user, name]);

  const filteredStories = useMemo(() => stories, [stories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Please log in to share your story.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const result = await submitUserTestimonial({ name, role, text, group }, idToken);
      if ('error' in result && result.error) {
        toast({ variant: 'destructive', title: 'Submission failed', description: result.error });
        return;
      }
      setSubmitted(true);
      setText('');
      toast({
        title: 'Thank you!',
        description: 'Your testimonial was sent for review. We will publish it once approved.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground overflow-hidden">
          <div className="page-container hero-pad">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <div className="mb-8 flex items-center gap-3">
                <span className="h-px w-10 bg-accent" aria-hidden />
                <span className="section-label !mb-0">Student Voices</span>
              </div>
              <h1 className="font-headline text-[clamp(2.5rem,5vw,4rem)] font-black leading-[1.02] tracking-tight">
                Testimonials
              </h1>
              <p className="mt-6 max-w-[50ch] text-lg leading-relaxed text-primary-foreground/70">
                Real stories from ICAG and CITG students who trained with us. Share yours and inspire the next cohort.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="bg-background section-pad-lg">
          <div className="page-container">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-label">Community Stories</p>
                <h2 className="section-heading">Approved testimonials</h2>
              </div>
              <Select
                value={filterGroup}
                onValueChange={(v) => setFilterGroup(v as TestimonialGroup | 'all')}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {TESTIMONIAL_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredStories.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredStories.map((story, idx) => (
                  <motion.div
                    key={story.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="flex flex-col rounded-xl border bg-card p-6"
                  >
                    <div className="mb-4 flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                      ))}
                    </div>
                    <Quote className="mb-3 h-6 w-6 flex-shrink-0 text-accent/30" />
                    <p className="flex-grow text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{story.text}&rdquo;
                    </p>
                    <div className="mt-6 flex items-center gap-3 border-t pt-4">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={resolveAvatarUrl(story.avatar)} alt={story.name} />
                        <AvatarFallback className="bg-primary text-xs font-black text-primary-foreground">
                          {story.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">{story.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{story.role}</p>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0 text-xs">
                        {groupLabel(story.group)}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-surface py-16 text-center text-muted-foreground">
                <p className="font-medium">No published testimonials in this group yet.</p>
                <p className="mt-2 text-sm">Be the first to share your story below.</p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-surface-muted section-pad-lg">
          <div className="page-container">
            <div className="mx-auto max-w-2xl">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="font-headline text-2xl">Share your story</CardTitle>
                  <CardDescription>
                    Submissions are reviewed by our team before appearing on this page.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submitted ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                        <CheckCircle2 className="h-8 w-8 text-success" />
                      </div>
                      <p className="font-semibold text-primary">Submission received</p>
                      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        We will notify you once your testimonial is approved and published.
                      </p>
                      <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
                        Submit another
                      </Button>
                    </div>
                  ) : user ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="t-name">Your name</Label>
                          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="t-role">Program / role</Label>
                          <Input
                            id="t-role"
                            placeholder="e.g. ICAG Level 2 Student"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="t-group">Group</Label>
                        <Select value={group} onValueChange={(v) => setGroup(v as TestimonialGroup)}>
                          <SelectTrigger id="t-group">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TESTIMONIAL_GROUPS.map((g) => (
                              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="t-text">Your testimonial</Label>
                        <Textarea
                          id="t-text"
                          rows={5}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          placeholder="Tell us how Profs Training Solutions helped you..."
                          required
                          minLength={20}
                        />
                      </div>
                      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Submit for review
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-xl border bg-background p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Sign in to submit your testimonial for admin review.
                      </p>
                      <Button asChild className="mt-4">
                        <Link href="/login?redirect=/testimonials">Sign in to submit</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
