import React from 'react';

import type { GenerationExampleCardItem } from '../../types/content';

type ExampleCardProps = {
  item: GenerationExampleCardItem;
  onUse: () => void;
  resolveImageUrl: (url: string) => string;
  ctaLabel?: string;
  imageClassName?: string;
  className?: string;
};

export const ExampleCard: React.FC<ExampleCardProps> = ({
  item,
  onUse,
  resolveImageUrl,
  ctaLabel = 'Сгенерировать по этому образцу',
  imageClassName = 'w-full h-60 object-cover bg-slate-100',
  className = 'bg-white rounded-2xl shadow overflow-hidden flex flex-col max-w-[360px] w-full',
}) => {
  const primaryUrl = React.useMemo(
    () => resolveImageUrl(item.thumbnail_url || item.image_url),
    [item.image_url, item.thumbnail_url, resolveImageUrl]
  );
  const fallbackUrl = React.useMemo(
    () => resolveImageUrl(item.image_url),
    [item.image_url, resolveImageUrl]
  );
  const [imageSrc, setImageSrc] = React.useState(primaryUrl);

  React.useEffect(() => {
    setImageSrc(primaryUrl);
  }, [primaryUrl]);

  return (
    <div className={className}>
      <div className="relative">
        <img
          src={imageSrc}
          alt={item.title || 'Пример генерации'}
          className={imageClassName}
          loading="lazy"
          decoding="async"
          width={720}
          height={720}
          onError={() => {
            if (imageSrc !== fallbackUrl) {
              setImageSrc(fallbackUrl);
            }
          }}
        />
        <div className="absolute top-3 right-3 bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
          {item.uses_count} запусков
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h3 className="text-lg font-bold text-slate-900">
          {item.title || 'Без названия'}
        </h3>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {item.tags.map((tag) => (
              <span
                key={`${item.id}-${tag}`}
                className="px-2 py-1 rounded-full bg-slate-100"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onUse}
          className="mt-auto px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold text-sm hover:shadow-lg transition"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};
