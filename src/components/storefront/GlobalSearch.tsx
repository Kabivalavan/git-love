import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/database';

interface GlobalSearchProps {
  className?: string;
  onClose?: () => void;
  autoFocus?: boolean;
}

export function GlobalSearch({ className, onClose, autoFocus }: GlobalSearchProps) {
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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search for products..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-10 pr-10"
            autoFocus={autoFocus}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Results dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No products found for "{query}"</p>
            </div>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto">
                {results.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.slug}`}
                    onClick={handleProductClick}
                    className="flex items-center gap-3 p-3 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                  >
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0].image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          No img
                        </div>
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
                className="block px-4 py-3 text-center text-sm font-medium text-primary hover:bg-muted transition-colors border-t border-border"
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
