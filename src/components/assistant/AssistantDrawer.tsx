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
  Mic,
  MicOff,
  Languages,
} from 'lucide-react';
import { AssistantAvatar } from './AssistantAvatar';
import { ConfirmationCard } from './ConfirmationCard';
import {
  useSpeechRecognition,
  SUPPORTED_VOICE_LANGUAGES,
  VoiceLanguage,
} from '@/hooks/useSpeechRecognition';
import { formatINR } from '@/lib/calculations';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  card?: {
    type: 'SUMMARY' | 'PARTNERS' | 'EXPENSES' | 'KNOWLEDGE' | 'WARNING' | 'CONFIRMATION';
    title: string;
    data?: any;
    draft?: any;
    linkUrl?: string;
    linkLabel?: string;
  };
  options?: Array<{ id: string; name: string; subtext?: string }>;
  field?: string;
  source?: string;
}

const QUICK_CHIPS = [
  { label: '📋 Aaj Ki Attendance', query: 'aaj ki attendance kya hai' },
  { label: '📊 Aaj Ka Kharch', query: 'Aaj ka kharch kitna hua?' },
  { label: '👥 Partner Cash', query: 'Sabhi partners ka cash balance dikhao' },
  { label: '👷 Worker Hisaab', query: 'Worker ka hisab batao' },
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
      content: 'Namaste! Main Modern Way Civil Solutions ka AI Assistant hoon. Aap bolkar (mic) ya type karke daily hisaab, partner cash, worker khata, ya direct entry draft kar sakte hain (Hindi, Hinglish, Gujarati ya English).',
      source: 'SYSTEM',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'GEMINI' | 'SIMPLE'>('SIMPLE');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isSupported: isSpeechSupported,
    isListening,
    language: speechLang,
    setLanguage: setSpeechLang,
    interimTranscript,
    errorMessage: speechError,
    toggleListening,
    clearError: clearSpeechError,
  } = useSpeechRecognition({
    onFinalTranscript: (finalText) => {
      // Put directly into editable input box (do NOT send immediately, allow review/edit)
      setInput((prev) => (prev ? `${prev} ${finalText}`.trim() : finalText));
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    },
  });

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
          options: data.options,
          field: data.field,
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

                {/* Disambiguation Choices if provided */}
                {msg.options && msg.options.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 mt-2 space-y-1.5">
                    <span className="text-[11px] font-semibold text-amber-300">Option chunein:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSend(`${opt.name} ke liye`)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-300 border border-amber-500/30 font-medium transition-colors"
                        >
                          {opt.name} {opt.subtext && <span className="opacity-70 text-[10px]">({opt.subtext})</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embedded Card if provided */}
                {msg.card && (
                  <div className="pt-2 border-t border-slate-800/80 mt-2">
                    {msg.card.type === 'CONFIRMATION' && msg.card.draft ? (
                      <ConfirmationCard draft={msg.card.draft} />
                    ) : (
                      <div className="space-y-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 shadow-sm">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                          <span>{msg.card.title}</span>
                        </div>

                        {/* PARTNERS LIVE BALANCES IN CHAT */}
                        {msg.card.type === 'PARTNERS' && msg.card.data?.partners && (
                          <div className="space-y-1.5 pt-1">
                            {msg.card.data.partners.map((p: any) => (
                              <div
                                key={p.id || p.name}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0 border border-indigo-500/20">
                                    {p.name?.charAt(0) || 'P'}
                                  </div>
                                  <span className="font-semibold text-slate-200 truncate">{p.name}</span>
                                </div>
                                <span className="font-mono font-bold text-emerald-400 text-xs shrink-0">
                                  {p.formattedBalance || formatINR(p.balance || p.cashInHand || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* EXPENSES BREAKDOWN IN CHAT */}
                        {msg.card.type === 'EXPENSES' && msg.card.data && (
                          <div className="space-y-2 pt-1">
                            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                              <span className="text-[11px] text-slate-400">Total Spent</span>
                              <span className="font-mono font-black text-amber-400 text-sm">
                                {msg.card.data.formattedTotal || formatINR(msg.card.data.total || 0)}
                              </span>
                            </div>
                            {msg.card.data.expenses && msg.card.data.expenses.length > 0 && (
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1 no-scrollbar text-[11px]">
                                {msg.card.data.expenses.slice(0, 5).map((exp: any, i: number) => (
                                  <div key={exp.id || i} className="flex items-center justify-between py-1 border-b border-slate-800/50">
                                    <span className="text-slate-300 truncate max-w-[150px]">{exp.category || exp.reason || 'Expense'}</span>
                                    <span className="font-mono text-slate-200 font-semibold">{formatINR(exp.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Optional subtle page shortcut link */}
                        {msg.card.linkUrl && (
                          <div className="pt-1 flex justify-end">
                            <Link
                              href={msg.card.linkUrl}
                              onClick={onClose}
                              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-amber-300 bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/50 transition-colors"
                            >
                              <span>{msg.card.linkLabel || 'Open Page'}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        )}
                      </div>
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

        {/* Footer Input Box & Voice Controls */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md">
          {/* Language Selector Bar & Speech Status */}
          <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
            <div className="flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Bhasha:
              </span>
              <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 shadow-inner">
                {SUPPORTED_VOICE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSpeechLang(lang.code)}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                      speechLang === lang.code
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Helper text */}
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Mic dabayein aur bolein
            </span>
          </div>

          {/* Active Listening Visual Banner */}
          {isListening && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs truncate mr-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="font-semibold text-red-300 shrink-0">
                  Sun raha hoon ({SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === speechLang)?.shortLabel})...
                </span>
                {interimTranscript && (
                  <span className="text-slate-300 italic truncate text-[11px]">
                    &ldquo;{interimTranscript}&rdquo;
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[11px] font-bold text-red-400 hover:text-red-300 underline shrink-0 cursor-pointer"
              >
                Rokein
              </button>
            </div>
          )}

          {/* Speech Error Banner (Permission Denied, No Speech, etc.) */}
          {speechError && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] leading-tight">{speechError}</span>
              </div>
              <button
                type="button"
                onClick={clearSpeechError}
                className="text-slate-400 hover:text-slate-200 ml-2 p-0.5"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Form with Mic Button, Text Input, and Send */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            {/* Mic Button (Voice Input) */}
            <button
              type="button"
              onClick={() => {
                if (!isSpeechSupported) return;
                if (!isListening) {
                  // Prevent mobile virtual keyboard from opening on tap
                  inputRef.current?.blur();
                }
                toggleListening();
              }}
              disabled={!isSpeechSupported}
              title={
                isSpeechSupported
                  ? isListening
                    ? 'Sunna band karein'
                    : 'Bolkar likhein (Voice Input)'
                  : 'Aapke browser me voice input support nahi hai'
              }
              className={`min-h-[44px] min-w-[44px] sm:min-h-[42px] sm:min-w-[42px] px-2.5 rounded-xl flex items-center justify-center transition-all ${
                !isSpeechSupported
                  ? 'opacity-40 cursor-not-allowed bg-slate-900 border border-slate-800 text-slate-500'
                  : isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500 shadow-lg shadow-red-500/20 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700/80 hover:text-amber-400'
              }`}
            >
              {isListening ? (
                <Mic className="w-4 h-4 text-red-400 animate-bounce" />
              ) : isSpeechSupported ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Editable Text Input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? '🎙️ Boliye, sun raha hoon...'
                  : 'Poochhein ya bolein (e.g. Ramesh ko 500 diye)...'
              }
              disabled={isLoading}
              className="flex-1 min-h-[44px] sm:min-h-[42px] px-3.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="min-h-[44px] min-w-[44px] sm:min-h-[42px] sm:min-w-[42px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>

          {/* Micro Footer status */}
          <div className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Voice &amp; Text • Draft + Confirm • Safe Entries</span>
          </div>
        </div>
      </div>
    </>
  );
}
