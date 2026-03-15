import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Gift, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConversionSettings, trackConversionEvent } from '@/hooks/useConversionOptimization';
import { cn } from '@/lib/utils';

export function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: settings } = useConversionSettings();

  const handleExit = useCallback((e: MouseEvent) => {
    if (e.clientY <= 5 && !show) {
      const key = 'exit_popup_shown';
      if (settings?.exit_popup.show_once_per_session && sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      setShow(true);
      trackConversionEvent('exit_popup_shown');
    }
  }, [show, settings]);

  useEffect(() => {
    if (!settings?.exit_popup.enabled) return;
    // Delay adding listener to avoid triggering on page load
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleExit);
    }, 5000);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleExit);
    };
  }, [handleExit, settings?.exit_popup.enabled]);

  const handleCopy = () => {
    if (!settings) return;
    navigator.clipboard.writeText(settings.exit_popup.coupon_code);
    setCopied(true);
    trackConversionEvent('exit_popup_clicked', { metadata: { coupon: settings.exit_popup.coupon_code } });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!settings?.exit_popup.enabled) return null;

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm"
            onClick={() => setShow(false)}
          />
          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto">
              {/* Header gradient */}
              <div className="relative bg-gradient-to-br from-primary to-primary/70 px-6 py-8 text-center">
                <button
                  onClick={() => setShow(false)}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center text-primary-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Gift className="h-7 w-7 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold text-primary-foreground leading-tight">
                  {settings.exit_popup.headline}
                </h2>
                <p className="text-sm text-primary-foreground/80 mt-2">
                  {settings.exit_popup.description}
                </p>
              </div>

              {/* Coupon code */}
              <div className="px-6 py-6">
                <div className="text-center mb-4">
                  <span className="text-3xl font-black text-primary tracking-wider">
                    {settings.exit_popup.discount_text}
                  </span>
                </div>

                <button
                  onClick={handleCopy}
                  className={cn(
                    "w-full flex items-center justify-center gap-3 border-2 border-dashed rounded-2xl px-4 py-4 transition-all",
                    copied
                      ? "border-[hsl(var(--success))] bg-[hsl(var(--success))]/5"
                      : "border-primary/40 hover:border-primary bg-muted/50 hover:bg-primary/5"
                  )}
                >
                  <span className="font-mono text-lg font-bold text-foreground tracking-widest">
                    {settings.exit_popup.coupon_code}
                  </span>
                  {copied ? (
                    <CheckCircle className="h-5 w-5 text-[hsl(var(--success))]" />
                  ) : (
                    <Copy className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                <p className="text-xs text-muted-foreground text-center mt-3">
                  {copied ? '✅ Code copied! Use it at checkout.' : 'Click to copy the coupon code'}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5">
                <button
                  onClick={() => setShow(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-2 transition-colors"
                >
                  No thanks, I'll pass
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
