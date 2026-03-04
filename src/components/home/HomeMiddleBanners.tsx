import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Banner } from '@/types/database';

interface Props {
  middleBanners: Banner[];
}

export default function HomeMiddleBanners({ middleBanners }: Props) {
  if (middleBanners.length > 0) {
    return (
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className={`grid gap-4 md:gap-6 ${middleBanners.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
          {middleBanners.map((banner) => (
            <Card key={banner.id} className="overflow-hidden group cursor-pointer border-0 shadow-lg">
              <CardContent className="p-0">
                <Link to={banner.redirect_url || '/products'}>
                  <div className="aspect-[2/1] overflow-hidden">
                    <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
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
            <div className="aspect-[2/1] bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center p-6 md:p-10">
              <div className="text-white">
                <Badge className="bg-white/20 text-white border-0 mb-3">NEW ARRIVALS</Badge>
                <h3 className="text-xl md:text-3xl font-bold mb-2">Fresh Collection</h3>
                <p className="text-sm opacity-90 mb-4">Just dropped this week</p>
                <Button className="bg-white text-orange-600 hover:bg-white/90 rounded-full" size="sm" asChild>
                  <Link to="/products?new=true">Explore <ArrowRight className="h-4 w-4 ml-1" /></Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
