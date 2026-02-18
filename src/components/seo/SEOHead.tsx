import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  type?: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

export function SEOHead({ title, description, canonical, type = 'website', image, noindex, jsonLd }: SEOHeadProps) {
  useEffect(() => {
    // Title
    document.title = title.length > 60 ? title.slice(0, 57) + '...' : title;

    // Meta tags
    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    const desc = description.length > 160 ? description.slice(0, 157) + '...' : description;
    setMeta('description', desc);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // OG
    setMeta('og:title', title, true);
    setMeta('og:description', desc, true);
    setMeta('og:type', type, true);
    if (image) setMeta('og:image', image, true);
    if (canonical) setMeta('og:url', canonical, true);

    // Twitter
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
    if (image) setMeta('twitter:image', image);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // JSON-LD
    const existingLd = document.getElementById('seo-jsonld');
    if (existingLd) existingLd.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'seo-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...jsonLd });
      document.head.appendChild(script);
    }

    return () => {
      const ld = document.getElementById('seo-jsonld');
      if (ld) ld.remove();
    };
  }, [title, description, canonical, type, image, noindex, jsonLd]);

  return null;
}
