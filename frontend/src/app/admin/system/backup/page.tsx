import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatabaseBackup, ExternalLink, ShieldCheck, Terminal, Clock } from "lucide-react";
import Link from "next/link";

export default function AdminBackupPage() {
  const steps = [
    { step: '1', title: 'Open Firebase Console', desc: 'Go to console.firebase.google.com → your project → Firestore Database.' },
    { step: '2', title: 'Export Data', desc: 'Click ⋮ → Export → choose a Google Cloud Storage bucket (e.g. gs://your-project-backups).' },
    { step: '3', title: 'Schedule Exports', desc: 'Use Cloud Scheduler or a cron job to call the Firestore export REST API daily.' },
    { step: '4', title: 'Restore', desc: 'From GCS, use gcloud firestore import gs://your-bucket/export-folder to restore.' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10"><DatabaseBackup className="h-8 w-8 text-primary" /></div>
        <div>
          <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">Recovery &amp; Persistence</h1>
          <p className="text-muted-foreground text-sm">Database backup and restore runbook for Firestore.</p>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>No automated UI backup — use Firebase Console</AlertTitle>
        <AlertDescription>
          Firestore managed exports require Google Cloud Storage. Automated backups via
          Cloud Scheduler are the recommended production approach.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map(({ step, title, desc }) => (
          <Card key={step}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">{step}</div>
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
              <CardDescription className="pl-11 text-sm">{desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Terminal className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">gcloud CLI Quick Reference</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Export</p>
            <code className="block text-xs bg-muted rounded p-3 font-mono">gcloud firestore export gs://YOUR_BUCKET/$(date +%Y-%m-%d)</code>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Import / Restore</p>
            <code className="block text-xs bg-muted rounded p-3 font-mono">gcloud firestore import gs://YOUR_BUCKET/2025-01-01</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Recommended Backup Schedule</CardTitle></div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-5">
            <li><strong>Daily</strong> — full export retained for 7 days</li>
            <li><strong>Weekly</strong> — full export retained for 4 weeks</li>
            <li><strong>Monthly</strong> — full export retained for 12 months</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap">
        <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4">
          <ExternalLink className="h-4 w-4" /> Firebase Console
        </a>
        <a href="https://cloud.google.com/firestore/docs/manage-data/export-import" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4">
          <ExternalLink className="h-4 w-4" /> Firestore Export Docs
        </a>
      </div>
    </div>
  );
}
