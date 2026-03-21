import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const label = process.argv[2] ?? 'snapshot';
const distDir = resolve(process.cwd(), 'dist');
const manifestPath = resolve(distDir, '.vite', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const routeModules = {
  '/': 'src/routes/publicRoutes.ts',
  '/login': 'src/routes/authRoutes.ts',
};

const entryKey =
  Object.entries(manifest).find(([, chunk]) => chunk.isEntry)?.[0] ?? 'index.html';

const fileSize = (file) => statSync(resolve(distDir, file)).size;

const isJsFile = (file) => file.endsWith('.js');

const walkFiles = (key, seen = new Set()) => {
  const chunk = manifest[key];
  if (!chunk) {
    return seen;
  }
  if (chunk.file && isJsFile(chunk.file)) {
    seen.add(chunk.file);
  }
  for (const imported of chunk.imports ?? []) {
    walkFiles(imported, seen);
  }
  return seen;
};

const entryFiles = walkFiles(entryKey);

const routeExtraFiles = (routeKey) => {
  const routeEntry = manifest[routeKey];
  if (!routeEntry) {
    return new Set();
  }
  const allRouteFiles = walkFiles(routeKey);
  return new Set([...allRouteFiles].filter((file) => !entryFiles.has(file)));
};

const sumBytes = (files) => [...files].reduce((acc, file) => acc + fileSize(file), 0);

const topJsChunks = Object.values(manifest)
  .filter((chunk) => chunk.file && isJsFile(chunk.file))
  .map((chunk) => ({ file: chunk.file, bytes: fileSize(chunk.file) }))
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 10);

const routeMetrics = Object.entries(routeModules).map(([route, routeKey]) => {
  const extraFiles = routeExtraFiles(routeKey);
  return {
    route,
    entry_bytes: sumBytes(entryFiles),
    route_extra_bytes: sumBytes(extraFiles),
    initial_js_bytes: sumBytes(entryFiles) + sumBytes(extraFiles),
    entry_files: [...entryFiles].sort(),
    route_extra_files: [...extraFiles].sort(),
  };
});

const payload = {
  label,
  entry_files: [...entryFiles].sort(),
  largest_js_chunks: topJsChunks,
  routes: routeMetrics,
};

console.log(JSON.stringify(payload, null, 2));
