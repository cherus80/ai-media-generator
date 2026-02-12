import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { getFallbackSettings, updateFallbackSettings } from '../../api/admin';
import type {
  FallbackSettings as FallbackSettingsType,
  GenerationProvider,
  UpdateFallbackSettingsRequest,
} from '../../types/admin';
import toast from 'react-hot-toast';

const providerLabels: Record<GenerationProvider, string> = {
  grsai: 'GrsAI (primary)',
  kie_ai: 'kie.ai',
  openrouter: 'OpenRouter',
};

export const FallbackSettings: React.FC = () => {
  const [settings, setSettings] = React.useState<FallbackSettingsType | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadSettings = async () => {
    try {
      const data = await getFallbackSettings();
      setSettings(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить настройки fallback');
    }
  };

  React.useEffect(() => {
    loadSettings();
  }, []);

  const handleUpdate = async (payload: UpdateFallbackSettingsRequest) => {
    if (!settings) return;
    setIsLoading(true);
    try {
      const updated = await updateFallbackSettings(payload);
      setSettings(updated);
      toast.success('Настройки сохранены');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось сохранить настройки');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrimaryChange = async (value: GenerationProvider) => {
    if (!settings) return;

    const payload: UpdateFallbackSettingsRequest = { primary_provider: value };
    if (settings.fallback_provider === value) {
      payload.fallback_provider = null;
    }

    await handleUpdate(payload);
  };

  const handleFallbackChange = async (value: string) => {
    const normalized = value === 'none' ? null : (value as GenerationProvider);
    await handleUpdate({ fallback_provider: normalized });
  };

  const providers = settings?.available_providers || (['grsai', 'kie_ai', 'openrouter'] as GenerationProvider[]);
  const chain = settings
    ? [settings.primary_provider, settings.fallback_provider].filter(Boolean).join(' → ') || '—'
    : '—';

  return (
    <Card variant="glass" padding="lg" className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-dark-900">Резервная генерация</h2>
          <p className="text-sm text-dark-500">
            Переключайте основной и запасной провайдер без перезапуска сервиса.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadSettings} isLoading={isLoading}>
          Обновить
        </Button>
      </div>

      {settings ? (
        <div className="space-y-6">
          <div className="bg-dark-50 border border-dark-100 rounded-xl px-4 py-3">
            <div className="text-sm text-dark-500">Текущая цепочка</div>
            <div className="text-lg font-semibold text-dark-900">{chain}</div>
            <div className="text-xs text-dark-400 mt-1">
              При ошибке основного провайдера будет использован запасной (если выбран).
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-semibold text-dark-800">Основной провайдер</div>
              <select
                className="w-full rounded-xl border border-dark-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={settings.primary_provider}
                onChange={(e) => handlePrimaryChange(e.target.value as GenerationProvider)}
                disabled={isLoading}
              >
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {providerLabels[provider]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-dark-500">
                Основной канал для генераций. Рекомендуем GrsAI, fallback — kie.ai.
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-dark-800">Запасной провайдер</div>
              <select
                className="w-full rounded-xl border border-dark-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={settings.fallback_provider || 'none'}
                onChange={(e) => handleFallbackChange(e.target.value)}
                disabled={isLoading}
              >
                <option value="none">Не переключаться (отключить fallback)</option>
                {providers.map((provider) => (
                  <option
                    key={provider}
                    value={provider}
                    disabled={provider === settings.primary_provider}
                  >
                    {providerLabels[provider]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-dark-500">
                Используется автоматически, если основной провайдер вернул ошибку или таймаут.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-dark-500">Загрузка настроек...</div>
      )}
    </Card>
  );
};
