import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { useGlobalStore } from '@/hooks/useGlobalStore';

export function Footer() {
  const { storeInfo, socialLinks } = useGlobalStore();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{storeInfo?.name || 'Our Store'}</h3>
            <p className="text-primary-foreground/70 text-sm mb-4">
              {storeInfo?.tagline || 'Your one-stop shop for quality products.'}
            </p>
            <div className="flex gap-3">
              {socialLinks?.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {socialLinks?.twitter && (
                <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              {socialLinks?.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                  <Youtube className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Home</Link></li>
              <li><Link to="/products" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Shop All</Link></li>
              <li><Link to="/products?featured=true" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Featured Products</Link></li>
              <li><Link to="/products?bestseller=true" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Best Sellers</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Customer Service</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/account" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">My Account</Link></li>
              <li><Link to="/account/orders" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Track Order</Link></li>
              <li><Link to="/shipping-policy" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Shipping Policy</Link></li>
              <li><Link to="/return-policy" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Return Policy</Link></li>
              <li><Link to="/contact" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              {storeInfo?.contact_email && (
                <li className="flex items-center gap-2 text-primary-foreground/70">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${storeInfo.contact_email}`} className="hover:text-primary-foreground transition-colors">{storeInfo.contact_email}</a>
                </li>
              )}
              {storeInfo?.contact_phone && (
                <li className="flex items-center gap-2 text-primary-foreground/70">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${storeInfo.contact_phone}`} className="hover:text-primary-foreground transition-colors">{storeInfo.contact_phone}</a>
                </li>
              )}
              {storeInfo?.address && (
                <li className="flex items-start gap-2 text-primary-foreground/70">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>{storeInfo.address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/50">© {new Date().getFullYear()} {storeInfo?.name || 'Store'}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-sm text-primary-foreground/50">
            <Link to="/privacy-policy" className="hover:text-primary-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary-foreground transition-colors">Terms of Service</Link>
          </div>
          <Link to="/admin/login" className="text-primary-foreground/30 text-xs hover:text-primary-foreground/60 transition-colors">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
