import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, ChevronRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AIConfig {
  enabled: boolean;
  site_id: string;
  api_base: string;
  secret_key?: string;
  button_text?: string;
  assistant_name?: string;
}

interface Question {
  id: string;
  questionText: string;
  helperText?: string;
  options: string[];
  inputType: 'single_select' | 'multi_select';
  branchKey?: string;
  showWhen?: Record<string, string | string[]>;
}

interface Recommendation {
  name: string;
  description?: string;
  explanation?: string;
  matchScore: number;
  productUrl?: string;
  imageUrl?: string;
  price?: number;
}

type MessageType =
  | { role: 'assistant'; type: 'greeting'; text: string }
  | { role: 'assistant'; type: 'question'; question: Question; stepIndex: number; totalSteps: number }
  | { role: 'user'; type: 'answer'; text: string }
  | { role: 'assistant'; type: 'thinking'; text: string }
  | { role: 'assistant'; type: 'recommendations'; recs: Recommendation[] }
  | { role: 'assistant'; type: 'error'; text: string };

function getVisitorId() {
  let id = localStorage.getItem('ai_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ai_visitor_id', id);
  }
  return id;
}

function detectSurface() {
  const path = location.pathname;
  if (path.match(/\/products?\/[^/]+/i)) {
    return { surface: 'product_page', slug: path.split('/').pop() || null };
  }
  return { surface: 'home', slug: null };
}

function fireWidgetEvent(
  apiBase: string,
  siteId: string,
  eventType: string,
  sessionId: string | null,
  payload: Record<string, any> = {}
) {
  if (!apiBase || !siteId) return;
  fetch(`${apiBase}/widget-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-site-id': siteId },
    body: JSON.stringify({ eventType, sessionId, payload }),
  }).catch(() => {});
}

/** Filters questions based on branching logic */
function getVisibleQuestions(allQuestions: Question[], branches: Record<string, string[]>): Question[] {
  return allQuestions.filter((q) => {
    if (!q.showWhen) return true;
    return Object.keys(q.showWhen).every((key) => {
      const expected = Array.isArray(q.showWhen![key]) ? q.showWhen![key] : [q.showWhen![key]];
      const actual = branches[key] || [];
      return actual.some((answer) =>
        (expected as string[]).some((value) => String(value).toLowerCase() === String(answer).toLowerCase())
      );
    });
  });
}

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [visibleStep, setVisibleStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [branches, setBranches] = useState<Record<string, string[]>>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Use global store config — no separate query needed
  let globalAiConfig: any = null;
  try {
    const { useGlobalStore } = require('@/hooks/useGlobalStore');
    const store = useGlobalStore();
    globalAiConfig = store.aiAssistantConfig;
  } catch {}

  const config = (globalAiConfig as AIConfig | null) || null;

  const assistantName = config?.assistant_name || config?.button_text || 'AI';

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const saveSession = useCallback(async (payload: Record<string, any>) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/rest/v1/ai_assistant_sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.[0]?.id) setLocalSessionId(data[0].id);
    } catch (e) { console.error('AI session save error', e); }
  }, []);

  const updateSession = useCallback(async (payload: Record<string, any>) => {
    if (!localSessionId) return;
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/rest/v1/ai_assistant_sessions?id=eq.${localSessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) { console.error('AI session update error', e); }
  }, [localSessionId]);

  const startSession = useCallback(async () => {
    if (!config?.enabled || !config?.site_id || !config?.api_base) return;

    setSessionStarted(true);
    setMessages([
      { role: 'assistant', type: 'greeting', text: `Hi there! 👋 I'm ${assistantName}, your shopping assistant. Let me help you find the perfect product.` },
      { role: 'assistant', type: 'thinking', text: 'Loading questions...' },
    ]);

    const surface = detectSurface();
    const visitorId = getVisitorId();
    const sessionId = crypto.randomUUID();

    saveSession({
      session_id: sessionId,
      user_id: user?.id || null,
      visitor_id: visitorId,
      surface: surface.surface,
      pathname: location.pathname,
      product_slug: surface.slug || null,
      started_at: new Date().toISOString(),
    });

    try {
      const res = await fetch(`${config.api_base}/widget-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-site-id': config.site_id },
        body: JSON.stringify({
          surface: surface.surface,
          pathname: location.pathname,
          productSlug: surface.slug,
          userId: user?.id,
          visitorId,
        }),
      });
      const data = await res.json();
      const q = (data.questions || []) as Question[];
      setAllQuestions(q);
      setVisibleStep(0);
      setAnswers({});
      setBranches({});

      updateSession({ questions: q });

      const visible = getVisibleQuestions(q, {});
      setMessages(prev => [
        prev[0],
        ...(visible.length > 0
          ? [{ role: 'assistant' as const, type: 'question' as const, question: visible[0], stepIndex: 0, totalSteps: visible.length }]
          : [{ role: 'assistant' as const, type: 'error' as const, text: 'No questions available right now.' }]),
      ]);
    } catch {
      setMessages(prev => [
        prev[0],
        { role: 'assistant', type: 'error', text: 'Failed to load. Please try again.' },
      ]);
    }
  }, [config, user, saveSession, updateSession, assistantName]);

  const handleOptionSelect = (option: string, inputType: string) => {
    if (inputType === 'single_select') {
      setSelectedOptions([option]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
      );
    }
  };

  const handleContinue = useCallback(async () => {
    const visible = getVisibleQuestions(allQuestions, branches);
    if (selectedOptions.length === 0 || visibleStep >= visible.length) return;

    const q = visible[visibleStep];
    const newAnswers = { ...answers, [q.id]: selectedOptions };
    const newBranches = { ...branches };
    if (q.branchKey) newBranches[q.branchKey] = [...selectedOptions];

    setAnswers(newAnswers);
    setBranches(newBranches);

    setMessages(prev => [
      ...prev,
      { role: 'user', type: 'answer', text: selectedOptions.join(', ') },
    ]);
    setSelectedOptions([]);

    updateSession({ answers: newAnswers });

    const nextStep = visibleStep + 1;
    setVisibleStep(nextStep);

    // Recalculate visible questions with updated branches
    const nextVisible = getVisibleQuestions(allQuestions, newBranches);

    if (nextStep < nextVisible.length) {
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', type: 'question', question: nextVisible[nextStep], stepIndex: nextStep, totalSteps: nextVisible.length },
        ]);
      }, 400);
    } else {
      // Submit answers
      setMessages(prev => [
        ...prev,
        { role: 'assistant', type: 'thinking', text: 'Analyzing your preferences...' },
      ]);

      try {
        const surface = detectSurface();
        const res = await fetch(`${config!.api_base}/widget-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-site-id': config!.site_id },
          body: JSON.stringify({
            surface: surface.surface,
            pathname: location.pathname,
            productSlug: surface.slug,
            answers: newAnswers,
            userId: user?.id,
            visitorId: getVisitorId(),
          }),
        });
        const data = await res.json();
        const recs = (data.recommendations || []) as Recommendation[];

        updateSession({
          recommendations: recs,
          recommendation_count: recs.length,
          completed_at: new Date().toISOString(),
        });

        fireWidgetEvent(config!.api_base, config!.site_id, 'recommendation_viewed', data.sessionId || null, {
          count: recs.length,
          productIds: recs.map((r: any) => r.externalId || r.name).filter(Boolean),
        });

        setTimeout(() => {
          setMessages(prev => [
            ...prev.filter(m => m.type !== 'thinking'),
            { role: 'assistant', type: 'recommendations', recs },
          ]);
        }, 800);
      } catch {
        setMessages(prev => [
          ...prev.filter(m => m.type !== 'thinking'),
          { role: 'assistant', type: 'error', text: 'Something went wrong. Please try again.' },
        ]);
      }
    }
  }, [selectedOptions, visibleStep, allQuestions, answers, branches, config, user, updateSession]);

  const handleRestart = () => {
    setMessages([]);
    setAllQuestions([]);
    setVisibleStep(0);
    setAnswers({});
    setBranches({});
    setSelectedOptions([]);
    setSessionStarted(false);
    setLocalSessionId(null);
  };

  const handleProductClick = (url: string) => {
    updateSession({ clicked_product_url: url });
    if (config?.api_base && config?.site_id) {
      fireWidgetEvent(config.api_base, config.site_id, 'product_clicked', null, {
        productUrl: url,
        visitorId: getVisitorId(),
      });
    }
  };

  // Listen for open event from mobile bottom nav
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      if (!sessionStarted) startSession();
    };
    window.addEventListener('ai-assistant:open', handleOpen);
    return () => window.removeEventListener('ai-assistant:open', handleOpen);
  }, [sessionStarted, startSession]);

  if (!config?.enabled) return null;

  return (
    <>
      {/* Floating button - desktop only (mobile uses bottom nav) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => {
              setIsOpen(true);
              if (!sessionStarted) startSession();
            }}
            className={cn(
              "fixed z-[9998] h-14 w-14 rounded-full",
              "bg-gradient-to-br from-primary to-primary/80",
              "text-primary-foreground shadow-lg",
              "hover:shadow-xl hover:scale-110",
              "transition-all duration-300",
              "flex items-center justify-center",
              "hidden lg:flex",
              "bottom-6 right-6"
            )}
            title={assistantName}
          >
            <Sparkles className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-[9999] flex flex-col",
              "bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
              "bottom-[76px] right-4 lg:bottom-6 lg:right-6",
              "w-[360px] max-w-[calc(100vw-32px)]",
              "h-[calc(100vh-160px)] max-h-[520px] lg:h-[520px] lg:max-h-[calc(100vh-120px)]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{assistantName}</h3>
                  <p className="text-[10px] opacity-80">Shopping Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {sessionStarted && (
                  <button
                    onClick={handleRestart}
                    className="h-8 w-8 rounded-full hover:bg-primary-foreground/20 flex items-center justify-center transition-colors"
                    title="Start over"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-primary-foreground/20 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-muted/30">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  message={msg}
                  selectedOptions={i === messages.length - 1 && msg.type === 'question' ? selectedOptions : undefined}
                  onOptionSelect={i === messages.length - 1 && msg.type === 'question' ? handleOptionSelect : undefined}
                  onContinue={i === messages.length - 1 && msg.type === 'question' ? handleContinue : undefined}
                  onProductClick={handleProductClick}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface MessageBubbleProps {
  message: MessageType;
  selectedOptions?: string[];
  onOptionSelect?: (option: string, inputType: string) => void;
  onContinue?: () => void;
  onProductClick?: (url: string) => void;
}

function MessageBubble({ message, selectedOptions, onOptionSelect, onContinue, onProductClick }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex justify-end"
      >
        <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm">
          {message.text}
        </div>
      </motion.div>
    );
  }

  if (message.type === 'greeting') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex justify-start"
      >
        <div className="bg-card border border-border px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[85%] text-sm text-foreground shadow-sm">
          {message.text}
        </div>
      </motion.div>
    );
  }

  if (message.type === 'thinking') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-start"
      >
        <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            {message.text}
          </div>
        </div>
      </motion.div>
    );
  }

  if (message.type === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex justify-start"
      >
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[85%] text-sm">
          {message.text}
        </div>
      </motion.div>
    );
  }

  if (message.type === 'question') {
    const q = message.question;
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-2"
      >
        <div className="flex justify-start">
          <div className="bg-card border border-border px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[90%] shadow-sm">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">
              Step {message.stepIndex + 1} of {message.totalSteps}
            </p>
            <p className="text-sm font-medium text-foreground">{q.questionText}</p>
            {q.helperText && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{q.helperText}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pl-1">
          {q.options.map((opt) => {
            const isSelected = selectedOptions?.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => onOptionSelect?.(opt, q.inputType)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-foreground border-border hover:border-primary hover:bg-accent"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {onContinue && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onContinue}
            disabled={!selectedOptions || selectedOptions.length === 0}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ml-1",
              selectedOptions && selectedOptions.length > 0
                ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Continue <ChevronRight className="h-3.5 w-3.5" />
          </motion.button>
        )}
      </motion.div>
    );
  }

  if (message.type === 'recommendations') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex justify-start">
          <div className="bg-card border border-border px-4 py-2.5 rounded-2xl rounded-bl-md shadow-sm text-sm text-foreground">
            ✨ Here are my top picks for you!
          </div>
        </div>
        {message.recs.map((rec, ri) => (
          <motion.a
            key={ri}
            href={rec.productUrl || '#'}
            onClick={() => onProductClick?.(rec.productUrl || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ri * 0.1 }}
            className="block bg-card border border-border rounded-2xl p-3 hover:shadow-md transition-shadow"
          >
            <div className="flex gap-3">
              {rec.imageUrl && (
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  <img src={rec.imageUrl} alt={rec.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-foreground line-clamp-1">{rec.name}</h4>
                {rec.explanation && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rec.explanation}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {rec.matchScore > 0 && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      {rec.matchScore}% Match
                    </span>
                  )}
                  {rec.price && (
                    <span className="text-sm font-bold text-foreground">₹{rec.price}</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />
            </div>
          </motion.a>
        ))}
      </motion.div>
    );
  }

  return null;
}
