import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { ChatInput } from '../components/editing/ChatInput';
import { ExampleGenerationProgress } from '../components/examples/ExampleGenerationProgress';
import { ExampleGenerationResult } from '../components/examples/ExampleGenerationResult';
import { useExampleGenerationStore } from '../store/exampleGenerationStore';
import toast from 'react-hot-toast';
import type { ChatAttachment } from '../types/editing';

export const ExampleGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawPrompt = searchParams.get('prompt') || '';
  const prompt = useMemo(() => rawPrompt.trim(), [rawPrompt]);

  const {
    isGenerating,
    result,
    startGeneration,
    reset,
  } = useExampleGenerationStore();

  useEffect(() => {
    reset();
    return () => {
      reset();
    };
  }, [reset]);

  const handleSend = async (message: string, attachments?: ChatAttachment[]) => {
    try {
      await startGeneration(message, attachments || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Ошибка генерации');
    }
  };

  const handleBackToExamples = () => {
    reset();
    navigate('/app/examples');
  };

  const handleTryAgain = () => {
    reset();
  };

  const stage = result ? 'result' : isGenerating ? 'generating' : 'input';

  return (
    <AuthGuard>
      <Layout
        title="Генерация по образцу"
        subtitle="Промпт из образца можно отредактировать"
        gradient="from-blue-500 to-purple-500"
      >
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-8">
          {stage === 'input' && (
            <div className="max-w-4xl mx-auto pt-6">
              {!prompt && (
                <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  Промпт образца не найден. Выберите образец и повторите попытку.
                </div>
              )}
              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
                Для генерации по образцу нужно прикрепить фото через скрепку слева.
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isGenerating || !prompt}
                placeholder="Опишите желаемый результат..."
                prefillMessage={prompt}
                requireAttachments
                attachmentsHint=""
                attachmentTooltip="Нужно обязательно прикрепить фото (можно несколько)"
              />
            </div>
          )}

          {stage === 'generating' && <ExampleGenerationProgress />}

          {stage === 'result' && (
            <ExampleGenerationResult
              onBackToExamples={handleBackToExamples}
              onTryAgain={handleTryAgain}
            />
          )}
        </div>
      </Layout>
    </AuthGuard>
  );
};
