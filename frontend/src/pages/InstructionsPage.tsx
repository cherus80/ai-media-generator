import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/common/PublicLayout';
import { getInstructions } from '../api/content';
import type { InstructionItem, InstructionType } from '../types/content';
import { useSeo } from '../hooks/useSeo';

const TYPE_LABELS: Record<InstructionType, string> = {
  video: 'Видео-Инструкции',
  text: 'Текстовые инструкции',
};

const toEmbedUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace('www.', '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = url.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : rawUrl;
    }
    if (host === 'youtu.be') {
      const videoId = url.pathname.replace('/', '');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : rawUrl;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
};

export const InstructionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: InstructionType = tabParam === 'text' ? 'text' : 'video';
  const [items, setItems] = useState<InstructionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru';
  const description =
    'Видео и текстовые инструкции по использованию AI Generator: как загрузить фото и получить лучший результат.';

  useSeo({
    title: 'Инструкции по использованию — AI Generator',
    description,
    canonical: `${baseUrl}/instructions`,
    image: `${baseUrl}/logo.png`,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await getInstructions(activeTab);
        setItems(response.items);
      } catch (err) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab]);

  const tabs = useMemo(
    () =>
      (['video', 'text'] as InstructionType[]).map((type) => (
        <button
          key={type}
          onClick={() => setSearchParams({ tab: type })}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            activeTab === type
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {TYPE_LABELS[type]}
        </button>
      )),
    [activeTab, setSearchParams]
  );

  return (
    <PublicLayout>
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Инструкции по использованию приложения
            </h1>
            <p className="text-slate-500 mt-3 text-base sm:text-lg">
              Посмотрите видео или прочитайте короткие советы, чтобы получать лучший результат.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {tabs}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
              Загружаем инструкции...
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
              Пока нет опубликованных инструкций.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl shadow p-6">
                  <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-slate-500 mt-1 mb-3">{item.description}</p>
                  )}
                  {activeTab === 'video' ? (
                    <div className="space-y-3">
                      <div className="relative pb-[56.25%] rounded-xl overflow-hidden border border-slate-200">
                        <iframe
                          src={toEmbedUrl(item.content)}
                          title={item.title}
                          className="absolute inset-0 w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
                      >
                        Открыть видео в новой вкладке
                      </a>
                    </div>
                  ) : (
                    <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                      {item.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
};
