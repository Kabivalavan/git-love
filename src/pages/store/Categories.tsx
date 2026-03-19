import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { Shimmer } from '@/components/ui/shimmer';
import type { Category } from '@/types/database';

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .is('parent_id', null)
        .order('sort_order');
      return (data || []) as Category[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subCategories = [] } = useQuery({
    queryKey: ['sub-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .not('parent_id', 'is', null)
        .order('sort_order');
      return (data || []) as Category[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <StorefrontLayout>
      <SEOHead title="Categories - Shop by Category" description="Browse products by category." />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Shop by Category</h1>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Shimmer key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No categories available yet.</p>
        ) : (
          <div className="space-y-10">
            {categories.map((cat) => {
              const children = subCategories.filter(sc => sc.parent_id === cat.id);
              return (
                <div key={cat.id}>
                  <Link
                    to={`/category/${cat.slug}`}
                    className="group block mb-4"
                  >
                    <div className="relative aspect-[3/1] md:aspect-[4/1] rounded-2xl overflow-hidden bg-muted">
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <span className="text-4xl font-bold text-primary/30">{cat.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-4">
                        <h2 className="text-xl md:text-2xl font-bold text-white">{cat.name}</h2>
                        {cat.description && <p className="text-sm text-white/80 mt-1 line-clamp-1">{cat.description}</p>}
                      </div>
                    </div>
                  </Link>

                  {children.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pl-2">
                      {children.map((sub) => (
                        <Link
                          key={sub.id}
                          to={`/category/${cat.slug}?sub=${sub.slug}`}
                          className="group text-center"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-muted border-2 border-transparent group-hover:border-primary transition-all">
                            {sub.image_url ? (
                              <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                                <span className="text-lg font-bold text-primary/40">{sub.name.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <p className="mt-1.5 text-xs font-medium text-foreground group-hover:text-primary truncate">{sub.name}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
