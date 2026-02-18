import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="py-12">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Order Placed Successfully!</h1>
            <p className="text-muted-foreground mb-4">
              Thank you for your order. We'll send you a confirmation email shortly.
            </p>
            {orderNumber && (
              <div className="bg-muted rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="text-xl font-bold">{orderNumber}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link to="/account/orders">
                  <Package className="h-4 w-4 mr-2" />
                  Track Order
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/products">
                  Continue Shopping
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </StorefrontLayout>
  );
}
