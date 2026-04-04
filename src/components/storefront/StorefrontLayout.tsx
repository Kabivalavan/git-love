import { ReactNode, Suspense, lazy, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingCart, User, Sparkles } from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';
import { LoadingBreather } from './LoadingBreather';
import { cn } from '@/lib/utils';
import { useCartCount } from '@/hooks/useCartQuery';
import { useGlobalStore } from '@/hooks/useGlobalStore';

interface StorefrontLayoutProps {
  children: ReactNode;
}

const AIAssistantWidget = lazy(() => import('./AIAssistantWidget').then((module) => ({ default: module.AIAssistantWidget })));
const ExitIntentPopup = lazy(() => import('./ExitIntentPopup').then((module) => ({ default: module.ExitIntentPopup })));

const baseMobileNavItems = [
  { icon: Home, label: 'Home', path: '/', fill: true },
  { icon: LayoutGrid, label: 'Category', path: '/category', fill: false },
  { icon: User, label: 'Profile', path: '/account', fill: false },
  { icon: ShoppingCart, label: 'Cart', path: '/cart', fill: false },
];

function AIPopupBubble({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 animate-enter">
      <div
        className="relative bg-card border border-border rounded-2xl shadow-xl px-3 py-2 w-[180px] text-center cursor-pointer"
        onClick={() => {
          onDismiss();
          window.dispatchEvent(new CustomEvent('ai-assistant:open'));
        }}
      >
        <div className="text-lg mb-0.5">👋✨</div>
        <p className="text-[11px] font-medium text-foreground leading-tight">
          Hey! Use me as your assistant for discovering products!
        </p>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r border-b border-border rotate-45" />
      </div>
    </div>
  );
}

export function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const location = useLocation();
  const cartCount = useCartCount();
  const isHomePage = location.pathname === '/';
  const [showAiPopup, setShowAiPopup] = useState(false);
  const [enableEnhancements, setEnableEnhancements] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use consolidated config from global store — no separate query
  const { aiAssistantConfig } = useGlobalStore();
  const isAiEnabled = Boolean(aiAssistantConfig?.enabled);
  const aiPopupEnabled = Boolean(aiAssistantConfig?.show_popup);

  const dismissPopup = useCallback(() => setShowAiPopup(false), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setEnableEnhancements(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAiEnabled || !aiPopupEnabled) return;
    if (window.innerWidth > 1024) return;

    const AI_POPUP_SHOWN_KEY = 'ai_popup_shown_session';
    const alreadyShown = sessionStorage.getItem(AI_POPUP_SHOWN_KEY);

    if (!alreadyShown) {
      popupTimerRef.current = setTimeout(() => {
        setShowAiPopup(true);
        sessionStorage.setItem(AI_POPUP_SHOWN_KEY, '1');
      }, 7000);
    }

    intervalRef.current = setInterval(() => setShowAiPopup(true), 2 * 60 * 1000);

    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAiEnabled, aiPopupEnabled]);

  const mobileNavItems = useMemo(() => {
    if (!isAiEnabled) return baseMobileNavItems;
    return [
      baseMobileNavItems[0],
      baseMobileNavItems[1],
      baseMobileNavItems[2],
      { icon: Sparkles, label: 'AI', path: '/ai-assistant', fill: false, isAiLauncher: true },
      baseMobileNavItems[3],
    ];
  }, [isAiEnabled]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background">
      <Header />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      {isHomePage && <Footer />}
      {enableEnhancements && (
        <Suspense fallback={null}>
          <AIAssistantWidget />
          <ExitIntentPopup />
        </Suspense>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around h-[60px]">
          {mobileNavItems.map((item) => {
            const isActive = !('isAiLauncher' in item) && (
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            );
            const isCart = item.path === '/cart';

            if ('isAiLauncher' in item && item.isAiLauncher) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('ai-assistant:open'))}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative text-muted-foreground"
                >
                  {showAiPopup && <AIPopupBubble onDismiss={dismissPopup} />}
                  <span className="relative">
                    <item.icon className="h-[22px] w-[22px]" />
                  </span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary" />
                )}
                <span className="relative">
                  <item.icon className={cn('h-[22px] w-[22px]', isActive && 'fill-primary/15')} />
                  {isCart && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </span>
                <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
