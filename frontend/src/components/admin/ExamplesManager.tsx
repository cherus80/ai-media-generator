import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getAdminExamples,
  createExample,
  updateExample,
  deleteExample,
} from '../../api/admin';
import { uploadAttachment } from '../../api/editing';
import { FileUpload } from '../common/FileUpload';
import type { GenerationExampleAdminItem } from '../../types/content';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

interface DraftExample extends GenerationExampleAdminItem {
  draftTitle: string;
  draftPrompt: string;
  draftImageUrl: string;
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
  const [newPublished, setNewPublished] = useState(true);

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

  const handleUpload = async (file: File, target: number | 'new') => {
    setUploadingId(target);
    try {
      const uploaded = await uploadAttachment(file);
      if (target === 'new') {
        setNewImageUrl(uploaded.url);
      } else {
        setItems((prev) =>
          prev.map((row) =>
            row.id === target ? { ...row, draftImageUrl: uploaded.url } : row
          )
        );
      }
      toast.success('Изображение загружено');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить изображение');
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
      const created = await createExample({
        title: newTitle.trim() || null,
        prompt: newPrompt.trim(),
        image_url: newImageUrl.trim(),
        is_published: newPublished,
      });
      setItems((prev) => [
        {
          ...created,
          draftTitle: created.title || '',
          draftPrompt: created.prompt,
          draftImageUrl: created.image_url,
          draftPublished: created.is_published,
        },
        ...prev,
      ]);
      setNewTitle('');
      setNewPrompt('');
      setNewImageUrl('');
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
        is_published: item.draftPublished,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...updated,
                draftTitle: updated.title || '',
                draftPrompt: updated.prompt,
                draftImageUrl: updated.image_url,
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
    item.draftPublished !== item.is_published;

  const topExamples = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.uses_count - a.uses_count)
        .slice(0, 5),
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
          hint="Загрузите сгенерированное изображение, до 10MB"
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
                    hint="Нажмите для замены"
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
