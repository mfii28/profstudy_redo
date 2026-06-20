'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Code,
  CodeSquare,
  List,
  ListOrdered,
  Heading2,
  RotateCcw,
} from 'lucide-react';
import './rich-text-editor.css';

interface RichTextEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type a message...',
  disabled = false,
  onSubmit,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editable: !disabled,
  });

  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleCode = () => editor?.chain().focus().toggleCode().run();
  const toggleCodeBlock = () => editor?.chain().focus().toggleCodeBlock().run();
  const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor?.chain().focus().toggleOrderedList().run();
  const toggleHeading = () => editor?.chain().focus().toggleHeading({ level: 2 }).run();
  const clearFormatting = () => editor?.chain().focus().clearNodes().run();

  if (!editor) return null;

  const isBoldActive = editor.isActive('bold');
  const isItalicActive = editor.isActive('italic');
  const isCodeActive = editor.isActive('code');
  const isCodeBlockActive = editor.isActive('codeBlock');
  const isBulletListActive = editor.isActive('bulletList');
  const isOrderedListActive = editor.isActive('orderedList');
  const isHeadingActive = editor.isActive('heading');

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <Button
          size="sm"
          variant={isBoldActive ? 'default' : 'ghost'}
          onClick={toggleBold}
          disabled={disabled}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={isItalicActive ? 'default' : 'ghost'}
          onClick={toggleItalic}
          disabled={disabled}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={isCodeActive ? 'default' : 'ghost'}
          onClick={toggleCode}
          disabled={disabled}
          title="Inline code"
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={isCodeBlockActive ? 'default' : 'ghost'}
          onClick={toggleCodeBlock}
          disabled={disabled}
          title="Code block"
        >
          <CodeSquare className="h-4 w-4" />
        </Button>
        <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" />
        <Button
          size="sm"
          variant={isHeadingActive ? 'default' : 'ghost'}
          onClick={toggleHeading}
          disabled={disabled}
          title="Heading"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={isBulletListActive ? 'default' : 'ghost'}
          onClick={toggleBulletList}
          disabled={disabled}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={isOrderedListActive ? 'default' : 'ghost'}
          onClick={toggleOrderedList}
          disabled={disabled}
          title="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={clearFormatting}
          disabled={disabled}
          title="Clear formatting"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div className="p-3">
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert prose-sm max-w-none focus:outline-none
            prose-p:my-0 prose-p:leading-relaxed
            prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-200 prose-code:dark:bg-slate-700 prose-code:px-1 prose-code:rounded
            prose-pre:bg-slate-900 prose-pre:text-slate-100
            prose-a:text-blue-600 dark:prose-a:text-blue-400
          "
        />
      </div>
    </div>
  );
}
