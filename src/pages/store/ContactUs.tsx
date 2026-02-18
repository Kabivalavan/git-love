import { useState, useEffect } from 'react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { StoreInfo } from '@/types/database';

export default function ContactUs() {
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStoreInfo();
  }, []);

  const fetchStoreInfo = async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'store_info')
      .single();
    if (data) setStoreInfo(data.value as unknown as StoreInfo);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      toast({
        title: 'Message Sent!',
        description: 'We will get back to you within 24 hours.',
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Contact Us</h1>
          <p className="text-muted-foreground mb-10 text-center">
            We'd love to hear from you. Get in touch with us!
          </p>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Address</p>
                      <p className="text-sm text-muted-foreground">
                        {storeInfo?.address || '123 Main Street, City, State - 123456'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Phone</p>
                      <p className="text-sm text-muted-foreground">
                        {storeInfo?.contact_phone || '+91 9876543210'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Email</p>
                      <p className="text-sm text-muted-foreground">
                        {storeInfo?.contact_email || 'support@store.com'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Business Hours</p>
                      <p className="text-sm text-muted-foreground">
                        Mon - Sat: 9:00 AM - 8:00 PM<br />
                        Sunday: 10:00 AM - 6:00 PM
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Send us a Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Your Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                      {isSubmitting ? (
                        'Sending...'
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
