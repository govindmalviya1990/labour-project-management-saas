'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { AssistantAvatar } from './AssistantAvatar';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  card?: {
    type: 'SUMMARY' | 'PARTNERS' | 'EXPENSES' | 'KNOWLEDGE' | 'WARNING';
    title: string;
    data?: any;
    linkUrl?: string;
    linkLabel?: string;
  };
  source?: string;
}

const QUICK_CHIPS = [
  { label: '📊 Aaj Ka Kharch', query: 'Aaj ka kharch kitna hua?' },
  { label: '👥 Partner Cash', query: 'Sabhi partners ka cash balance dikhao' },
  { label: '💳 Pending Payments', query: 'Pending payment report dikhao' },
  { label: '🔒 Din Ka Hisaab', query: 'Din ka hisaab verify kaise karein?' },
  { label: '📦 Dr Fixit Stock', query: 'Dr Fixit ka stock kitna bacha hai?' },
];

export function AssistantDrawer({
  isOpen,
  onClose,
  userRole = 'PARTNER',
}: {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Namaste! Main Modern Way Civil Solutions ka AI Assistant hoon. Aap mujhse daily hisaab, partner cash, worker khata, stock ya application features ke baare me poochh sakte hain (Hindi, Hinglish, Gujarati ya English).',
      source: 'SYSTEM',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'GEMINI' | 'SIMPLE'>('SIMPLE');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check assistant status on mount
    fetch('/api/assistant')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.mode) {
          setAssistantMode(data.mode);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isOpen, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.error || 'Abhi jawab nahi de pa raha, dobara try karein.',
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer || '',
          card: data.card,
          source: data.source,
        },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Network connection me problem aayi. Kripya dobara try karein.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer from Right (Mobile: full-width right sheet, Desktop: right panel) */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <AssistantAvatar size={42} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">Modern Way AI</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {assistantMode === 'GEMINI' ? 'Gemini 1.5' : 'Simple Mode'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Support &amp; Calculations Assistant • 24/7
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Chips Bar */}
        <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleSend(chip.query)}
              disabled={isLoading}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 border border-slate-700/60 whitespace-nowrap transition-colors shrink-0 active:scale-95 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <AssistantAvatar size={28} className="mt-0.5" />
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-2 ${
                  msg.role === 'user'
                    ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-xs'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-xs shadow-lg'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Embedded Card if provided */}
                {msg.card && (
                  <div className="pt-2 border-t border-slate-800/80 mt-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 mb-1">
                      <span>{msg.card.title}</span>
                    </div>

                    {msg.card.linkUrl && (
                      <Link
                        href={msg.card.linkUrl}
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/30 transition-colors mt-1"
                      >
                        <span>{msg.card.linkLabel || 'Open in App'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 justify-start items-center text-xs text-slate-400">
              <AssistantAvatar size={28} isTyping={true} />
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Assistant soch raha hai...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input Box */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/90">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Kuch bhi poochhein (e.g. Aaj ka kharch)..."
              disabled={isLoading}
              className="flex-1 min-h-[42px] px-3.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="min-h-[42px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <div className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Role-Scoped • Single Source of Truth • Free-Tier Safe</span>
          </div>
        </div>
      </div>
    </>
  );
}
