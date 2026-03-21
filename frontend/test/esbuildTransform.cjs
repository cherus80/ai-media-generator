const { transformSync } = require('esbuild');

const loaders = {
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
};

module.exports = {
  process(sourceText, sourcePath) {
    const extension = sourcePath.slice(sourcePath.lastIndexOf('.'));
    const loader = loaders[extension] || 'tsx';

    const result = transformSync(sourceText, {
      loader,
      format: 'cjs',
      target: 'es2020',
      jsx: 'automatic',
      sourcemap: 'inline',
      sourcefile: sourcePath,
      define: {
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://api.example.test'),
        'import.meta.env.VITE_PUBLIC_BACKEND_URL': JSON.stringify('https://api.example.test'),
        'import.meta.env.VITE_ACTIVATION_ONBOARDING_V1': JSON.stringify('true'),
        'import.meta.env.VITE_APP_NAME': JSON.stringify('ИИ Генератор'),
        '__APP_VERSION__': JSON.stringify('test-version'),
        '__APP_BUILD_DATE__': JSON.stringify('2026-03-21T00:00:00.000Z'),
      },
    });

    return {
      code: result.code,
      map: result.map,
    };
  },
};
