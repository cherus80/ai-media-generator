import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getAdminExamples,
  createExample,
  updateExample,
  deleteExample,
  uploadExampleImage,
} from '../../api/admin';
import { getExampleTags } from '../../api/content';
import { FileUpload } from '../common/FileUpload';
import type { GenerationExampleAdminItem } from '../../types/content';
import { getUploadErrorMessage } from '../../utils/uploadErrors';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

interface DraftExample extends GenerationExampleAdminItem {
  draftSlug: string;
  draftTitle: string;
  draftDescription: string;
  draftPrompt: string;
  draftImageUrl: string;
  draftSeoTitle: string;
  draftSeoDescription: string;
  draftTags: string[];
  draftPublished: boolean;
}

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const toSlug = (value: string): string => {
  const source = value.trim().toLowerCase();
  if (!source) {
    return '';
  }
  const transliterated = source
    .split('')
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join('');
  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240);
};

const truncate = (value: string, max: number): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return normalized.slice(0, max - 1).trimEnd() + '…';
};

const extractTitleFromPrompt = (prompt: string): string => {
  const cleaned = prompt
    .replace(/[`"'«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'Пример генерации';
  }
  const words = cleaned.split(' ').slice(0, 7).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const buildSeoDraft = (params: {
  title: string;
  prompt: string;
  tags: string[];
  description: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
}) => {
  const baseTitle = params.title.trim() || extractTitleFromPrompt(params.prompt);
  const firstTag = params.tags[0] ? `, ${params.tags[0]}` : '';
  const generatedDescription = `Пример "${baseTitle}" для AI генерации${firstTag}. Загрузите свои фото и получите результат по этому сценарию.`;
  const generatedSeoTitle = truncate(`${baseTitle} | Пример генерации AI`, 120);
  const generatedSeoDescription = truncate(
    params.description.trim() || params.prompt.trim() || generatedDescription,
    200
  );
  const generatedSlug = params.slug.trim() || toSlug(baseTitle);

  return {
    slug: generatedSlug,
    description: params.description.trim() || generatedDescription,
    seoTitle: params.seoTitle.trim() || generatedSeoTitle,
    seoDescription: params.seoDescription.trim() || generatedSeoDescription,
  };
};

interface TagMultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const TagMultiSelect: React.FC<TagMultiSelectProps> = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((tag) => tag.includes(normalized));
  }, [options, query]);

  const toggleTag = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((item) => item !== tag));
      return;
    }
    onChange([...selected, tag]);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full border rounded-lg px-3 py-2 text-sm flex items-center justify-between bg-white"
        >
          <span className="text-gray-700">
            {selected.length > 0 ? `Выбрано: ${selected.length}` : 'Выберите метки'}
          </span>
          <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-2 w-full rounded-lg border bg-white shadow-lg p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск меток..."
              className="w-full border rounded-md px-2 py-1 text-xs"
            />
            <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
              {filteredOptions.length === 0 && (
                <div className="text-xs text-gray-400">Ничего не найдено</div>
              )}
              {filteredOptions.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <button
              key={`selected-${tag}`}
              type="button"
              onClick={() => toggleTag(tag)}
              className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              title="Удалить метку"
            >
              {tag} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ExamplesManager: React.FC = () => {
  const [items, setItems] = useState<DraftExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | 'new' | null>(null);

  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newSeoTitle, setNewSeoTitle] = useState('');
  const [newSeoDescription, setNewSeoDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newPublished, setNewPublished] = useState(true);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [selectedExistingTags, setSelectedExistingTags] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await getAdminExamples();
      setItems(
        response.items.map((item) => ({
          ...item,
          draftSlug: item.slug || '',
          draftTitle: item.title || '',
          draftDescription: item.description || '',
          draftPrompt: item.prompt,
          draftImageUrl: item.image_url,
          draftSeoTitle: item.seo_title || '',
          draftSeoDescription: item.seo_description || '',
          draftTags: item.tags || [],
          draftPublished: item.is_published,
        }))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить примеры');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadTags = async () => {
    try {
      const response = await getExampleTags();
      const tags = response.items.map((item) => item.tag);
      setExistingTags(tags);
    } catch {
      // Не блокируем UI если метки не загрузились
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleUpload = async (file: File, target: number | 'new') => {
    setUploadingId(target);
    try {
      const uploaded = await uploadExampleImage(file);
      if (target === 'new') {
        setNewImageUrl(uploaded.file_url);
      } else {
        setItems((prev) =>
          prev.map((row) =>
            row.id === target ? { ...row, draftImageUrl: uploaded.file_url } : row
          )
        );
      }
      toast.success('Изображение загружено');
    } catch (err: any) {
      toast.error(
        getUploadErrorMessage(err, {
          kind: 'image',
          maxSizeMb: 10,
          allowedTypesLabel: 'JPEG, PNG, WebP, HEIC/HEIF, MPO',
          fallback: 'Не удалось загрузить изображение. Попробуйте еще раз.',
        })
      );
    } finally {
      setUploadingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newPrompt.trim() || !newImageUrl.trim()) {
      toast.error('Заполните промпт и загрузите изображение');
      return;
    }
    try {
      const parsedTags = normalizeTagList([...selectedExistingTags, ...parseTags(newTags)]);
      const created = await createExample({
        slug: newSlug.trim() || null,
        title: newTitle.trim() || null,
        description: newDescription.trim() || null,
        prompt: newPrompt.trim(),
        image_url: newImageUrl.trim(),
        seo_title: newSeoTitle.trim() || null,
        seo_description: newSeoDescription.trim() || null,
        tags: parsedTags,
        is_published: newPublished,
      });
      await loadTags();
      setItems((prev) => [
        {
          ...created,
          draftSlug: created.slug || '',
          draftTitle: created.title || '',
          draftDescription: created.description || '',
          draftPrompt: created.prompt,
          draftImageUrl: created.image_url,
          draftSeoTitle: created.seo_title || '',
          draftSeoDescription: created.seo_description || '',
          draftTags: created.tags || [],
          draftPublished: created.is_published,
        },
        ...prev,
      ]);
      setNewSlug('');
      setNewTitle('');
      setNewDescription('');
      setNewPrompt('');
      setNewImageUrl('');
      setNewSeoTitle('');
      setNewSeoDescription('');
      setNewTags('');
      setSelectedExistingTags([]);
      setNewPublished(true);
      toast.success('Пример добавлен');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось добавить пример');
    }
  };

  const handleSave = async (item: DraftExample) => {
    setSavingId(item.id);
    try {
      const updated = await updateExample(item.id, {
        slug: item.draftSlug.trim() || null,
        title: item.draftTitle.trim() || null,
        description: item.draftDescription.trim() || null,
        prompt: item.draftPrompt.trim(),
        image_url: item.draftImageUrl.trim(),
        seo_title: item.draftSeoTitle.trim() || null,
        seo_description: item.draftSeoDescription.trim() || null,
        tags: item.draftTags,
        is_published: item.draftPublished,
      });
      await loadTags();
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...updated,
                draftSlug: updated.slug || '',
                draftTitle: updated.title || '',
                draftDescription: updated.description || '',
                draftPrompt: updated.prompt,
                draftImageUrl: updated.image_url,
                draftSeoTitle: updated.seo_title || '',
                draftSeoDescription: updated.seo_description || '',
                draftTags: updated.tags || [],
                draftPublished: updated.is_published,
              }
            : row
        )
      );
      toast.success('Сохранено');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось сохранить');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (item: DraftExample) => {
    if (!window.confirm(`Удалить пример "${item.title || item.prompt.slice(0, 20)}"?`)) {
      return;
    }
    setSavingId(item.id);
    try {
      await deleteExample(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      toast.success('Пример удален');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось удалить');
    } finally {
      setSavingId(null);
    }
  };

  const hasChanges = (item: DraftExample) =>
    item.draftSlug.trim() !== item.slug ||
    item.draftTitle.trim() !== (item.title || '') ||
    item.draftDescription.trim() !== (item.description || '') ||
    item.draftPrompt.trim() !== item.prompt ||
    item.draftImageUrl.trim() !== item.image_url ||
    item.draftSeoTitle.trim() !== (item.seo_title || '') ||
    item.draftSeoDescription.trim() !== (item.seo_description || '') ||
    item.draftTags.join(',') !== item.tags.join(',') ||
    item.draftPublished !== item.is_published;

  const parseTags = (value: string) =>
    value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);

  const normalizeTagList = (tags: string[]) => {
    const unique = new Set<string>();
    tags.forEach((tag) => {
      const cleaned = tag.trim().toLowerCase();
      if (cleaned) {
        unique.add(cleaned);
      }
    });
    return Array.from(unique);
  };

  const normalizeSelectedTags = (tags: string[]) => normalizeTagList(tags);

  const fillCreateSeoDraft = () => {
    const tags = normalizeTagList([...selectedExistingTags, ...parseTags(newTags)]);
    const draft = buildSeoDraft({
      title: newTitle,
      prompt: newPrompt,
      tags,
      description: newDescription,
      seoTitle: newSeoTitle,
      seoDescription: newSeoDescription,
      slug: newSlug,
    });
    setNewSlug(draft.slug);
    setNewDescription(draft.description);
    setNewSeoTitle(draft.seoTitle);
    setNewSeoDescription(draft.seoDescription);
    toast.success('SEO-поля автозаполнены');
  };

  const fillItemSeoDraft = (item: DraftExample) => {
    const draft = buildSeoDraft({
      title: item.draftTitle,
      prompt: item.draftPrompt,
      tags: item.draftTags,
      description: item.draftDescription,
      seoTitle: item.draftSeoTitle,
      seoDescription: item.draftSeoDescription,
      slug: item.draftSlug,
    });
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              draftSlug: draft.slug,
              draftDescription: draft.description,
              draftSeoTitle: draft.seoTitle,
              draftSeoDescription: draft.seoDescription,
            }
          : row
      )
    );
    toast.success('SEO-поля обновлены');
  };

  const topExamples = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.uses_count - a.uses_count)
        .slice(0, 6),
    [items]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Примеры генераций</h2>
        <p className="text-sm text-gray-600">
          Загружайте изображения и промпты. Пользователи могут запускать генерацию по этим шаблонам.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Добавить пример</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">Название (опционально)</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Например: Городской стиль"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Slug (опционально)</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="gorodskoy-stil"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-6 md:mt-7">
            <input
              type="checkbox"
              checked={newPublished}
              onChange={(e) => setNewPublished(e.target.checked)}
            />
            Публиковать сразу
          </label>
        </div>
        <div className="space-y-3">
          <TagMultiSelect
            label="Метки (выбор из списка)"
            options={existingTags}
            selected={selectedExistingTags}
            onChange={(next) => setSelectedExistingTags(normalizeSelectedTags(next))}
          />
          {existingTags.length === 0 && (
            <p className="text-xs text-gray-400">Пока нет сохраненных меток</p>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600">Новые метки (через запятую)</label>
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="уличный стиль, вечерний стиль, повседневный"
            />
            {parseTags(newTags).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {parseTags(newTags).map((tag) => (
                  <span key={`new-${tag}`} className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Промпт</label>
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={4}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Описание карточки</label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Кратко объясните, что делает этот пример и какой результат ожидать."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">SEO Title</label>
            <input
              value={newSeoTitle}
              onChange={(e) => setNewSeoTitle(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Title для поисковой выдачи"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">SEO Description</label>
            <input
              value={newSeoDescription}
              onChange={(e) => setNewSeoDescription(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Description для поисковой выдачи"
            />
          </div>
        </div>
        <FileUpload
          onFileSelect={(file) => handleUpload(file, 'new')}
          preview={newImageUrl ? resolveImageUrl(newImageUrl) : null}
          isLoading={uploadingId === 'new'}
          label="Изображение примера"
          hint="Загрузите сгенерированное изображение, до 10MB (конвертируется в WebP)"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fillCreateSeoDraft}
            className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-sm hover:bg-indigo-100"
          >
            Автозаполнить SEO
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
          >
            Добавить
          </button>
        </div>
      </div>

      {topExamples.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Самые популярные примеры
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            {topExamples.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="truncate">{item.title || item.prompt.slice(0, 60)}</span>
                <span className="text-xs font-semibold text-gray-500">
                  {item.uses_count} запусков
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow p-6 animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.length === 0 && (
            <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">
              Пока нет примеров.
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow p-6 space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-full md:w-48">
                  <img
                    src={resolveImageUrl(item.draftImageUrl)}
                    alt={item.title || 'Пример'}
                    className="rounded-lg border border-gray-100 object-cover w-full h-48"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Название</label>
                      <input
                        value={item.draftTitle}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftTitle: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Slug</label>
                      <input
                        value={item.draftSlug}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftSlug: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 mt-6 md:mt-7">
                      <input
                        type="checkbox"
                        checked={item.draftPublished}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, draftPublished: e.target.checked }
                                : row
                            )
                          )
                        }
                      />
                      Опубликовано
                    </label>
                  </div>
                  <div className="space-y-3">
                    <TagMultiSelect
                      label="Метки"
                      options={existingTags}
                      selected={item.draftTags}
                      onChange={(next) =>
                        setItems((prev) =>
                          prev.map((row) =>
                            row.id === item.id
                              ? { ...row, draftTags: normalizeSelectedTags(next) }
                              : row
                          )
                        )
                      }
                    />
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Метки (ручной ввод)</label>
                      <input
                        value={item.draftTags.join(', ')}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, draftTags: parseTags(e.target.value) }
                                : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                      {item.draftTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.draftTags.map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Промпт</label>
                    <textarea
                      value={item.draftPrompt}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row) =>
                            row.id === item.id ? { ...row, draftPrompt: e.target.value } : row
                          )
                        )
                      }
                      rows={3}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Описание карточки</label>
                    <textarea
                      value={item.draftDescription}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row) =>
                            row.id === item.id ? { ...row, draftDescription: e.target.value } : row
                          )
                        )
                      }
                      rows={2}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">SEO Title</label>
                      <input
                        value={item.draftSeoTitle}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftSeoTitle: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">SEO Description</label>
                      <input
                        value={item.draftSeoDescription}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftSeoDescription: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <FileUpload
                    onFileSelect={(file) => handleUpload(file, item.id)}
                    preview={resolveImageUrl(item.draftImageUrl)}
                    isLoading={uploadingId === item.id}
                    label="Изображение"
                    hint="Нажмите для замены (конвертируется в WebP)"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => fillItemSeoDraft(item)}
                      disabled={savingId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    >
                      SEO автозаполнение
                    </button>
                    <button
                      onClick={() => handleSave(item)}
                      disabled={savingId === item.id || !hasChanges(item)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                        savingId === item.id || !hasChanges(item)
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {savingId === item.id ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={savingId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      Удалить
                    </button>
                    <span className="text-xs text-gray-500">
                      Использований: {item.uses_count}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Обновлено: {new Date(item.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
