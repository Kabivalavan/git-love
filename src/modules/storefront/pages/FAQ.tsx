import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    category: 'Orders & Shipping',
    questions: [
      {
        q: 'How can I track my order?',
        a: 'Once your order is shipped, you will receive an email and SMS with the tracking details. You can also track your order by logging into your account and visiting the "My Orders" section.',
      },
      {
        q: 'What are the shipping charges?',
        a: 'We offer free shipping on all orders above ₹500. For orders below ₹500, a flat shipping fee of ₹50 is charged.',
      },
      {
        q: 'How long does delivery take?',
        a: 'Standard delivery takes 3-7 business days depending on your location. Metro cities typically receive orders within 3-5 days, while other areas may take 5-7 days.',
      },
      {
        q: 'Do you deliver to all locations in India?',
        a: 'Yes, we deliver across India. However, delivery times may vary for remote areas.',
      },
    ],
  },
  {
    category: 'Returns & Refunds',
    questions: [
      {
        q: 'What is your return policy?',
        a: 'We offer a 7-day return policy on most items. Products must be unused, with original tags attached and in original packaging. Some items like intimate wear and customized products are not eligible for return.',
      },
      {
        q: 'How do I return a product?',
        a: 'You can initiate a return from your account under "My Orders". Select the order, click on "Return/Exchange", and follow the instructions. You can either schedule a pickup or drop the item at the nearest collection point.',
      },
      {
        q: 'How long does it take to get a refund?',
        a: 'Once we receive and inspect the returned item, refunds are processed within 5-7 business days. The time for the amount to reflect in your account depends on your payment method.',
      },
      {
        q: 'Can I exchange a product for a different size?',
        a: 'Yes, you can exchange products for a different size or color, subject to availability. Exchanges are free within the 7-day return window.',
      },
    ],
  },
  {
    category: 'Payment',
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept Credit Cards, Debit Cards, Net Banking, UPI (Google Pay, PhonePe, Paytm), and Cash on Delivery (COD).',
      },
      {
        q: 'Is Cash on Delivery available?',
        a: 'Yes, Cash on Delivery is available for most locations. Some remote areas may not have COD service.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes, we use industry-standard SSL encryption and secure payment gateways. We do not store your complete card details on our servers.',
      },
      {
        q: 'What should I do if my payment failed but money was deducted?',
        a: 'If your payment failed but the amount was deducted, it will be automatically refunded to your account within 5-7 business days. If not, please contact our support team.',
      },
    ],
  },
  {
    category: 'Account & Privacy',
    questions: [
      {
        q: 'How do I create an account?',
        a: 'Click on the "Login" button and select "Create Account". You can register using your email address or phone number.',
      },
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'Click on "Login" and then "Forgot Password". Enter your registered email or phone number, and we will send you a reset link.',
      },
      {
        q: 'How is my personal information protected?',
        a: 'We take data privacy seriously. Your personal information is encrypted and stored securely. We never share your data with third parties without your consent. Please read our Privacy Policy for more details.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes, you can request account deletion by contacting our support team. Please note that this action is irreversible and all your data will be permanently deleted.',
      },
    ],
  },
];

export default function FAQ() {
  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground mb-10 text-center">
            Find answers to common questions about shopping with us
          </p>

          <div className="space-y-8">
            {faqs.map((section) => (
              <div key={section.category}>
                <h2 className="text-xl font-semibold mb-4 text-foreground">
                  {section.category}
                </h2>
                <Accordion type="single" collapsible className="space-y-2">
                  {section.questions.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`${section.category}-${index}`}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="text-left hover:no-underline">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center p-6 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Still have questions?</h3>
            <p className="text-muted-foreground mb-4">
              Can't find the answer you're looking for? Please reach out to our support team.
            </p>
            <a
              href="/contact"
              className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
