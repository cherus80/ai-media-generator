import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/common/PublicLayout';
import { getGenerationExamples, incrementExampleUse } from '../api/content';
import type { GenerationExampleItem } from '../types/content';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

export const ExamplesPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<GenerationExampleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await getGenerationExamples();
        setItems(response.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUseExample = async (example: GenerationExampleItem) => {
    incrementExampleUse(example.id).catch(() => undefined);
    const prompt = encodeURIComponent(example.prompt);
    navigate(`/editing?prompt=${prompt}`);
  };

  const emptyState = useMemo(
    () => (
      <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
        Примеры появятся после публикации в админ-панели.
      </div>
    ),
    []
  );

  return (
    <PublicLayout>
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Примеры генераций
            </h1>
            <p className="text-slate-500 mt-3 text-base sm:text-lg">
              Выберите понравившийся пример и запустите генерацию по его промпту.
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
              Загружаем примеры...
            </div>
          ) : items.length === 0 ? (
            emptyState
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
                  <div className="relative">
                    <img
                      src={resolveImageUrl(item.image_url)}
                      alt={item.title || 'Пример генерации'}
                      className="w-full h-56 object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
                      {item.uses_count} запусков
                    </div>
                  </div>
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {item.title || 'Без названия'}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-5 whitespace-pre-line">
                      {item.prompt}
                    </p>
                    <button
                      onClick={() => handleUseExample(item)}
                      className="mt-auto px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold text-sm hover:shadow-lg transition"
                    >
                      Сгенерировать по этому образцу
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
};
