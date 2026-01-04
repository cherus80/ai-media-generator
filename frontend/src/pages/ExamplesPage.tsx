import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { getGenerationExamples, getExampleTags, incrementExampleUse } from '../api/content';
import type { GenerationExampleItem, ExampleTagItem } from '../types/content';
import { useSeo } from '../hooks/useSeo';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

export const ExamplesPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<GenerationExampleItem[]>([]);
  const [topItems, setTopItems] = useState<GenerationExampleItem[]>([]);
  const [tags, setTags] = useState<ExampleTagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'popular' | 'newest'>('popular');
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru';

  useSeo({
    title: 'Примеры генераций — AI Generator',
    description: 'Библиотека лучших примеров генераций. Выберите стиль и запустите генерацию по образцу.',
    canonical: `${baseUrl}/app/examples`,
    image: `${baseUrl}/logo.png`,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await getGenerationExamples({
          tags: selectedTags,
          sort: sortBy,
        });
        setItems(response.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedTags, sortBy]);

  useEffect(() => {
    const loadTop = async () => {
      try {
        const response = await getGenerationExamples({ sort: 'popular', limit: 6 });
        setTopItems(response.items);
      } catch {
        setTopItems([]);
      }
    };
    loadTop();
  }, []);

  useEffect(() => {
    const loadTags = async () => {
      setLoadingFilters(true);
      try {
        const response = await getExampleTags();
        setTags(response.items);
      } catch {
        setTags([]);
      } finally {
        setLoadingFilters(false);
      }
    };
    loadTags();
  }, []);

  const handleUseExample = async (example: GenerationExampleItem) => {
    incrementExampleUse(example.id).catch(() => undefined);
    const prompt = encodeURIComponent(example.prompt);
    navigate(`/editing?prompt=${prompt}`);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const filteredItems = useMemo(() => {
    if (topItems.length === 0) {
      return items;
    }
    const topIds = new Set(topItems.map((item) => item.id));
    return items.filter((item) => !topIds.has(item.id));
  }, [items, topItems]);

  const emptyState = useMemo(
    () => (
      <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
        Примеры появятся после публикации в админ-панели.
      </div>
    ),
    []
  );

  return (
    <AuthGuard>
      <Layout title="Примеры генераций" subtitle="Библиотека образцов для вдохновения">
        <section className="py-12">
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
            <div className="space-y-10">
              {topItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-900">
                      ТОП 6
                    </h2>
                    <span className="text-sm text-slate-500">
                      Обновляется по активности пользователей
                    </span>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {topItems.map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
                        <div className="relative">
                          <img
                            src={resolveImageUrl(item.image_url)}
                            alt={item.title || 'Пример генерации'}
                            className="w-full h-56 object-contain bg-slate-50"
                          />
                          <div className="absolute top-3 right-3 bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
                            {item.uses_count} запусков
                          </div>
                        </div>
                        <div className="p-5 flex flex-col gap-3 flex-1">
                          <h3 className="text-lg font-bold text-slate-900">
                            {item.title || 'Без названия'}
                          </h3>
                          <p className="text-sm text-slate-600 line-clamp-4 whitespace-pre-line">
                            {item.prompt}
                          </p>
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
                            onClick={() => handleUseExample(item)}
                            className="mt-auto px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold text-sm hover:shadow-lg transition"
                          >
                            Сгенерировать по этому образцу
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {loadingFilters ? (
                    <span className="text-sm text-slate-400">Загружаем метки...</span>
                  ) : tags.length === 0 ? (
                    <span className="text-sm text-slate-400">Метки не заданы</span>
                  ) : (
                    tags.map((tag) => (
                      <button
                        key={tag.tag}
                        onClick={() => toggleTag(tag.tag)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                          selectedTags.includes(tag.tag)
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {tag.tag} ({tag.count})
                      </button>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-500">Сортировка:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'popular' | 'newest')}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="popular">По востребованности</option>
                    <option value="newest">Сначала новые</option>
                  </select>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="text-xs text-primary-600 font-semibold"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
                  По выбранным фильтрам нет результатов.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
                      <div className="relative">
                        <img
                          src={resolveImageUrl(item.image_url)}
                          alt={item.title || 'Пример генерации'}
                          className="w-full h-56 object-contain bg-slate-50"
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
          )}
        </div>
        </section>
      </Layout>
    </AuthGuard>
  );
};
