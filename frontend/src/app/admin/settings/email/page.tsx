'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Eye, Code, KeyRound, Loader2, CheckCircle2, XCircle, Send, RefreshCw, AlertTriangle } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  defaultEmailTemplates,
  getEmailTemplates,
  saveEmailTemplate,
  type EmailTemplateKey,
  type EmailTemplates,
} from '@/lib/email-template-data';
import { logAdminAction } from '@/lib/audit-data';
import { getEmailProviderStatus, sendTestEmail } from '@/app/actions/email';

type HealthStatus = {
  configured: boolean;
  internalSecretConfigured: boolean;
  senderDomain: string;
  senderAddress: string;
  senderDomainConfigured: boolean;
};

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-none">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
      {ok ? (
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-bold">OK</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-destructive">
          <XCircle className="h-4 w-4" />
          <span className="text-xs font-bold">Not Set</span>
        </div>
      )}
    </div>
  );
}

export default function EmailTemplatesPage() {
  const { user: adminUser } = useUser();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<EmailTemplates>(defaultEmailTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateKey>('welcome');
  const [subject, setSubject] = useState(defaultEmailTemplates.welcome?.subject ?? '');
  const [body, setBody] = useState(defaultEmailTemplates.welcome?.body ?? '');
  const [activeTab, setActiveTab] = useState('health');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    void loadTemplates();
    void loadHealth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const loaded = await getEmailTemplates();
      setTemplates(loaded);
      setSubject(loaded.welcome?.subject ?? '');
      setBody(loaded.welcome?.body ?? '');
    } catch {
      toast({ variant: 'destructive', title: 'Template load failed' });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const status = await getEmailProviderStatus();
      setHealth(status);
    } catch {
      setHealth(null);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const handleTemplateChange = (value: string) => {
    const key = value as EmailTemplateKey;
    setSelectedTemplate(key);
    setSubject(templates[key]?.subject ?? '');
    setBody(templates[key]?.body ?? '');
  };

  const handleSaveTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      await saveEmailTemplate(selectedTemplate, { subject, body });
      setTemplates(prev => ({
        ...prev,
        [selectedTemplate]: { ...prev[selectedTemplate], subject, body },
      }));

      if (adminUser) {
        await logAdminAction({
          actorId: adminUser.uid,
          actorName: adminUser.displayName || adminUser.email || 'Administrator',
          action: 'SETTINGS_UPDATE',
          targetId: `email-template-${selectedTemplate}`,
          targetType: 'setting',
          severity: 'info',
          details: `Updated email template: ${templates[selectedTemplate].name}`,
        });
      }

      toast({ title: "Template Saved", description: `The "${templates[selectedTemplate].name}" template has been updated.` });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save template changes.' });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const [testRecipient, setTestRecipient] = useState('');

  const handleSendTest = async () => {
    if (!adminUser) return;
    setIsSendingTest(true);
    try {
      const idToken = await adminUser.getIdToken(true);
      const result = await sendTestEmail(idToken, testRecipient.trim() || undefined);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Test email failed', description: result.error });
      } else {
        toast({ title: 'Test email sent!', description: `Test email delivered to ${result.sentTo}.` });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const renderedPreview = useMemo(() => {
    let html = body;
    const replacements: Record<string, string> = {
      '{{user.name}}': 'John Doe',
      '{{siteName}}': 'Profs Training Solutions',
      '{{order.id}}': 'INV-2024-8892',
      '{{order.total}}': '150.00',
      '{{course.title}}': 'Financial Reporting (ICAG)',
    };
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replaceAll(key, value);
    });
    return html;
  }, [body]);

  if (isLoadingTemplates) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-8 items-start">
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Communication Hub
              </CardTitle>
              <CardDescription>Monitor email health and customize automated templates.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6 border-b bg-muted/10">
              <TabsList className="bg-transparent h-12 gap-6 rounded-none">
                <TabsTrigger value="health" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full gap-2">
                  <CheckCircle2 size={16} /> Email Health
                </TabsTrigger>
                <TabsTrigger value="config" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full gap-2">
                  <KeyRound size={16} /> API Config
                </TabsTrigger>
                <TabsTrigger value="editor" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full gap-2">
                  <Code size={16} /> Template Editor
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Email Health Tab ─────────────────────────────────── */}
            <TabsContent value="health" className="p-6 m-0 space-y-6">
              {/* Prominent banner when sender domain is not configured */}
              {health && !health.senderDomainConfigured && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 space-y-1">
                    <p className="font-bold">Email sender domain not configured</p>
                    <p className="text-xs leading-relaxed">
                      Transactional emails (welcome, enrollment, approval) are using the default test domain
                      <code className="mx-1 bg-amber-100 px-1 rounded">{health.senderDomain}</code>
                      which may not be verified with Resend and can cause delivery failures in production.
                    </p>
                    <p className="text-xs leading-relaxed">
                      Set <code className="bg-amber-100 px-1 rounded">APP_EMAIL_FROM</code> (e.g.{' '}
                      <code className="bg-amber-100 px-1 rounded">no-reply@yourdomain.com</code>) or{' '}
                      <code className="bg-amber-100 px-1 rounded">APP_EMAIL_DOMAIN</code> in your environment
                      secrets and redeploy to fix this.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Live Configuration Status</p>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={loadHealth} disabled={isLoadingHealth}>
                  {isLoadingHealth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
              </div>

              {isLoadingHealth ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : health ? (
                <div className="rounded-xl border divide-y overflow-hidden">
                  <StatusRow
                    label="Resend API Key"
                    ok={health.configured}
                    detail={health.configured ? 'RESEND_API_KEY is set in environment' : 'Set RESEND_API_KEY in your environment secrets'}
                  />
                  <StatusRow
                    label="Internal Email Secret"
                    ok={health.internalSecretConfigured}
                    detail={health.internalSecretConfigured ? 'INTERNAL_EMAIL_SECRET is set — webhook emails will authenticate' : 'Set INTERNAL_EMAIL_SECRET to enable webhook & signup emails'}
                  />
                  <StatusRow
                    label="Sender Domain"
                    ok={health.senderDomainConfigured}
                    detail={
                      health.senderDomainConfigured
                        ? `${health.senderAddress} (domain: ${health.senderDomain})`
                        : `Using default test domain (${health.senderDomain}). Set APP_EMAIL_FROM or APP_EMAIL_DOMAIN to configure a verified sender.`
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Could not load status. Try refreshing.</p>
              )}

              <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                <p className="text-sm font-semibold">Send Test Email</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Send a live test email to verify the full delivery stack — Resend API, sender domain, and template rendering. Leave blank to send to your own account.
                </p>
                <div className="flex gap-2 items-center">
                  <Input
                    type="email"
                    placeholder={adminUser?.email ?? 'your@email.com'}
                    value={testRecipient}
                    onChange={e => setTestRecipient(e.target.value)}
                    disabled={isSendingTest || !health?.configured}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    onClick={handleSendTest}
                    disabled={isSendingTest || !health?.configured}
                    className="gap-2 shrink-0"
                    size="sm"
                  >
                    {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isSendingTest ? 'Sending…' : 'Send'}
                  </Button>
                </div>
                {!health?.configured && (
                  <p className="text-xs text-destructive">Resend API key must be configured before sending.</p>
                )}
              </div>
            </TabsContent>

            {/* ── API Config Tab ───────────────────────────────────── */}
            <TabsContent value="config" className="p-6 m-0 space-y-6">
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-green-800 leading-relaxed font-medium space-y-2">
                    <p className="font-bold">Resend API key is configured via environment variables</p>
                    <p>For security, the API key is stored as <code className="bg-green-100 px-1 rounded">RESEND_API_KEY</code> in your deployment environment, not in the database.</p>
                    <p>To update the key, change the environment variable in your hosting provider&apos;s dashboard and redeploy.</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-3">
                  <KeyRound className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 leading-relaxed font-medium space-y-1.5">
                    <p className="font-bold">Environment Variables Required</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><code className="bg-blue-100 px-1 rounded">RESEND_API_KEY</code> — Resend API key for sending emails</li>
                      <li><code className="bg-blue-100 px-1 rounded">INTERNAL_EMAIL_SECRET</code> — Internal secret for webhook email auth</li>
                      <li><code className="bg-blue-100 px-1 rounded">APP_EMAIL_DOMAIN</code> — Verified sender domain (optional, defaults to mytestingdomain.icu)</li>
                      <li><code className="bg-blue-100 px-1 rounded">APP_EMAIL_FROM</code> — Sender address (optional)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Template Editor Tab ──────────────────────────────── */}
            <TabsContent value="editor" className="p-6 m-0 space-y-6">
              <div className="flex justify-between items-center mb-4">
                <Label>Select Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(templates).map(([key, t]) => (
                      <SelectItem key={key} value={key}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Subject Line</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Body (HTML)</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm min-h-[300px]" />
              </div>
              <Button onClick={handleSaveTemplate} className="w-full" disabled={isSavingTemplate}>
                {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Template Changes'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="sticky top-24">
        <Card className="border-none shadow-xl overflow-hidden flex flex-col h-[600px]">
          <CardHeader className="bg-slate-900 text-white pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Eye size={16} className="text-accent" /> Preview Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden">
            <div className="p-8 bg-white dark:bg-slate-900 m-4 rounded-lg shadow-inner border h-[calc(100%-32px)] overflow-auto">
              <div className="prose dark:prose-invert max-w-none prose-sm font-sans" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderedPreview) }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
