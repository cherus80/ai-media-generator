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
  draftTitle: string;
  draftPrompt: string;
  draftImageUrl: string;
  draftTags: string[];
  draftPublished: boolean;
}

export const ExamplesManager: React.FC = () => {
  const [items, setItems] = useState<DraftExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | 'new' | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newPublished, setNewPublished] = useState(true);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [selectedExistingTag, setSelectedExistingTag] = useState('');
  const [selectedExistingTags, setSelectedExistingTags] = useState<string[]>([]);
  const [selectedExistingTagById, setSelectedExistingTagById] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const response = await getAdminExamples();
      setItems(
        response.items.map((item) => ({
          ...item,
          draftTitle: item.title || '',
          draftPrompt: item.prompt,
          draftImageUrl: item.image_url,
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
        title: newTitle.trim() || null,
        prompt: newPrompt.trim(),
        image_url: newImageUrl.trim(),
        tags: parsedTags,
        is_published: newPublished,
      });
      await loadTags();
      setItems((prev) => [
        {
          ...created,
          draftTitle: created.title || '',
          draftPrompt: created.prompt,
          draftImageUrl: created.image_url,
          draftTags: created.tags || [],
          draftPublished: created.is_published,
        },
        ...prev,
      ]);
      setNewTitle('');
      setNewPrompt('');
      setNewImageUrl('');
      setNewTags('');
      setSelectedExistingTag('');
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
        title: item.draftTitle.trim() || null,
        prompt: item.draftPrompt.trim(),
        image_url: item.draftImageUrl.trim(),
        tags: item.draftTags,
        is_published: item.draftPublished,
      });
      await loadTags();
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...updated,
                draftTitle: updated.title || '',
                draftPrompt: updated.prompt,
                draftImageUrl: updated.image_url,
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
    item.draftTitle.trim() !== (item.title || '') ||
    item.draftPrompt.trim() !== item.prompt ||
    item.draftImageUrl.trim() !== item.image_url ||
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

  const mergeTagList = (list: string[], tag: string) => {
    return normalizeTagList([...list, tag]);
  };

  const handleAddExistingTag = () => {
    if (!selectedExistingTag) {
      return;
    }
    setSelectedExistingTags((prev) => mergeTagList(prev, selectedExistingTag));
    setSelectedExistingTag('');
  };

  const handleRemoveExistingTag = (tag: string) => {
    setSelectedExistingTags((prev) => prev.filter((item) => item !== tag));
  };

  const handleAddExistingTagToItem = (itemId: number) => {
    const tag = selectedExistingTagById[itemId];
    if (!tag) {
      return;
    }
    setItems((prev) =>
      prev.map((row) =>
        row.id === itemId ? { ...row, draftTags: mergeTagList(row.draftTags, tag) } : row
      )
    );
    setSelectedExistingTagById((prev) => ({ ...prev, [itemId]: '' }));
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
          <div>
            <label className="text-xs font-semibold text-gray-600">Метки (выбор из списка)</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                value={selectedExistingTag}
                onChange={(e) => setSelectedExistingTag(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">Выберите метку</option>
                {existingTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddExistingTag}
                disabled={!selectedExistingTag}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  selectedExistingTag
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                Добавить
              </button>
            </div>
            {selectedExistingTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedExistingTags.map((tag) => (
                  <button
                    key={`selected-${tag}`}
                    type="button"
                    onClick={() => handleRemoveExistingTag(tag)}
                    className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                    title="Удалить метку"
                  >
                    {tag} ✕
                  </button>
                ))}
              </div>
            )}
            {existingTags.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">Пока нет сохраненных меток</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Новые метки (через запятую)</label>
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="street, вечерний стиль, casual"
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
        <FileUpload
          onFileSelect={(file) => handleUpload(file, 'new')}
          preview={newImageUrl ? resolveImageUrl(newImageUrl) : null}
          isLoading={uploadingId === 'new'}
          label="Изображение примера"
          hint="Загрузите сгенерированное изображение, до 10MB (конвертируется в WebP)"
        />
        <button
          onClick={handleCreate}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
        >
          Добавить
        </button>
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
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Метки</label>
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        value={selectedExistingTagById[item.id] || ''}
                        onChange={(e) =>
                          setSelectedExistingTagById((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="border rounded-lg px-3 py-2 text-xs min-w-[180px]"
                      >
                        <option value="">Выберите метку</option>
                        {existingTags.map((tag) => (
                          <option key={`${item.id}-${tag}`} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAddExistingTagToItem(item.id)}
                        disabled={!selectedExistingTagById[item.id]}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                          selectedExistingTagById[item.id]
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Добавить
                      </button>
                    </div>
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
                  <FileUpload
                    onFileSelect={(file) => handleUpload(file, item.id)}
                    preview={resolveImageUrl(item.draftImageUrl)}
                    isLoading={uploadingId === item.id}
                    label="Изображение"
                    hint="Нажмите для замены (конвертируется в WebP)"
                  />
                  <div className="flex flex-wrap items-center gap-2">
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
