import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { ChatInput } from '../components/editing/ChatInput';
import { ExampleGenerationProgress } from '../components/examples/ExampleGenerationProgress';
import { ExampleGenerationResult } from '../components/examples/ExampleGenerationResult';
import { useExampleGenerationStore } from '../store/exampleGenerationStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import type { ChatAttachment } from '../types/editing';
import type { AspectRatio } from '../types/generation';
import { InsufficientBalanceModal } from '../components/payment/InsufficientBalanceModal';
import { getGenerationErrorMessage, isInsufficientBalanceError } from '../utils/billingErrors';
import { getGenerationExampleBySlug } from '../api/content';

export const ExampleGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawPrompt = searchParams.get('prompt') || '';
  const exampleSlug = (searchParams.get('example') || '').trim();
  const fallbackPrompt = useMemo(() => rawPrompt.trim(), [rawPrompt]);
  const [prompt, setPrompt] = React.useState(fallbackPrompt);
  const [loadingExample, setLoadingExample] = React.useState(false);
  const [exampleError, setExampleError] = React.useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>('auto');
  const { user } = useAuthStore();
  const [balanceWarning, setBalanceWarning] = React.useState<{
    description: string;
    requiredCredits?: number;
    requiredActions?: number;
  } | null>(null);

  const {
    isGenerating,
    result,
    startGeneration,
    reset,
  } = useExampleGenerationStore();

  const creditsBalance = user?.balance_credits ?? 0;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const hasActiveSubscriptionActions = !!(
    user?.subscription_type &&
    user.subscription_type !== 'none' &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date() &&
    (user.subscription_ops_remaining ?? 0) > 0
  );

  useEffect(() => {
    reset();
    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    let cancelled = false;

    const loadPrompt = async () => {
      if (!exampleSlug) {
        setPrompt(fallbackPrompt);
        setExampleError(null);
        setLoadingExample(false);
        return;
      }

      setLoadingExample(true);
      setExampleError(null);
      try {
        const example = await getGenerationExampleBySlug(exampleSlug);
        if (!cancelled) {
          setPrompt(example.prompt.trim());
        }
      } catch {
        if (!cancelled) {
          setPrompt('');
          setExampleError('Пример не найден или временно недоступен.');
        }
      } finally {
        if (!cancelled) {
          setLoadingExample(false);
        }
      }
    };

    loadPrompt();
    return () => {
      cancelled = true;
    };
  }, [exampleSlug, fallbackPrompt]);

  const handleSend = async (message: string, attachments?: ChatAttachment[]) => {
    try {
      if (!user) {
        toast.error('Необходима авторизация');
        return;
      }
      if (!isAdmin && !hasActiveSubscriptionActions && creditsBalance < 2) {
        setBalanceWarning({
          description: 'Для генерации нужно 2 ⭐️звезды или активная подписка с генерациями.',
          requiredCredits: 2,
          requiredActions: 1,
        });
        return;
      }

      await startGeneration(message, attachments || [], aspectRatio);
    } catch (err: any) {
      if (isInsufficientBalanceError(err)) {
        setBalanceWarning({
          description: 'Для генерации нужно 2 ⭐️звезды или активная подписка с генерациями.',
          requiredCredits: 2,
          requiredActions: 1,
        });
        return;
      }
      toast.error(getGenerationErrorMessage(err));
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
              {loadingExample && (
                <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  Загружаем данные примера...
                </div>
              )}
              {!loadingExample && exampleError && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {exampleError}
                </div>
              )}
              {!loadingExample && !exampleError && !prompt && (
                <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  Промпт образца не найден. Выберите образец и повторите попытку.
                </div>
              )}
              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
                Для генерации по образцу нужно прикрепить фото через скрепку слева.
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isGenerating || !prompt || loadingExample}
                placeholder="Опишите желаемый результат..."
                prefillMessage={prompt}
                requireAttachments
                attachmentsHint=""
                attachmentTooltip="Нужно обязательно прикрепить фото (можно несколько)"
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                showAspectRatioSelect
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

        <InsufficientBalanceModal
          isOpen={Boolean(balanceWarning)}
          description={balanceWarning?.description || ''}
          currentCredits={creditsBalance}
          requiredCredits={balanceWarning?.requiredCredits}
          requiredActions={balanceWarning?.requiredActions}
          onClose={() => setBalanceWarning(null)}
          onBuyCredits={() => {
            setBalanceWarning(null);
            navigate('/profile?buy=credits');
          }}
          onBuySubscription={() => {
            setBalanceWarning(null);
            navigate('/profile?buy=subscription');
          }}
        />
      </Layout>
    </AuthGuard>
  );
};
