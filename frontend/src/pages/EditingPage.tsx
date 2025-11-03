/**
 * Страница редактирования изображений через AI-чат
 * Интерактивный чат с AI-ассистентом для редактирования изображений
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChatWindow } from '../components/editing/ChatWindow';
import { ChatInput } from '../components/editing/ChatInput';
import { FileUpload } from '../components/common/FileUpload';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export const EditingPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    sessionId,
    baseImage,
    messages,
    currentPrompts,
    isSendingMessage,
    isGenerating,
    uploadAndCreateSession,
    sendMessage,
    generateImage,
    resetSession,
    uploadError,
    error,
    clearError,
  } = useChatStore();

  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // Сброс состояния при монтировании страницы
  useEffect(() => {
    // Не сбрасываем, если есть активная сессия (пользователь мог вернуться назад)
    // reset();
  }, []);

  // Обработка ошибок
  useEffect(() => {
    if (uploadError) {
      toast.error(uploadError);
      clearError();
    }
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [uploadError, error, clearError]);

  const handleFileSelect = async (file: File) => {
    setIsUploadingImage(true);
    clearError();

    try {
      await uploadAndCreateSession(file);
      toast.success('Изображение загружено! Начните беседу с AI-ассистентом.');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка загрузки изображения');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    try {
      await sendMessage(text);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка отправки сообщения');
    }
  };

  const handleSelectPrompt = async (prompt: string) => {
    try {
      await generateImage(prompt);
      toast.success('Изображение сгенерировано!');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка генерации изображения');
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

  const hasActiveSession = sessionId && baseImage;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-white/20 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-3"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">
                    AI Редактор
                  </h1>
                  <p className="text-sm text-dark-600">
                    Умный ассистент для фото
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-3"
              >
                {user && (
                  <Card variant="gradient" padding="sm" className="border border-primary-200">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary-700">
                        {user.balance_credits}
                      </p>
                      <p className="text-xs text-primary-600 font-semibold">кредитов</p>
                    </div>
                    {user.subscription_type && user.subscription_type !== 'none' && (
                      <Badge variant="primary" size="sm" className="mt-1">
                        {user.subscription_type}
                      </Badge>
                    )}
                  </Card>
                )}
                {hasActiveSession && (
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
                    Сбросить
                  </Button>
                )}
              </motion.div>
            </div>
          </div>
        </header>

        {/* Main content */}
        {!hasActiveSession ? (
          // Upload screen
          <main className="flex-1 flex items-center justify-center px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl w-full"
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
                  Загрузите изображение
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-dark-600 text-lg"
                >
                  Выберите фотографию, которую хотите отредактировать с помощью AI
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <FileUpload
                  onFileSelect={handleFileSelect}
                  isLoading={isUploadingImage}
                  error={uploadError}
                  label="Базовое изображение"
                  hint="JPEG или PNG, до 5MB"
                />
              </motion.div>

              {/* Info cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <Card variant="glass" hover padding="lg">
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
                        Опишите изменения естественным языком. AI предложит варианты промптов.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card variant="glass" hover padding="lg">
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
                        1 кредит за сообщение AI, 1 кредит за генерацию изображения.
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
              onSend={handleSendMessage}
              disabled={isSendingMessage || isGenerating}
              placeholder="Опишите, как хотите изменить изображение..."
            />
          </>
        )}

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
    </AuthGuard>
  );
};
