import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiError } from '../../services/api';
import { ChatMessage } from '../../types';
import { Markdown } from '../common/Markdown';
import { AlertCircle, Bot, CheckCircle2, Loader2, Send, User, Wrench, X } from 'lucide-react';

/**
 * Tool call metadata arrives as a JSON *string* from Prisma (the column is TEXT).
 * Calling .map() on it crashed the component — and with no error boundary above,
 * blanked the entire app — every time the agent executed a tool.
 */
function parseToolCalls(toolCalls: unknown): Array<{ toolName?: string }> {
  if (!toolCalls) return [];
  if (Array.isArray(toolCalls)) return toolCalls;
  if (typeof toolCalls === 'string') {
    try {
      const parsed = JSON.parse(toolCalls);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  sender: 'ASSISTANT',
  content: `Ask me to search for scholarships, check your eligibility against one, add to your application tracker, or review upcoming deadlines.`,
  createdAt: new Date().toISOString(),
};

// Emoji removed: they were decoration, they render inconsistently across platforms, and
// screen readers announce them by their Unicode name mid-sentence.
const SUGGESTIONS = [
  { label: 'Fully funded for me', prompt: 'Find fully funded scholarships for me' },
  { label: 'Matches for my profile', prompt: 'Which scholarships match my profile?' },
  { label: 'Check my eligibility', prompt: 'Check my eligibility' },
  { label: 'Upcoming deadlines', prompt: 'Show my upcoming deadlines' },
  { label: 'Compare saved', prompt: 'Compare my saved scholarships' },
];

const MAX_MESSAGE_LENGTH = 4000;

export const FloatingChatbot: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [conversationId, setConversationId] = useState<string>('new');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Move focus into the panel when it opens so keyboard users are not stranded.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Escape closes the panel — expected behaviour for any dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleSend = useCallback(
    async (customText?: string) => {
      const textToSend = (customText ?? input).trim();
      if (!textToSend || loading) return;

      if (textToSend.length > MAX_MESSAGE_LENGTH) {
        setError(`Message is too long (${textToSend.length}/${MAX_MESSAGE_LENGTH} characters).`);
        return;
      }

      setError(null);
      const tempUserMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        sender: 'USER',
        content: textToSend,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg]);
      if (!customText) setInput('');
      setLoading(true);

      try {
        const res = await api.sendMessage(conversationId, textToSend);
        if (res?.conversationId) setConversationId(res.conversationId);
        if (res?.message) setMessages((prev) => [...prev, res.message]);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.isRateLimited
              ? 'You are sending messages too quickly. Please wait a few seconds and try again.'
              : err.message
            : 'Could not reach the assistant. Please try again.';
        setError(message);
        // Roll the optimistic message back so the user can edit and resend it.
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setInput(textToSend);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, input, loading]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="ScholarAI assistant chat"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 sm:w-[420px] h-[min(580px,calc(100vh-2rem))] glass-panel border border-brand-500/40 rounded-3xl flex flex-col z-50 overflow-hidden animate-slide-up"
    >
      {/* Header */}
      <div className="p-4 bg-dark-card border-b border-dark-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-md shrink-0">
            <Bot className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-white flex items-center gap-2 truncate">
              ScholarAI assistant
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
            </h2>
            <p className="text-2xs text-cyan-400">Agent &amp; tool calling active</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-hover focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none transition shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Suggested actions */}
      <div className="p-2.5 bg-dark-bg/80 border-b border-dark-border/40 flex items-center gap-1.5 overflow-x-auto text-2xs shrink-0">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.prompt}
            type="button"
            onClick={() => handleSend(s.prompt)}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-brand-900/50 border border-brand-500/30 text-brand-200 hover:bg-brand-600 hover:text-white disabled:opacity-50 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none transition"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs" role="log" aria-live="polite" aria-atomic="false">
        {messages.map((m) => {
          const isUser = m.sender === 'USER';
          const toolCalls = parseToolCalls(m.toolCalls);

          return (
            <div key={m.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isUser ? 'bg-brand-600 text-white' : 'bg-brand-900 text-cyan-400 border border-brand-500/30'
                }`}
                aria-hidden="true"
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className="max-w-[82%] space-y-1.5 min-w-0">
                {!isUser && toolCalls.length > 0 && (
                  <div className="p-2 rounded-xl bg-dark-bg/90 border border-brand-500/20 text-2xs text-brand-300 space-y-1 font-mono">
                    {toolCalls.map((tc, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Wrench className="w-3 h-3 text-cyan-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          Tool: <strong className="text-white">{tc.toolName || 'unknown'}</strong>
                        </span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto shrink-0" aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl break-words ${
                    isUser
                      ? 'bg-brand-600 text-white rounded-tr-none shadow-md whitespace-pre-wrap'
                      : 'bg-dark-card border border-dark-border text-slate-200 rounded-tl-none'
                  }`}
                >
                  {/* Assistant replies are Markdown; user text is shown verbatim. */}
                  {isUser ? m.content : <Markdown content={m.content} />}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-900 border border-brand-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            </div>
            <div className="p-3 rounded-2xl bg-dark-card border border-dark-border text-slate-400 text-xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" aria-hidden="true" />
              <span>Orchestrating AI tools &amp; querying the scholarship database…</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {error && (
        <div
          role="alert"
          className="mx-3 mb-2 flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-2xs shrink-0"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="font-bold px-1">
            ×
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className="p-3 border-t border-dark-border bg-dark-card/90 flex items-center gap-2 shrink-0"
      >
        <label htmlFor="chatbot-input" className="sr-only">
          Message the assistant
        </label>
        <input
          id="chatbot-input"
          ref={inputRef}
          type="text"
          value={input}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI Copilot anything…"
          autoComplete="off"
          className="flex-1 min-w-0 bg-dark-bg border border-dark-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400/50 transition"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition shadow-md focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none shrink-0"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};
