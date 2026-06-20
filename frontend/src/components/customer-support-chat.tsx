'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Loader2, Send, User, AlertCircle } from 'lucide-react';
import { customerSupportChat } from '@/ai/flows/customer-support-chat';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * @fileOverview Hardened Customer Support Chat.
 * PROTECTION: Implements client-side rate limiting to manage costs and prevent bot abuse.
 */

export function CustomerSupportChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
        const scrollableView = scrollAreaRef.current.querySelector('div');
        if (scrollableView) {
            scrollableView.scrollTop = scrollableView.scrollHeight;
        }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Rate Limiting: Minimum 2 seconds between messages
    const now = Date.now();
    if (now - lastSentTime < 2000) {
        return;
    }
    setLastSentTime(now);

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await customerSupportChat({ question: input });
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[70vh] flex-col md:h-[60vh]">
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback>
                <Bot size={20} />
              </AvatarFallback>
            </Avatar>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p>
                Hello! I'm the Profs Training Solutions AI assistant. How can I help you today?
              </p>
            </div>
          </div>
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3',
                message.role === 'user' && 'justify-end'
              )}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback>
                    <Bot size={20} />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-xs rounded-lg p-3 text-sm md:max-w-md shadow-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' && (
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback>
                    <User size={20} />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 border">
                <AvatarFallback>
                  <Bot size={20} />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center space-x-2 rounded-lg bg-muted p-3 text-sm shadow-inner">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t bg-background p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Ask about courses, pricing, or features..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 rounded-full px-4 h-11"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="rounded-full h-11 w-11 shadow-md"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
        <div className="mt-2 text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
            <AlertCircle size={10} />
            AI may provide inaccurate info. Verify important exam details with official sources.
        </div>
      </div>
    </div>
  );
}
