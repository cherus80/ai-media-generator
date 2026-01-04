import { useEffect } from 'react';

interface SeoOptions {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, unknown>;
}

const ensureMeta = (key: string, content: string, attr: 'name' | 'property' = 'name') => {
  const selector = `meta[${attr}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const ensureLink = (rel: string, href: string) => {
  const selector = `link[rel="${rel}"]`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

export const useSeo = ({
  title,
  description,
  canonical,
  image,
  type = 'website',
  noIndex = false,
  jsonLd,
}: SeoOptions) => {
  useEffect(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const resolvedCanonical = canonical || (typeof window !== 'undefined' ? window.location.href : '');
    const resolvedImage = image || `${baseUrl}/logo.png`;

    document.title = title;
    ensureMeta('description', description);
    ensureMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    ensureMeta('og:title', title, 'property');
    ensureMeta('og:description', description, 'property');
    ensureMeta('og:type', type, 'property');
    ensureMeta('og:url', resolvedCanonical, 'property');
    ensureMeta('og:image', resolvedImage, 'property');

    ensureMeta('twitter:card', 'summary_large_image');
    ensureMeta('twitter:title', title);
    ensureMeta('twitter:description', description);
    ensureMeta('twitter:image', resolvedImage);

    if (resolvedCanonical) {
      ensureLink('canonical', resolvedCanonical);
    }

    const existing = document.getElementById('seo-jsonld');
    if (jsonLd) {
      if (existing) {
        existing.remove();
      }
      const script = document.createElement('script');
      script.id = 'seo-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    } else if (existing) {
      existing.remove();
    }
  }, [title, description, canonical, image, type, noIndex, jsonLd]);
};
