import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBundles } from './useHomeProducts';

const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } } };

export default function HomeBundles() {
  const { data: bundles = [], isLoading } = useBundles();

  if (isLoading || bundles.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-8 md:py-12">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <h2 className="text-xl md:text-3xl font-bold text-foreground">Bundle Deals</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {bundles.map((bundle: any) => {
          const discount = bundle.compare_price && bundle.compare_price > bundle.bundle_price
            ? Math.round(((bundle.compare_price - bundle.bundle_price) / bundle.compare_price) * 100)
            : 0;
          const bundleImage = bundle.image_url || bundle.items?.[0]?.product?.images?.[0]?.image_url || '/placeholder.svg';
          return (
            <motion.div key={bundle.id} variants={scaleIn}>
              <Link to={`/bundles/${bundle.slug}`} className="block group">
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md">
                  <CardContent className="p-0">
                    <div className="aspect-[2/1] relative overflow-hidden bg-muted">
                      <img src={bundleImage} alt={bundle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      {discount > 0 && (
                        <Badge variant="destructive" className="absolute top-3 left-3 text-xs">{discount}% OFF</Badge>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{bundle.name}</h3>
                      {bundle.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bundle.description}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-lg font-bold text-foreground">₹{Number(bundle.bundle_price).toFixed(0)}</span>
                        {bundle.compare_price && bundle.compare_price > bundle.bundle_price && (
                          <span className="text-sm text-muted-foreground line-through">₹{Number(bundle.compare_price).toFixed(0)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{bundle.items?.length || 0} products included</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
