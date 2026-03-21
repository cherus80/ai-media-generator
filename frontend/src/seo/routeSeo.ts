import type { SeoOptions } from '../hooks/useSeo';
import routeSeoData from './routeSeoData.json';

export const DEFAULT_SITE_URL = routeSeoData.defaultSiteUrl;
export const DEFAULT_SEO = routeSeoData.defaultSeo;

export type SeoRoutePath =
  | '/login'
  | '/register'
  | '/forgot-password'
  | '/app'
  | '/app/about'
  | '/app/examples'
  | '/app/instructions'
  | '/pricing'
  | '/privacy'
  | '/contacts';

type RouteSeoDefinition = {
  title: string;
  description: string;
  robots: string;
};

const ROUTE_SEO = routeSeoData.routes as Record<SeoRoutePath, RouteSeoDefinition>;

export const getSiteOrigin = () =>
  typeof window !== 'undefined' ? window.location.origin : DEFAULT_SITE_URL;

export const resolveRouteSeo = (
  path: SeoRoutePath,
  origin: string = DEFAULT_SITE_URL
): SeoOptions => {
  const route = ROUTE_SEO[path];

  return {
    title: route.title,
    description: route.description,
    canonical: `${origin}${path}`,
    image: `${origin}${DEFAULT_SEO.imagePath}`,
    noIndex: route.robots === 'noindex,follow',
  };
};
