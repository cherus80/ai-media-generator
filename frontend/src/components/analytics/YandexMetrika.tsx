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

    (function (m, e, t, r, i, k, a) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      m[i] =
        m[i] ||
        function () {
          // eslint-disable-next-line prefer-rest-params
          (m[i].a = m[i].a || []).push(arguments);
        };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      m[i].l = 1 * new Date();
      for (let j = 0; j < e.scripts.length; j++) {
        // @ts-ignore
        if (e.scripts[j].src === r) return;
      }
      k = e.createElement(t);
      a = e.getElementsByTagName(t)[0];
      k.async = true;
      k.src = `${r}?id=${counterId}`;
      // @ts-ignore
      a.parentNode.insertBefore(k, a);
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
