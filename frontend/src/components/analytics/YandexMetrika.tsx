import React from 'react';

declare global {
  interface Window {
    ym?: (...args: any[]) => void;
  }
}

export const YandexMetrika: React.FC = () => {
  const counterId = import.meta.env.VITE_YANDEX_METRIKA_ID;

  React.useEffect(() => {
    if (!counterId) return;
    if (document.getElementById('ym-tag')) return;

    type YMFunction = ((...args: unknown[]) => void) & { a?: unknown[]; l?: number };

    ((m: Window & { ym?: YMFunction }, doc: Document, tag: 'script', src: string, name: 'ym') => {
      const existing = Array.from(doc.getElementsByTagName(tag)).find((s) => s.src === src);
      if (existing) return;

      let fn: YMFunction;
      if (m[name]) {
        fn = m[name] as YMFunction;
      } else {
        fn = ((...args: unknown[]) => {
          fn.a = fn.a || [];
          fn.a.push(args);
        }) as YMFunction;
        fn.l = Date.now();
        m[name] = fn;
      }

      const scriptEl = doc.createElement(tag);
      const firstScript = doc.getElementsByTagName(tag)[0];
      scriptEl.async = true;
      scriptEl.src = `${src}?id=${counterId}`;
      firstScript?.parentNode?.insertBefore(scriptEl, firstScript);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    if (window.ym) {
      window.ym(Number(counterId), 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        accurateTrackBounce: true,
        trackLinks: true,
      });
    }

    return () => {
      // ym snippet не требует очистки; скрипт оставляем
    };
  }, [counterId]);

  if (!counterId) return null;

  return (
    <noscript>
      <div>
        <img
          src={`https://mc.yandex.ru/watch/${counterId}`}
          style={{ position: 'absolute', left: '-9999px' }}
          alt=""
        />
      </div>
    </noscript>
  );
};
