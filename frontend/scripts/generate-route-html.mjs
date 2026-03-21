import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const distDir = path.join(frontendDir, 'dist');
const indexPath = path.join(distDir, 'index.html');
const routeSeoDataPath = path.join(frontendDir, 'src', 'seo', 'routeSeoData.json');

const routeSeoData = JSON.parse(await readFile(routeSeoDataPath, 'utf8'));
const baseHtml = await readFile(indexPath, 'utf8');

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const escapeAttribute = (value) =>
  escapeHtml(value).replaceAll('"', '&quot;');

const upsertMetaByName = (html, name, content) => {
  const escaped = escapeAttribute(content);
  const pattern = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
  const replacement = `<meta name="${name}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
};

const upsertMetaByProperty = (html, property, content) => {
  const escaped = escapeAttribute(content);
  const pattern = new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
  const replacement = `<meta property="${property}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
};

const upsertCanonical = (html, href) => {
  const escaped = escapeAttribute(href);
  const canonicalTag = `<link rel="canonical" href="${escaped}" />`;
  const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;

  if (canonicalPattern.test(html)) {
    return html.replace(canonicalPattern, canonicalTag);
  }

  const robotsPattern = /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i;
  if (robotsPattern.test(html)) {
    return html.replace(robotsPattern, (match) => `${match}\n    ${canonicalTag}`);
  }

  return html;
};

const renderRouteHtml = (routePath, meta) => {
  const canonical = `${routeSeoData.defaultSiteUrl}${routePath}`;
  const image = `${routeSeoData.defaultSiteUrl}${routeSeoData.defaultSeo.imagePath}`;
  let html = baseHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = upsertMetaByName(html, 'description', meta.description);
  html = upsertMetaByName(html, 'robots', meta.robots);
  html = upsertMetaByProperty(html, 'og:title', meta.title);
  html = upsertMetaByProperty(html, 'og:description', meta.description);
  html = upsertMetaByProperty(html, 'og:image', image);
  html = upsertMetaByName(html, 'twitter:title', meta.title);
  html = upsertMetaByName(html, 'twitter:description', meta.description);
  html = upsertMetaByName(html, 'twitter:image', image);
  html = upsertCanonical(html, canonical);

  return html;
};

for (const [routePath, meta] of Object.entries(routeSeoData.routes)) {
  const outputDir = path.join(distDir, routePath.replace(/^\/+/, ''));
  const outputPath = path.join(outputDir, 'index.html');
  const html = renderRouteHtml(routePath, meta);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, html, 'utf8');
}
