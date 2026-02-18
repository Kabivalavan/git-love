import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Clock, MapPin, Package } from 'lucide-react';

export default function ShippingPolicy() {
  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Shipping Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Free Shipping</p>
                    <p className="text-sm text-muted-foreground">On orders above ₹500</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Delivery Time</p>
                    <p className="text-sm text-muted-foreground">3-7 business days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold mb-4">Shipping Methods</h2>
            <p className="text-muted-foreground mb-4">
              We partner with reliable courier services to ensure your orders reach you safely and on time. 
              Currently, we ship across India using Standard Shipping and Express Shipping options.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Shipping Charges</h2>
            <div className="bg-muted rounded-lg p-4 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Order Value</th>
                    <th className="text-left py-2">Shipping Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2">Below ₹500</td>
                    <td className="py-2">₹50</td>
                  </tr>
                  <tr>
                    <td className="py-2">₹500 and above</td>
                    <td className="py-2 text-green-600 font-medium">FREE</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold mb-4 mt-8">Delivery Timeline</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Metro cities: 3-5 business days</li>
              <li>Other cities: 5-7 business days</li>
              <li>Remote areas: 7-10 business days</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              Please note that delivery times may vary during sale periods, festivals, or due to unforeseen circumstances.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Order Tracking</h2>
            <p className="text-muted-foreground mb-4">
              Once your order is shipped, you will receive a tracking number via email and SMS. 
              You can track your order status in your account under "My Orders" section.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Delivery Attempts</h2>
            <p className="text-muted-foreground mb-4">
              Our delivery partners will attempt delivery up to 3 times. If delivery fails after all attempts, 
              the order will be returned to us and a refund will be initiated after deducting shipping charges.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Contact Us</h2>
            <p className="text-muted-foreground">
              For shipping-related queries, please contact our customer support team at{' '}
              <a href="mailto:support@store.com" className="text-primary hover:underline">support@store.com</a>
            </p>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
