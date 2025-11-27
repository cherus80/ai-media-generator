import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getFittingPrompts,
  updateFittingPrompt,
} from '../../api/admin';
import type { FittingPromptItem } from '../../types/admin';

const ZONE_META: Record<string, { title: string; hint: string }> = {
  clothing: { title: 'Одежда (по умолчанию)', hint: 'Если зона не выбрана' },
  head: { title: 'Голова', hint: 'Кепки, шапки' },
  face: { title: 'Лицо', hint: 'Очки, маски' },
  neck: { title: 'Шея', hint: 'Шарфы, цепочки' },
  hands: { title: 'Руки', hint: 'Часы, браслеты, перчатки' },
  legs: { title: 'Ноги', hint: 'Обувь' },
  body: { title: 'Всё тело', hint: 'Футболки, рубашки, худи, костюмы' },
};

interface PromptState extends FittingPromptItem {
  draft: string;
}

export const FittingPrompts: React.FC = () => {
  const [prompts, setPrompts] = useState<Record<string, PromptState>>({});
  const [loading, setLoading] = useState(true);
  const [savingZone, setSavingZone] = useState<string | null>(null);

  const orderedZones = useMemo(
    () => ['clothing', 'head', 'face', 'neck', 'hands', 'legs', 'body'],
    []
  );

  const load = async () => {
    setLoading(true);
    try {
      const response = await getFittingPrompts();
      const next: Record<string, PromptState> = {};
      response.items.forEach((item) => {
        next[item.zone] = { ...item, draft: item.prompt };
      });
      setPrompts(next);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Не удалось загрузить промпты');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (zone: string) => {
    const current = prompts[zone];
    if (!current) return;
    setSavingZone(zone);
    try {
      const updated = await updateFittingPrompt(zone, { prompt: current.draft });
      setPrompts((prev) => ({
        ...prev,
        [zone]: { ...updated, draft: updated.prompt },
      }));
      toast.success('Сохранено');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Не удалось сохранить промпт');
    } finally {
      setSavingZone(null);
    }
  };

  const handleReset = async (zone: string) => {
    setSavingZone(zone);
    try {
      const reset = await updateFittingPrompt(zone, { use_default: true });
      setPrompts((prev) => ({
        ...prev,
        [zone]: { ...reset, draft: reset.prompt },
      }));
      toast.success('Сброшено на дефолт');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Не удалось сбросить промпт');
    } finally {
      setSavingZone(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="grid grid-cols-1 gap-4">
            <div className="h-32 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Промпты виртуальной примерки
        </h2>
        <p className="text-sm text-gray-600">
          Эти тексты подставляются в генерацию в зависимости от выбранной зоны.
          Сохраняйте изменения, чтобы они применились в новых задачах.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {orderedZones.map((zone) => {
          const data = prompts[zone];
          if (!data) return null;
          const meta = ZONE_META[zone] || { title: zone, hint: '' };
          const isDirty = data.draft !== data.prompt;

          return (
            <div
              key={zone}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 max-[360px]:p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 max-[360px]:text-base">
                    {meta.title}
                  </h3>
                  <p className="text-sm text-gray-500 max-[360px]:text-[12px]">
                    {meta.hint}
                  </p>
                </div>
                {!data.is_default && (
                  <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">
                    Кастомно
                  </span>
                )}
              </div>

              <textarea
                value={data.draft}
                onChange={(e) =>
                  setPrompts((prev) => ({
                    ...prev,
                    [zone]: { ...prev[zone], draft: e.target.value },
                  }))
                }
                rows={5}
                className="w-full border rounded-lg p-3 text-sm text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition max-[360px]:text-[13px]"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSave(zone)}
                  disabled={savingZone === zone || !isDirty}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                    ${
                      savingZone === zone || !isDirty
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }
                  `}
                >
                  {savingZone === zone ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => handleReset(zone)}
                  disabled={savingZone === zone || data.is_default}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                    ${
                      savingZone === zone || data.is_default
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  Сбросить к дефолту
                </button>
              </div>

              <div className="text-xs text-gray-500">
                {data.updated_at
                  ? `Обновлено: ${new Date(data.updated_at).toLocaleString()}`
                  : 'Используется дефолтный промпт'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
