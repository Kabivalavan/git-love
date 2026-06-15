import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ReturnPolicy() {
  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Return & Refund Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold">7-Day Returns</p>
                <p className="text-sm text-muted-foreground">Easy return window</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold">Free Exchanges</p>
                <p className="text-sm text-muted-foreground">No extra charges</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold">Quick Refunds</p>
                <p className="text-sm text-muted-foreground">5-7 business days</p>
              </CardContent>
            </Card>
          </div>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold mb-4">Return Eligibility</h2>
            <p className="text-muted-foreground mb-4">
              Items are eligible for return within 7 days of delivery, provided they meet the following conditions:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
                <h3 className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400 mb-2">
                  <CheckCircle className="h-4 w-4" /> Eligible for Return
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Unused and unworn items</li>
                  <li>• Original tags attached</li>
                  <li>• Original packaging intact</li>
                  <li>• Defective or damaged items</li>
                  <li>• Wrong item received</li>
                </ul>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4">
                <h3 className="flex items-center gap-2 font-medium text-red-700 dark:text-red-400 mb-2">
                  <XCircle className="h-4 w-4" /> Not Eligible
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Used or washed items</li>
                  <li>• Items without tags</li>
                  <li>• Intimate wear & swimwear</li>
                  <li>• Customized products</li>
                  <li>• Sale items (final sale)</li>
                </ul>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-4 mt-8">How to Return</h2>
            <ol className="list-decimal list-inside text-muted-foreground space-y-3 mb-4">
              <li>Go to "My Orders" in your account</li>
              <li>Select the order and click "Return/Exchange"</li>
              <li>Choose the items you want to return</li>
              <li>Select the reason for return</li>
              <li>Schedule a pickup or drop at nearest center</li>
            </ol>

            <h2 className="text-xl font-semibold mb-4 mt-8">Refund Process</h2>
            <p className="text-muted-foreground mb-4">
              Once we receive and inspect the returned item, we will process your refund.
            </p>
            <div className="bg-muted rounded-lg p-4 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Payment Method</th>
                    <th className="text-left py-2">Refund Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2">UPI / Net Banking</td>
                    <td className="py-2">3-5 business days</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2">Credit / Debit Card</td>
                    <td className="py-2">5-7 business days</td>
                  </tr>
                  <tr>
                    <td className="py-2">Cash on Delivery</td>
                    <td className="py-2">7-10 business days (bank transfer)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold mb-4 mt-8">Exchange Policy</h2>
            <p className="text-muted-foreground mb-4">
              You can exchange items for a different size or color, subject to availability. 
              Exchanges are processed free of charge within the 7-day return window.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Contact Us</h2>
            <p className="text-muted-foreground">
              For return-related queries, please contact our customer support at{' '}
              <a href="mailto:returns@store.com" className="text-primary hover:underline">returns@store.com</a>
            </p>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
