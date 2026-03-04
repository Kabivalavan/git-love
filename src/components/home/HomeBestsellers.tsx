import { Link } from 'react-router-dom';
import { Flame, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { useBestsellers, useReviewStats, useHomeAddToCart } from './useHomeProducts';

const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } } };

export default function HomeBestsellers() {
  const { data: products = [], isLoading } = useBestsellers();
  const { data: reviewStats = {} } = useReviewStats(products.map(p => p.id));
  const { storefrontDisplay, getProductOffer } = useGlobalStore();
  const { handleAddToCart, handleAddToWishlist } = useHomeAddToCart();

  if (isLoading || products.length === 0) return null;

  return (
    <section className="bg-muted/50 py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 md:h-6 md:w-6 text-amber-500" />
            <h2 className="text-xl md:text-3xl font-bold text-foreground">Best Sellers</h2>
          </div>
          <Button variant="outline" asChild size="sm" className="rounded-full">
            <Link to="/products?bestseller=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {products.map((product) => (
            <motion.div key={product.id} variants={scaleIn}>
              <ProductCard product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} variant="compact" lowStockSettings={storefrontDisplay} avgRating={reviewStats[product.id]?.avgRating || 0} reviewCount={reviewStats[product.id]?.reviewCount || 0} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
