'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/firebase';
import { getPresignedUploadUrl } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

const TinyEditor = dynamic(
  () => import('@tinymce/tinymce-react').then((m) => m.Editor),
  { ssr: false }
);

type RichEditorProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
};

function getUploadContext(): 'rich_content' {
  return 'rich_content';
}

export function TinyMceRichEditor({ label, value, onChange, placeholder }: RichEditorProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isPreview, setIsPreview] = useState(false);
  const [failedToLoad, setFailedToLoad] = useState(false);

  const initConfig = useMemo<any>(
    () => ({
      menubar: true,
      branding: false,
      height: 420,
      plugins:
        'advlist autolink lists link image media charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime table wordcount',
      toolbar:
        'undo redo | blocks fontsize | bold italic underline forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table | code preview fullscreen',
      content_style: 'body { font-family:Inter,Arial,sans-serif; font-size:14px }',
      placeholder: placeholder || 'Write content...',
      automatic_uploads: true,
      file_picker_types: 'image media file',
      file_picker_callback: async (callback: (url: string, meta?: Record<string, string>) => void, _value: string, meta: { filetype: string }) => {
        if (!user) {
          toast({ variant: 'destructive', title: 'Sign in required' });
          return;
        }
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', meta.filetype === 'image' ? 'image/*' : meta.filetype === 'media' ? 'video/*,audio/*' : '*/*');
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            const idToken = await user.getIdToken();
            const upload = await getPresignedUploadUrl(
              user.uid,
              getUploadContext(),
              file.name,
              file.type || 'application/octet-stream',
              undefined,
              idToken
            );
            if (upload.error || !upload.url || !upload.key) {
              throw new Error(upload.error || 'Unable to authorize upload.');
            }

            await uploadToR2(upload.url, file, file.type || 'application/octet-stream', {
              key: upload.key,
              idToken,
            });

            const stableUrl = `/api/media/stream?key=${encodeURIComponent(upload.key)}`;
            callback(stableUrl, { title: file.name });
          } catch (error: any) {
            toast({
              variant: 'destructive',
              title: 'Upload failed',
              description: error?.message || 'Could not upload this file.',
            });
          }
        };
        input.click();
      },
    }),
    [placeholder, toast, user]
  );

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsPreview((p) => !p)}>
          {isPreview ? 'Edit' : 'Preview'}
        </Button>
      </div>
      {isPreview ? (
        <div className="min-h-44 rounded-lg border p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: value || '' }} />
      ) : failedToLoad ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-600">Rich editor unavailable right now. Using plain editor mode.</p>
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={12} />
        </div>
      ) : (
        <TinyEditor
          tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@7/tinymce.min.js"
          value={value}
          init={initConfig}
          onEditorChange={onChange}
          onInit={() => setFailedToLoad(false)}
          onScriptsLoadError={() => setFailedToLoad(true)}
        />
      )}
    </div>
  );
}

