import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';

export default function TermsConditions() {
  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms & Conditions</h1>
          <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing and using this website, you accept and agree to be bound by these Terms and Conditions. 
              If you do not agree to these terms, please do not use our services.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">2. Eligibility</h2>
            <p className="text-muted-foreground mb-4">
              You must be at least 18 years old to use this website. By using our services, you represent that 
              you are at least 18 years of age and have the legal capacity to enter into these terms.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">3. Account Registration</h2>
            <p className="text-muted-foreground mb-4">
              When you create an account with us, you must provide accurate and complete information. 
              You are responsible for maintaining the confidentiality of your account credentials and 
              for all activities that occur under your account.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">4. Products and Pricing</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>All product descriptions and images are as accurate as possible</li>
              <li>Prices are subject to change without notice</li>
              <li>We reserve the right to limit quantities</li>
              <li>Promotional offers are subject to terms and availability</li>
            </ul>

            <h2 className="text-xl font-semibold mb-4 mt-8">5. Orders and Payment</h2>
            <p className="text-muted-foreground mb-4">
              By placing an order, you are making an offer to purchase. We reserve the right to accept or 
              decline your order for any reason. Payment must be made at the time of order or upon delivery 
              (for COD orders).
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">6. Shipping and Delivery</h2>
            <p className="text-muted-foreground mb-4">
              Delivery times are estimates and not guaranteed. We are not responsible for delays caused by 
              shipping carriers or circumstances beyond our control. Risk of loss passes to you upon delivery.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">7. Returns and Refunds</h2>
            <p className="text-muted-foreground mb-4">
              Returns are subject to our Return Policy. Please review our Return Policy for detailed information 
              about eligibility, process, and refund timelines.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">8. Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              All content on this website, including text, graphics, logos, images, and software, is our property 
              and is protected by intellectual property laws. You may not use, reproduce, or distribute any 
              content without our written permission.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">9. User Conduct</h2>
            <p className="text-muted-foreground mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Use the website for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the website</li>
              <li>Interfere with the proper working of the website</li>
              <li>Submit false or misleading information</li>
              <li>Engage in any form of fraud or abuse</li>
            </ul>

            <h2 className="text-xl font-semibold mb-4 mt-8">10. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, 
              special, or consequential damages arising from your use of our services.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">11. Indemnification</h2>
            <p className="text-muted-foreground mb-4">
              You agree to indemnify and hold us harmless from any claims, damages, or expenses arising 
              from your violation of these terms or your use of our services.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">12. Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These terms shall be governed by and construed in accordance with the laws of India. 
              Any disputes shall be subject to the exclusive jurisdiction of the courts in [City], India.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">13. Changes to Terms</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to modify these terms at any time. Changes will be effective immediately 
              upon posting. Your continued use of the website constitutes acceptance of the modified terms.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">14. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms & Conditions, please contact us at{' '}
              <a href="mailto:legal@store.com" className="text-primary hover:underline">legal@store.com</a>
            </p>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
