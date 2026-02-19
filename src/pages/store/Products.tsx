import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Grid, List, SlidersHorizontal, X } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOffers } from '@/hooks/useOffers';
import { ShimmerProductGrid } from '@/components/ui/shimmer';
import { SEOHead } from '@/components/seo/SEOHead';
import type { Product, Category } from '@/types/database';

const ITEMS_PER_PAGE = 12;

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showInStock, setShowInStock] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getProductOffer } = useOffers();

  const searchQuery = searchParams.get('search') || '';
  const categorySlug = searchParams.get('category') || '';
  const isFeatured = searchParams.get('featured') === 'true';
  const isBestseller = searchParams.get('bestseller') === 'true';

  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Reset page and sub-category when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchParams, sortBy, priceRange, selectedCategories, showInStock, selectedSubCategory]);

  // Reset sub-category when category changes
  useEffect(() => {
    setSelectedSubCategory(null);
  }, [categorySlug]);

  useEffect(() => {
    if (categories.length === 0) return;
    fetchProducts();
  }, [searchParams, sortBy, priceRange, selectedCategories, showInStock, categories, currentPage, selectedSubCategory]);

  // Fetch sub-categories when a category is selected
  useEffect(() => {
    if (categorySlug && categories.length > 0) {
      const parentCat = categories.find(c => c.slug === categorySlug);
      if (parentCat) {
        supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .eq('parent_id', parentCat.id)
          .order('sort_order')
          .then(({ data }) => setSubCategories((data || []) as Category[]));
      } else {
        setSubCategories([]);
      }
    } else {
      setSubCategories([]);
    }
  }, [categorySlug, categories]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
    setCategories((data || []) as Category[]);
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('products')
      .select('*, category:categories(*), images:product_images(*)', { count: 'exact' })
      .eq('is_active', true)
      .gte('price', priceRange[0])
      .lte('price', priceRange[1]);

    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    if (selectedSubCategory) {
      query = query.eq('category_id', selectedSubCategory);
    } else if (categorySlug) {
      const category = categories.find(c => c.slug === categorySlug);
      if (category) {
        // Include parent category and all its children
        const childIds = categories.filter(c => c.parent_id === category.id).map(c => c.id);
        query = query.in('category_id', [category.id, ...childIds]);
      }
    }

    if (selectedCategories.length > 0) {
      query = query.in('category_id', selectedCategories);
    }

    if (isFeatured) query = query.eq('is_featured', true);
    if (isBestseller) query = query.eq('is_bestseller', true);
    if (showInStock) query = query.gt('stock_quantity', 0);

    switch (sortBy) {
      case 'price_low':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price', { ascending: false });
        break;
      case 'name':
        query = query.order('name');
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setProducts((data || []) as Product[]);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  };

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to cart' });
      return;
    }

    try {
      let { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
      if (!cart) {
        const { data: newCart } = await supabase.from('cart').insert({ user_id: user.id }).select().single();
        cart = newCart;
      }

      if (cart) {
        const { data: existingItem } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('cart_id', cart.id)
          .eq('product_id', product.id)
          .single();

        if (existingItem) {
          await supabase.from('cart_items').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
        } else {
          await supabase.from('cart_items').insert({ cart_id: cart.id, product_id: product.id, quantity: 1 });
        }
        toast({ title: 'Added to cart', description: `${product.name} has been added to your cart` });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add item to cart', variant: 'destructive' });
    }
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, 10000]);
    setShowInStock(false);
    setSearchParams({});
  };

  const activeFilterCount = selectedCategories.length + (showInStock ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 10000 ? 1 : 0);

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="font-semibold mb-3">Categories</h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={cat.id}
                checked={selectedCategories.includes(cat.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedCategories([...selectedCategories, cat.id]);
                  } else {
                    setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                  }
                }}
              />
              <Label htmlFor={cat.id} className="text-sm cursor-pointer">{cat.name}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="font-semibold mb-3">Price Range</h3>
        <Slider
          value={priceRange}
          onValueChange={setPriceRange}
          min={0}
          max={10000}
          step={100}
          className="mb-2"
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={priceRange[0]}
            onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
            className="w-20 text-sm"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="number"
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 10000])}
            className="w-20 text-sm"
          />
        </div>
      </div>

      {/* Availability */}
      <div>
        <h3 className="font-semibold mb-3">Availability</h3>
        <div className="flex items-center gap-2">
          <Checkbox
            id="inStock"
            checked={showInStock}
            onCheckedChange={(checked) => setShowInStock(!!checked)}
          />
          <Label htmlFor="inStock" className="text-sm cursor-pointer">In Stock Only</Label>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={clearFilters}>
        Clear All Filters
      </Button>
    </div>
  );

  return (
    <StorefrontLayout>
      <SEOHead
        title="Shop All Products - Decon Fashions"
        description="Browse our complete collection of premium men's clothing. Free shipping on orders above ₹500."
        jsonLd={{ '@type': 'CollectionPage', name: 'Products' }}
      />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {categorySlug ? categories.find(c => c.slug === categorySlug)?.name || 'Products' : 
               isFeatured ? 'Featured Products' :
               isBestseller ? 'Best Sellers' :
               searchQuery ? `Search: "${searchQuery}"` : 'All Products'}
            </h1>
            <p className="text-muted-foreground mt-1">{totalCount} products found</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile filter trigger */}
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="outline" className="relative">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            {/* View mode */}
            <div className="hidden sm:flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sub-categories */}
        {categorySlug && subCategories.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            {subCategories.map((sub) => {
              const isSelected = selectedSubCategory === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCategory(isSelected ? null : sub.id)}
                  className="group text-center"
                >
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-muted border-2 transition-all duration-300 mx-auto ${isSelected ? 'border-primary ring-2 ring-primary/30 shadow-lg' : 'border-transparent group-hover:border-primary group-hover:shadow-md'}`}>
                    {sub.image_url ? (
                      <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <span className="text-sm font-bold text-primary">{sub.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <p className={`mt-1.5 text-[10px] sm:text-xs font-medium transition-colors truncate max-w-[5rem] ${isSelected ? 'text-primary font-semibold' : 'text-foreground group-hover:text-primary'}`}>{sub.name}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Active filters */}
        {(selectedCategories.length > 0 || searchQuery || categorySlug) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchQuery}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchParams({})} />
              </Badge>
            )}
            {categorySlug && (
              <Badge variant="secondary" className="gap-1">
                {categories.find(c => c.slug === categorySlug)?.name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => {
                  searchParams.delete('category');
                  setSearchParams(searchParams);
                }} />
              </Badge>
            )}
            {selectedCategories.map(catId => {
              const cat = categories.find(c => c.id === catId);
              return cat ? (
                <Badge key={catId} variant="secondary" className="gap-1">
                  {cat.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategories(selectedCategories.filter(id => id !== catId))} />
                </Badge>
              ) : null;
            })}
          </div>
        )}

        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Filters</h2>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount}</Badge>
                )}
              </div>
              <FilterContent />
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {isLoading ? (
              <ShimmerProductGrid items={8} />
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl text-muted-foreground mb-4">No products found</p>
                <Button onClick={clearFilters}>Clear Filters</Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    productOffer={getProductOffer(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    variant="horizontal"
                    onAddToCart={handleAddToCart}
                    productOffer={getProductOffer(product)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .reduce((acc, page, idx, arr) => {
                      if (idx > 0 && page - arr[idx - 1] > 1) {
                        acc.push(-idx);
                      }
                      acc.push(page);
                      return acc;
                    }, [] as number[])
                    .map(page =>
                      page < 0 ? (
                        <PaginationItem key={`ellipsis-${page}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={page}>
                          <PaginationLink
                            isActive={page === currentPage}
                            onClick={() => setCurrentPage(page)}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
