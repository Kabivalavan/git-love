import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingCart, User } from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';
import { cn } from '@/lib/utils';

interface StorefrontLayoutProps {
  children: ReactNode;
}

const mobileNavItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Search, label: 'Shop', path: '/products' },
  { icon: ShoppingCart, label: 'Cart', path: '/cart' },
  { icon: User, label: 'Account', path: '/account' },
];

export function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      <Footer />
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden">
        <div className="flex items-center justify-around h-14">
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
