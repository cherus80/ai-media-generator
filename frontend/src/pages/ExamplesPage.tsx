import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getExampleTags, getGenerationExamples } from '../api/content';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { ExampleCard } from '../components/examples/ExampleCard';
import { ExampleCardsSkeleton } from '../components/examples/ExampleCardsSkeleton';
import { useSeo } from '../hooks/useSeo';
import { getSiteOrigin, resolveRouteSeo } from '../seo/routeSeo';
import type { ExampleTagItem, GenerationExampleCardItem } from '../types/content';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

export const ExamplesPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<GenerationExampleCardItem[]>([]);
  const [topItems, setTopItems] = useState<GenerationExampleCardItem[]>([]);
  const [tags, setTags] = useState<ExampleTagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'newest'>('popular');
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useSeo(resolveRouteSeo('/app/examples', getSiteOrigin()));

  useEffect(() => {
    const loadCatalog = async () => {
      setLoading(true);
      setCatalogError(null);
      try {
        const response = await getGenerationExamples({
          tags: selectedTags,
          sort: sortBy,
          page: 1,
          pageSize: 20,
        });
        setItems(response.items);
      } catch {
        setItems([]);
        setCatalogError('Не удалось загрузить каталог примеров.');
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, [reloadToken, selectedTags, sortBy]);

  useEffect(() => {
    const loadTop = async () => {
      try {
        const response = await getGenerationExamples({
          sort: 'popular',
          page: 1,
          pageSize: 6,
        });
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

  const handleUseExample = (example: GenerationExampleCardItem) => {
    navigate(
      `/app/examples/generate?example=${encodeURIComponent(example.slug)}&source=app_examples&v=${example.seo_variant_index ?? 0}`
    );
  };

  const handleRetry = () => {
    setReloadToken((value) => value + 1);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch = (item: GenerationExampleCardItem) => {
      if (!normalizedSearch) {
        return true;
      }
      return (item.title || '').toLowerCase().includes(normalizedSearch);
    };

    const filteredTopItems = topItems.filter(matchesSearch);
    const filteredAllItems = items.filter(matchesSearch);

    if (filteredTopItems.length === 0) {
      return filteredAllItems;
    }

    const topIds = new Set(filteredTopItems.map((item) => item.id));
    return filteredAllItems.filter((item) => !topIds.has(item.id));
  }, [items, topItems, searchQuery]);

  const visibleTopItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) {
      return topItems;
    }
    return topItems.filter((item) => (item.title || '').toLowerCase().includes(normalizedSearch));
  }, [topItems, searchQuery]);

  const hasResults = useMemo(
    () => visibleTopItems.length > 0 || filteredItems.length > 0,
    [filteredItems.length, visibleTopItems.length]
  );

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
              <ExampleCardsSkeleton testId="examples-skeleton" />
            ) : catalogError ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center">
                <p className="text-slate-700 font-semibold mb-2">
                  {catalogError}
                </p>
                <p className="text-sm text-slate-500 mb-5">
                  Проверьте соединение и попробуйте ещё раз.
                </p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Повторить
                </button>
              </div>
            ) : items.length === 0 ? (
              emptyState
            ) : (
              <div className="space-y-10">
                {visibleTopItems.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-slate-900">
                        ТОП 6
                      </h2>
                      <span className="text-sm text-slate-500">
                        Обновляется по активности пользователей
                      </span>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 justify-items-center">
                      {visibleTopItems.map((item) => (
                        <ExampleCard
                          key={item.id}
                          item={item}
                          onUse={() => handleUseExample(item)}
                          resolveImageUrl={resolveImageUrl}
                          imageClassName="w-full h-60 object-contain bg-slate-50"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
                  <div className="flex flex-wrap gap-2 md:flex-1">
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
                  <div className="w-full md:w-72">
                    <label htmlFor="examples-search" className="sr-only">
                      Поиск по названию примера
                    </label>
                    <input
                      id="examples-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск по названию примера"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
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

                {!hasResults ? (
                  <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
                    По выбранным фильтрам нет результатов.
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 justify-items-center">
                    {filteredItems.map((item) => (
                      <ExampleCard
                        key={item.id}
                        item={item}
                        onUse={() => handleUseExample(item)}
                        resolveImageUrl={resolveImageUrl}
                        imageClassName="w-full h-60 object-contain bg-slate-50"
                      />
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
