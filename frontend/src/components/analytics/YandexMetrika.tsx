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

    ((m: Window & { ym?: (...args: unknown[]) => void }, doc: Document, tag: 'script', src: string, name: 'ym') => {
      const existing = Array.from(doc.getElementsByTagName(tag)).find((s) => s.src === src);
      if (existing) return;

      const ymFunc = (...args: unknown[]) => {
        (ymFunc as any).a = (ymFunc as any).a || [];
        (ymFunc as any).a.push(args);
      };

      if (!m[name]) {
        const fn = ymFunc as typeof m.ym;
        fn.l = Number(new Date());
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
