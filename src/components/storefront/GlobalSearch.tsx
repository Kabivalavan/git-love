import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/database';

interface GlobalSearchProps {
  className?: string;
  onClose?: () => void;
  autoFocus?: boolean;
  variant?: 'default' | 'header';
}

export function GlobalSearch({ className, onClose, autoFocus, variant = 'default' }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      const { data } = await supabase
        .from('products')
        .select('*, images:product_images(*)')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(6);
      setResults((data || []) as Product[]);
      setIsLoading(false);
    };
    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query)}`);
      setIsOpen(false);
      setQuery('');
      onClose?.();
    }
  };

  const handleProductClick = () => {
    setIsOpen(false);
    setQuery('');
    onClose?.();
  };

  const isHeader = variant === 'header';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${isHeader ? 'text-muted-foreground' : 'text-muted-foreground'}`} />
          <input
            ref={inputRef}
            placeholder="Search products..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className={`w-full h-10 pl-10 pr-10 rounded-full text-sm transition-all focus:outline-none ${
              isHeader
                ? 'bg-primary-foreground text-foreground border-0 placeholder:text-muted-foreground shadow-inner focus:ring-2 focus:ring-primary-foreground/50'
                : 'border border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary'
            }`}
            autoFocus={autoFocus}
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
              onClick={() => { setQuery(''); setResults([]); }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Results dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">No products found for "{query}"</p>
            </div>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto">
                {results.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.slug}`}
                    onClick={handleProductClick}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {product.images?.[0] ? (
                        <ResponsiveImage
                          src={product.images[0].image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          widths={[64, 96, 128]}
                          sizes="48px"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-semibold text-primary">₹{Number(product.price).toFixed(0)}</span>
                        {product.mrp && product.mrp > product.price && (
                          <span className="text-xs text-muted-foreground line-through">₹{Number(product.mrp).toFixed(0)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                to={`/products?search=${encodeURIComponent(query)}`}
                onClick={handleProductClick}
                className="block px-4 py-3 text-center text-sm font-medium text-primary hover:bg-muted/50 transition-colors border-t border-border"
              >
                View all results for "{query}"
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
