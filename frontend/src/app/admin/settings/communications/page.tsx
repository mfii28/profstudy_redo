'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { getGlobalSettings, setGlobalSettings } from '@/lib/platform-settings-data';
import {
  getCommunicationProviderStatus,
  loadCommunicationTemplatesAdmin,
  previewAllSmsTemplatesAction,
  processCommunicationQueueNow,
  saveCommunicationTemplateAdmin,
  sendAllSmsTemplateTestsAction,
  sendTemplateTestCommunication,
  sendTestCommunication,
} from '@/app/actions/communications';
import type { GlobalSettings } from '@/lib/db';
import type { SmsTemplatePreviewRow, SmsTemplateTestResult } from '@/lib/communications';
import {
  COMMUNICATION_EVENT_KEYS,
  EVENT_INTEGRATION_HINTS,
  PLACEHOLDERS_BY_EVENT,
  SAMPLE_METADATA_BY_EVENT,
  formatEventLabel,
  type CommunicationEventKey,
  type CommunicationChannel,
  defaultCommunicationTemplates,
} from '@/lib/communication-template-data';

type ProviderStatus = Awaited<ReturnType<typeof getCommunicationProviderStatus>>;

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      {ok ? (
        <div className="flex shrink-0 items-center gap-1.5 text-green-600 dark:text-green-500">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span className="text-xs font-medium">Configured</span>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5 text-destructive">
          <XCircle className="h-4 w-4" aria-hidden />
          <span className="text-xs font-medium">Missing</span>
        </div>
      )}
    </div>
  );
}

function SettingToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <Label className="cursor-pointer font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function CommunicationsSettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading communication settings">
      {[1, 2, 3].map((section) => (
        <Card key={section}>
          <CardHeader>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CommunicationSettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [templateBody, setTemplateBody] = useState('');
  const [templateEnabled, setTemplateEnabled] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateEvent, setTemplateEvent] = useState<CommunicationEventKey>('otp');
  const [templateChannel, setTemplateChannel] = useState<CommunicationChannel>('sms');
  const [phone, setPhone] = useState('');
  const [previewVars, setPreviewVars] = useState<Record<string, string>>(SAMPLE_METADATA_BY_EVENT.otp);
  const [loading, setLoading] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [testingChannel, setTestingChannel] = useState<'sms' | 'whatsapp' | null>(null);
  const [sendingTemplateSms, setSendingTemplateSms] = useState(false);
  const [previewingAll, setPreviewingAll] = useState(false);
  const [sendingAllLive, setSendingAllLive] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<SmsTemplatePreviewRow[] | null>(null);
  const [bulkSendResults, setBulkSendResults] = useState<SmsTemplateTestResult[] | null>(null);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  const refreshStatus = async () => {
    const st = await getCommunicationProviderStatus();
    setStatus(st);
  };

  useEffect(() => {
    void (async () => {
      const [s, st] = await Promise.all([getGlobalSettings(), getCommunicationProviderStatus()]);
      setSettings(s);
      setStatus(st);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const idToken = await user.getIdToken();
      const result = await loadCommunicationTemplatesAdmin({ idToken });
      const templates =
        'templates' in result && result.templates
          ? result.templates
          : defaultCommunicationTemplates;
      const selected = templates[templateEvent]?.[templateChannel] || defaultCommunicationTemplates[templateEvent][templateChannel];
      setTemplateBody(selected.body);
      setTemplateEnabled(selected.enabled);
      setTemplatesLoaded(true);
    })();
  }, [user, templateEvent, templateChannel]);

  useEffect(() => {
    setPreviewVars({ ...SAMPLE_METADATA_BY_EVENT[templateEvent] });
    setBulkSendResults(null);
  }, [templateEvent]);

  if (!settings) return <CommunicationsSettingsSkeleton />;

  const update = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) =>
    setSettings((prev) => {
      setIsDirty(true);
      return prev ? { ...prev, [key]: value } : prev;
    });

  const save = async () => {
    setLoading(true);
    try {
      await setGlobalSettings(settings);
      setIsDirty(false);
      toast({ title: 'Saved', description: 'Communication settings updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!user) return;
    setTemplateSaving(true);
    try {
      const idToken = await user.getIdToken();
      const result = await saveCommunicationTemplateAdmin({
        idToken,
        eventKey: templateEvent,
        channel: templateChannel,
        body: templateBody,
        enabled: templateEnabled,
      });
      if ((result as { error?: string }).error) {
        toast({ variant: 'destructive', title: 'Template save failed', description: (result as { error: string }).error });
        return;
      }
      toast({ title: 'Template saved', description: `${templateEvent} ${templateChannel} template updated.` });
    } catch {
      toast({ variant: 'destructive', title: 'Template save failed' });
    } finally {
      setTemplateSaving(false);
    }
  };

  const preview = templateBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => previewVars[key] || '');

  const test = async (channel: 'sms' | 'whatsapp') => {
    if (!user) return;
    setTestingChannel(channel);
    try {
      const idToken = await user.getIdToken();
      const result = await sendTestCommunication({ idToken, channel, toPhoneNumber: phone });
      if ((result as { error?: string }).error) {
        toast({
          variant: 'destructive',
          title: 'Test failed',
          description: (result as { error?: string }).error,
        });
      } else {
        toast({
          title: 'Test sent',
          description: `Your ${channel.toUpperCase()} test was accepted by the provider.`,
        });
        void refreshStatus();
      }
    } finally {
      setTestingChannel(null);
    }
  };

  const sendTemplateSmsTest = async () => {
    if (!user || !phone.trim()) return;
    setSendingTemplateSms(true);
    try {
      const idToken = await user.getIdToken();
      const result = await sendTemplateTestCommunication({
        idToken,
        eventKey: templateEvent,
        channel: 'sms',
        toPhoneNumber: phone,
        metadata: previewVars,
        fallbackMessage: preview,
      });
      if ((result as { error?: string }).error) {
        toast({
          variant: 'destructive',
          title: 'Template test failed',
          description: (result as { error?: string }).error,
        });
      } else {
        toast({
          title: 'Template test sent',
          description: `Rendered ${formatEventLabel(templateEvent)} SMS was sent to your test number.`,
        });
      }
    } finally {
      setSendingTemplateSms(false);
    }
  };

  const loadAllSmsPreviews = async () => {
    if (!user) return;
    setPreviewingAll(true);
    setBulkSendResults(null);
    try {
      const idToken = await user.getIdToken();
      const result = await previewAllSmsTemplatesAction({ idToken });
      if ((result as { error?: string }).error) {
        toast({ variant: 'destructive', title: 'Preview failed', description: (result as { error?: string }).error });
        return;
      }
      setBulkPreviewRows((result as { rows?: SmsTemplatePreviewRow[] }).rows || []);
    } finally {
      setPreviewingAll(false);
    }
  };

  const sendAllLive = async () => {
    if (!user || !phone.trim() || !bulkPreviewRows) return;
    const enabledCount = bulkPreviewRows.filter((row) => row.enabled).length;
    const confirmed = window.confirm(
      `This will send ${enabledCount} live SMS message(s) to ${phone.trim()} using each enabled template. Continue?`
    );
    if (!confirmed) return;

    setSendingAllLive(true);
    try {
      const idToken = await user.getIdToken();
      const result = await sendAllSmsTemplateTestsAction({ idToken, toPhoneNumber: phone });
      if ((result as { error?: string }).error) {
        toast({ variant: 'destructive', title: 'Bulk send failed', description: (result as { error?: string }).error });
        return;
      }
      const results = (result as { results?: SmsTemplateTestResult[] }).results || [];
      setBulkSendResults(results);
      const sent = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok && !r.skipped).length;
      toast({
        title: 'Bulk send complete',
        description: `${sent} sent, ${failed} failed, ${results.filter((r) => r.skipped).length} skipped (disabled).`,
      });
    } finally {
      setSendingAllLive(false);
    }
  };

  const processQueue = async () => {
    if (!user) return;
    setProcessingQueue(true);
    try {
      const idToken = await user.getIdToken(true);
      const result = await processCommunicationQueueNow({ idToken, limit: 200 });
      if ((result as { error?: string }).error) {
        toast({ variant: 'destructive', title: 'Queue processing failed', description: (result as { error?: string }).error });
      } else {
        const processed = (result as { processed?: number }).processed || 0;
        const skipped = (result as { skipped?: number }).skipped || 0;
        toast({
          title: 'Queue processed',
          description:
            skipped > 0
              ? `Processed ${processed} job(s); skipped ${skipped} already claimed or not pending.`
              : `Processed ${processed} pending message(s).`,
        });
      }
    } finally {
      setProcessingQueue(false);
    }
  };

  const smsKeyDetail = status?.smsConfigured
    ? `Source: ${status.smsKeySource} (${status.smsKeyLength} characters)`
    : 'Set ARKESEL_SMS_API_KEY or ARKESEL_API_KEY in your deployment environment';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SMS & WhatsApp Settings</CardTitle>
          <CardDescription>
            Channel toggles and templates are saved here. Arkesel API keys are configured only via environment variables, not the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="divide-y rounded-lg border px-4">
            <SettingToggleRow
              label="Enable SMS"
              checked={!!settings.commSmsEnabled}
              onCheckedChange={(v) => update('commSmsEnabled', v)}
            />
            <SettingToggleRow
              label="Enable WhatsApp"
              checked={!!settings.commWhatsappEnabled}
              onCheckedChange={(v) => update('commWhatsappEnabled', v)}
            />
            <SettingToggleRow
              label="Enable OTP over SMS"
              checked={!!settings.commOtpSmsEnabled}
              onCheckedChange={(v) => update('commOtpSmsEnabled', v)}
            />
            <SettingToggleRow
              label="Enable OTP over WhatsApp"
              checked={!!settings.commOtpWhatsappEnabled}
              onCheckedChange={(v) => update('commOtpWhatsappEnabled', v)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Retry Limit</Label>
              <Input value={settings.commRetryLimit || '3'} onChange={(e) => update('commRetryLimit', e.target.value)} />
            </div>
            <div>
              <Label>Rate Limit (per minute)</Label>
              <Input value={settings.commRateLimitPerMinute || '60'} onChange={(e) => update('commRateLimitPerMinute', e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isDirty ? 'You have unsaved communication settings.' : 'All communication settings are saved.'}
            </p>
            <Button onClick={save} disabled={loading || !isDirty}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Provider Health</CardTitle>
            <CardDescription>Read-only status from environment variables (values are never shown).</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshStatus()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {status ? (
            <div className="rounded-xl border divide-y overflow-hidden">
              <StatusRow label="Arkesel SMS API Key" ok={!!status.smsConfigured} detail={smsKeyDetail} />
              <StatusRow
                label="SMS Sender ID"
                ok={!!status.smsSenderConfigured && status.smsSenderValid !== false}
                detail={
                  status.smsSenderError
                    ? status.smsSenderError
                    : status.smsSenderId
                      ? `ARKESEL_SMS_SENDER_ID: ${status.smsSenderId} (must be less than 11 characters)`
                      : 'Set ARKESEL_SMS_SENDER_ID (defaults to PROFS)'
                }
              />
              <StatusRow
                label="Arkesel WhatsApp API Key"
                ok={!!status.whatsappConfigured}
                detail={
                  status.whatsappConfigured
                    ? `Source: ${status.whatsappKeySource} (${status.whatsappKeyLength} characters)`
                    : 'Set ARKESEL_WHATSAPP_API_KEY or ARKESEL_API_KEY'
                }
              />
              <StatusRow
                label="WhatsApp Sender"
                ok={!!status.whatsappSenderConfigured}
                detail={status.whatsappSenderConfigured ? 'ARKESEL_WHATSAPP_SENDER is set' : 'Set ARKESEL_WHATSAPP_SENDER for WhatsApp delivery'}
              />
              <StatusRow
                label="Generic Arkesel API Key (fallback)"
                ok={!!status.genericApiKeyConfigured}
                detail="Optional ARKESEL_API_KEY used when channel-specific keys are unset"
              />
              <StatusRow
                label="Internal jobs secret"
                ok={!!status.jobsSecretConfigured}
                detail="INTERNAL_JOBS_SECRET for queue/cron runners"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading provider status...</p>
          )}
          {status?.smsBalance != null && (
            <p className="text-sm text-muted-foreground">SMS balance: {status.smsBalance}</p>
          )}

          <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
            <AlertTitle>Arkesel credentials are configured via environment variables</AlertTitle>
            <AlertDescription className="space-y-2 text-green-800 dark:text-green-200">
              <p>
                For security, API keys are stored in{' '}
                <code className="rounded bg-green-100 px-1 dark:bg-green-900">ARKESEL_SMS_API_KEY</code> and related env vars in your
                deployment environment, not in Firestore.
              </p>
              <p>
                Update keys in your hosting provider&apos;s dashboard and redeploy. SMS sends try the v2 API first, then fall back to legacy{' '}
                <code className="rounded bg-green-100 px-1 dark:bg-green-900">send-sms</code>.
              </p>
            </AlertDescription>
          </Alert>

          <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
            <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-500" />
            <AlertTitle>Environment variables</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">ARKESEL_SMS_API_KEY</code> — SMS API key (required for SMS)
                </li>
                <li>
                  <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">ARKESEL_SMS_SENDER_ID</code> — Registered sender ID, max 10 characters (e.g. PROFS)
                </li>
                <li>
                  <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">ARKESEL_WHATSAPP_API_KEY</code> — WhatsApp API key (optional)
                </li>
                <li>
                  <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">ARKESEL_WHATSAPP_SENDER</code> — WhatsApp sender number (optional)
                </li>
                <li>
                  <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">ARKESEL_API_KEY</code> — Shared fallback for SMS or WhatsApp
                </li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Messaging</CardTitle>
          <CardDescription>Send a live test after env vars are set and the app has been redeployed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="+2332XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Generic tests send a short fixed message for connectivity. Template tests below use real template bodies from this page.
          </p>
          {!status?.smsConfigured && (
            <p className="text-xs text-destructive">Configure ARKESEL_SMS_API_KEY before sending SMS tests.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void test('sms')}
              disabled={!status?.smsConfigured || status?.smsSenderValid === false || testingChannel !== null}
            >
              {testingChannel === 'sms' ? 'Sending SMS...' : 'Send SMS Test'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void test('whatsapp')}
              disabled={!status?.whatsappConfigured || testingChannel !== null}
            >
              {testingChannel === 'whatsapp' ? 'Sending WhatsApp...' : 'Send WhatsApp Test'}
            </Button>
            <Button variant="outline" onClick={() => void processQueue()} disabled={processingQueue}>
              {processingQueue ? 'Processing queue...' : 'Process Pending Queue'}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin/settings/communications/logs">View delivery logs</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SMS / WhatsApp Template Preview</CardTitle>
          <CardDescription>Edit templates, preview placeholders, and send live template tests to your test number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">Wired in app</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {COMMUNICATION_EVENT_KEYS.map((key) => (
                <li key={key}>
                  <span className="font-medium text-foreground">{formatEventLabel(key)}</span>
                  <span> — {EVENT_INTEGRATION_HINTS[key]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Event</Label>
              <select
                value={templateEvent}
                onChange={(e) => setTemplateEvent(e.target.value as CommunicationEventKey)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {COMMUNICATION_EVENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {formatEventLabel(key)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <select
                value={templateChannel}
                onChange={(e) => setTemplateChannel(e.target.value as CommunicationChannel)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="inapp">In-app</option>
              </select>
            </div>
            <div className="flex items-end justify-between rounded-md border p-3">
              <Label htmlFor="template-enabled">Template enabled</Label>
              <Switch id="template-enabled" checked={templateEnabled} onCheckedChange={setTemplateEnabled} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Template body</Label>
              <Textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                rows={7}
                placeholder="Hi {{user_name}}, your OTP is {{otp_code}}."
                disabled={!templatesLoaded}
              />
              <div className="text-xs text-muted-foreground">
                Placeholders for this event:{' '}
                {PLACEHOLDERS_BY_EVENT[templateEvent].map((key) => (
                  <code key={key} className="mr-1">
                    {`{{${key}}}`}
                  </code>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="min-h-[180px] rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">{preview || 'Nothing to preview yet.'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(previewVars).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{key}</Label>
                <Input value={value} onChange={(e) => setPreviewVars((prev) => ({ ...prev, [key]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveTemplate()} disabled={templateSaving}>
              {templateSaving ? 'Saving template...' : 'Save Template'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void sendTemplateSmsTest()}
              disabled={
                sendingTemplateSms ||
                !phone.trim() ||
                !status?.smsConfigured ||
                status?.smsSenderValid === false ||
                templateChannel !== 'sms'
              }
            >
              {sendingTemplateSms ? 'Sending...' : 'Send test SMS (this template)'}
            </Button>
            <Button variant="outline" onClick={() => void loadAllSmsPreviews()} disabled={previewingAll}>
              {previewingAll ? 'Loading previews...' : 'Preview all SMS templates'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void sendAllLive()}
              disabled={
                sendingAllLive ||
                !bulkPreviewRows ||
                !phone.trim() ||
                !status?.smsConfigured ||
                status?.smsSenderValid === false
              }
            >
              {sendingAllLive ? 'Sending all...' : 'Send all live'}
            </Button>
          </div>

          {bulkPreviewRows && (
            <div className="space-y-2">
              <Label>All SMS template previews</Label>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Enabled</th>
                      <th className="px-3 py-2 font-medium">Message</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreviewRows.map((row) => {
                      const sendResult = bulkSendResults?.find((r) => r.eventKey === row.eventKey);
                      let statusLabel = '—';
                      if (sendResult) {
                        if (sendResult.skipped) statusLabel = 'Skipped';
                        else if (sendResult.ok) statusLabel = 'Sent';
                        else statusLabel = sendResult.error || 'Failed';
                      }
                      return (
                        <tr key={row.eventKey} className="border-t">
                          <td className="px-3 py-2 align-top">{formatEventLabel(row.eventKey)}</td>
                          <td className="px-3 py-2 align-top">{row.enabled ? 'Yes' : 'No'}</td>
                          <td className="max-w-md px-3 py-2 align-top text-muted-foreground">
                            {row.message.length > 120 ? `${row.message.slice(0, 120)}…` : row.message}
                          </td>
                          <td className="px-3 py-2 align-top text-xs">{statusLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
