import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Package, ChevronLeft, Tag } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SEOHead } from '@/components/seo/SEOHead';

interface BundleProduct {
  id: string;
  name: string;
  price: number;
  images: { image_url: string; is_primary: boolean }[];
  slug: string;
}

interface BundleItem {
  id: string;
  quantity: number;
  sort_order: number;
  product: BundleProduct;
}

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bundle_price: number;
  compare_price: number | null;
  is_active: boolean;
  image_url: string | null;
  items: BundleItem[];
}

export default function BundleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (slug) fetchBundle(slug);
  }, [slug]);

  const fetchBundle = async (slug: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('bundles')
      .select(`
        *,
        items:bundle_items(
          id, quantity, sort_order,
          product:products(id, name, price, slug, images:product_images(image_url, is_primary))
        )
      `)
      .eq('slug', slug)
      .single();

    if (error || !data) {
      setBundle(null);
    } else {
      const sorted = { ...data, items: [...(data.items || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) };
      setBundle(sorted as unknown as Bundle);
    }
    setIsLoading(false);
  };

  // Collect all bundle images: bundle image + product images
  const allImages: string[] = [];
  if (bundle?.image_url) allImages.push(bundle.image_url);
  bundle?.items?.forEach(item => {
    const primary = item.product?.images?.find(i => i.is_primary)?.image_url || item.product?.images?.[0]?.image_url;
    if (primary && !allImages.includes(primary)) allImages.push(primary);
  });

  const handleAddToCart = async () => {
    if (!user) {
      toast({ title: 'Please login', description: 'Login to add items to cart', variant: 'destructive' });
      return;
    }
    if (!bundle) return;

    setIsAddingToCart(true);
    try {
      // Get or create cart
      let cartId: string;
      const { data: existingCart } = await supabase
        .from('cart')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingCart) {
        cartId = existingCart.id;
      } else {
        const { data: newCart, error } = await supabase
          .from('cart')
          .insert({ user_id: user.id })
          .select('id')
          .single();
        if (error) throw error;
        cartId = newCart.id;
      }

      // Add each bundle product to cart
      for (const item of bundle.items) {
        const { data: existing } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('cart_id', cartId)
          .eq('product_id', item.product.id)
          .is('variant_id', null)
          .single();

        if (existing) {
          await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + item.quantity })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('cart_items')
            .insert({ cart_id: cartId, product_id: item.product.id, quantity: item.quantity });
        }
      }

      toast({ title: '🎁 Bundle added to cart!', description: `${bundle.items.length} products added` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setIsAddingToCart(false);
  };

  const discount = bundle?.compare_price && bundle.compare_price > bundle.bundle_price
    ? Math.round(((bundle.compare_price - bundle.bundle_price) / bundle.compare_price) * 100)
    : 0;

  const totalOriginalValue = bundle?.items?.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity, 0
  ) ?? 0;

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-6 w-48 mb-6" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (!bundle) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Bundle not found</h1>
          <Link to="/" className="text-primary underline">Return Home</Link>
        </div>
      </StorefrontLayout>
    );
  }

  return (
    <StorefrontLayout>
      <SEOHead
        title={`${bundle.name} — Bundle Deal`}
        description={bundle.description || `Get the ${bundle.name} bundle at ₹${bundle.bundle_price}.`}
        image={bundle.image_url || undefined}
      />

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <span className="text-foreground">{bundle.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {/* Image Gallery */}
          <div className="space-y-3 md:sticky md:top-20 md:self-start">
            <div className="relative aspect-square bg-muted rounded-xl overflow-hidden">
              {allImages.length > 0 ? (
                <img
                  src={allImages[currentImageIndex]}
                  alt={bundle.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">📦</div>
              )}
              {discount > 0 && (
                <Badge variant="destructive" className="absolute top-3 left-3 text-sm px-2 py-1">
                  {discount}% OFF
                </Badge>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-14 h-14 rounded-md overflow-hidden border-2 flex-shrink-0 transition-colors ${i === currentImageIndex ? 'border-primary' : 'border-transparent'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bundle Info */}
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="mb-2">Bundle Deal</Badge>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{bundle.name}</h1>
              {bundle.description && (
                <p className="text-muted-foreground mt-2">{bundle.description}</p>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-bold text-foreground">₹{Number(bundle.bundle_price).toFixed(0)}</span>
                {bundle.compare_price && bundle.compare_price > bundle.bundle_price && (
                  <span className="text-xl text-muted-foreground line-through">₹{Number(bundle.compare_price).toFixed(0)}</span>
                )}
                {discount > 0 && (
                  <Badge variant="destructive">{discount}% OFF</Badge>
                )}
              </div>
              {totalOriginalValue > bundle.bundle_price && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  💰 You save ₹{Math.round(totalOriginalValue - bundle.bundle_price)} vs buying separately
                </p>
              )}
              <p className="text-xs text-muted-foreground">(Tax Inclusive)</p>
            </div>

            {/* What's included summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-semibold mb-2 text-foreground">{bundle.items.length} Products Included:</p>
              <ul className="space-y-1">
                {bundle.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{item.product?.name}</span>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <Button
              size="lg"
              className="w-full h-14 text-lg font-semibold"
              onClick={handleAddToCart}
              disabled={isAddingToCart}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {isAddingToCart ? 'Adding to Cart...' : 'Add Bundle to Cart'}
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              All items added individually to cart at bundle savings
            </div>
          </div>
        </div>

        {/* Products in Bundle - detail cards */}
        <Separator className="my-8" />
        <div>
          <h2 className="text-xl font-bold mb-6 text-foreground">What's in this Bundle</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundle.items.map((item) => {
              const img = item.product?.images?.find(i => i.is_primary)?.image_url || item.product?.images?.[0]?.image_url;
              return (
                <Link
                  key={item.id}
                  to={`/product/${item.product?.slug}`}
                  className="group flex gap-3 border rounded-xl p-4 bg-card hover:shadow-md transition-all"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {img ? (
                      <img src={img} alt={item.product?.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground group-hover:text-primary truncate">{item.product?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">₹{Number(item.product?.price).toFixed(0)}</p>
                  </div>
                  <div className="flex items-center">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Value breakdown */}
        {totalOriginalValue > 0 && (
          <div className="mt-8 bg-primary/5 border border-primary/20 rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-3">Bundle Savings Breakdown</h3>
            <div className="space-y-2">
              {bundle.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.product?.name} ×{item.quantity}</span>
                  <span className="font-medium">₹{(Number(item.product?.price) * item.quantity).toFixed(0)}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total if bought separately</span>
                <span className="font-medium line-through">₹{totalOriginalValue.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-base">
                <span className="text-primary">Bundle Price</span>
                <span className="text-primary">₹{Number(bundle.bundle_price).toFixed(0)}</span>
              </div>
              {totalOriginalValue > bundle.bundle_price && (
                <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400 font-semibold">
                  <span>You Save</span>
                  <span>₹{(totalOriginalValue - bundle.bundle_price).toFixed(0)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
