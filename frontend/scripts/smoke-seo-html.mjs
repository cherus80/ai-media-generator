import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const distDir = path.resolve(__dirname, '..', 'dist');
const routeSeoData = JSON.parse(
  await readFile(path.join(frontendDir, 'src', 'seo', 'routeSeoData.json'), 'utf8')
);

const routes = [
  {
    path: '/',
    title: routeSeoData.defaultSeo.title,
    description: routeSeoData.defaultSeo.description,
    robots: routeSeoData.defaultSeo.robots,
    canonical: null,
  },
  ...Object.entries(routeSeoData.routes).map(([routePath, meta]) => ({
    path: routePath,
    title: meta.title,
    description: meta.description,
    robots: meta.robots,
    canonical: `${routeSeoData.defaultSiteUrl}${routePath}`,
  })),
];

const extractTag = (html, pattern, label, routePath) => {
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`${routePath}: missing ${label}`);
  }
  return match[1].trim();
};

const resolveFilePath = async (pathname) => {
  const relativePath = pathname === '/' ? '' : pathname.replace(/^\/+/, '');
  const candidates = [
    path.join(distDir, relativePath),
    path.join(distDir, relativePath, 'index.html'),
    path.join(distDir, 'index.html'),
  ];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) {
        return candidate;
      }
    } catch {
      // ignore and continue
    }
  }

  return path.join(distDir, 'index.html');
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const filePath = await resolveFilePath(url.pathname);
    const body = await readFile(filePath);
    const contentType = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(body);
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error));
  }
});

const listen = () =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(address.port);
    });
  });

const close = () =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const run = async () => {
  const port = await listen();
  const errors = [];
  const results = [];

  for (const route of routes) {
    const response = await fetch(`http://127.0.0.1:${port}${route.path}`);
    const html = await response.text();

    try {
      const title = extractTag(html, /<title>([^<]+)<\/title>/i, 'title', route.path);
      const robots = extractTag(
        html,
        /<meta\s+name="robots"\s+content="([^"]+)"\s*\/?>/i,
        'meta robots',
        route.path
      );
      const description = extractTag(
        html,
        /<meta\s+name="description"\s+content="([^"]+)"\s*\/?>/i,
        'meta description',
        route.path
      );
      const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/i);
      const canonical = canonicalMatch ? canonicalMatch[1].trim() : null;

      if (title !== route.title) {
        throw new Error(`${route.path}: title mismatch: expected "${route.title}", got "${title}"`);
      }
      if (robots !== route.robots) {
        throw new Error(`${route.path}: robots mismatch: expected "${route.robots}", got "${robots}"`);
      }
      if (description !== route.description) {
        throw new Error(`${route.path}: description mismatch: expected "${route.description}", got "${description}"`);
      }
      if (route.canonical !== canonical) {
        throw new Error(`${route.path}: canonical mismatch: expected "${route.canonical}", got "${canonical}"`);
      }

      results.push(`${route.path} OK`);
    } catch (error) {
      errors.push(error.message);
    }
  }

  await close();

  if (errors.length > 0) {
    console.error('SEO raw HTML smoke check FAILED');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('SEO raw HTML smoke check PASSED');
  for (const result of results) {
    console.log(`- ${result}`);
  }
};

run().catch(async (error) => {
  console.error(error);
  try {
    await close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
