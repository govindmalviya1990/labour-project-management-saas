'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type VoiceLanguage = 'hi-IN' | 'gu-IN' | 'en-IN';

export interface LanguageOption {
  code: VoiceLanguage;
  label: string;
  shortLabel: string;
}

export const SUPPORTED_VOICE_LANGUAGES: LanguageOption[] = [
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', shortLabel: 'हिन्दी' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', shortLabel: 'ગુજરાતી' },
  { code: 'en-IN', label: 'English (India)', shortLabel: 'EN' },
];

export interface UseSpeechRecognitionOptions {
  onFinalTranscript?: (transcript: string) => void;
  onInterimTranscript?: (transcript: string) => void;
}

export function useSpeechRecognition(options?: UseSpeechRecognitionOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguageState] = useState<VoiceLanguage>('hi-IN');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Check browser support and load saved language preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognition));

      try {
        const savedLang = localStorage.getItem('mw_assistant_voice_lang') as VoiceLanguage;
        if (savedLang && (savedLang === 'hi-IN' || savedLang === 'gu-IN' || savedLang === 'en-IN')) {
          setLanguageState(savedLang);
        }
      } catch {
        // LocalStorage access failsafe
      }
    }
  }, []);

  const setLanguage = useCallback((lang: VoiceLanguage) => {
    setLanguageState(lang);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('mw_assistant_voice_lang', lang);
      }
    } catch {
      // LocalStorage access failsafe
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error if already stopped
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Aapke browser me voice input support nahi hai. Kripya type karein.');
      return;
    }

    // Stop existing instance if running
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort error
      }
    }

    setErrorMessage(null);
    setInterimTranscript('');

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = false; // Auto-stop on silence for crisp mobile/desktop experience
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += chunk;
          } else {
            interim += chunk;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
          optionsRef.current?.onInterimTranscript?.(interim);
        }

        if (final) {
          setInterimTranscript('');
          optionsRef.current?.onFinalTranscript?.(final.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMessage('Mic permission chahiye. Kripya browser settings se mic allow karein.');
        } else if (event.error === 'no-speech') {
          setErrorMessage('Koi aawaz sunai nahi di. Kripya dobara mic dabakar bolein.');
        } else if (event.error === 'network') {
          setErrorMessage('Voice recognition ke liye internet connection zaroori hai.');
        } else if (event.error !== 'aborted') {
          setErrorMessage('Voice input me problem aayi. Kripya dobara try karein.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setErrorMessage('Microphone shuru nahi ho saka. Kripya check karein.');
      setIsListening(false);
    }
  }, [language]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    language,
    setLanguage,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
    clearError,
  };
}
