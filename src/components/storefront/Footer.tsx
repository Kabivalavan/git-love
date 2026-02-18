import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { StoreInfo, SocialLinks } from '@/types/database';

export function Footer() {
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['store_info', 'social_links']);
    
    data?.forEach((item) => {
      if (item.key === 'store_info') setStoreInfo(item.value as unknown as StoreInfo);
      if (item.key === 'social_links') setSocialLinks(item.value as unknown as SocialLinks);
    });
  };

  return (
    <footer className="bg-slate-900 text-slate-200">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">{storeInfo?.name || 'Our Store'}</h3>
            <p className="text-slate-400 text-sm mb-4">
              {storeInfo?.tagline || 'Your one-stop shop for quality products.'}
            </p>
            <div className="flex gap-3">
              {socialLinks?.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {socialLinks?.twitter && (
                <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              {socialLinks?.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                  <Youtube className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/products" className="text-slate-400 hover:text-white transition-colors">Shop All</Link></li>
              <li><Link to="/products?featured=true" className="text-slate-400 hover:text-white transition-colors">Featured Products</Link></li>
              <li><Link to="/products?bestseller=true" className="text-slate-400 hover:text-white transition-colors">Best Sellers</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Customer Service</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/account" className="text-slate-400 hover:text-white transition-colors">My Account</Link></li>
              <li><Link to="/account/orders" className="text-slate-400 hover:text-white transition-colors">Track Order</Link></li>
              <li><Link to="/shipping-policy" className="text-slate-400 hover:text-white transition-colors">Shipping Policy</Link></li>
              <li><Link to="/return-policy" className="text-slate-400 hover:text-white transition-colors">Return Policy</Link></li>
              <li><Link to="/contact" className="text-slate-400 hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              {storeInfo?.contact_email && (
                <li className="flex items-center gap-2 text-slate-400">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${storeInfo.contact_email}`} className="hover:text-white transition-colors">
                    {storeInfo.contact_email}
                  </a>
                </li>
              )}
              {storeInfo?.contact_phone && (
                <li className="flex items-center gap-2 text-slate-400">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${storeInfo.contact_phone}`} className="hover:text-white transition-colors">
                    {storeInfo.contact_phone}
                  </a>
                </li>
              )}
              {storeInfo?.address && (
                <li className="flex items-start gap-2 text-slate-400">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>{storeInfo.address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {storeInfo?.name || 'Store'}. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
          {/* Hidden admin link */}
          <Link to="/admin/login" className="text-slate-600 text-xs hover:text-slate-400 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
