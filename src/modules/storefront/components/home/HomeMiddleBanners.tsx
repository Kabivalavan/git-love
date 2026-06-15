import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { Shimmer } from '@/components/ui/shimmer';
import { useLazySection } from '@/hooks/useLazySection';
import type { Banner } from '@/types/database';

interface Props {
  middleBanners: Banner[];
}

function MiddleBannerShimmer() {
  return (
    <section className="container mx-auto px-4 py-8 md:py-12">
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        <Shimmer className="aspect-[2/1] rounded-xl" />
        <Shimmer className="aspect-[2/1] rounded-xl" />
      </div>
    </section>
  );
}

export default function HomeMiddleBanners({ middleBanners }: Props) {
  const { ref, isVisible } = useLazySection({ rootMargin: '350px' });

  return (
    <div ref={ref}>
      {!isVisible ? (
        <MiddleBannerShimmer />
      ) : middleBanners.length > 0 ? (
        <section className="container mx-auto px-4 py-8 md:py-12">
          <div className={`grid gap-4 md:gap-6 ${middleBanners.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {middleBanners.map((banner) => (
              <Card key={banner.id} className="overflow-hidden group cursor-pointer border-0 shadow-lg bg-muted">
                <CardContent className="p-0">
                  <Link to={banner.redirect_url || '/products'}>
                    <div className="aspect-[2/1] overflow-hidden flex items-center justify-center">
                      <ResponsiveImage
                        src={(banner as any).media_url_mobile || banner.media_url}
                        alt={banner.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 block md:hidden"
                        widths={[320, 480, 640]}
                        sizes="100vw"
                        loading="lazy"
                      />
                      <ResponsiveImage
                        src={banner.media_url}
                        alt={banner.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 hidden md:block"
                        widths={[480, 768, 1024, 1280]}
                        sizes="50vw"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <section className="container mx-auto px-4 py-8 md:py-12">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-br from-primary via-primary/90 to-accent flex items-center p-6 md:p-10">
                  <div className="text-primary-foreground">
                    <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 mb-3">SPECIAL OFFER</Badge>
                    <h3 className="text-xl md:text-3xl font-bold mb-2">Up to 50% OFF</h3>
                    <p className="text-sm opacity-90 mb-4">On selected items this season</p>
                    <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full" size="sm" asChild>
                      <Link to="/products?offer=true">Shop Now <ArrowRight className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-br from-secondary via-secondary/90 to-muted flex items-center p-6 md:p-10">
                  <div className="text-foreground">
                    <Badge className="bg-foreground/10 text-foreground border-0 mb-3">NEW ARRIVALS</Badge>
                    <h3 className="text-xl md:text-3xl font-bold mb-2">Fresh Collection</h3>
                    <p className="text-sm opacity-90 mb-4">Just dropped this week</p>
                    <Button className="bg-card text-foreground hover:bg-card/90 rounded-full" size="sm" asChild>
                      <Link to="/products?new=true">Explore <ArrowRight className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
