import { ReactNode, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingCart, User, Sparkles } from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AIAssistantWidget } from './AIAssistantWidget';
import { ExitIntentPopup } from './ExitIntentPopup';
import { cn } from '@/lib/utils';
import { useCartCount } from '@/hooks/useCartQuery';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface StorefrontLayoutProps {
  children: ReactNode;
}

const AI_CACHE_KEY = 'ai_enabled_cache';

const baseMobileNavItems = [
  { icon: Home, label: 'Home', path: '/', fill: true },
  { icon: LayoutGrid, label: 'Category', path: '/category', fill: false },
  { icon: ShoppingCart, label: 'Cart', path: '/cart', fill: false },
  { icon: User, label: 'Profile', path: '/account', fill: false },
];

function getCachedAiEnabled(): boolean {
  try { return localStorage.getItem(AI_CACHE_KEY) === '1'; } catch { return false; }
}

export function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const location = useLocation();
  const cartCount = useCartCount();
  const isHomePage = location.pathname === '/';

  const { data: isAiEnabled = getCachedAiEnabled() } = useQuery({
    queryKey: ['ai-assistant-enabled'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'ai_assistant')
        .maybeSingle();
      const enabled = Boolean((data?.value as { enabled?: boolean } | null)?.enabled);
      try { localStorage.setItem(AI_CACHE_KEY, enabled ? '1' : '0'); } catch {}
      return enabled;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const mobileNavItems = useMemo(() => {
    if (!isAiEnabled) return baseMobileNavItems;

    return [
      baseMobileNavItems[0],
      baseMobileNavItems[1],
      { icon: Sparkles, label: 'AI', path: '/ai-assistant', fill: false, isAiLauncher: true },
      baseMobileNavItems[2],
      baseMobileNavItems[3],
    ];
  }, [isAiEnabled]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background">
      <Header />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      {isHomePage && <Footer />}
      <AIAssistantWidget />
      <ExitIntentPopup />
      {/* Mobile Bottom Navigation - App style */}
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
