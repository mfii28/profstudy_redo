'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { getLegalDocuments, saveLegalDocuments, type LegalDocuments } from "@/lib/legal-data";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useUser } from "@/firebase";
import { logAdminAction } from "@/lib/audit-data";

export default function AdminCompliancePage() {
  const { user: adminUser } = useUser();
  const [docs, setDocs] = useState<LegalDocuments | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDocs = async () => {
        setIsLoading(true);
        const data = await getLegalDocuments();
        setDocs(data);
        setIsLoading(false);
    }
    fetchDocs();
  }, []);

  const handleContentChange = (docKey: keyof LegalDocuments, content: string) => {
    if (docs) {
        setDocs({
            ...docs,
            [docKey]: content,
        });
    }
  }

  const handleSave = async () => {
    if (docs && adminUser) {
        await saveLegalDocuments(docs);
        
        await logAdminAction({
            actorId: adminUser.uid,
            actorName: adminUser.displayName || adminUser.email || 'Administrator',
            action: 'LEGAL_DOCS_UPDATE',
            targetId: 'site-legal-docs',
            targetType: 'setting',
            severity: 'warn',
            details: `Updated platform legal documents (Terms, Privacy, or Refund policies).`
        });

        toast({
            title: "Documents Saved",
            description: "Your legal documents have been updated successfully."
        });
    }
  }

  if (isLoading || !docs) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 font-headline">Compliance & Legal</h1>
        <p className="text-muted-foreground">
          Manage legal documents and track DMCA copyright claims.
        </p>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Legal Document Management</CardTitle>
            <CardDescription>Edit and manage the content of your site's legal pages. Basic HTML is supported.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="terms">{docs.terms.title}</Label>
                <Textarea id="terms" value={docs.terms.content} onChange={(e) => handleContentChange('terms', e.target.value)} rows={10} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="privacy">{docs.privacy.title}</Label>
                <Textarea id="privacy" value={docs.privacy.content} onChange={(e) => handleContentChange('privacy', e.target.value)} rows={10} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="refund">{docs.refund.title}</Label>
                <Textarea id="refund" value={docs.refund.content} onChange={(e) => handleContentChange('refund', e.target.value)} rows={10} />
            </div>
        </CardContent>
        <CardFooter>
            <Button onClick={handleSave}>Save Legal Documents</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>DMCA Takedown Requests</CardTitle>
            <CardDescription>Review and process copyright infringement claims.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-center text-muted-foreground py-8">No active DMCA requests.</p>
        </CardContent>
      </Card>
    </div>
  );
}
