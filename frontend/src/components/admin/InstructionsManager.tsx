import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getAdminInstructions,
  createInstruction,
  updateInstruction,
  deleteInstruction,
  uploadInstructionVideo,
} from '../../api/admin';
import type { InstructionAdminItem, InstructionType } from '../../types/content';

interface DraftInstruction extends InstructionAdminItem {
  draftTitle: string;
  draftDescription: string;
  draftContent: string;
  draftSortOrder: number;
  draftPublished: boolean;
}

const TYPE_LABELS: Record<InstructionType, string> = {
  video: 'Видео-инструкции',
  text: 'Текстовые инструкции',
};

const TYPE_HINTS: Record<InstructionType, string> = {
  video: 'Вставьте ссылку на видео или загрузите файл (MP4/WebM/MOV).',
  text: 'Короткие правила и советы. Можно использовать простое форматирование.',
};

export const InstructionsManager: React.FC = () => {
  const [activeType, setActiveType] = useState<InstructionType>('video');
  const [items, setItems] = useState<DraftInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [newPublished, setNewPublished] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await getAdminInstructions(activeType);
      setItems(
        response.items.map((item) => ({
          ...item,
          draftTitle: item.title,
          draftDescription: item.description || '',
          draftContent: item.content,
          draftSortOrder: item.sort_order,
          draftPublished: item.is_published,
        }))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить инструкции');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeType]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Заполните заголовок и содержание');
      return;
    }
    try {
      const created = await createInstruction({
        type: activeType,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        content: newContent.trim(),
        sort_order: newSortOrder,
        is_published: newPublished,
      });
      setItems((prev) => [
        {
          ...created,
          draftTitle: created.title,
          draftDescription: created.description || '',
          draftContent: created.content,
          draftSortOrder: created.sort_order,
          draftPublished: created.is_published,
        },
        ...prev,
      ]);
      setNewTitle('');
      setNewDescription('');
      setNewContent('');
      setNewSortOrder(0);
      setNewPublished(true);
      toast.success('Инструкция добавлена');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось добавить инструкцию');
    }
  };

  const handleNewVideoUpload = async (file: File | null) => {
    if (!file) {
      return;
    }
    setUploadingNew(true);
    try {
      const uploaded = await uploadInstructionVideo(file);
      setNewContent(uploaded.file_url);
      toast.success('Видео загружено');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить видео');
    } finally {
      setUploadingNew(false);
    }
  };

  const handleItemVideoUpload = async (itemId: number, file: File | null) => {
    if (!file) {
      return;
    }
    setUploadingId(itemId);
    try {
      const uploaded = await uploadInstructionVideo(file);
      setItems((prev) =>
        prev.map((row) =>
          row.id === itemId ? { ...row, draftContent: uploaded.file_url } : row
        )
      );
      toast.success('Видео загружено');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить видео');
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async (item: DraftInstruction) => {
    setSavingId(item.id);
    try {
      const updated = await updateInstruction(item.id, {
        title: item.draftTitle.trim(),
        description: item.draftDescription.trim() || null,
        content: item.draftContent.trim(),
        sort_order: item.draftSortOrder,
        is_published: item.draftPublished,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...updated,
                draftTitle: updated.title,
                draftDescription: updated.description || '',
                draftContent: updated.content,
                draftSortOrder: updated.sort_order,
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

  const handleDelete = async (item: DraftInstruction) => {
    if (!window.confirm(`Удалить инструкцию "${item.title}"?`)) {
      return;
    }
    setSavingId(item.id);
    try {
      await deleteInstruction(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      toast.success('Инструкция удалена');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось удалить');
    } finally {
      setSavingId(null);
    }
  };

  const hasChanges = (item: DraftInstruction) =>
    item.draftTitle.trim() !== item.title ||
    item.draftDescription.trim() !== (item.description || '') ||
    item.draftContent.trim() !== item.content ||
    item.draftSortOrder !== item.sort_order ||
    item.draftPublished !== item.is_published;

  const tabButtons = useMemo(
    () =>
      (['video', 'text'] as InstructionType[]).map((type) => (
        <button
          key={type}
          onClick={() => setActiveType(type)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeType === type
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {TYPE_LABELS[type]}
        </button>
      )),
    [activeType]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex flex-wrap gap-3 mb-4">{tabButtons}</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {TYPE_LABELS[activeType]}
        </h2>
        <p className="text-sm text-gray-600">{TYPE_HINTS[activeType]}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Добавить инструкцию</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">Заголовок</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Например: Как выбрать фото одежды"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Краткое описание</label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Коротко о видео или инструкции"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Порядок</label>
            <input
              type="number"
              value={newSortOrder}
              onChange={(e) => {
                const value = Number(e.target.value);
                setNewSortOrder(Number.isNaN(value) ? 0 : value);
              }}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Содержание</label>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={activeType === 'video' ? 'Ссылка на видео' : 'Текст инструкции'}
          />
          {activeType === 'video' && (
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold text-gray-600">
                Загрузить видеофайл
              </label>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => handleNewVideoUpload(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-600"
                disabled={uploadingNew}
              />
              {newContent && (
                <p className="text-xs text-gray-500 break-all">
                  Текущая ссылка: {newContent}
                </p>
              )}
              {uploadingNew && (
                <p className="text-xs text-gray-500">Загрузка видео...</p>
              )}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={newPublished}
            onChange={(e) => setNewPublished(e.target.checked)}
          />
          Публиковать сразу
        </label>
        <button
          onClick={handleCreate}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
        >
          Добавить
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-6 animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.length === 0 && (
            <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">
              Пока нет инструкций этого типа.
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow p-6 space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-600">Заголовок</label>
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
              <label className="text-xs font-semibold text-gray-600">Краткое описание</label>
              <input
                value={item.draftDescription}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row) =>
                      row.id === item.id ? { ...row, draftDescription: e.target.value } : row
                    )
                  )
                }
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Порядок</label>
              <input
                type="number"
                value={item.draftSortOrder}
                    onChange={(e) =>
                      setItems((prev) => {
                        const value = Number(e.target.value);
                        const nextValue = Number.isNaN(value) ? 0 : value;
                        return prev.map((row) =>
                          row.id === item.id
                            ? { ...row, draftSortOrder: nextValue }
                            : row
                        );
                      })
                    }
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Содержание</label>
                <textarea
                  value={item.draftContent}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row) =>
                        row.id === item.id ? { ...row, draftContent: e.target.value } : row
                      )
                    )
                  }
                  rows={4}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
                {activeType === 'video' && (
                  <div className="mt-3 space-y-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Заменить видеофайл
                    </label>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={(e) => handleItemVideoUpload(item.id, e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-600"
                      disabled={uploadingId === item.id}
                    />
                    {item.draftContent && (
                      <p className="text-xs text-gray-500 break-all">
                        Текущая ссылка: {item.draftContent}
                      </p>
                    )}
                    {uploadingId === item.id && (
                      <p className="text-xs text-gray-500">Загрузка видео...</p>
                    )}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={item.draftPublished}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row) =>
                        row.id === item.id ? { ...row, draftPublished: e.target.checked } : row
                      )
                    )
                  }
                />
                Опубликовано
              </label>
              <div className="flex flex-wrap gap-2">
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
              </div>
              <p className="text-xs text-gray-500">
                Обновлено: {new Date(item.updated_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
