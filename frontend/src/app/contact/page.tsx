'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin, Loader2, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getGlobalSettings, defaultGlobalSettings } from '@/lib/platform-settings-data';
import { type GlobalSettings } from '@/lib/db';
import { submitContactInquiry } from '@/lib/application-service';
import { useToast } from '@/hooks/use-toast';

export default function ContactPage() {
  const [settings, setSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getGlobalSettings().then(data => {
      setSettings(data);
      setIsLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await submitContactInquiry({ name: `${firstName} ${lastName}`, email, subject, message });
      setIsSubmitted(true);
      toast({ title: 'Message Sent', description: "We've received your inquiry and will get back to you shortly." });
    } catch {
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'There was an error sending your message. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">

        {/* Hero */}
        <section className="bg-primary text-primary-foreground overflow-hidden">
          <div className="page-container hero-pad">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl"
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px w-10 bg-accent" aria-hidden />
                <span className="section-label !mb-0">Get in Touch</span>
              </div>
              <h1 className="font-headline font-black text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] tracking-tight">
                We&apos;d love to<br />hear from you.
              </h1>
              <p className="mt-5 text-primary-foreground/70 text-lg leading-relaxed max-w-[48ch]">
                Have a question about our courses, need support, or want to partner with us? Reach out and our team will respond promptly.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Contact body */}
        <section className="section-pad-lg bg-background">
          <div className="page-container">
            <div className="grid grid-cols-1 gap-16 lg:grid-cols-5">

              {/* Left â€” contact info */}
              <div className="lg:col-span-2 space-y-10">
                <div>
                  <p className="section-label mb-4">Contact Information</p>
                  <div className="space-y-6">
                    {[
                      { icon: Mail, label: 'Email', value: settings.supportEmail },
                      { icon: Phone, label: 'Phone', value: settings.supportPhone },
                      { icon: MapPin, label: 'Address', value: settings.businessAddress },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
                          <p className="text-sm text-primary whitespace-pre-wrap">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-primary text-primary-foreground">
                  <p className="font-headline font-bold text-lg mb-2">Response time</p>
                  <p className="text-primary-foreground/70 text-sm leading-relaxed">
                    We aim to respond to all inquiries within <strong className="text-primary-foreground">24 business hours</strong>. For urgent matters please call us directly.
                  </p>
                </div>
              </div>

              {/* Right â€” form */}
              <div className="lg:col-span-3">
                {isSubmitted ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border bg-surface-muted px-8 py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mb-6">
                      <CheckCircle className="h-8 w-8 text-success" />
                    </div>
                    <h2 className="font-headline font-black text-2xl text-primary mb-2">Message Received</h2>
                    <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                      Thank you for reaching out. A Profs Training Solutions representative will contact you via email shortly.
                    </p>
                    <Button variant="outline" className="mt-8" onClick={() => setIsSubmitted(false)}>
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="first-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">First Name</Label>
                        <Input id="first-name" placeholder="Ama" required value={firstName} onChange={e => setFirstName(e.target.value)} disabled={isSubmitting} className="h-11" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="last-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Name</Label>
                        <Input id="last-name" placeholder="Boateng" required value={lastName} onChange={e => setLastName(e.target.value)} disabled={isSubmitting} className="h-11" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Address</Label>
                      <Input id="email" type="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={isSubmitting} className="h-11" />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="subject" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</Label>
                      <Input id="subject" placeholder="e.g., Payment Issue, Course Question" required value={subject} onChange={e => setSubject(e.target.value)} disabled={isSubmitting} className="h-11" />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="message" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="Describe your issue or question in detail..."
                        rows={6}
                        required
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        disabled={isSubmitting}
                        className="resize-none"
                      />
                    </div>

                    <Button type="submit" size="lg" className="w-full font-bold h-12" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Message
                    </Button>
                  </form>
                )}
              </div>

            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
