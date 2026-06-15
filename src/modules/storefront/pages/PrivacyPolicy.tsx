import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';

export default function PrivacyPolicy() {
  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold mb-4">Introduction</h2>
            <p className="text-muted-foreground mb-4">
              We respect your privacy and are committed to protecting your personal data. This privacy policy 
              explains how we collect, use, and safeguard your information when you use our e-commerce platform.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Information We Collect</h2>
            <p className="text-muted-foreground mb-4">We collect the following types of information:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li><strong>Personal Information:</strong> Name, email address, phone number, shipping address</li>
              <li><strong>Payment Information:</strong> Payment method details (processed securely via payment gateways)</li>
              <li><strong>Account Information:</strong> Login credentials, order history, preferences</li>
              <li><strong>Usage Data:</strong> Browsing behavior, device information, IP address</li>
            </ul>

            <h2 className="text-xl font-semibold mb-4 mt-8">How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">We use your information to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Provide customer support</li>
              <li>Improve our products and services</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Prevent fraud and ensure security</li>
            </ul>

            <h2 className="text-xl font-semibold mb-4 mt-8">Data Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement appropriate security measures to protect your personal data. All sensitive information 
              is encrypted using SSL technology. Payment transactions are processed through secure payment gateways 
              and we do not store your complete card details.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Cookies</h2>
            <p className="text-muted-foreground mb-4">
              We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, 
              and personalize content. You can control cookie preferences through your browser settings.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">
              We may share your information with trusted third parties who assist us in operating our website, 
              conducting our business, or servicing you, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Payment processors (Razorpay, PayU)</li>
              <li>Shipping and logistics partners</li>
              <li>Analytics providers</li>
              <li>Email service providers</li>
            </ul>

            <h2 className="text-xl font-semibold mb-4 mt-8">Your Rights</h2>
            <p className="text-muted-foreground mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Data portability</li>
            </ul>

            <h2 className="text-xl font-semibold mb-4 mt-8">Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your personal data only for as long as necessary to fulfill the purposes outlined in this 
              policy, unless a longer retention period is required by law.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Changes to This Policy</h2>
            <p className="text-muted-foreground mb-4">
              We may update this privacy policy from time to time. We will notify you of any changes by posting 
              the new policy on this page and updating the "Last updated" date.
            </p>

            <h2 className="text-xl font-semibold mb-4 mt-8">Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this privacy policy, please contact us at{' '}
              <a href="mailto:privacy@store.com" className="text-primary hover:underline">privacy@store.com</a>
            </p>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
