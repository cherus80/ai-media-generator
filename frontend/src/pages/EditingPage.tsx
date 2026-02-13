/**
 * Страница редактирования изображений через AI-чат
 * Интерактивный чат с AI-ассистентом для редактирования изображений
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChatWindow } from '../components/editing/ChatWindow';
import { ChatInput } from '../components/editing/ChatInput';
import { PromptDecisionModal } from '../components/editing/PromptDecisionModal';
import { FileUpload } from '../components/common/FileUpload';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { InsufficientBalanceModal } from '../components/payment/InsufficientBalanceModal';
import toast from 'react-hot-toast';
import type { ChatAttachment } from '../types/editing';
import { getGenerationErrorMessage, isInsufficientBalanceError } from '../utils/billingErrors';

export const EditingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    sessionId,
    baseImage,
    messages,
    currentPrompts,
    isSendingMessage,
    isGenerating,
    uploadAndCreateSession,
    createTextSession,
    loadHistory,
    sendMessage,
    generateImage,
    resetSession,
    addMessage,
    uploadError,
    error,
    clearError,
    clearUploadError,
    aspectRatio,
    setAspectRatio,
  } = useChatStore();
  const { user } = useAuthStore();

  const promptAssistantModel =
    import.meta.env.VITE_PROMPT_ASSISTANT_MODEL || 'AI-ассистент';
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [isStartingTextMode, setIsStartingTextMode] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [pendingPrompt, setPendingPrompt] = React.useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = React.useState<ChatAttachment[]>([]);
  const [showPromptDecision, setShowPromptDecision] = React.useState(false);
  const [decisionLoadingTarget, setDecisionLoadingTarget] = React.useState<'original' | 'ai' | null>(null);
  const historyLoadRef = React.useRef<string | null>(null);
  const [prefillMessage, setPrefillMessage] = React.useState('');
  const MAX_PROMPT_LENGTH = 4000;
  const [balanceWarning, setBalanceWarning] = React.useState<{
    title?: string;
    description: string;
    requiredCredits?: number;
    requiredActions?: number;
  } | null>(null);

  const creditsBalance = user?.balance_credits ?? 0;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const hasActiveSubscriptionActions = !!(
    user?.subscription_type &&
    user.subscription_type !== 'none' &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date() &&
    (user.subscription_ops_remaining ?? 0) > 0
  );

  // Сброс состояния при монтировании страницы
  useEffect(() => {
    // Не сбрасываем, если есть активная сессия (пользователь мог вернуться назад)
    // reset();
  }, []);

  // Обработка ошибок
  useEffect(() => {
    if (uploadError) {
      toast.error(uploadError);
    }
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [uploadError, error, clearError]);

  useEffect(() => {
    if (!sessionId || !user) {
      return;
    }
    if (historyLoadRef.current === sessionId) {
      return;
    }
    historyLoadRef.current = sessionId;
    loadHistory(sessionId).catch((loadError) => {
      console.error('[EditingPage] Failed to load chat history:', loadError);
    });
  }, [sessionId, user, loadHistory]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const promptParam = params.get('prompt');
    if (promptParam) {
      setPrefillMessage(promptParam);
    }
  }, [location.search]);

  const handleFileSelect = async (file: File) => {
    setIsUploadingImage(true);
    clearError();
    clearUploadError();

    try {
      await uploadAndCreateSession(file);
      toast.success('Изображение загружено! Начните беседу с AI-ассистентом.');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка загрузки изображения');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleStartTextMode = async () => {
    setIsStartingTextMode(true);
    clearError();
    clearUploadError();

    try {
      await createTextSession();
      toast.success('Режим генерации по тексту активирован. Опишите желаемый результат.');
    } catch (err: any) {
      toast.error(err.message || 'Не удалось начать режим без фото');
    } finally {
      setIsStartingTextMode(false);
    }
  };

  const handlePromptSubmit = (text: string, attachments?: ChatAttachment[]) => {
    if (text.trim().length > MAX_PROMPT_LENGTH) {
      toast.error(
        `Промпт превышает ${MAX_PROMPT_LENGTH} символов. Сократите текст, чтобы продолжить.`
      );
      return;
    }
    setPendingPrompt(text);
    setPendingAttachments(attachments || []);
    setShowPromptDecision(true);
  };

  const openBalanceWarning = (payload: {
    title?: string;
    description: string;
    requiredCredits?: number;
    requiredActions?: number;
  }) => {
    setBalanceWarning(payload);
  };

  const openGenerationBalanceWarning = () => {
    openBalanceWarning({
      description: 'Для генерации нужно 2 ⭐️звезды или активная подписка с генерациями.',
      requiredCredits: 2,
      requiredActions: 1,
    });
  };

  const openAssistantBalanceWarning = () => {
    const requiredCredits = hasActiveSubscriptionActions ? 1 : 3;
    openBalanceWarning({
      title: 'Недостаточно ⭐️звезд для ассистента',
      description: hasActiveSubscriptionActions
        ? 'Для улучшения через AI нужна 1 ⭐️звезда. Генерация спишет 1 генерацию по подписке.'
        : 'Для улучшения через AI и последующей генерации нужно 3 ⭐️звезды (1 за ассистента и 2 за генерацию).',
      requiredCredits,
      requiredActions: hasActiveSubscriptionActions ? 1 : undefined,
    });
  };

  const handleBuyCredits = () => {
    setBalanceWarning(null);
    navigate('/profile?buy=credits');
  };

  const handleBuySubscription = () => {
    setBalanceWarning(null);
    navigate('/profile?buy=subscription');
  };

  const ensureCanGenerate = () => {
    if (!user) {
      toast.error('Необходима авторизация');
      return false;
    }
    if (isAdmin || hasActiveSubscriptionActions || creditsBalance >= 2) {
      return true;
    }
    openBalanceWarning({
      description: 'Для генерации нужно 2 ⭐️звезды или активная подписка с генерациями.',
      requiredCredits: 2,
      requiredActions: 1,
    });
    return false;
  };

  const ensureCanUseAssistant = () => {
    if (!user) {
      toast.error('Необходима авторизация');
      return false;
    }
    if (isAdmin) {
      return true;
    }
    const requiredCredits = hasActiveSubscriptionActions ? 1 : 3;
    if (creditsBalance >= requiredCredits) {
      return true;
    }
    openBalanceWarning({
      title: 'Недостаточно ⭐️звезд для ассистента',
      description: hasActiveSubscriptionActions
        ? 'Для улучшения через AI нужна 1 ⭐️звезда. Генерация спишет 1 генерацию по подписке.'
        : 'Для улучшения через AI и последующей генерации нужно 3 ⭐️звезды (1 за ассистента и 2 за генерацию).',
      requiredCredits,
      requiredActions: hasActiveSubscriptionActions ? 1 : undefined,
    });
    return false;
  };

  const handleUseOriginalPrompt = async () => {
    if (!pendingPrompt) {
      console.warn('[EditingPage] No pending prompt');
      return;
    }
    if (pendingPrompt.trim().length > MAX_PROMPT_LENGTH) {
      toast.error(
        `Промпт превышает ${MAX_PROMPT_LENGTH} символов. Сократите текст, чтобы запустить генерацию.`
      );
      return;
    }
    if (!ensureCanGenerate()) {
      return;
    }

    console.log('[EditingPage] Starting direct generation with prompt:', pendingPrompt);
    console.log('[EditingPage] Current sessionId:', sessionId);

    setDecisionLoadingTarget('original');
    try {
      // Сначала отправляем генерацию, только после успеха показываем статус
      await generateImage(pendingPrompt, pendingAttachments);

      addMessage({
        role: 'user',
        content: pendingPrompt,
        attachments: pendingAttachments,
      });
      addMessage({
        role: 'assistant',
        content: 'Отправляю запрос как есть. Списание: 2 ⭐️звезды за генерацию.',
      });

      toast.success('Промпт отправлен без AI-ассистента');
      setShowPromptDecision(false);
      setPendingPrompt(null);
      setPendingAttachments([]);
    } catch (err: any) {
      console.error('[EditingPage] Error in handleUseOriginalPrompt:', err);
      if (isInsufficientBalanceError(err)) {
        openGenerationBalanceWarning();
        return;
      }
      toast.error(getGenerationErrorMessage(err));
    } finally {
      setDecisionLoadingTarget(null);
    }
  };

  const handleUseAiHelper = async () => {
    if (!pendingPrompt) {
      return;
    }
    if (pendingPrompt.trim().length > MAX_PROMPT_LENGTH) {
      toast.error(
        `Промпт превышает ${MAX_PROMPT_LENGTH} символов. Сократите текст, чтобы продолжить.`
      );
      return;
    }
    if (!ensureCanUseAssistant()) {
      return;
    }

    setDecisionLoadingTarget('ai');
    try {
      await sendMessage(pendingPrompt, pendingAttachments);
      toast.success('AI подготовил финальный промпт — отправьте на генерацию.');
      setShowPromptDecision(false);
      setPendingPrompt(null);
      setPendingAttachments([]);
    } catch (err: any) {
      if (isInsufficientBalanceError(err)) {
        openAssistantBalanceWarning();
        return;
      }
      toast.error(getGenerationErrorMessage(err));
    } finally {
      setDecisionLoadingTarget(null);
    }
  };

  const handleSelectPrompt = async (prompt: string, attachments?: ChatAttachment[]) => {
    if (prompt.trim().length > MAX_PROMPT_LENGTH) {
      toast.error(
        `Промпт превышает ${MAX_PROMPT_LENGTH} символов. Сократите текст, чтобы запустить генерацию.`
      );
      return;
    }
    if (!ensureCanGenerate()) {
      return;
    }
    try {
      await generateImage(prompt, attachments);
      toast.success('Изображение сгенерировано!');
    } catch (err: any) {
      if (isInsufficientBalanceError(err)) {
        openGenerationBalanceWarning();
        return;
      }
      toast.error(getGenerationErrorMessage(err));
    }
  };

  const handleResetSession = async () => {
    try {
      await resetSession();
      toast.success('Чат сброшен');
      setShowResetConfirm(false);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка сброса чата');
    }
  };

  const hasActiveSession = Boolean(sessionId);

  return (
    <AuthGuard>
      <Layout
        title="Генерация и редактирование фото"
        subtitle="По фото или с нуля по тексту"
        gradient="from-pink-500 to-orange-500"
        icon={
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
        }
      >
        <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
          {/* Reset button in header area (only when session active) */}
          {hasActiveSession && (
            <div className="max-w-4xl mx-auto px-4 py-2 w-full">
              <div className="flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                >
                  Сбросить чат
                </Button>
              </div>
            </div>
          )}

          {/* Main content */}
          {!hasActiveSession ? (
            // Upload screen
            <main className="flex-1 flex items-center justify-center px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-4xl xl:max-w-5xl w-full"
            >
              <div className="mb-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6, delay: 0.1 }}
                  className="inline-block mb-6"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-3xl blur-2xl opacity-50 animate-pulse-slow" />
                    <div className="relative bg-white rounded-3xl p-6 shadow-large">
                      <svg className="w-20 h-20 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl font-bold gradient-text mb-3"
                >
                  Загрузите изображение или начните с текста
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-dark-600 text-lg"
                >
                  Редактируйте существующее фото или генерируйте новое по текстовому описанию
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {prefillMessage && (
                  <div className="mb-6 rounded-2xl border border-primary-100 bg-white/80 p-4 text-sm text-dark-700 shadow-soft">
                    <p className="font-semibold text-dark-900 mb-1">
                      Промпт из примера уже добавлен
                    </p>
                    <p className="text-dark-600">
                      Загрузите фото или начните без фото. При необходимости промпт можно изменить.
                    </p>
                  </div>
                )}
                <FileUpload
                  onFileSelect={handleFileSelect}
                  isLoading={isUploadingImage || isStartingTextMode}
                  error={uploadError}
                  maxSize={40 * 1024 * 1024}
                  label="Базовое изображение (необязательно)"
                  hint="JPEG / PNG / WebP / HEIC, до 40MB (если файл больше 9MB — сожмём автоматически)."
                />
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleStartTextMode}
                    isLoading={isStartingTextMode}
                    disabled={isUploadingImage || isStartingTextMode}
                    fullWidth
                  >
                    Начать без фото (генерация по тексту)
                  </Button>
                </div>
              </motion.div>

              {/* Info cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                <Card variant="glass" hover padding="lg" className="h-full">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-dark-900 mb-2">AI-ассистент</h3>
                      <p className="text-sm text-dark-600">
                        Опишите задачу и при желании прикрепите референсы. Можно генерировать по тексту с нуля или редактировать загруженное фото. Промпт можно отправить как есть или улучшить через AI (рекомендуем {promptAssistantModel}, списывает 1 ⭐️звезду).
                      </p>
                    </div>
                  </div>
                </Card>

                <Card variant="glass" hover padding="lg" className="h-full">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-success-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-dark-900 mb-2">Прозрачная оплата</h3>
                      <p className="text-sm text-dark-600">
                        1 ⭐️звезда за сообщение AI. Генерация: 1 генерация по подписке или 2 ⭐️звезды без подписки.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card variant="glass" hover padding="lg" className="h-full">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h5m5 5H6a2 2 0 01-2-2V6a2 2 0 012-2h8l6 6v8a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-dark-900 mb-2">История чата</h3>
                      <p className="text-sm text-dark-600">
                        Сессия сохраняется: можно вернуться к переписке после перезагрузки, пока чат активен.
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
            </main>
          ) : (
            // Chat screen
            <>
              <ChatWindow
                messages={messages}
                currentPrompts={currentPrompts}
                onSelectPrompt={handleSelectPrompt}
                isGenerating={isGenerating}
                baseImageUrl={baseImage?.url}
              />

              <ChatInput
                onSend={handlePromptSubmit}
                disabled={isSendingMessage || isGenerating || decisionLoadingTarget !== null}
                placeholder="Опишите задачу для генерации или редактирования..."
                prefillMessage={prefillMessage}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                showAspectRatioSelect
              />
              <p className="text-xs text-dark-400 px-4 mb-6 max-w-4xl mx-auto">
                Сервис "AI Generator" не несёт ответственности за результаты сгенерированных изображений, так как генерация происходит на сторонних ресурсах с помощью ИИ.
              </p>
            </>
          )}

        <PromptDecisionModal
          prompt={pendingPrompt || ''}
          isOpen={showPromptDecision && Boolean(pendingPrompt)}
          onClose={() => {
            if (decisionLoadingTarget) return;
            setShowPromptDecision(false);
            setPendingPrompt(null);
            setPendingAttachments([]);
          }}
          onUseOriginal={handleUseOriginalPrompt}
          onUseAiHelper={handleUseAiHelper}
          modelName={promptAssistantModel}
          loadingTarget={decisionLoadingTarget}
        />

        <InsufficientBalanceModal
          isOpen={Boolean(balanceWarning)}
          title={balanceWarning?.title}
          description={balanceWarning?.description || ''}
          currentCredits={creditsBalance}
          requiredCredits={balanceWarning?.requiredCredits}
          requiredActions={balanceWarning?.requiredActions}
          onClose={() => setBalanceWarning(null)}
          onBuyCredits={handleBuyCredits}
          onBuySubscription={handleBuySubscription}
        />

        {/* Reset confirmation modal */}
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card variant="glass" padding="lg" className="max-w-sm w-full shadow-glow-primary">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-danger-500 to-warning-500 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-dark-900 ml-3">
                    Сбросить чат?
                  </h3>
                </div>
                <p className="text-dark-600 mb-6">
                  Вся история беседы будет удалена. Это действие нельзя отменить.
                </p>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowResetConfirm(false)}
                    fullWidth
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="danger"
                    size="lg"
                    onClick={handleResetSession}
                    fullWidth
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    }
                  >
                    Сбросить
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
        </div>
      </Layout>
    </AuthGuard>
  );
};
